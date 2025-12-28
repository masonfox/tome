import { bookRepository, sessionRepository, progressRepository } from "@/lib/repositories";
import type { Book } from "@/lib/db/schema/books";
import type { ReadingSession } from "@/lib/db/schema/reading-sessions";
import type { ProgressLog } from "@/lib/db/schema/progress-logs";
import type { BookFilter } from "@/lib/repositories/book.repository";
import { updateCalibreRating, updateCalibreTags } from "@/lib/db/calibre-write";

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
   * 
   * OPTIMIZED: Uses single query instead of 3 separate queries
   * 
   * @param bookId - The ID of the book to retrieve
   * @returns Promise resolving to the book with enriched details, or null if not found
   * @throws {Error} If database query fails
   * 
   * @example
   * const book = await bookService.getBookById(123);
   * if (book) {
   *   console.log(`Book: ${book.title}, Active session: ${book.activeSession !== null}`);
   * }
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
   * 
   * @param filters - Filter criteria for books (status, tags, search, rating, series)
   * @param limit - Maximum number of books to return (default: 50)
   * @param skip - Number of books to skip for pagination (default: 0)
   * @param sortBy - Sort criteria (optional)
   * @returns Promise resolving to object with filtered books array and total count
   * 
   * @example
   * const { books, total } = await bookService.getBooksByFilters(
   *   { status: 'reading', tags: ['fiction'] },
   *   20,
   *   0,
   *   'title'
   * );
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
   * Get all unique tags from all books in the library
   * 
   * Tags are extracted from the books.tags array field and deduplicated.
   * Useful for filter dropdowns and tag clouds.
   * 
   * @returns Promise resolving to array of unique tag strings, sorted alphabetically
   * 
   * @example
   * const tags = await bookService.getAllTags();
   * // returns: ['fiction', 'non-fiction', 'sci-fi', ...]
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

    // Validate that new page count doesn't contradict existing progress in active sessions
    const highestCurrentPage = await progressRepository.getHighestCurrentPageForActiveSessions(bookId);

    if (highestCurrentPage > totalPages) {
      throw new Error(
        `Cannot reduce page count to ${totalPages}. ` +
        `You've already logged progress up to page ${highestCurrentPage} ` +
        `in your current reading session. ` +
        `Please adjust your progress or use a higher page count.`
      );
    }

    // Import dependencies inside method to avoid circular imports
    const { getDatabase } = await import("@/lib/db/context");
    const { getLogger } = await import("@/lib/logger");

    const logger = getLogger();
    const db = getDatabase(); // Get the correct database instance (test or production)

    // Use transaction for atomic update + recalculation
    // NOTE: better-sqlite3 requires synchronous transaction callbacks (no async/await)
    // Bun's sqlite supports async, but Drizzle handles the difference
    try {
      return await db.transaction((tx) => {
        // 1. Update book's totalPages using repository method with transaction
        const updated = bookRepository.updateTotalPagesWithRecalculation(
          bookId,
          totalPages,
          tx
        );

        // 2. Recalculate progress percentages for all active sessions using repository method
        const logsUpdated = progressRepository.recalculatePercentagesForBook(
          bookId,
          totalPages,
          tx
        );

        // Log for debugging/monitoring
        logger.info({
          bookId,
          totalPages,
          progressLogsUpdated: logsUpdated
        }, "[BookService] Updated total pages and recalculated progress");

        return updated;
      });
    } catch (error) {
      const { getLogger } = await import("@/lib/logger");
      getLogger().error({ err: error, bookId }, "[BookService] Failed to update total pages");
      
      // Re-throw validation errors as-is (they have user-friendly messages)
      if (
        error instanceof Error && (
          error.message.includes("Cannot reduce") ||
          error.message.includes("Total pages must be a positive number") ||
          error.message.includes("Book not found")
        )
      ) {
        throw error;
      }
      
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

  /**
   * Update tags for a book
   * Syncs to Calibre first, then updates Tome database
   * 
   * @param bookId - The Tome book ID
   * @param tags - Array of tag names to set for the book
   * @returns Promise resolving to the updated book
   * @throws {Error} If book not found or sync fails
   * 
   * @example
   * const book = await bookService.updateTags(123, ["Fiction", "Fantasy"]);
   */
  async updateTags(bookId: number, tags: string[]): Promise<Book> {
    // Validate tags
    if (!Array.isArray(tags)) {
      throw new Error("Tags must be an array");
    }

    // Get book to find calibreId
    const book = await bookRepository.findById(bookId);
    if (!book) {
      throw new Error("Book not found");
    }

    // Sync to Calibre first (fail fast if this fails)
    try {
      await this.syncTagsToCalibre(book.calibreId, tags);
    } catch (error) {
      // Log error but continue - tags will be out of sync until next Calibre sync
      const { getLogger } = require("@/lib/logger");
      getLogger().error({ err: error }, `[BookService] Failed to sync tags to Calibre for book ${bookId}`);
    }

    // Update in Tome database
    const updated = await bookRepository.update(bookId, { tags });
    
    if (!updated) {
      throw new Error("Failed to update tags");
    }

    return updated;
  }

  /**
   * Sync tags to Calibre (best effort)
   */
  private async syncTagsToCalibre(calibreId: number, tags: string[]): Promise<void> {
    try {
      updateCalibreTags(calibreId, tags);
      const { getLogger } = require("@/lib/logger");
      getLogger().info(`[BookService] Synced tags to Calibre (calibreId: ${calibreId}): ${tags.join(', ')}`);
    } catch (error) {
      const { getLogger } = require("@/lib/logger");
      getLogger().error({ err: error, calibreId }, `[BookService] Failed to sync tags to Calibre`);
      throw error;
    }
  }

  /**
   * Get tag statistics with book counts
   * 
   * @returns Promise resolving to array of tags with their book counts
   * @example
   * const stats = await bookService.getTagStats();
   * // returns: [{ name: "fantasy", bookCount: 23 }, ...]
   */
  async getTagStats(): Promise<Array<{ name: string; bookCount: number }>> {
    return bookRepository.getTagStats();
  }

  /**
   * Get count of unique books that have at least one tag
   * 
   * @returns Promise resolving to count of books with tags
   * @example
   * const count = await bookService.countBooksWithTags();
   * // returns: 245
   */
  async countBooksWithTags(): Promise<number> {
    return bookRepository.countBooksWithTags();
  }

  /**
   * Get all books with a specific tag
   * 
   * @param tagName - The tag name to filter by
   * @param limit - Maximum number of books to return (default: 50)
   * @param skip - Number of books to skip for pagination (default: 0)
   * @returns Promise resolving to object with books array and total count
   */
  async getBooksByTag(
    tagName: string,
    limit: number = 50,
    skip: number = 0
  ): Promise<{ books: Book[]; total: number }> {
    return bookRepository.findByTag(tagName, limit, skip);
  }

  /**
   * Rename a tag across all books and sync to Calibre
   * 
   * @param oldName - The current tag name
   * @param newName - The new tag name
   * @returns Promise resolving to object with number of books updated
   * @throws {Error} If tag rename fails
   */
  async renameTag(oldName: string, newName: string): Promise<{ booksUpdated: number }> {
    // Validate inputs
    if (!oldName || !newName) {
      throw new Error("Tag names cannot be empty");
    }

    if (oldName === newName) {
      throw new Error("Old and new tag names must be different");
    }

    const { getLogger } = require("@/lib/logger");
    const logger = getLogger();

    // Rename in Tome database
    const booksUpdated = await bookRepository.renameTag(oldName, newName);

    // Sync to Calibre for each affected book (best effort)
    try {
      const booksWithTag = await bookRepository.findByTag(newName, booksUpdated, 0);
      
      for (const book of booksWithTag.books) {
        try {
          await this.syncTagsToCalibre(book.calibreId, book.tags);
        } catch (error) {
          logger.error({ err: error, bookId: book.id }, "Failed to sync renamed tag to Calibre");
        }
      }
    } catch (error) {
      logger.error({ err: error, oldName, newName }, "Failed to sync renamed tags to Calibre");
    }

    logger.info({ oldName, newName, booksUpdated }, "Renamed tag");

    return { booksUpdated };
  }

  /**
   * Delete a tag from all books and sync to Calibre
   * 
   * @param tagName - The tag name to delete
   * @returns Promise resolving to object with number of books updated
   * @throws {Error} If tag deletion fails
   */
  async deleteTag(tagName: string): Promise<{ booksUpdated: number }> {
    // Validate input
    if (!tagName) {
      throw new Error("Tag name cannot be empty");
    }

    const { getLogger } = require("@/lib/logger");
    const logger = getLogger();

    // Get books with this tag before deletion (for Calibre sync)
    const booksWithTag = await bookRepository.findByTag(tagName, 1000, 0);

    // Delete from Tome database
    const booksUpdated = await bookRepository.deleteTag(tagName);

    // Sync to Calibre for each affected book (best effort)
    try {
      for (const book of booksWithTag.books) {
        try {
          // Refetch book to get updated tags after deletion
          const updatedBook = await bookRepository.findById(book.id);
          if (updatedBook) {
            await this.syncTagsToCalibre(book.calibreId, updatedBook.tags);
          }
        } catch (error) {
          logger.error({ err: error, bookId: book.id }, "Failed to sync deleted tag to Calibre");
        }
      }
    } catch (error) {
      logger.error({ err: error, tagName }, "Failed to sync deleted tag to Calibre");
    }

    logger.info({ tagName, booksUpdated }, "Deleted tag");

    return { booksUpdated };
  }

  /**
   * Merge multiple source tags into a target tag and sync to Calibre
   * 
   * @param sourceTags - Array of tag names to merge from
   * @param targetTag - The tag name to merge into
   * @returns Promise resolving to object with number of books updated
   * @throws {Error} If tag merge fails
   */
  async mergeTags(sourceTags: string[], targetTag: string): Promise<{ booksUpdated: number }> {
    // Validate inputs
    if (!Array.isArray(sourceTags) || sourceTags.length === 0) {
      throw new Error("Source tags must be a non-empty array");
    }

    if (!targetTag) {
      throw new Error("Target tag cannot be empty");
    }

    const { getLogger } = require("@/lib/logger");
    const logger = getLogger();

    // Suspend the Calibre watcher during merge to prevent interference
    const { calibreWatcher } = require("@/lib/calibre-watcher");
    calibreWatcher.suspend();
    
    try {
      // Merge in Tome database
      const booksUpdated = await bookRepository.mergeTags(sourceTags, targetTag);

      // Sync to Calibre for each affected book (best effort)
      try {
        const booksWithTag = await bookRepository.findByTag(targetTag, booksUpdated, 0);
        
        logger.info({ bookCount: booksWithTag.books.length }, "Syncing merged tags to Calibre");
        
        for (const book of booksWithTag.books) {
          try {
            await this.syncTagsToCalibre(book.calibreId, book.tags);
          } catch (error) {
            logger.error({ err: error, bookId: book.id }, "Failed to sync merged tag to Calibre");
          }
        }
      } catch (error) {
        logger.error({ err: error, sourceTags, targetTag }, "Failed to sync merged tags to Calibre");
      }

      logger.info({ sourceTags, targetTag, booksUpdated }, "Merged tags");

      return { booksUpdated };
    } finally {
      // Always resume the watcher, even if there was an error
      calibreWatcher.resume();
    }
  }

  /**
   * Bulk update tags for multiple books and sync to Calibre
   * 
   * @param bookIds - Array of book IDs to update
   * @param action - Action to perform: "add" or "remove"
   * @param tags - Array of tag names to add or remove
   * @returns Promise resolving to object with number of books updated
   * @throws {Error} If bulk update fails
   */
  async bulkUpdateTags(
    bookIds: number[],
    action: "add" | "remove",
    tags: string[]
  ): Promise<{ booksUpdated: number }> {
    // Validate inputs
    if (!Array.isArray(bookIds) || bookIds.length === 0) {
      throw new Error("Book IDs must be a non-empty array");
    }

    if (!Array.isArray(tags) || tags.length === 0) {
      throw new Error("Tags must be a non-empty array");
    }

    if (action !== "add" && action !== "remove") {
      throw new Error("Action must be 'add' or 'remove'");
    }

    const { getLogger } = require("@/lib/logger");
    const logger = getLogger();

    // Bulk update in Tome database
    const tagsToAdd = action === "add" ? tags : [];
    const tagsToRemove = action === "remove" ? tags : [];
    
    const booksUpdated = await bookRepository.bulkUpdateBookTags(
      bookIds,
      tagsToAdd,
      tagsToRemove
    );

    // Sync to Calibre for each affected book (best effort)
    try {
      const updatedBooks = await bookRepository.findByIds(bookIds);
      
      for (const book of updatedBooks) {
        try {
          await this.syncTagsToCalibre(book.calibreId, book.tags);
        } catch (error) {
          logger.error({ err: error, bookId: book.id }, "Failed to sync bulk tag update to Calibre");
        }
      }
    } catch (error) {
      logger.error({ err: error, bookIds, action, tags }, "Failed to sync bulk tag updates to Calibre");
    }

    logger.info({ bookIds, action, tags, booksUpdated }, "Bulk updated tags");

    return { booksUpdated };
  }
}

// Singleton instance
export const bookService = new BookService();
