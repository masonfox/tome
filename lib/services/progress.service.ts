import { bookRepository, sessionRepository, progressRepository } from "@/lib/repositories";
import type { ProgressLog } from "@/lib/db/schema/progress-logs";
import { validateProgressTimeline, validateProgressEdit } from "./progress-validation";
import { streakService } from "@/lib/services/streak.service";
import { SessionService } from "@/lib/services/session.service";
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
  completedSessionId?: number; // Session ID when auto-completed (for updating review)
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
   * Get progress logs for a specific reading session
   * 
   * Returns all progress entries for the session, ordered by progress date (most recent first).
   * 
   * @param sessionId - The ID of the reading session
   * @returns Promise resolving to array of progress logs
   * @throws {Error} If database query fails
   * 
   * @example
   * const progress = await progressService.getProgressForSession(42);
   * // returns: [{ id: 1, currentPage: 100, progressDate: ..., }, ...]
   */
  async getProgressForSession(sessionId: number): Promise<ProgressLog[]> {
    return progressRepository.findBySessionId(sessionId);
  }

  /**
   * Get progress logs for the active reading session of a book
   * 
   * Finds the active session for the book and returns all its progress entries.
   * Returns empty array if the book has no active session.
   * 
   * @param bookId - The ID of the book
   * @returns Promise resolving to array of progress logs (empty if no active session)
   * @throws {Error} If database query fails
   * 
   * @example
   * const progress = await progressService.getProgressForActiveSession(123);
   * // returns: [{ currentPage: 50, progressDate: ..., }, ...]
   */
  async getProgressForActiveSession(bookId: number): Promise<ProgressLog[]> {
    const activeSession = await sessionRepository.findActiveByBookId(bookId);
    
    if (!activeSession) {
      return [];
    }

    return progressRepository.findBySessionId(activeSession.id);
  }

  /**
   * Log new progress entry for a book
   * 
   * Creates a new progress log entry for the book's active reading session.
   * Automatically calculates pages read, validates timeline consistency,
   * updates streak system, and detects completion (100% progress).
   * 
   * Timeline Validation:
   * - Progress date must not create chronological conflicts
   * - Progress value must be consistent with surrounding entries
   * - See `validateProgressTimeline` for detailed rules
   * 
   * Completion Detection:
   * - When progress reaches 100%, returns `shouldShowCompletionModal: true`
   * - Does NOT auto-complete the book (requires explicit user action)
   * - Modal allows user to mark book as finished or continue reading
   * 
   * @param bookId - The ID of the book to log progress for
   * @param progressData - Progress data (page or percentage, optional notes and date)
   * @returns Promise resolving to progress log result with completion flag
   * @throws {Error} If book not found, no active session, invalid status, or timeline validation fails
   * 
   * @example
   * // Log progress by page number
   * const result = await progressService.logProgress(123, {
   *   currentPage: 150,
   *   notes: "Great chapter!",
   *   progressDate: new Date()
   * });
   * 
   * if (result.shouldShowCompletionModal) {
   *   // Show "You've finished the book!" modal
   * }
   * 
   * @example
   * // Log progress by percentage
   * const result = await progressService.logProgress(123, {
   *   currentPercentage: 75
   * });
   */
  async logProgress(bookId: number, progressData: ProgressLogData, tx?: any): Promise<ProgressLogResult> {
    const { currentPage, currentPercentage, notes, progressDate } = progressData;

    // Validate input
    if (currentPage === undefined && currentPercentage === undefined) {
      throw new Error("Either currentPage or currentPercentage is required");
    }

    // Verify book exists
    const book = await bookRepository.findById(bookId, tx);
    if (!book) {
      throw new Error("Book not found");
    }

    // Get the active reading session
    const activeSession = await sessionRepository.findActiveByBookId(bookId, tx);
    if (!activeSession) {
      throw new Error("No active reading session found. Please set a reading status first.");
    }

    // Only allow progress logging for books currently being read
    if (activeSession.status !== "reading") {
      throw new Error("Can only log progress for books with 'reading' status");
    }

    // Get the last progress entry for this session to calculate pages read
    const lastProgress = await progressRepository.findLatestBySessionId(activeSession.id, tx);

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
    }, tx);

    // Touch the session to update its updatedAt timestamp (for sorting on dashboard)
    await sessionRepository.update(activeSession.id, {
      updatedAt: new Date(),
    } as any, tx);

    // Update streak system (only if not in transaction)
    if (!tx) {
      await this.updateStreakSystem();
    }

    // Check if book is completed (100% progress) and auto-transition to "read" status
    const shouldShowCompletionModal = this.shouldShowCompletionModal(activeSession.status, metrics.currentPercentage);

    let completedSessionId: number | undefined;
    if (shouldShowCompletionModal) {
      // Auto-complete the book with the progress date as the completion date
      const { getLogger } = require("@/lib/logger");
      const logger = getLogger();
      logger.info({ bookId, progressDate: requestedDate }, 'Auto-completing book at 100% progress');

      // IMPORTANT: Use direct repository call instead of creating new SessionService
      // to avoid circular dependency and maintain transaction context
      await sessionRepository.update(activeSession.id, {
        status: "read",
        completedDate: requestedDate,  // Use the progress date, including backdated entries!
        isActive: false,
      } as any, tx);

      // Return the session ID so the completion modal can update the review on this session
      completedSessionId = activeSession.id;
    }

    // Invalidate cache (only if not in transaction)
    if (!tx) {
      await this.invalidateCache(bookId);
    }

    return {
      progressLog,
      shouldShowCompletionModal,
      completedSessionId,
    };
  }

  /**
   * Update an existing progress entry
   * 
   * Allows editing of progress logs to correct mistakes or adjust historical data.
   * Recalculates metrics and validates timeline consistency after the update.
   * 
   * Timeline Validation:
   * - Updated entry must not create chronological conflicts with neighbors
   * - Progress value must be consistent with surrounding entries
   * - Date changes are validated to ensure logical progression
   * 
   * @param progressId - The ID of the progress entry to update
   * @param updateData - Updated progress data (page, percentage, notes, or date)
   * @returns Promise resolving to the updated progress log
   * @throws {Error} If progress not found, book/session missing, or validation fails
   * 
   * @example
   * // Correct a typo in page number
   * const updated = await progressService.updateProgress(42, {
   *   currentPage: 151 // was 150
   * });
   * 
   * @example
   * // Add retroactive notes
   * const updated = await progressService.updateProgress(42, {
   *   notes: "Added notes later"
   * });
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
   * Delete a progress entry
   * 
   * Removes a progress log entry and updates the streak system accordingly.
   * Invalidates relevant caches to ensure UI reflects the deletion.
   * 
   * Use Cases:
   * - Remove accidental/duplicate progress logs
   * - Delete invalid entries
   * - Bulk cleanup of incorrect data
   * 
   * @param progressId - The ID of the progress entry to delete
   * @returns Promise resolving to true if deleted, false if not found
   * @throws {Error} If database operation fails
   * 
   * @example
   * const deleted = await progressService.deleteProgress(42);
   * if (deleted) {
   *   console.log('Progress entry removed');
   * }
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
      // Lazy import to avoid mock pollution in tests
      const { revalidatePath } = await import("next/cache");
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

/**
 * Default ProgressService instance
 * Use this in API routes, services, and other application code
 */
export const progressService = new ProgressService();
