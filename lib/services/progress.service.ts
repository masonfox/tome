import { bookRepository, sessionRepository, progressRepository } from "@/lib/repositories";
import type { ProgressLog } from "@/lib/db/schema/progress-logs";
import { validateProgressTimeline, validateProgressEdit } from "./progress-validation";
import { streakService } from "@/lib/services/streak.service";
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
 * Progress log result with completion flag
 */
export interface ProgressLogResult {
  progressLog: ProgressLog;
  shouldShowCompletionModal: boolean;
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
  async logProgress(bookId: number, progressData: ProgressLogData): Promise<ProgressLogResult> {
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

    // Check if book is completed (100% progress) but DON'T auto-complete
    const shouldShowCompletionModal = this.shouldShowCompletionModal(activeSession.status, metrics.currentPercentage);

    // Invalidate cache
    await this.invalidateCache(bookId);

    return {
      progressLog,
      shouldShowCompletionModal,
    };
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
    // Only pass the value that was actually updated to calculateProgressMetrics
    // If both are undefined, use existing values
    const progressData: ProgressLogData = {
      currentPage: updateData.currentPage,
      currentPercentage: updateData.currentPercentage,
      progressDate: updateData.progressDate ?? existingProgress.progressDate,
      notes: updateData.notes ?? (existingProgress.notes || undefined),
    };

    // If neither was provided in the update, use existing values
    if (progressData.currentPage === undefined && progressData.currentPercentage === undefined) {
      progressData.currentPage = existingProgress.currentPage || undefined;
      progressData.currentPercentage = existingProgress.currentPercentage || undefined;
    }

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
    await this.invalidateCache(existingProgress.bookId);

    return updated;
  }

  /**
   * Delete progress entry
   */
  async deleteProgress(progressId: number): Promise<boolean> {
    // Get the progress entry first to obtain bookId for cache invalidation
    const progressEntry = await progressRepository.findById(progressId);
    const bookId = progressEntry?.bookId;
    
    const result = await progressRepository.delete(progressId);
    
    if (result && bookId) {
      // Rebuild streak after progress deletion
      await this.updateStreakSystem();
      
      // Invalidate cache
      await this.invalidateCache(bookId);
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
   * Check if completion modal should be shown
   * Returns true if book just reached 100% progress while in "reading" status
   */
  private shouldShowCompletionModal(sessionStatus: string, percentage: number): boolean {
    // Show modal if book reached 100% and is currently being read
    // Note: We use >= 100 here because percentage is already calculated with Math.floor,
    // and only reaching the last page will result in exactly 100%
    return percentage >= 100 && sessionStatus === "reading";
  }

  /**
   * Update streak system (best effort)
   */
  private async updateStreakSystem(): Promise<void> {
    try {
      const { getLogger } = require("@/lib/logger");
      const logger = getLogger();
      logger.info("[ProgressService] Rebuilding streak after progress log change");
      const updatedStreak = await streakService.rebuildStreak();
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
  private async invalidateCache(bookId: number): Promise<void> {
    try {
      revalidatePath("/"); // Dashboard
      revalidatePath("/library"); // Library page
      revalidatePath("/stats"); // Stats page
      revalidatePath(`/books/${bookId}`); // Book detail page
    } catch (error) {
            const { getLogger } = require("@/lib/logger");
      getLogger().error({ err: error }, "[ProgressService] Failed to invalidate cache");
      // Don't fail the request if cache invalidation fails
    }
  }
}
