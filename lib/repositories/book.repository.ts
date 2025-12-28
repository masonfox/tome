import { eq, and, or, sql, like, inArray, desc, asc, SQL } from "drizzle-orm";
import { BaseRepository } from "./base.repository";
import { books, Book, NewBook } from "@/lib/db/schema/books";
import { readingSessions } from "@/lib/db/schema/reading-sessions";
import { progressLogs } from "@/lib/db/schema/progress-logs";
import { bookShelves } from "@/lib/db/schema/shelves";
import { db } from "@/lib/db/sqlite";

export interface BookFilter {
  status?: string;
  search?: string;
  tags?: string[];
  rating?: string; // "all" | "rated" | "5" | "4" | "3" | "2" | "1" | "unrated"
  showOrphaned?: boolean;
  orphanedOnly?: boolean;
  shelfIds?: number[]; // Filter by books on specific shelves (OR logic - book must be on ANY shelf)
}

export interface BookWithStatus extends Book {
  status?: string | null;
}

export class BookRepository extends BaseRepository<Book, NewBook, typeof books> {
  constructor() {
    super(books);
  }

  protected getTable() {
    return books;
  }

  /**
   * Helper method to build rating filter condition
   * @param rating - The rating filter value ("5" | "4" | "3" | "2" | "1" | "rated" | "unrated")
   * @returns SQL condition for filtering by rating, or undefined for invalid inputs
   */
  private buildRatingCondition(rating: string): SQL | undefined {
    switch (rating) {
      case "5":
        return eq(books.rating, 5);
      case "4":
        return eq(books.rating, 4);
      case "3":
        return eq(books.rating, 3);
      case "2":
        return eq(books.rating, 2);
      case "1":
        return eq(books.rating, 1);
      case "rated":
        return sql`${books.rating} IS NOT NULL`;
      case "unrated":
        return sql`${books.rating} IS NULL`;
      default:
        return undefined;
    }
  }

  /**
   * Find a book by calibreId
   */
  async findByCalibreId(calibreId: number): Promise<Book | undefined> {
    return this.getDatabase()
      .select()
      .from(books)
      .where(eq(books.calibreId, calibreId))
      .get();
  }

  /**
   * Find multiple books by IDs
   */
  async findByIds(bookIds: number[]): Promise<Book[]> {
    if (bookIds.length === 0) {
      return [];
    }

    return this.getDatabase()
      .select()
      .from(books)
      .where(inArray(books.id, bookIds))
      .all();
  }

