import { bookRepository, sessionRepository, progressRepository } from "@/lib/repositories";
import type { ProgressLog } from "@/lib/db/schema/progress-logs";
import { validateProgressTimeline, validateProgressEdit } from "./progress-validation";
import { rebuildStreak } from "@/lib/streaks";
import { revalidatePath } from "next/cache";
import { 
  calculatePercentage, 
  calculatePageFromPercentage
} from "@/lib/utils/progress-calculations";

/**
 * Progress log data for creating new entries
 */
export interface ProgressLogData {
  currentPage?: number;
  currentPercentage?: number;
  notes?: string;
  progressDate?: Date;
}

/**
 * Progress update data for editing existing entries
 */
export interface ProgressUpdateData {
  currentPage?: number;
  currentPercentage?: number;
  notes?: string;
  progressDate?: Date;
}

/**
 * Calculated progress metrics
 */
interface ProgressMetrics {
  currentPage: number;
  currentPercentage: number;
  pagesRead: number;
}

/**
 * ProgressService - Handles progress logging, validation, and calculations
 * 
 * Responsibilities:
 * - Progress CRUD operations
 * - Temporal validation (progress timeline consistency)
 * - Progress calculations (pages read, percentage)
 * - Auto-completion detection (100% progress)
 * - Integration with streak system
 */
export class ProgressService {
  /**
   * Get progress for a specific session
   */
  async getProgressForSession(sessionId: number): Promise<ProgressLog[]> {
    return progressRepository.findBySessionId(sessionId);
  }

  /**
   * Get progress for the active session of a book
   */
  async getProgressForActiveSession(bookId: number): Promise<ProgressLog[]> {
    const activeSession = await sessionRepository.findActiveByBookId(bookId);
    
    if (!activeSession) {
      return [];
    }

    return progressRepository.findBySessionId(activeSession.id);
  }

  /**
   * Log new progress entry
   */
  async logProgress(bookId: number, progressData: ProgressLogData): Promise<ProgressLog> {
    const { currentPage, currentPercentage, notes, progressDate } = progressData;

    // Validate input
    if (currentPage === undefined && currentPercentage === undefined) {
      throw new Error("Either currentPage or currentPercentage is required");
    }

    // Verify book exists
    const book = await bookRepository.findById(bookId);
    if (!book) {
      throw new Error("Book not found");
    }

    // Get the active reading session
    const activeSession = await sessionRepository.findActiveByBookId(bookId);
    if (!activeSession) {
      throw new Error("No active reading session found. Please set a reading status first.");
    }

    // Only allow progress logging for books currently being read
    if (activeSession.status !== "reading") {
      throw new Error("Can only log progress for books with 'reading' status");
    }

    // Get the last progress entry for this session to calculate pages read
    const lastProgress = await progressRepository.findLatestBySessionId(activeSession.id);

    // Calculate progress metrics
    const metrics = await this.calculateProgressMetrics(book, progressData, lastProgress);

    // Temporal validation: Check if progress is consistent with existing timeline
    const requestedDate = progressDate || new Date();
    const usePercentage = currentPercentage !== undefined;
    const progressValue = usePercentage ? metrics.currentPercentage : metrics.currentPage;
    
    const validationResult = await validateProgressTimeline(
      activeSession.id,
      requestedDate,
      progressValue,
      usePercentage
    );

    if (!validationResult.valid) {
      throw new Error(validationResult.error);
    }

    // Create progress log
    const progressLog = await progressRepository.create({
      bookId,
      sessionId: activeSession.id,
      currentPage: metrics.currentPage,
      currentPercentage: metrics.currentPercentage,
      progressDate: requestedDate,
      notes,
      pagesRead: metrics.pagesRead,
    });

    // Touch the session to update its updatedAt timestamp (for sorting on dashboard)
    await sessionRepository.update(activeSession.id, {
      updatedAt: new Date(),
    } as any);

    // Update streak system
    await this.updateStreakSystem();

    // Check for auto-completion
    await this.checkForCompletion(activeSession.id, metrics.currentPercentage);

    // Invalidate cache
    await this.invalidateCache();

    return progressLog;
  }

