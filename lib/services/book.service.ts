import { bookRepository, sessionRepository, progressRepository } from "@/lib/repositories";
import type { Book, NewBook } from "@/lib/db/schema/books";
import type { ReadingSession } from "@/lib/db/schema/reading-sessions";
import type { ProgressLog } from "@/lib/db/schema/progress-logs";
import type { BookFilter } from "@/lib/repositories/book.repository";
import type { ICalibreService } from "@/lib/services/calibre.service";
import { SessionService } from "@/lib/services/session.service";
import { getLogger } from "@/lib/logger";
import { validateManualBookInput, type ManualBookInput } from "@/lib/validation/manual-book.schema";
import { detectDuplicates, type DuplicateDetectionResult } from "@/lib/services/duplicate-detection.service";
import { generateAuthorSort } from "@/lib/utils/author-sort";
import { downloadCover } from "@/lib/utils/cover-download";
import { saveCover } from "@/lib/utils/cover-storage";

/**
 * Book with enriched details (session, progress, read count)
 */
export interface BookWithDetails extends Book {
  activeSession: ReadingSession | null;
  latestProgress: ProgressLog | null;
  hasCompletedReads: boolean;
  hasFinishedSessions: boolean;
  totalReads: number;
}

/**
 * Manual book creation result with duplicate warnings
 */
export interface ManualBookCreationResult {
  book: Book;
  duplicates: DuplicateDetectionResult;
}

/**
 * BookService - Handles book CRUD operations and metadata updates
 * 
 * Responsibilities:
 * - Book retrieval with enriched details
 * - Metadata updates (totalPages, rating)
 * - Book filtering and search
 * - Calibre rating sync
 * 
 * Note: Tag management has been extracted to TagService
 */
export class BookService {
  private calibre?: ICalibreService;
  
  constructor(calibre?: ICalibreService) {
    this.calibre = calibre;
  }
  
  /**
   * Get the Calibre service instance (lazy loaded to support test mocking)
   * Always re-imports to ensure test mocks are applied correctly
   */
  private getCalibreService(): ICalibreService {
    if (this.calibre) {
      return this.calibre;
    }
    // Lazy import to ensure mocks are applied before the module is loaded
    // Don't cache the result - always get fresh reference to support test mocking
    const { calibreService } = require("@/lib/services/calibre.service");
    return calibreService;
  }
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

    // Check if book has any finished sessions (read or DNF)
    const hasFinishedSessions = await sessionRepository.hasFinishedSessions(bookId);