  /**
   * Find a book by ID with enriched details (session, progress, read count) - OPTIMIZED
   * Uses a single query with LEFT JOINs and subqueries instead of 3 separate queries
   */
  async findByIdWithDetails(bookId: number): Promise<{
    book: Book;
    activeSession: any | null;
    latestProgress: any | null;
    totalReads: number;
  } | null> {
    // Correlated subquery to select ONLY active session
    // Returns null if no active session exists
    const sessionIdSubquery = sql`(
      SELECT rs.id FROM ${readingSessions} rs
      WHERE rs.book_id = ${books.id}
        AND rs.is_active = 1
      LIMIT 1
    )`;

    // Main query with LEFT JOIN and scalar subqueries
    const result = this.getDatabase()
      .select({
        // Book fields
        bookId: books.id,
        calibreId: books.calibreId,
        title: books.title,
        authors: books.authors,
        isbn: books.isbn,
        totalPages: books.totalPages,
        addedToLibrary: books.addedToLibrary,
        lastSynced: books.lastSynced,
        publisher: books.publisher,
        pubDate: books.pubDate,
        series: books.series,
        seriesIndex: books.seriesIndex,
        tags: books.tags,
        path: books.path,
        description: books.description,
        rating: books.rating,
        orphaned: books.orphaned,
        orphanedAt: books.orphanedAt,
        createdAt: books.createdAt,
        updatedAt: books.updatedAt,

        // Session fields
        sessionId: readingSessions.id,
        sessionUserId: readingSessions.userId,
        sessionBookId: readingSessions.bookId,
        sessionNumber: readingSessions.sessionNumber,
        sessionStatus: readingSessions.status,
        sessionStartedDate: readingSessions.startedDate,
        sessionCompletedDate: readingSessions.completedDate,
        sessionReview: readingSessions.review,
        sessionIsActive: readingSessions.isActive,
        sessionCreatedAt: readingSessions.createdAt,
        sessionUpdatedAt: readingSessions.updatedAt,

        // Latest progress fields (scalar subqueries)
        progressId: sql`(
          SELECT pl.id FROM progress_logs pl
          WHERE pl.session_id = ${readingSessions.id}
          ORDER BY pl.progress_date DESC, pl.id DESC
          LIMIT 1
        )`.as('progressId'),
        progressUserId: sql`(
          SELECT pl.user_id FROM progress_logs pl
          WHERE pl.session_id = ${readingSessions.id}
          ORDER BY pl.progress_date DESC, pl.id DESC
          LIMIT 1
        )`.as('progressUserId'),
        progressBookId: sql`(
          SELECT pl.book_id FROM progress_logs pl
          WHERE pl.session_id = ${readingSessions.id}
          ORDER BY pl.progress_date DESC, pl.id DESC
          LIMIT 1
        )`.as('progressBookId'),
        progressSessionId: sql`(
          SELECT pl.session_id FROM progress_logs pl
          WHERE pl.session_id = ${readingSessions.id}
          ORDER BY pl.progress_date DESC, pl.id DESC
          LIMIT 1
        )`.as('progressSessionId'),
        progressCurrentPage: sql`(
          SELECT pl.current_page FROM progress_logs pl
          WHERE pl.session_id = ${readingSessions.id}
          ORDER BY pl.progress_date DESC, pl.id DESC
          LIMIT 1
        )`.as('progressCurrentPage'),
        progressCurrentPercentage: sql`(
          SELECT pl.current_percentage FROM progress_logs pl
          WHERE pl.session_id = ${readingSessions.id}
          ORDER BY pl.progress_date DESC, pl.id DESC
          LIMIT 1
        )`.as('progressCurrentPercentage'),
        progressDate: sql`(
          SELECT pl.progress_date FROM progress_logs pl
          WHERE pl.session_id = ${readingSessions.id}
          ORDER BY pl.progress_date DESC, pl.id DESC
          LIMIT 1
        )`.as('progressDate'),
        progressNotes: sql`(
          SELECT pl.notes FROM progress_logs pl
          WHERE pl.session_id = ${readingSessions.id}
          ORDER BY pl.progress_date DESC, pl.id DESC
          LIMIT 1
        )`.as('progressNotes'),
        progressPagesRead: sql`(
          SELECT pl.pages_read FROM progress_logs pl
          WHERE pl.session_id = ${readingSessions.id}
          ORDER BY pl.progress_date DESC, pl.id DESC
          LIMIT 1
        )`.as('progressPagesRead'),
        progressCreatedAt: sql`(
          SELECT pl.created_at FROM progress_logs pl
          WHERE pl.session_id = ${readingSessions.id}
          ORDER BY pl.progress_date DESC, pl.id DESC
          LIMIT 1
        )`.as('progressCreatedAt'),

        // Total completed reads count
        totalReads: sql`(
          SELECT COUNT(*) FROM ${readingSessions} rs_count
          WHERE rs_count.book_id = ${books.id}
            AND rs_count.status = 'read'
            AND rs_count.is_active = 0
        )`.as('totalReads'),
      })
      .from(books)
      .leftJoin(
        readingSessions,
        sql`${readingSessions.id} = ${sessionIdSubquery}`
      )
      .where(eq(books.id, bookId))
      .get();

    if (!result) {
      return null;
    }

    // Map result to proper structure
    const book: Book = {
      id: result.bookId,
      calibreId: result.calibreId,
      title: result.title,
      authors: result.authors,
      isbn: result.isbn,
      totalPages: result.totalPages,
      addedToLibrary: result.addedToLibrary,
      lastSynced: result.lastSynced,
      publisher: result.publisher,
      pubDate: result.pubDate,
      series: result.series,
      seriesIndex: result.seriesIndex,
      tags: result.tags,
      path: result.path,
      description: result.description,
      rating: result.rating,
      orphaned: result.orphaned,
      orphanedAt: result.orphanedAt,
      createdAt: result.createdAt,
      updatedAt: result.updatedAt,
    };

    const activeSession = result.sessionId ? {
      id: result.sessionId,
      userId: result.sessionUserId,
      bookId: result.sessionBookId,
      sessionNumber: result.sessionNumber,
      status: result.sessionStatus,
      startedDate: result.sessionStartedDate,
      completedDate: result.sessionCompletedDate,
      review: result.sessionReview,
      isActive: result.sessionIsActive,
      createdAt: result.sessionCreatedAt,
      updatedAt: result.sessionUpdatedAt,
    } : null;

    const latestProgress = result.progressId ? {
      id: result.progressId,
      userId: result.progressUserId,
      bookId: result.progressBookId,
      sessionId: result.progressSessionId,
      currentPage: result.progressCurrentPage,
      currentPercentage: result.progressCurrentPercentage,
      progressDate: result.progressDate,
      notes: result.progressNotes,
      pagesRead: result.progressPagesRead,
      createdAt: result.progressCreatedAt,
    } : null;

    return {
      book,
      activeSession,
      latestProgress,
      totalReads: result.totalReads as number || 0,
    };
  }