  /**
   * Update existing progress entry
   */
  async updateProgress(progressId: number, updateData: ProgressUpdateData): Promise<ProgressLog> {
    // Get existing progress entry
    const existingProgress = await progressRepository.findById(progressId);
    if (!existingProgress) {
      throw new Error("Progress entry not found");
    }

    // Get book and session
    const book = await bookRepository.findById(existingProgress.bookId);
    if (!book) {
      throw new Error("Book not found");
    }

    if (!existingProgress.sessionId) {
      throw new Error("Progress entry has no session");
    }

    const session = await sessionRepository.findById(existingProgress.sessionId);
    if (!session) {
      throw new Error("Session not found");
    }

    // Calculate new metrics
    const progressData: ProgressLogData = {
      currentPage: updateData.currentPage ?? (existingProgress.currentPage || undefined),
      currentPercentage: updateData.currentPercentage ?? (existingProgress.currentPercentage || undefined),
      progressDate: updateData.progressDate ?? existingProgress.progressDate,
      notes: updateData.notes ?? (existingProgress.notes || undefined),
    };

    const metrics = await this.calculateProgressMetrics(book, progressData);

    // Validate updated position in timeline (exclude this entry from validation)
    const requestedDate = updateData.progressDate || new Date(existingProgress.progressDate);
    const usePercentage = updateData.currentPercentage !== undefined;
    const progressValue = usePercentage ? metrics.currentPercentage : metrics.currentPage;
    
    const validationResult = await validateProgressEdit(
      progressId,
      session.id,
      requestedDate,
      progressValue,
      usePercentage
    );

    if (!validationResult.valid) {
      const error: any = new Error(validationResult.error);
      error.conflictingEntry = validationResult.conflictingEntry;
      throw error;
    }

    // Get previous progress entry (chronologically before this one) to calculate pagesRead
    const allProgress = await progressRepository.findBySessionId(session.id);
    const sortedProgress = allProgress
      .filter(p => p.id !== progressId) // Exclude the entry being edited
      .sort((a, b) => new Date(a.progressDate).getTime() - new Date(b.progressDate).getTime());
    
    // Find the entry immediately before this one by date
    const previousProgress = sortedProgress.find(
      p => new Date(p.progressDate).getTime() < requestedDate.getTime()
    );
    
    // Recalculate pagesRead based on previous entry
    const pagesRead = previousProgress
      ? Math.max(0, metrics.currentPage - (previousProgress.currentPage || 0))
      : metrics.currentPage;

    // Update progress entry
    const updated = await progressRepository.update(progressId, {
      currentPage: metrics.currentPage,
      currentPercentage: metrics.currentPercentage,
      progressDate: requestedDate,
      notes: updateData.notes ?? (existingProgress.notes || undefined),
      pagesRead,
    } as any);

    if (!updated) {
      throw new Error("Failed to update progress entry");
    }

    // Rebuild streak after progress update
    await this.updateStreakSystem();

    // Invalidate cache
    await this.invalidateCache();

    return updated;
  }

  /**
   * Delete progress entry
   */
  async deleteProgress(progressId: number): Promise<boolean> {
    const result = await progressRepository.delete(progressId);
    
    if (result) {
      // Rebuild streak after progress deletion
      await this.updateStreakSystem();
      
      // Invalidate cache
      await this.invalidateCache();
    }
    
    return result;
  }

  /**
   * Calculate progress metrics (currentPage, currentPercentage, pagesRead)
   */
  private async calculateProgressMetrics(
    book: any,
    progressData: ProgressLogData,
    lastProgress?: ProgressLog | null
  ): Promise<ProgressMetrics> {
    const { currentPage, currentPercentage } = progressData;

    let finalCurrentPage = currentPage ?? 0;
    let finalCurrentPercentage = currentPercentage ?? 0;

    // Calculate based on what was provided
    if (currentPage !== undefined && book.totalPages) {
      finalCurrentPercentage = calculatePercentage(currentPage, book.totalPages);
    } else if (currentPercentage !== undefined && book.totalPages) {
      finalCurrentPage = calculatePageFromPercentage(currentPercentage, book.totalPages);
    } else if (currentPage !== undefined) {
      finalCurrentPercentage = 0; // Can't calculate without total pages
    }

    // Calculate pages read since last progress
    const pagesRead = lastProgress
      ? Math.max(0, finalCurrentPage - (lastProgress.currentPage || 0))
      : finalCurrentPage;

    return {
      currentPage: finalCurrentPage,
      currentPercentage: finalCurrentPercentage,
      pagesRead,
    };
  }

  /**
   * Check if book is completed and auto-update session status
   */
  private async checkForCompletion(sessionId: number, percentage: number): Promise<void> {
    // If book is completed (100%), update session status to "read"
    // Note: We use >= 100 here because percentage is already calculated with Math.floor,
    // and only reaching the last page will result in exactly 100%
    if (percentage >= 100) {
      const session = await sessionRepository.findById(sessionId);
      
      if (session && session.status === "reading") {
        await sessionRepository.update(sessionId, {
          status: "read",
          completedDate: new Date(),
        } as any);
        
        const { getLogger } = require("@/lib/logger");
        getLogger().info(`[ProgressService] Book completed, session status updated to 'read'`);
      }
    }
  }

  /**
   * Update streak system (best effort)
   */
  private async updateStreakSystem(): Promise<void> {
    try {
      const { getLogger } = require("@/lib/logger");
      const logger = getLogger();
      logger.info("[ProgressService] Rebuilding streak after progress log change");
      const updatedStreak = await rebuildStreak();
      logger.info("[ProgressService] Streak rebuilt:", {
        currentStreak: updatedStreak.currentStreak,
        longestStreak: updatedStreak.longestStreak,
        totalDaysActive: updatedStreak.totalDaysActive,
      });
    } catch (streakError) {
      const { getLogger } = require("@/lib/logger");
      getLogger().error({ err: streakError }, "[ProgressService] Failed to rebuild streak");
      // Don't fail the entire request if streak rebuild fails
    }
  }

  /**
   * Invalidate Next.js cache for relevant pages
   */
  private async invalidateCache(): Promise<void> {
    try {
      revalidatePath("/"); // Dashboard
      revalidatePath("/stats"); // Stats page
    } catch (error) {
            const { getLogger } = require("@/lib/logger");
      getLogger().error({ err: error }, "[ProgressService] Failed to invalidate cache");
      // Don't fail the request if cache invalidation fails
    }
  }
}