    return {
      ...result.book,
      activeSession: result.activeSession,
      latestProgress: result.latestProgress,
      hasCompletedReads: result.totalReads > 0,
      hasFinishedSessions,
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
      const result = db.transaction((tx) => {
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
      return result;
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
    
    // Check if book has any finished sessions (read or DNF)
    const hasFinishedSessions = await sessionRepository.hasFinishedSessions(book.id);

    return {
      ...book,
      activeSession: activeSession || null,
      latestProgress,
      hasCompletedReads: totalReads > 0,
      hasFinishedSessions,
      totalReads,
    };
  }

  /**
   * Create a manual book entry
   * 
   * Creates a new book with source='manual' and performs duplicate detection.
   * Validates input and automatically creates an initial reading session.
   * 
   * @param input - Manual book data (title, authors, optional metadata)
   * @returns Promise resolving to created book and duplicate detection result
   * @throws {Error} If validation fails or book creation fails
   * 
   * @example
   * const result = await bookService.createManualBook({
   *   title: 'The Great Gatsby',
   *   authors: ['F. Scott Fitzgerald'],
   *   totalPages: 180
   * });
   * 
   * if (result.duplicates.hasDuplicates) {
   *   console.log('Potential duplicates:', result.duplicates.duplicates);
   * }
   */
  async createManualBook(input: ManualBookInput): Promise<ManualBookCreationResult> {
    const logger = getLogger();

    // Validate input
    const validatedInput = validateManualBookInput(input);
    logger.debug({ title: validatedInput.title }, "Creating manual book");

    // Check for duplicates (warning only, doesn't prevent creation)
    const duplicates = await detectDuplicates(
      validatedInput.title,
      validatedInput.authors
    );

    if (duplicates.hasDuplicates) {
      logger.info(
        {
          title: validatedInput.title,
          duplicateCount: duplicates.duplicates.length,
        },
        "Manual book creation detected potential duplicates"
      );
    }

    // Prepare book data
    const newBook: NewBook = {
      // Required fields
      title: validatedInput.title,
      authors: validatedInput.authors,
      authorSort: generateAuthorSort(validatedInput.authors),

      // Manual books have no source entry (implicit manual)
      calibreId: null,

      // Optional metadata
      isbn: validatedInput.isbn ?? null,
      description: validatedInput.description ?? null,
      publisher: validatedInput.publisher ?? null,
      pubDate: validatedInput.pubDate ?? null,
      totalPages: validatedInput.totalPages ?? null,
      series: validatedInput.series ?? null,
      seriesIndex: validatedInput.seriesIndex ?? null,
      tags: validatedInput.tags ?? [],

      // Calibre-specific fields (null for manual books)
      path: null,
      lastSynced: null,

      // Default values
      rating: null,
      orphanedAt: null,
    };

    // Create book and initial session sequentially
    // Repository pattern must be maintained per constitution
    // Note: Not atomic due to better-sqlite3 transaction limitations with async repository methods,
    // but we handle failures by rolling back the book creation if session creation fails
    let createdBook: Book;
    try {
      createdBook = await bookRepository.create(newBook);
    } catch (error) {
      logger.error({ err: error, title: newBook.title }, "Failed to create manual book");
      throw error;
    }

    try {
      // Create initial session using SessionService's canonical data structure
      await sessionRepository.create(
        SessionService.buildInitialSessionData(createdBook.id)
      );
    } catch (error) {
      // Rollback: Delete the book if session creation fails to prevent orphaned books
      logger.error(
        { err: error, bookId: createdBook.id },
        "Failed to create initial session, rolling back book creation"
      );
      try {
        await bookRepository.delete(createdBook.id);
      } catch (deleteError) {
        logger.error(
          { err: deleteError, bookId: createdBook.id },
          "Failed to rollback book creation - orphaned book may exist"
        );
      }
      throw error;
    }

    logger.info(
      {
        bookId: createdBook.id,
        title: createdBook.title,
        hasDuplicates: duplicates.hasDuplicates,
      },
      "Manual book created successfully"
    );

    // Download cover from provider URL (non-blocking — book creation succeeds even if download fails)
    if (validatedInput.coverImageUrl) {
      const coverUrl = validatedInput.coverImageUrl;
      const bookId = createdBook.id;
      
      // Fire-and-forget: download in background, don't await
      downloadCover(coverUrl)
        .then((result) => {
          if (result) {
            saveCover(bookId, result.buffer, result.mimeType);
            logger.info(
              { bookId, coverUrl, mimeType: result.mimeType, size: result.buffer.length },
              "[BookService] Cover downloaded from provider URL"
            );
          } else {
            logger.warn(
              { bookId, coverUrl },
              "[BookService] Failed to download cover from provider URL (non-blocking)"
            );
          }
        })
        .catch((error) => {
          logger.warn(
            { bookId, coverUrl, err: error },
            "[BookService] Cover download threw error (non-blocking)"
          );
        });
    }

    return {
      book: createdBook,
      duplicates,
    };
  }

  /**
   * Check for duplicate books (preview without creating)
   * 
   * Used for real-time duplicate detection in the UI before submission.
   * 
   * @param title - Book title to check
   * @param authors - Book authors to check
   * @returns Promise resolving to duplicate detection result
   */
  async checkForDuplicates(
    title: string,
    authors: string[]
  ): Promise<DuplicateDetectionResult> {
    return detectDuplicates(title, authors);
  }

  /**
   * Sync rating to Calibre (best effort)
   */
  private async syncRatingToCalibre(calibreId: number | null, rating: number | null): Promise<void> {
    // Skip sync for non-Calibre books
    if (calibreId === null) {
      return;
    }

    try {
      this.getCalibreService().updateRating(calibreId, rating);
      getLogger().info(`[BookService] Synced rating to Calibre (calibreId: ${calibreId}): ${rating ?? 'removed'}`);
    } catch (error) {
      getLogger().error({ err: error, calibreId }, `[BookService] Failed to sync rating to Calibre`);
      throw error;
    }
  }
}

/**
 * Default BookService instance
 * Use this in API routes and other application code
 */
export const bookService = new BookService();
