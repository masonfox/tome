import { bookRepository, sessionRepository, progressRepository } from "@/lib/repositories";
import type { Book } from "@/lib/db/schema/books";
import type { ReadingSession } from "@/lib/db/schema/reading-sessions";
import type { ProgressLog } from "@/lib/db/schema/progress-logs";
import type { BookFilter } from "@/lib/repositories/book.repository";
import { updateCalibreRating } from "@/lib/db/calibre-write";

/**
 * Book with enriched details (session, progress, read count)
 */
export interface BookWithDetails extends Book {
  activeSession: ReadingSession | null;
  latestProgress: ProgressLog | null;
  hasCompletedReads: boolean;
  totalReads: number;
}

/**
 * BookService - Handles book CRUD operations and metadata updates
 * 
 * Responsibilities:
 * - Book retrieval with enriched details
 * - Metadata updates (totalPages, rating)
 * - Book filtering and search
 * - Tags management
 * - Calibre rating sync
 */
export class BookService {
  /**
   * Get a book by ID with enriched details (session, progress, read count)
   * OPTIMIZED: Uses single query instead of 3 separate queries
   */
  async getBookById(bookId: number): Promise<BookWithDetails | null> {
    const result = await bookRepository.findByIdWithDetails(bookId);

    if (!result) {
      return null;
    }

    return {
      ...result.book,
      activeSession: result.activeSession,
      latestProgress: result.latestProgress,
      hasCompletedReads: result.totalReads > 0,
      totalReads: result.totalReads,
    };
  }

  /**
   * Get books with filters and pagination
   */
  async getBooksByFilters(
    filters: BookFilter,
    limit: number = 50,
    skip: number = 0,
    sortBy?: string
  ): Promise<{ books: Book[]; total: number }> {
    return bookRepository.findWithFilters(filters, limit, skip, sortBy);
  }

  /**
   * Get all unique tags from all books
   */
  async getAllTags(): Promise<string[]> {
    return bookRepository.getAllTags();
  }

  /**
   * Update total pages for a book
   * Also recalculates progress percentages for all active reading sessions
   * Uses transaction to ensure atomicity (rollback if recalculation fails)
   */
  async updateTotalPages(bookId: number, totalPages: number): Promise<Book> {
    // Validate input
    if (!totalPages || totalPages <= 0) {
      throw new Error("Total pages must be a positive number");
    }

    // Find book
    const book = await bookRepository.findById(bookId);
    if (!book) {
      throw new Error("Book not found");
    }

    // Import dependencies inside method to avoid circular imports
    const { getDatabase } = await import("@/lib/db/context");
    const { calculatePercentage } = await import("@/lib/utils/progress-calculations");
    const { getLogger } = await import("@/lib/logger");
    const { books } = await import("@/lib/db/schema/books");
    const { readingSessions } = await import("@/lib/db/schema/reading-sessions");
    const { progressLogs } = await import("@/lib/db/schema/progress-logs");
    const { eq, and } = await import("drizzle-orm");

    const logger = getLogger();
    const db = getDatabase(); // Get the correct database instance (test or production)

    // Use transaction for atomic update + recalculation
    // NOTE: better-sqlite3 requires synchronous transaction callbacks (no async/await)
    // Bun's sqlite supports async, but Drizzle handles the difference
    try {
      return await db.transaction((tx) => {

        // 1. Update book's totalPages using transaction
        const [updated] = tx
          .update(books)
          .set({ totalPages })
          .where(eq(books.id, bookId))
          .returning()
          .all();

        if (!updated) {
          throw new Error("Failed to update total pages");
        }

        // 2. Find active sessions for this book using transaction
        const activeSessions = tx
          .select()
          .from(readingSessions)
          .where(
            and(
              eq(readingSessions.bookId, bookId),
              eq(readingSessions.isActive, true),
              eq(readingSessions.status, 'reading')
            )
          )
          .all();

        // 3. For each active session, recalculate progress log percentages
        let totalLogsUpdated = 0;
        for (const session of activeSessions) {
          // Get progress logs for this session
          const logs = tx
            .select()
            .from(progressLogs)
            .where(eq(progressLogs.sessionId, session.id))
            .all();

          // Update each log with new percentage
          for (const log of logs) {
            const newPercentage = calculatePercentage(log.currentPage, totalPages);
            tx
              .update(progressLogs)
              .set({ currentPercentage: newPercentage })
              .where(eq(progressLogs.id, log.id))
              .run();
            totalLogsUpdated++;
          }
        }

        // Log for debugging/monitoring
        logger.info({
          bookId,
          totalPages,
          activeSessionsCount: activeSessions.length,
          progressLogsUpdated: totalLogsUpdated
        }, "[BookService] Updated total pages and recalculated progress");

        return updated;
      });
    } catch (error) {
      const { getLogger } = await import("@/lib/logger");
      getLogger().error({ err: error, bookId }, "[BookService] Failed to update total pages");
      throw new Error("Failed to update page count. Please try again.");
    }
  }

  /**
   * Update rating for a book (syncs with Calibre)
   */
  async updateRating(bookId: number, rating: number | null): Promise<Book> {
    // Validate input
    if (rating !== null && (rating < 1 || rating > 5)) {
      throw new Error("Rating must be between 1 and 5");
    }

    // Find book
    const book = await bookRepository.findById(bookId);
    if (!book) {
      throw new Error("Book not found");
    }

    // Sync to Calibre first (best effort)
    try {
      await this.syncRatingToCalibre(book.calibreId, rating);
    } catch (error) {
      // Log error but continue - rating will be out of sync until next Calibre sync
      const { getLogger } = require("@/lib/logger");
      getLogger().error({ err: error }, `[BookService] Failed to sync rating to Calibre for book ${bookId}`);
    }

    // Update in Tome database
    const updated = await bookRepository.update(bookId, { rating });
    
    if (!updated) {
      throw new Error("Failed to update rating");
    }

    return updated;
  }

  /**
   * Enrich a book with session, progress, and read count details
   * DEPRECATED: Replaced by optimized single-query approach in getBookById
   * Kept temporarily for reference/rollback purposes
   */
  private async enrichBookWithDetails_OLD(book: Book): Promise<BookWithDetails> {
    // Get active session
    const activeSession = await sessionRepository.findActiveByBookId(book.id);

    // Get latest progress (only for active session)
    let latestProgress: ProgressLog | null = null;
    if (activeSession) {
      latestProgress = await progressRepository.findLatestBySessionId(activeSession.id) || null;
    }

    // Count completed reads
    const totalReads = await sessionRepository.countCompletedReadsByBookId(book.id);

    return {
      ...book,
      activeSession: activeSession || null,
      latestProgress,
      hasCompletedReads: totalReads > 0,
      totalReads,
    };
  }

  /**
   * Sync rating to Calibre (best effort)
   */
  private async syncRatingToCalibre(calibreId: number, rating: number | null): Promise<void> {
    try {
      updateCalibreRating(calibreId, rating);
      const { getLogger } = require("@/lib/logger");
      getLogger().info(`[BookService] Synced rating to Calibre (calibreId: ${calibreId}): ${rating ?? 'removed'}`);
    } catch (error) {
      const { getLogger } = require("@/lib/logger");
      getLogger().error({ err: error, calibreId }, `[BookService] Failed to sync rating to Calibre`);
      throw error;
    }
  }
}
