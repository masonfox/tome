import { bookRepository, sessionRepository, progressRepository } from "@/lib/repositories";
import type { ReadingSession } from "@/lib/db/schema/reading-sessions";
import { rebuildStreak } from "@/lib/streaks";
import { calibreService } from "@/lib/services/calibre.service";
import { progressService } from "@/lib/services/progress.service";

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
 * Mark as read parameters
 */
export interface MarkAsReadParams {
  bookId: number;
  rating?: number;
  review?: string;
  completedDate?: Date;
}

/**
 * Mark as read result
 */
export interface MarkAsReadResult {
  session: ReadingSession;
  ratingUpdated: boolean;
  reviewUpdated: boolean;
  progressCreated: boolean;
}

/**
 * Context data passed to mark-as-read strategies
 */
interface MarkAsReadStrategyContext {
  bookId: number;
  book: any; // Book type from repository
  activeSession: ReadingSession | null;
  has100Progress: boolean;
  isAlreadyRead: boolean;
  completedDate?: Date;
  ensureReadingStatus: (bookId: number) => Promise<ReadingSession>;
  create100PercentProgress: (bookId: number, totalPages: number, completedDate?: Date) => Promise<void>;
  updateStatus: (bookId: number, statusData: StatusUpdateData) => Promise<StatusUpdateResult>;
  invalidateCache: (bookId: number) => Promise<void>;
  findMostRecentCompletedSession: (bookId: number) => Promise<ReadingSession | null>;
  sessionRepository: typeof sessionRepository;
  logger: any; // Logger type
}

/**
 * Result from executing a mark-as-read strategy
 */
interface MarkAsReadStrategyResult {
  sessionId: number | undefined;
  progressCreated: boolean;
}

/**
 * Strategy function type for marking a book as read
 */