  /**
   * Find books with filters and pagination
   */
  async findWithFilters(
    filters: BookFilter,
    limit: number = 50,
    skip: number = 0,
    sortBy?: string
  ): Promise<{ books: Book[]; total: number }> {
    const conditions: SQL[] = [];

    // Orphaned filter
    if (filters.orphanedOnly) {
      conditions.push(eq(books.orphaned, true));
    } else if (!filters.showOrphaned) {
      conditions.push(or(eq(books.orphaned, false), sql`${books.orphaned} IS NULL`)!);
    }

    // Search filter
    if (filters.search) {
      const searchPattern = `%${filters.search}%`;
      conditions.push(
        or(
          like(books.title, searchPattern),
          like(books.authors, searchPattern)
        )!
      );
    }

    // Tags filter (JSON contains)
    // Use json_each for accurate JSON array searching instead of LIKE
    // Multiple tags use AND logic - book must have ALL selected tags
    if (filters.tags && filters.tags.length > 0) {
      const tagConditions = filters.tags.map((tag) =>
        sql`EXISTS (
          SELECT 1 FROM json_each(${books.tags})
          WHERE json_each.value = ${tag}
        )`
      );
      conditions.push(and(...tagConditions)!);
    }

    // Rating filter
    if (filters.rating && filters.rating !== "all") {
      const ratingCondition = this.buildRatingCondition(filters.rating);
      if (ratingCondition) {
        conditions.push(ratingCondition);
      }
    }

    // Status filter (requires join with sessions)
    let bookIds: number[] | undefined;
    if (filters.status) {
      const statusCondition = eq(readingSessions.status, filters.status as any);
      const activeCondition =
        filters.status === "read"
          ? undefined // For "read", include all sessions
          : eq(readingSessions.isActive, true);

      const sessionQuery = this.getDatabase()
        .select({ bookId: readingSessions.bookId })
        .from(readingSessions)
        .where(activeCondition ? and(statusCondition, activeCondition) : statusCondition);

      const sessions = sessionQuery.all() as Array<{ bookId: number }>;
      bookIds = sessions.map((s: any) => s.bookId);

      if (bookIds.length === 0) {
        return { books: [], total: 0 };
      }

      if (bookIds.length > 0) {
        conditions.push(inArray(books.id, bookIds));
      }
    }

    // Shelf filter (books must be on ANY of the selected shelves - OR logic)
    if (filters.shelfIds && filters.shelfIds.length > 0) {
      const shelfQuery = this.getDatabase()
        .selectDistinct({ bookId: bookShelves.bookId })
        .from(bookShelves)
        .where(inArray(bookShelves.shelfId, filters.shelfIds));

      const shelfBooks = shelfQuery.all() as Array<{ bookId: number }>;
      const shelfBookIds = shelfBooks.map((s) => s.bookId);

      if (shelfBookIds.length === 0) {
        return { books: [], total: 0 };
      }

      conditions.push(inArray(books.id, shelfBookIds));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Get total count
    const countResult = this.getDatabase()
      .select({ count: sql<number>`count(*)` })
      .from(books)
      .where(whereClause)
      .get();
    const total = countResult?.count ?? 0;

    // Determine sort order
    let orderBy: SQL;
    switch (sortBy) {
      case "title":
        orderBy = asc(books.title);
        break;
      case "title_desc":
        orderBy = desc(books.title);
        break;
      case "author":
        orderBy = asc(books.authors);
        break;
      case "author_desc":
        orderBy = desc(books.authors);
        break;
      case "created":
        // Sort by when the book was added to Calibre library (not tome database)
        orderBy = desc(books.addedToLibrary);
        break;
      case "created_desc":
        // Oldest books first by Calibre library date
        orderBy = asc(books.addedToLibrary);
        break;
      case "rating":
        // Rating high to low (nulls last)
        orderBy = sql`${books.rating} DESC NULLS LAST`;
        break;
      case "rating_asc":
        // Rating low to high (nulls last)
        orderBy = sql`${books.rating} ASC NULLS LAST`;
        break;
      case "pages":
        // Shortest books first (nulls last)
        orderBy = sql`${books.totalPages} ASC NULLS LAST`;
        break;
      case "pages_desc":
        // Longest books first (nulls last)
        orderBy = sql`${books.totalPages} DESC NULLS LAST`;
        break;
      case "recently_read":
        // Most recently finished books first
        // Uses subquery to get latest completed session date
        orderBy = sql`(
          SELECT MAX(rs.completed_date) 
          FROM ${readingSessions} rs 
          WHERE rs.book_id = ${books.id} 
            AND rs.status = 'read'
            AND rs.completed_date IS NOT NULL
        ) DESC NULLS LAST`;
        break;
      default:
        orderBy = desc(books.addedToLibrary);
    }

    // Get paginated results
    const results = this.getDatabase()
      .select()
      .from(books)
      .where(whereClause)
      .orderBy(orderBy)
      .limit(limit)
      .offset(skip)
      .all();

    return { books: results, total };
  }

  /**
   * Update book by calibreId
   */
  async updateByCalibreId(
    calibreId: number,
    data: Partial<NewBook>
  ): Promise<Book | undefined> {
    const result = this.getDatabase()
      .update(books)
      .set(data)
      .where(eq(books.calibreId, calibreId))
      .returning()
      .get();
    return result;
  }

  /**
   * Find books not in a list of calibreIds (for orphaning)
   */
  async findNotInCalibreIds(calibreIds: number[]): Promise<Book[]> {
    // SAFETY: If calibreIds is empty, return empty array to prevent mass orphaning
    // This prevents a catastrophic bug where an empty Calibre result would orphan ALL books
    if (calibreIds.length === 0) {
      return [];
    }

    return this.getDatabase()
      .select()
      .from(books)
      .where(
        and(
          sql`${books.calibreId} NOT IN ${sql.raw(`(${calibreIds.join(",")})`)}`,
          or(eq(books.orphaned, false), sql`${books.orphaned} IS NULL`)!
        )
      )
      .all();
  }

  /**
   * Mark book as orphaned
   */
  async markAsOrphaned(id: number): Promise<Book | undefined> {
    return this.update(id, {
      orphaned: true,
      orphanedAt: new Date(),
    } as any);
  }

  /**
   * Get all unique tags from all books
   * Optimized to use SQLite's json_each function instead of loading all books
   */
  async getAllTags(): Promise<string[]> {
    try {
      // Use json_each to extract tags directly in SQL
      // This is much faster than loading all books into memory
      const results = this.getDatabase()
        .select({
          tag: sql<string>`json_each.value`,
        })
        .from(sql`${books}, json_each(${books.tags})`)
        .where(sql`json_array_length(${books.tags}) > 0`)
        .groupBy(sql`json_each.value`)
        .orderBy(sql`json_each.value`)
        .all();

      return results.map((r) => r.tag);
    } catch (error) {
      const { getLogger } = require("@/lib/logger");
      getLogger().error({ err: error }, "Error fetching tags");
      return [];
    }
  }

  /**
   * Update book's totalPages within a transaction context
   * Used when recalculating progress percentages atomically
   * 
   * @param bookId - The book ID
   * @param totalPages - The new total page count
   * @param tx - Optional transaction context (for use in transactions)
   * @returns Updated book
   */
  updateTotalPagesWithRecalculation(
    bookId: number,
    totalPages: number,
    tx?: any
  ): Book {
    const database = tx || this.getDatabase();

    const [updated] = database
      .update(books)
      .set({ totalPages })
      .where(eq(books.id, bookId))
      .returning()
      .all();

    if (!updated) {
      throw new Error("Failed to update total pages");
    }

    return updated;
  }

  /**
   * Find books with filters AND eagerly load their sessions and progress in a single query.
   * This replaces the N+1 query pattern with a performant JOIN.
   */
  async findWithFiltersAndRelations(
    filters: BookFilter,
    limit: number = 50,
    skip: number = 0,
    sortBy?: string
  ): Promise<{ books: any[]; total: number }> {
    const conditions: SQL[] = [];

    // Orphaned filter
    if (filters.orphanedOnly) {
      conditions.push(eq(books.orphaned, true));
    } else if (!filters.showOrphaned) {
      conditions.push(or(eq(books.orphaned, false), sql`${books.orphaned} IS NULL`)!);
    }

    // Search filter
    if (filters.search) {
      const searchPattern = `%${filters.search}%`;
      conditions.push(
        or(
          like(books.title, searchPattern),
          like(books.authors, searchPattern)
        )!
      );
    }

    // Tags filter (JSON contains)
    // Use json_each for accurate JSON array searching instead of LIKE
    // Multiple tags use AND logic - book must have ALL selected tags
    if (filters.tags && filters.tags.length > 0) {
      const tagConditions = filters.tags.map((tag) =>
        sql`EXISTS (
          SELECT 1 FROM json_each(${books.tags})
          WHERE json_each.value = ${tag}
        )`
      );
      conditions.push(and(...tagConditions)!);
    }

    // Rating filter
    if (filters.rating && filters.rating !== "all") {
      const ratingCondition = this.buildRatingCondition(filters.rating);
      if (ratingCondition) {
        conditions.push(ratingCondition);
      }
    }

    // Status filter (requires join with sessions)
    let bookIds: number[] | undefined;
    if (filters.status) {
      const statusCondition = eq(readingSessions.status, filters.status as any);
      const activeCondition =
        filters.status === "read"
          ? undefined // For "read", include all sessions
          : eq(readingSessions.isActive, true);

      const sessionQuery = this.getDatabase()
        .select({ bookId: readingSessions.bookId })
        .from(readingSessions)
        .where(activeCondition ? and(statusCondition, activeCondition) : statusCondition);

      const sessions = sessionQuery.all() as Array<{ bookId: number }>;
      bookIds = sessions.map((s: any) => s.bookId);

      if (bookIds.length === 0) {
        return { books: [], total: 0 };
      }

      if (bookIds.length > 0) {
        conditions.push(inArray(books.id, bookIds));
      }
    }

    // Shelf filter (books must be on ANY of the selected shelves - OR logic)
    if (filters.shelfIds && filters.shelfIds.length > 0) {
      const shelfQuery = this.getDatabase()
        .selectDistinct({ bookId: bookShelves.bookId })
        .from(bookShelves)
        .where(inArray(bookShelves.shelfId, filters.shelfIds));

      const shelfBooks = shelfQuery.all() as Array<{ bookId: number }>;
      const shelfBookIds = shelfBooks.map((s) => s.bookId);

      if (shelfBookIds.length === 0) {
        return { books: [], total: 0 };
      }

      conditions.push(inArray(books.id, shelfBookIds));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Get total count
    const countResult = this.getDatabase()
      .select({ count: sql<number>`count(*)` })
      .from(books)
      .where(whereClause)
      .get();
    const total = countResult?.count ?? 0;

    // Determine sort order
    let orderBy: SQL;
    switch (sortBy) {
      case "title":
        orderBy = asc(books.title);
        break;
      case "title_desc":
        orderBy = desc(books.title);
        break;
      case "author":
        orderBy = asc(books.authors);
        break;
      case "author_desc":
        orderBy = desc(books.authors);
        break;
      case "created":
        // Sort by when the book was added to Calibre library (not tome database)
        orderBy = desc(books.addedToLibrary);
        break;
      case "created_desc":
        // Oldest books first by Calibre library date
        orderBy = asc(books.addedToLibrary);
        break;
      case "rating":
        orderBy = sql`${books.rating} DESC NULLS LAST`;
        break;
      case "rating_asc":
        orderBy = sql`${books.rating} ASC NULLS LAST`;
        break;
      case "pages":
        // Shortest books first (nulls last)
        orderBy = sql`${books.totalPages} ASC NULLS LAST`;
        break;
      case "pages_desc":
        // Longest books first (nulls last)
        orderBy = sql`${books.totalPages} DESC NULLS LAST`;
        break;
      case "recently_read":
        // Most recently finished books first
        // Uses subquery to get latest completed session date
        orderBy = sql`(
          SELECT MAX(rs.completed_date) 
          FROM ${readingSessions} rs 
          WHERE rs.book_id = ${books.id} 
            AND rs.status = 'read'
            AND rs.completed_date IS NOT NULL
        ) DESC NULLS LAST`;
        break;
      default:
        orderBy = desc(books.addedToLibrary);
    }

    // Build the main query with JOINs
    // We use a correlated subquery to select the appropriate session for each book
    const sessionIdSubquery = filters.status === "read"
      ? // For "read" filter: get most recent completed session
        sql`(
          SELECT rs.id FROM ${readingSessions} rs
          WHERE rs.book_id = ${books.id}
            AND rs.status = 'read'
          ORDER BY rs.completed_date DESC, rs.session_number DESC
          LIMIT 1
        )`
      : // For other filters: get active session, or fallback to most recent completed
        sql`(
          SELECT rs.id FROM ${readingSessions} rs
          WHERE rs.book_id = ${books.id}
          ORDER BY
            CASE WHEN rs.is_active = 1 THEN 0 ELSE 1 END,
            CASE WHEN rs.status = 'read' THEN rs.completed_date ELSE rs.started_date END DESC,
            rs.session_number DESC
          LIMIT 1
        )`;

    // Main query with LEFT JOINs
    const results = this.getDatabase()
      .select({
        // Book fields
        bookId: books.id,
        calibreId: books.calibreId,
        title: books.title,
        authors: books.authors,
        isbn: books.isbn,
        totalPages: books.totalPages,
        addedToLibrary: books.addedToLibrary,
        lastSynced: books.lastSynced,
        publisher: books.publisher,
        pubDate: books.pubDate,
        series: books.series,
        seriesIndex: books.seriesIndex,
        tags: books.tags,
        path: books.path,
        description: books.description,
        rating: books.rating,
        orphaned: books.orphaned,
        orphanedAt: books.orphanedAt,
        createdAt: books.createdAt,
        updatedAt: books.updatedAt,

        // Session fields
        sessionId: readingSessions.id,
        sessionUserId: readingSessions.userId,
        sessionBookId: readingSessions.bookId,
        sessionNumber: readingSessions.sessionNumber,
        sessionStatus: readingSessions.status,
        sessionStartedDate: readingSessions.startedDate,
        sessionCompletedDate: readingSessions.completedDate,
        sessionReview: readingSessions.review,
        sessionIsActive: readingSessions.isActive,
        sessionCreatedAt: readingSessions.createdAt,
        sessionUpdatedAt: readingSessions.updatedAt,

        // Progress fields (latest progress for the session)
        progressId: sql`(
          SELECT pl.id FROM progress_logs pl
          WHERE pl.session_id = ${readingSessions.id}
          ORDER BY pl.progress_date DESC
          LIMIT 1
        )`.as('progressId'),
        progressBookId: sql`(
          SELECT pl.book_id FROM progress_logs pl
          WHERE pl.session_id = ${readingSessions.id}
          ORDER BY pl.progress_date DESC
          LIMIT 1
        )`.as('progressBookId'),
        progressSessionId: sql`(
          SELECT pl.session_id FROM progress_logs pl
          WHERE pl.session_id = ${readingSessions.id}
          ORDER BY pl.progress_date DESC
          LIMIT 1
        )`.as('progressSessionId'),
        progressCurrentPage: sql`(
          SELECT pl.current_page FROM progress_logs pl
          WHERE pl.session_id = ${readingSessions.id}
          ORDER BY pl.progress_date DESC
          LIMIT 1
        )`.as('progressCurrentPage'),
        progressCurrentPercentage: sql`(
          SELECT pl.current_percentage FROM progress_logs pl
          WHERE pl.session_id = ${readingSessions.id}
          ORDER BY pl.progress_date DESC
          LIMIT 1
        )`.as('progressCurrentPercentage'),
        progressDate: sql`(
          SELECT pl.progress_date FROM progress_logs pl
          WHERE pl.session_id = ${readingSessions.id}
          ORDER BY pl.progress_date DESC
          LIMIT 1
        )`.as('progressDate'),
        progressNotes: sql`(
          SELECT pl.notes FROM progress_logs pl
          WHERE pl.session_id = ${readingSessions.id}
          ORDER BY pl.progress_date DESC
          LIMIT 1
        )`.as('progressNotes'),
        progressPagesRead: sql`(
          SELECT pl.pages_read FROM progress_logs pl
          WHERE pl.session_id = ${readingSessions.id}
          ORDER BY pl.progress_date DESC
          LIMIT 1
        )`.as('progressPagesRead'),
        progressCreatedAt: sql`(
          SELECT pl.created_at FROM progress_logs pl
          WHERE pl.session_id = ${readingSessions.id}
          ORDER BY pl.progress_date DESC
          LIMIT 1
        )`.as('progressCreatedAt'),
      })
      .from(books)
      .leftJoin(
        readingSessions,
        sql`${readingSessions.id} = ${sessionIdSubquery}`
      )
      .where(whereClause)
      .orderBy(orderBy)
      .limit(limit)
      .offset(skip)
      .all();

    // Map results to optimized structure (only fields needed by BookCard)
    // This reduces payload size by ~40-50% for large libraries
    const booksWithRelations = results.map((row: any) => ({
      id: row.bookId,
      calibreId: row.calibreId,
      title: row.title,
      authors: row.authors,
      tags: row.tags,
      totalPages: row.totalPages,
      rating: row.rating,
      status: row.sessionStatus,
      // Only include minimal progress info needed for display
      latestProgress: row.progressId ? {
        currentPage: row.progressCurrentPage,
        currentPercentage: row.progressCurrentPercentage,
        progressDate: row.progressDate,
      } : null,
    }));

    return { books: booksWithRelations, total };
  }

  /**
   * Get tag statistics with book counts
   * Returns all tags with their book counts
   */
  async getTagStats(): Promise<Array<{ name: string; bookCount: number }>> {
    try {
      // Query to get all unique tags with their book counts
      // Uses json_each to extract individual tag values from JSON arrays
      const results = this.getDatabase()
        .all(sql`
          SELECT 
            json_each.value as name,
            COUNT(DISTINCT books.id) as bookCount
          FROM books, json_each(books.tags)
          WHERE json_array_length(books.tags) > 0
          GROUP BY json_each.value
          ORDER BY json_each.value ASC
        `);

      // Map the raw results to the expected type
      return results.map((row: any) => ({
        name: row.name,
        bookCount: Number(row.bookCount),
      }));
    } catch (error) {
      const { getLogger } = require("@/lib/logger");
      getLogger().error({ err: error }, "Error fetching tag statistics");
      return [];
    }
  }

  /**
   * Get count of unique books that have at least one tag
   */
  async countBooksWithTags(): Promise<number> {
    try {
      const result = this.getDatabase()
        .select({ count: sql<number>`COUNT(*)` })
        .from(books)
        .where(sql`json_array_length(${books.tags}) > 0`)
        .get();
      
      return result?.count || 0;
    } catch (error) {
      const { getLogger } = require("@/lib/logger");
      getLogger().error({ err: error }, "Error counting books with tags");
      return 0;
    }
  }

  /**
   * Find books by a specific tag with pagination
   */
  async findByTag(
    tag: string,
    limit: number = 50,
    skip: number = 0
  ): Promise<{ books: Book[]; total: number }> {
    try {
      // Build the tag filter condition
      const tagCondition = sql`EXISTS (
        SELECT 1 FROM json_each(${books.tags})
        WHERE json_each.value = ${tag}
      )`;

      // Get total count
      const countResult = this.getDatabase()
        .select({ count: sql<number>`COUNT(*)` })
        .from(books)
        .where(tagCondition)
        .get();

      const total = countResult?.count || 0;

      // Get paginated books
      const results = this.getDatabase()
        .select()
        .from(books)
        .where(tagCondition)
        .orderBy(desc(books.createdAt))
        .limit(limit)
        .offset(skip)
        .all();

      return { books: results, total };
    } catch (error) {
      const { getLogger } = require("@/lib/logger");
      getLogger().error({ err: error, tag }, "Error finding books by tag");
      return { books: [], total: 0 };
    }
  }

  /**
   * Rename a tag across all books
   * Returns the number of books updated
   * 
   * Uses a transaction to ensure atomicity - either all books are updated or none are.
   * This prevents race conditions where concurrent tag operations could leave data in an inconsistent state.
   */
  async renameTag(oldName: string, newName: string): Promise<number> {
    try {
      const db = this.getDatabase();
      const { getLogger } = require("@/lib/logger");
      const logger = getLogger();

      // Use transaction for atomic update across all books
      return await db.transaction((tx) => {
        // Find all books with the old tag
        const booksWithTag = tx
          .select()
          .from(books)
          .where(sql`EXISTS (
            SELECT 1 FROM json_each(${books.tags})
            WHERE json_each.value = ${oldName}
          )`)
          .all();

        let updatedCount = 0;

        // Update each book's tags within the transaction
        for (const book of booksWithTag) {
          const currentTags = book.tags || [];
          const updatedTags = currentTags.map((tag: string) => tag === oldName ? newName : tag);

          tx.update(books)
            .set({ tags: updatedTags })
            .where(eq(books.id, book.id))
            .run();
          
          updatedCount++;
        }

        logger.info({ oldName, newName, updatedCount }, "Renamed tag across books");

        return updatedCount;
      });
    } catch (error) {
      const { getLogger } = require("@/lib/logger");
      getLogger().error({ err: error, oldName, newName }, "Error renaming tag");
      throw error;
    }
  }

  /**
   * Delete a tag from all books
   * Returns the number of books updated
   * 
   * Uses a transaction to ensure atomicity - either all books are updated or none are.
   * This prevents race conditions where concurrent tag operations could leave data in an inconsistent state.
   */
  async deleteTag(tagName: string): Promise<number> {
    try {
      const db = this.getDatabase();
      const { getLogger } = require("@/lib/logger");
      const logger = getLogger();

      // Use transaction for atomic update across all books
      return await db.transaction((tx) => {
        // Find all books with the tag
        const booksWithTag = tx
          .select()
          .from(books)
          .where(sql`EXISTS (
            SELECT 1 FROM json_each(${books.tags})
            WHERE json_each.value = ${tagName}
          )`)
          .all();

        let updatedCount = 0;

        // Remove tag from each book within the transaction
        for (const book of booksWithTag) {
          const currentTags = book.tags || [];
          const updatedTags = currentTags.filter((tag: string) => tag !== tagName);

          tx.update(books)
            .set({ tags: updatedTags })
            .where(eq(books.id, book.id))
            .run();
          
          updatedCount++;
        }

        logger.info({ tagName, updatedCount }, "Deleted tag from books");

        return updatedCount;
      });
    } catch (error) {
      const { getLogger } = require("@/lib/logger");
      getLogger().error({ err: error, tagName }, "Error deleting tag");
      throw error;
    }
  }

  /**
   * Merge multiple source tags into a target tag
   * Returns the number of books updated
   * 
   * Uses a transaction to ensure atomicity - either all books are updated or none are.
   * This prevents race conditions where concurrent tag operations could leave data in an inconsistent state.
   */
  async mergeTags(sourceTags: string[], targetTag: string): Promise<number> {
    try {
      const db = this.getDatabase();
      const { getLogger } = require("@/lib/logger");
      const logger = getLogger();

      // Use transaction for atomic update across all books
      return await db.transaction((tx) => {
        // Find all books with any of the source tags
        const tagConditions = sourceTags.map(tag =>
          sql`EXISTS (
            SELECT 1 FROM json_each(${books.tags})
            WHERE json_each.value = ${tag}
          )`
        );

        const booksWithTags = tx
          .select()
          .from(books)
          .where(or(...tagConditions)!)
          .all();

        let updatedCount = 0;

        // Update each book's tags within the transaction
        for (const book of booksWithTags) {
          const currentTags = book.tags || [];
          
          logger.info({ 
            bookId: book.id, 
            currentTags, 
            sourceTags, 
            targetTag 
          }, "Before merging tags for book");
          
          // Remove source tags and add target tag
          let updatedTags = currentTags.filter((tag: string) => !sourceTags.includes(tag));
          
          // Add target tag if not already present (deduplication)
          if (!updatedTags.includes(targetTag)) {
            updatedTags.push(targetTag);
          }
          
          logger.info({ 
            bookId: book.id, 
            updatedTags,
            changed: JSON.stringify(currentTags) !== JSON.stringify(updatedTags)
          }, "After merging tags for book");

          tx.update(books)
            .set({ tags: updatedTags })
            .where(eq(books.id, book.id))
            .run();
          
          updatedCount++;
        }

        logger.info({ sourceTags, targetTag, updatedCount }, "Merged tags");

        return updatedCount;
      });
    } catch (error) {
      const { getLogger } = require("@/lib/logger");
      getLogger().error({ err: error, sourceTags, targetTag }, "Error merging tags");
      throw error;
    }
  }

  /**
   * Bulk update tags for multiple books
   * Can add and/or remove tags from specified books
   * 
   * Uses a transaction to ensure atomicity - either all books are updated or none are.
   * This prevents race conditions where concurrent tag operations could leave data in an inconsistent state.
   */
  async bulkUpdateBookTags(
    bookIds: number[],
    tagsToAdd: string[] = [],
    tagsToRemove: string[] = []
  ): Promise<number> {
    try {
      if (bookIds.length === 0) {
        return 0;
      }

      const db = this.getDatabase();
      const { getLogger } = require("@/lib/logger");
      const logger = getLogger();

      // Use transaction for atomic update across all books
      return await db.transaction((tx) => {
        const booksToUpdate = tx
          .select()
          .from(books)
          .where(inArray(books.id, bookIds))
          .all();

        let updatedCount = 0;

        for (const book of booksToUpdate) {
          const currentTags = book.tags || [];
          
          // Remove specified tags
          let updatedTags = currentTags.filter((tag: string) => !tagsToRemove.includes(tag));
          
          // Add new tags (avoiding duplicates)
          for (const tagToAdd of tagsToAdd) {
            if (!updatedTags.includes(tagToAdd)) {
              updatedTags.push(tagToAdd);
            }
          }

          tx.update(books)
            .set({ tags: updatedTags })
            .where(eq(books.id, book.id))
            .run();
          
          updatedCount++;
        }

        logger.info({ bookIds, tagsToAdd, tagsToRemove, updatedCount }, "Bulk updated book tags");

        return updatedCount;
      });
    } catch (error) {
      const { getLogger } = require("@/lib/logger");
      getLogger().error({ err: error, bookIds, tagsToAdd, tagsToRemove }, "Error bulk updating tags");
      throw error;
    }
  }
}

// Singleton instance
export const bookRepository = new BookRepository();
