import { bookRepository, sessionRepository, progressRepository } from "@/lib/repositories";
import type { ReadingSession } from "@/lib/db/schema/reading-sessions";
import { rebuildStreak } from "@/lib/streaks";
import { revalidatePath } from "next/cache";
import { updateCalibreRating } from "@/lib/db/calibre-write";

/**
 * Status update data structure
 */
export interface StatusUpdateData {
  status: "to-read" | "read-next" | "reading" | "read";
  rating?: number | null;
  review?: string;
  startedDate?: Date;
  completedDate?: Date;
}

/**
 * Status update result
 */
export interface StatusUpdateResult {
  session: ReadingSession;
  sessionArchived?: boolean;
  archivedSessionNumber?: number;
}

/**
 * SessionService - Handles reading session lifecycle and status transitions
 * 
 * Responsibilities:
 * - Session CRUD operations
 * - Status transitions with validation
 * - Backward movement detection and session archival
 * - Re-reading workflow
 * - Integration with streak system
 * - Cache invalidation
 */
export class SessionService {
  /**
   * Get active reading session for a book
   */
  async getActiveSession(bookId: number): Promise<ReadingSession | null> {
    const session = await sessionRepository.findActiveByBookId(bookId);
    return session || null;
  }

  /**
   * Get all sessions for a book (ordered by session number descending)
   */
  async getAllSessionsForBook(bookId: number): Promise<ReadingSession[]> {
    return sessionRepository.findAllByBookId(bookId);
  }

  /**
   * Update book reading status (main workflow)
   * Handles: status transitions, backward movement, session archival, rating updates
   */
  async updateStatus(bookId: number, statusData: StatusUpdateData): Promise<StatusUpdateResult> {
    const { status, rating, review, startedDate, completedDate } = statusData;

    // Validate status
    const validStatuses = ["to-read", "read-next", "reading", "read"];
    if (!validStatuses.includes(status)) {
      throw new Error("Invalid status. Must be 'to-read', 'read-next', 'reading', or 'read'");
    }

    // Verify book exists
    const book = await bookRepository.findById(bookId);
    if (!book) {
      throw new Error("Book not found");
    }

    // Find active reading session or prepare to create new one
    let readingSession = await sessionRepository.findActiveByBookId(bookId);

    // Detect "backward movement" from "reading" to planning statuses
    const isBackwardMovement =
      readingSession &&
      readingSession.status === "reading" &&
      (status === "read-next" || status === "to-read");

    // Check if current session has progress
    let hasProgress = false;
    if (isBackwardMovement && readingSession) {
      hasProgress = await progressRepository.hasProgressForSession(readingSession.id);
    }

    // If moving backward with progress, archive current session and create new one
    if (isBackwardMovement && hasProgress && readingSession) {
      const { getLogger } = require("@/lib/logger");
      getLogger().info(`[SessionService] Archiving session #${readingSession.sessionNumber} and creating new session for backward movement`);

      // Archive current session
      await sessionRepository.archive(readingSession.id);

      // Create new session with new status
      const newSessionNumber = readingSession.sessionNumber + 1;
      const newSession = await sessionRepository.create({
        userId: readingSession.userId,
        bookId,
        sessionNumber: newSessionNumber,
        status: status as any,
        isActive: true,
      });

      // Rebuild streak to ensure consistency
      await this.updateStreakSystem();

      // Invalidate cache
      await this.invalidateCache(bookId);

      return {
        session: newSession,
        sessionArchived: true,
        archivedSessionNumber: readingSession.sessionNumber,
      };
    }

    // Otherwise, proceed with normal update/create logic
    const updateData: any = {
      status,
    };

    // Set dates based on status
    if (status === "reading" && !readingSession?.startedDate) {
      updateData.startedDate = startedDate || new Date();
    }

    if (status === "read") {
      if (!updateData.startedDate && !readingSession?.startedDate) {
        updateData.startedDate = startedDate || new Date();
      }
      updateData.completedDate = completedDate || new Date();
      // Auto-archive session when marked as read
      updateData.isActive = false;
    }

    if (review !== undefined) {
      updateData.review = review;
    }

    if (readingSession) {
      // Update existing session
      readingSession = await sessionRepository.update(readingSession.id, updateData);
      
      if (!readingSession) {
        throw new Error("Failed to update session");
      }
    } else {
      // Create new session (first time reading this book)
      const sessionNumber = await sessionRepository.getNextSessionNumber(bookId);

      readingSession = await sessionRepository.create({
        bookId,
        sessionNumber,
        isActive: true,
        ...updateData,
      });
    }

    // Update book rating if provided (single source of truth: books table)
    if (rating !== undefined) {
      try {
        // Sync to Calibre first (best effort)
        updateCalibreRating(book.calibreId, rating);
        const { getLogger } = require("@/lib/logger");
        getLogger().info(`[SessionService] Synced rating to Calibre for book ${bookId} (calibreId: ${book.calibreId}): ${rating ?? 'removed'}`);
      } catch (calibreError) {
        // Log error but continue with status update
        const { getLogger } = require("@/lib/logger");
        getLogger().error({ err: calibreError }, `[SessionService] Failed to sync rating to Calibre for book ${bookId}`);
      }
      
      // Update Tome database
      await bookRepository.update(bookId, { rating: rating ?? null });
    }

    // Invalidate cache
    await this.invalidateCache(bookId);

    return { session: readingSession };
  }

  /**
   * Start a re-read of a book (creates new active session)
   */
  async startReread(bookId: number): Promise<ReadingSession> {
    // Verify book has completed reads (business rule enforcement)
    const hasCompletedReads = await sessionRepository.hasCompletedReads(bookId);
    if (!hasCompletedReads) {
      throw new Error("Cannot start re-read: no completed reads found");
    }

    // Get most recent completed session to preserve userId
    const previousSession = await sessionRepository.findMostRecentCompletedByBookId(bookId);

    // Get next session number
    const sessionNumber = await sessionRepository.getNextSessionNumber(bookId);

    // Create new reading session (preserve userId from previous session)
    const newSession = await sessionRepository.create({
      bookId,
      sessionNumber,
      status: "reading",
      isActive: true,
      startedDate: new Date(),
      userId: previousSession?.userId ?? null,
    });

    // Invalidate cache
    await this.invalidateCache(bookId);

    return newSession;
  }

  /**
   * Update session date (startedDate or completedDate)
   */
  async updateSessionDate(
    sessionId: number,
    field: "startedDate" | "completedDate",
    date: Date
  ): Promise<ReadingSession> {
    const session = await sessionRepository.findById(sessionId);
    if (!session) {
      throw new Error("Session not found");
    }

    const updated = await sessionRepository.update(sessionId, {
      [field]: date,
    } as any);

    if (!updated) {
      throw new Error("Failed to update session date");
    }

    // Invalidate cache
    await this.invalidateCache(session.bookId);

    return updated;
  }

  /**
   * Update streak system (best effort)
   */
  private async updateStreakSystem(): Promise<void> {
    try {
      const { getLogger } = require("@/lib/logger");
      getLogger().info("[SessionService] Rebuilding streak after session change");
      await rebuildStreak();
    } catch (streakError) {
      const { getLogger } = require("@/lib/logger");
      getLogger().error({ err: streakError }, "[SessionService] Failed to rebuild streak");
      // Don't fail the request if streak rebuild fails
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
      getLogger().error({ err: error }, "[SessionService] Failed to invalidate cache");
      // Don't fail the request if cache invalidation fails
    }
  }
}