type MarkAsReadStrategy = (
  context: MarkAsReadStrategyContext
) => Promise<MarkAsReadStrategyResult>;

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
   * Get the active reading session for a book
   * 
   * Returns the currently active session (isActive = true) for the book.
   * Each book can have only one active session at a time.
   * 
   * @param bookId - The ID of the book
   * @returns Promise resolving to the active session, or null if no active session exists
   * @throws {Error} If database query fails
   * 
   * @example
   * const session = await sessionService.getActiveSession(123);
   * if (session) {
   *   console.log(`Status: ${session.status}, Session #${session.sessionNumber}`);
   * }
   */
  async getActiveSession(bookId: number): Promise<ReadingSession | null> {
    const session = await sessionRepository.findActiveByBookId(bookId);
    return session || null;
  }

  /**
   * Get all reading sessions for a book
   * 
   * Returns all sessions (both active and archived) for the book,
   * ordered by session number descending (newest first).
   * 
   * Use Cases:
   * - Display reading history
   * - Show re-read statistics
   * - Calculate total reads
   * 
   * @param bookId - The ID of the book
   * @returns Promise resolving to array of sessions (empty if book has no sessions)
   * @throws {Error} If database query fails
   * 
   * @example
   * const sessions = await sessionService.getAllSessionsForBook(123);
   * console.log(`Total reads: ${sessions.filter(s => s.status === 'read').length}`);
   */
  async getAllSessionsForBook(bookId: number): Promise<ReadingSession[]> {
    return sessionRepository.findAllByBookId(bookId);
  }

  /**
   * Update book reading status (primary workflow for status changes)
   * 
   * Handles complex status transitions with validation, backward movement detection,
   * session archival, and rating updates. This is the main entry point for changing
   * a book's reading status from the UI.
   * 
   * Status Transitions:
   * - `to-read` → `read-next`: Queueing a book
   * - `read-next` → `reading`: Starting to read
   * - `reading` → `read`: Finishing a book
   * - `reading` → `to-read`/`read-next`: Backward movement (archives session if progress exists)
   * 
   * Backward Movement:
   * When moving from "reading" back to "to-read" or "read-next" with logged progress:
   * 1. Current session is archived (marked as inactive with completedDate)
   * 2. New session is created with new status
   * 3. Progress history is preserved in the archived session
   * 4. Streak system is updated
   * 
   * Validation:
   * - Status must be one of: 'to-read', 'read-next', 'reading', 'read'
   * - Book must exist
   * - 'reading' and 'read' statuses require totalPages to be set
   * - Dates are auto-assigned if not provided
   * 
   * Side Effects:
   * - Updates streak system (when completing books)
   * - Syncs rating to Calibre (if rating provided)
   * - Invalidates relevant caches
   * - Revalidates UI paths
   * 
   * @param bookId - The ID of the book to update
   * @param statusData - Status update data (status, optional rating/review/dates)
   * @returns Promise resolving to update result with session and archival info
   * @throws {Error} If validation fails, book not found, or page count missing
   * 
   * @example
   * // Start reading a book
   * const result = await sessionService.updateStatus(123, {
   *   status: 'reading',
   *   startedDate: new Date()
   * });
   * 
   * @example
   * // Finish a book with rating
   * const result = await sessionService.updateStatus(123, {
   *   status: 'read',
   *   rating: 5,
   *   review: 'Amazing book!',
   *   completedDate: new Date()
   * });
   * 
   * @example
   * // Backward movement (creates new session)
   * const result = await sessionService.updateStatus(123, {
   *   status: 'to-read' // was 'reading' with progress
   * });
   * if (result.sessionArchived) {
   *   console.log(`Session #${result.archivedSessionNumber} archived`);
   * }
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

    // Validate page count requirement for reading/read status
    if ((status === "reading" || status === "read") && !book.totalPages) {
      const error = new Error("Page count required. Please set the total number of pages before starting to read.");
      (error as any).code = "PAGES_REQUIRED";
      throw error;
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

      // Get last progress date for completedDate (use last activity or current date)
      const latestProgress = await progressRepository.findLatestBySessionId(readingSession.id);
      const completedDate = latestProgress?.progressDate 
        ? new Date(latestProgress.progressDate)
        : new Date();

      // Archive current session WITH completedDate
      await sessionRepository.update(readingSession.id, {
        isActive: false,
        completedDate,
      } as any);

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
      await this.updateBookRating(bookId, rating);
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
   * Ensures a book is in "reading" status, creating or updating session as needed
   *
   * Used by markAsRead workflow to ensure book is in reading status before
   * creating 100% progress entry (which auto-completes to "read").
   *
   * @param bookId - The ID of the book
   * @returns Promise resolving to the reading session (existing or newly created)
   * @throws {Error} If book not found or page count validation fails
   *
   * @example
   * const session = await sessionService.ensureReadingStatus(123);
   * // Now safe to log progress for this book
   */
  async ensureReadingStatus(bookId: number): Promise<ReadingSession> {
    const { getLogger } = require("@/lib/logger");
    const logger = getLogger();

    // Check if book already has reading status
    const activeSession = await sessionRepository.findActiveByBookId(bookId);

    if (activeSession?.status === "reading") {
      logger.info({ bookId, sessionId: activeSession.id }, "Book already in reading status");
      return activeSession;
    }

    // Transition to reading status
    logger.info({ bookId, currentStatus: activeSession?.status }, "Transitioning book to reading status");
    const result = await this.updateStatus(bookId, { status: "reading" });

    return result.session;
  }

  /**
   * Creates a 100% progress entry for a book (triggers auto-completion to "read")
   *
   * This method logs 100% progress which triggers the auto-completion flow in ProgressService.
   * The book's status will be automatically changed to "read" and the session will be archived.
   *
   * Prerequisites:
   * - Book must be in "reading" status (use ensureReadingStatus first)
   * - Book must have totalPages set
   *
   * @param bookId - The ID of the book
   * @param totalPages - The total number of pages in the book
   * @param completedDate - Optional completion date (defaults to current date)
   * @returns Promise resolving when progress is logged and book is auto-completed
   * @throws {Error} If book not found, not in reading status, or no totalPages
   *
   * @example
   * await sessionService.ensureReadingStatus(123);
   * await sessionService.create100PercentProgress(123, 350);
   * // Book is now marked as "read" with 100% progress logged
   */
  async create100PercentProgress(bookId: number, totalPages: number, completedDate?: Date): Promise<void> {
    const { getLogger } = require("@/lib/logger");
    const logger = getLogger();

    logger.info({ bookId, totalPages, completedDate }, "Creating 100% progress entry");

    // Log 100% progress (this will trigger auto-completion in ProgressService)
    await progressService.logProgress(bookId, {
      currentPage: totalPages,
      currentPercentage: 100,
      notes: "Marked as read",
      progressDate: completedDate,
    });

    logger.info({ bookId }, "Successfully created 100% progress entry (book auto-completed)");
  }

  /**
   * Updates book rating in the books table (with Calibre sync)
   *
   * This is the canonical method for updating book ratings. It syncs to Calibre first
   * (best-effort), then updates the Tome database. The books table is the single
   * source of truth for ratings.
   *
   * @param bookId - The ID of the book
   * @param rating - The rating value (1-5) or null to remove rating
   * @returns Promise resolving when rating is updated
   * @throws {Error} If book not found
   *
   * @example
   * await sessionService.updateBookRating(123, 5);
   * // Rating updated in both Calibre and Tome database
   *
   * @example
   * await sessionService.updateBookRating(123, null);
   * // Rating removed
   */
  async updateBookRating(bookId: number, rating: number | null): Promise<void> {
    const { getLogger } = require("@/lib/logger");
    const logger = getLogger();

    // Verify book exists and get calibreId
    const book = await bookRepository.findById(bookId);
    if (!book) {
      throw new Error("Book not found");
    }

    try {
      // Sync to Calibre first (best effort)
      calibreService.updateRating(book.calibreId, rating);
      logger.info({ bookId, calibreId: book.calibreId, rating }, "Synced rating to Calibre");
    } catch (calibreError) {
      // Log error but continue with Tome database update
      logger.error({ err: calibreError, bookId }, "Failed to sync rating to Calibre");
    }

    // Update Tome database (single source of truth)
    await bookRepository.update(bookId, { rating: rating ?? null });
    logger.info({ bookId, rating }, "Updated book rating in database");
  }

  /**
   * Updates review on a reading session
   *
   * Reviews are stored on reading sessions, not on the book itself. This allows
   * tracking different reviews for different reads (e.g., first read vs re-read).
   *
   * @param sessionId - The ID of the reading session
   * @param review - The review text
   * @returns Promise resolving to the updated session
   * @throws {Error} If session not found
   *
   * @example
   * const session = await sessionService.updateSessionReview(42, "Great book!");
   * console.log(session.review); // "Great book!"
   */
  async updateSessionReview(sessionId: number, review: string): Promise<ReadingSession> {
    const { getLogger } = require("@/lib/logger");
    const logger = getLogger();

    const session = await sessionRepository.findById(sessionId);
    if (!session) {
      throw new Error("Session not found");
    }

    logger.info({ sessionId, bookId: session.bookId }, "Updating session review");

    const updated = await sessionRepository.update(sessionId, {
      review,
    } as any);

    if (!updated) {
      throw new Error("Failed to update session review");
    }

    // Invalidate cache
    await this.invalidateCache(session.bookId);

    return updated;
  }

  /**
   * Finds the most recent completed reading session for a book
   *
   * Used when a book is already marked as "read" and we need to attach
   * a review to the most recent completed session.
   *
   * @param bookId - The ID of the book
   * @returns Promise resolving to the most recent completed session, or null if none found
   * @throws {Error} If database query fails
   *
   * @example
   * const session = await sessionService.findMostRecentCompletedSession(123);
   * if (session) {
   *   await sessionService.updateSessionReview(session.id, "Amazing!");
   * }
   */
  async findMostRecentCompletedSession(bookId: number): Promise<ReadingSession | null> {
    const sessions = await sessionRepository.findAllByBookId(bookId);

    // Filter for completed sessions (status = "read", isActive = false)
    const completedSessions = sessions.filter(
      (s) => !s.isActive && s.status === "read"
    );

    if (completedSessions.length === 0) {
      return null;
    }

    // Sort by completedDate descending to get most recent
    completedSessions.sort((a, b) => {
      const dateA = a.completedDate ? new Date(a.completedDate).getTime() : 0;
      const dateB = b.completedDate ? new Date(b.completedDate).getTime() : 0;
      return dateB - dateA;
    });

    return completedSessions[0];
  }

  // ========== MARK AS READ STRATEGIES ==========

  /**
   * Strategy: Create 100% progress entry to mark book as read
   * Used when: Book has totalPages but no 100% progress yet
   */
  private async createProgressStrategy(
    context: MarkAsReadStrategyContext
  ): Promise<MarkAsReadStrategyResult> {
    const { bookId, book, activeSession, completedDate, logger } = context;

    logger.info(
      { bookId, reason: "has pages, no 100% progress" },
      "Marking as read via progress creation"
    );

    await context.ensureReadingStatus(bookId);
    await context.create100PercentProgress(bookId, book.totalPages!, completedDate);

    return {
      sessionId: activeSession?.id,
      progressCreated: true,
    };
  }

  /**
   * Strategy: Direct status change to "read"
   * Used when: Book has totalPages and already has 100% progress
   */
  private async directStatusChangeStrategy(
    context: MarkAsReadStrategyContext
  ): Promise<MarkAsReadStrategyResult> {
    const { bookId, completedDate, logger } = context;

    logger.info(
      { bookId, reason: "has 100% progress" },
      "Marking as read via direct status change"
    );

    const result = await context.updateStatus(bookId, {
      status: "read",
      completedDate: completedDate,
    });

    return {
      sessionId: result.session.id,
      progressCreated: false,
    };
  }

  /**
   * Strategy: Manual session update without pages
   * Used when: Book has no totalPages (can't validate with progress)
   */
  private async manualSessionUpdateStrategy(
    context: MarkAsReadStrategyContext
  ): Promise<MarkAsReadStrategyResult> {
    const { bookId, activeSession, completedDate, sessionRepository, logger, invalidateCache } = context;

    logger.info(
      { bookId, reason: "no totalPages" },
      "Marking as read via session update (no pages)"
    );

    let sessionId: number | undefined;

    if (activeSession) {
      const updated = await sessionRepository.update(activeSession.id, {
        status: "read",
        completedDate: completedDate || new Date(),
        isActive: false,
      } as any);
      sessionId = updated?.id;
    } else {
      const nextSessionNumber = await sessionRepository.getNextSessionNumber(bookId);
      const newSession = await sessionRepository.create({
        bookId,
        sessionNumber: nextSessionNumber,
        status: "read",
        isActive: false,
        startedDate: completedDate || new Date(),
        completedDate: completedDate || new Date(),
      });
      sessionId = newSession.id;
    }

    await invalidateCache(bookId);

    return {
      sessionId,
      progressCreated: false,
    };
  }

  /**
   * Strategy: Find archived session for already-read books
   * Used when: Book is already marked as read (has completed reads, no active session)
   */
  private async alreadyReadStrategy(
    context: MarkAsReadStrategyContext
  ): Promise<MarkAsReadStrategyResult> {
    const { bookId, logger, findMostRecentCompletedSession } = context;

    logger.info({ bookId }, "Book already marked as read, finding archived session");

    const completedSession = await findMostRecentCompletedSession(bookId);

    return {
      sessionId: completedSession?.id,
      progressCreated: false,
    };
  }

  /**
   * Select the appropriate strategy for marking a book as read
   */
  private selectMarkAsReadStrategy(
    book: any,
    isAlreadyRead: boolean,
    has100Progress: boolean
  ): { strategy: MarkAsReadStrategy; name: string } {
    if (isAlreadyRead) {
      return { strategy: this.alreadyReadStrategy.bind(this), name: "AlreadyRead" };
    }

    if (book.totalPages && !has100Progress) {
      return { strategy: this.createProgressStrategy.bind(this), name: "CreateProgress" };
    }

    if (book.totalPages && has100Progress) {
      return { strategy: this.directStatusChangeStrategy.bind(this), name: "DirectStatusChange" };
    }

    return { strategy: this.manualSessionUpdateStrategy.bind(this), name: "ManualSessionUpdate" };
  }

  /**
   * Unified orchestration for marking a book as "read"
   *
   * This is the main entry point for the "mark as read" workflow. It handles all the
   * complex decision logic for transitioning a book to "read" status, including:
   * - Status transitions (ensuring book goes through "reading" if needed)
   * - Progress tracking (creating 100% progress if book has pages)
   * - Rating updates (with external service sync)
   * - Review attachment (to the correct session)
   *
   * Decision Flow:
   * 1. Get book and check current status
   * 2. If NOT already read:
   *    a. If has totalPages AND no 100% progress yet:
   *       - Ensure book is in "reading" status
   *       - Create 100% progress entry (auto-completes to "read")
   *    b. Else (no pages OR already has 100% progress):
   *       - Direct status change to "read"
   * 3. If already read:
   *    - Find most recent completed session (for review attachment)
   * 4. Update rating if provided (best-effort, won't fail the operation)
   * 5. Update review if provided (best-effort, won't fail the operation)
   *
   * Transaction Boundaries:
   * - CRITICAL operations (status transitions, progress creation) are NOT currently wrapped
   *   in a database transaction due to complexity of refactoring repository methods
   * - BEST-EFFORT operations (rating sync, review updates) intentionally outside transactions
   * - See docs/TRANSACTION_BOUNDARIES.md for detailed analysis and future roadmap
   * - Risk level: MEDIUM (database failures unlikely, user can retry on partial state)
   *
   * Error Handling:
   * - Rating and review updates use best-effort approach
   * - External sync failures (Calibre) are logged but don't fail the operation
   * - If rating sync fails, book is still marked as read
   * - If review update fails, book is still marked as read
   * - Errors are logged but don't fail the overall operation
   *
   * @param params - Mark as read parameters (bookId, rating, review, completedDate)
   * @returns Promise resolving to result with session and update flags
   * @throws {Error} If book not found or validation fails
   *
   * @example
   * // Simple mark as read
   * const result = await sessionService.markAsRead({ bookId: 123 });
   *
   * @example
   * // Mark as read with rating and review
   * const result = await sessionService.markAsRead({
   *   bookId: 123,
   *   rating: 5,
   *   review: "Excellent book!",
   * });
   * console.log(`Rating updated: ${result.ratingUpdated}`);
   * console.log(`Review updated: ${result.reviewUpdated}`);
   */
  async markAsRead(params: MarkAsReadParams): Promise<MarkAsReadResult> {
    const { bookId, rating, review, completedDate } = params;
    const { getLogger } = require("@/lib/logger");
    const logger = getLogger();

    logger.info({ bookId, hasRating: !!rating, hasReview: !!review }, "Starting markAsRead workflow");

    // Get book data
    const book = await bookRepository.findById(bookId);
    if (!book) {
      throw new Error("Book not found");
    }

    // Get active session and check if already has 100% progress
    const activeSession = await sessionRepository.findActiveByBookId(bookId);
    const currentStatus = activeSession?.status;

    // Check if book has been marked as read (has completed reads)
    const hasCompletedReads = await sessionRepository.hasCompletedReads(bookId);
    const isAlreadyRead = hasCompletedReads && !activeSession;

    let has100Progress = false;
    if (activeSession) {
      has100Progress = await progressRepository.hasProgressForSession(activeSession.id);
      if (has100Progress) {
        // Check if any progress entry is at 100%
        const progressLogs = await progressRepository.findBySessionId(activeSession.id);
        has100Progress = progressLogs.some(p => p.currentPercentage >= 100);
      }
    }

    logger.info({
      bookId,
      currentStatus,
      isAlreadyRead,
      totalPages: book.totalPages,
      has100Progress,
    }, "Book state analysis");

    // STRATEGY PATTERN: Select and execute appropriate strategy
    const { strategy, name: strategyName } = this.selectMarkAsReadStrategy(
      book,
      isAlreadyRead,
      has100Progress
    );

    logger.info({ bookId, strategy: strategyName }, "Executing mark-as-read strategy");

    const strategyContext: MarkAsReadStrategyContext = {
      bookId,
      book,
      activeSession,
      has100Progress,
      isAlreadyRead,
      completedDate,
      ensureReadingStatus: this.ensureReadingStatus.bind(this),
      create100PercentProgress: this.create100PercentProgress.bind(this),
      updateStatus: this.updateStatus.bind(this),
      invalidateCache: this.invalidateCache.bind(this),
      findMostRecentCompletedSession: this.findMostRecentCompletedSession.bind(this),
      sessionRepository,
      logger,
    };

    const { sessionId, progressCreated } = await strategy(strategyContext);

    // Step 2: Update rating (best-effort)
    let ratingUpdated = false;
    if (rating !== undefined && rating > 0) {
      try {
        await this.updateBookRating(bookId, rating);
        ratingUpdated = true;
        logger.info({ bookId, rating }, "Rating updated successfully");
      } catch (error) {
        logger.error({ err: error, bookId, rating }, "Failed to update rating (continuing)");
        // Don't throw - book is already marked as read
      }
    }

    // Step 3: Update review (best-effort)
    let reviewUpdated = false;
    if (review && sessionId) {
      try {
        await this.updateSessionReview(sessionId, review);
        reviewUpdated = true;
        logger.info({ bookId, sessionId }, "Review updated successfully");
      } catch (error) {
        logger.error({ err: error, bookId, sessionId }, "Failed to update review (continuing)");
        // Don't throw - book is already marked as read
      }
    }

    // Get the final session (may have been archived)
    let finalSession: ReadingSession;
    if (sessionId) {
      const session = await sessionRepository.findById(sessionId);
      if (session) {
        finalSession = session;
      } else {
        // Session was archived, find it
        const archived = await this.findMostRecentCompletedSession(bookId);
        finalSession = archived!;
      }
    } else {
      // Should not happen, but fallback to finding completed session
      const completed = await this.findMostRecentCompletedSession(bookId);
      if (!completed) {
        throw new Error("Could not find session after marking as read");
      }
      finalSession = completed;
    }

    logger.info({
      bookId,
      sessionId: finalSession.id,
      strategy: strategyName,
      ratingUpdated,
      reviewUpdated,
      progressCreated,
    }, "Successfully completed markAsRead workflow");

    return {
      session: finalSession,
      ratingUpdated,
      reviewUpdated,
      progressCreated,
    };
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
      // Lazy import to avoid mock pollution in tests
      const { revalidatePath } = await import("next/cache");
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

/**
 * Default SessionService instance
 * Use this in API routes, hooks, and other application code
 */
export const sessionService = new SessionService();
