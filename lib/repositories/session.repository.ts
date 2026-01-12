import { eq, and, desc, sql, SQL, asc, gte, or } from "drizzle-orm";
import { BaseRepository } from "./base.repository";
import { readingSessions, ReadingSession, NewReadingSession } from "@/lib/db/schema/reading-sessions";
import { books } from "@/lib/db/schema/books";
import { db } from "@/lib/db/sqlite";

export class SessionRepository extends BaseRepository<
  ReadingSession,
  NewReadingSession,
  typeof readingSessions
> {
  constructor() {
    super(readingSessions);
  }

  /**
   * Find active session for a book
   */
  async findActiveByBookId(bookId: number, tx?: any): Promise<ReadingSession | undefined> {
    const database = tx || this.getDatabase();
    return database
      .select()
      .from(readingSessions)
      .where(and(eq(readingSessions.bookId, bookId), eq(readingSessions.isActive, true)))
      .get();
  }

  /**
   * Find all active sessions for a book
   * Active = is_active = true AND status = 'reading'
   * Used for page count update to recalculate progress percentages
   */
  async findActiveSessionsByBookId(bookId: number): Promise<ReadingSession[]> {
    return this.getDatabase()
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
  }

  /**
   * Find session by book ID and session number
   */
  async findByBookIdAndSessionNumber(
    bookId: number,
    sessionNumber: number
  ): Promise<ReadingSession | undefined> {
    return this.getDatabase()
      .select()
      .from(readingSessions)
      .where(
        and(
          eq(readingSessions.bookId, bookId),
          eq(readingSessions.sessionNumber, sessionNumber)
        )
      )
      .get();
  }

  /**
   * Find all sessions for a book, sorted by session number (descending)
   */
  async findAllByBookId(bookId: number, tx?: any): Promise<ReadingSession[]> {
    const database = tx || this.getDatabase();
    return database
      .select()
      .from(readingSessions)
      .where(eq(readingSessions.bookId, bookId))
      .orderBy(desc(readingSessions.sessionNumber))
      .all();
  }

  /**
   * Find all sessions for a book with progress summaries - OPTIMIZED
   * Uses a single query with aggregations instead of N+1 queries
   */
  async findAllByBookIdWithProgress(bookId: number): Promise<Array<ReadingSession & {
    progressSummary: {
      totalEntries: number;
      totalPagesRead: number;
      latestProgress: {
        currentPage: number;
        currentPercentage: number;
        progressDate: string;
        notes: string | null;
      } | null;
      firstProgressDate: string | null;
      lastProgressDate: string | null;
    }
  }>> {
    // Import progress_logs table
    const { progressLogs } = await import("@/lib/db/schema/progress-logs");

    const results = this.getDatabase()
      .select({
        // Session fields
        id: readingSessions.id,
        userId: readingSessions.userId,
        bookId: readingSessions.bookId,
        sessionNumber: readingSessions.sessionNumber,
        status: readingSessions.status,
        startedDate: readingSessions.startedDate,
        completedDate: readingSessions.completedDate,
        dnfDate: readingSessions.dnfDate,
        review: readingSessions.review,
        isActive: readingSessions.isActive,
        createdAt: readingSessions.createdAt,
        updatedAt: readingSessions.updatedAt,

        // Progress aggregations
        totalEntries: sql`COUNT(${progressLogs.id})`.as('totalEntries'),
        totalPagesRead: sql`COALESCE(SUM(${progressLogs.pagesRead}), 0)`.as('totalPagesRead'),
        // Progress dates are already in YYYY-MM-DD format
        firstProgressDate: sql`MIN(${progressLogs.progressDate})`.as('firstProgressDate'),
        lastProgressDate: sql`MAX(${progressLogs.progressDate})`.as('lastProgressDate'),

        // Latest progress fields (using MAX to get most recent)
        latestProgressCurrentPage: sql`(
          SELECT pl.current_page FROM progress_logs pl
          WHERE pl.session_id = ${readingSessions.id}
          ORDER BY pl.progress_date DESC, pl.id DESC
          LIMIT 1
        )`.as('latestProgressCurrentPage'),
        latestProgressCurrentPercentage: sql`(
          SELECT pl.current_percentage FROM progress_logs pl
          WHERE pl.session_id = ${readingSessions.id}
          ORDER BY pl.progress_date DESC, pl.id DESC
          LIMIT 1
        )`.as('latestProgressCurrentPercentage'),
        latestProgressDate: sql`(
          SELECT pl.progress_date FROM progress_logs pl
          WHERE pl.session_id = ${readingSessions.id}
          ORDER BY pl.progress_date DESC, pl.id DESC
          LIMIT 1
        )`.as('latestProgressDate'),
        latestProgressNotes: sql`(
          SELECT pl.notes FROM progress_logs pl
          WHERE pl.session_id = ${readingSessions.id}
          ORDER BY pl.progress_date DESC, pl.id DESC
          LIMIT 1
        )`.as('latestProgressNotes'),
      })
      .from(readingSessions)
      .leftJoin(progressLogs, eq(progressLogs.sessionId, readingSessions.id))
      .where(eq(readingSessions.bookId, bookId))
      .groupBy(readingSessions.id)
      .orderBy(desc(readingSessions.sessionNumber))
      .all();

    // Map results to proper structure
    return results.map((row: any) => ({
      id: row.id,
      userId: row.userId,
      bookId: row.bookId,
      sessionNumber: row.sessionNumber,
      status: row.status,
      startedDate: row.startedDate,
      completedDate: row.completedDate,
      dnfDate: row.dnfDate,
      review: row.review,
      isActive: row.isActive,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      progressSummary: {
        totalEntries: row.totalEntries as number,
        totalPagesRead: row.totalPagesRead as number,
        latestProgress: row.latestProgressCurrentPage ? {
          currentPage: row.latestProgressCurrentPage,
          currentPercentage: row.latestProgressCurrentPercentage,
          progressDate: row.latestProgressDate,
          notes: row.latestProgressNotes,
        } : null,
        firstProgressDate: row.firstProgressDate,
        lastProgressDate: row.lastProgressDate,
      },
    }));
  }

  /**
   * Find latest session for a book (highest session number)
   */
  async findLatestByBookId(bookId: number, tx?: any): Promise<ReadingSession | undefined> {
    const database = tx || this.getDatabase();
    return database
      .select()
      .from(readingSessions)
      .where(eq(readingSessions.bookId, bookId))
      .orderBy(desc(readingSessions.sessionNumber))
      .limit(1)
      .get();
  }

  /**
   * Find sessions by status (excludes orphaned books by default)
   */
  async findByStatus(
    status: ReadingSession["status"],
    activeOnly: boolean = true,
    limit?: number
  ): Promise<ReadingSession[]> {
    const sessionConditions = activeOnly
      ? and(eq(readingSessions.status, status), eq(readingSessions.isActive, true))
      : eq(readingSessions.status, status);

    let query = this.getDatabase()
      .select({
        id: readingSessions.id,
        userId: readingSessions.userId,
        bookId: readingSessions.bookId,
        sessionNumber: readingSessions.sessionNumber,
        status: readingSessions.status,
        startedDate: readingSessions.startedDate,
        completedDate: readingSessions.completedDate,
        review: readingSessions.review,
        isActive: readingSessions.isActive,
        createdAt: readingSessions.createdAt,
        updatedAt: readingSessions.updatedAt,
      })
      .from(readingSessions)
      .innerJoin(books, eq(readingSessions.bookId, books.id))
      .where(
        and(
          sessionConditions,
          or(eq(books.orphaned, false), sql`${books.orphaned} IS NULL`)
        )
      )
      .orderBy(desc(readingSessions.updatedAt));

    if (limit) {
      query = query.limit(limit) as any;
    }

    return query.all() as ReadingSession[];
  }

  /**
   * Find sessions by status including orphaned books
   */
  async findByStatusIncludingOrphaned(
    status: ReadingSession["status"],
    activeOnly: boolean = true,
    limit?: number
  ): Promise<ReadingSession[]> {
    const conditions = activeOnly
      ? and(eq(readingSessions.status, status), eq(readingSessions.isActive, true))
      : eq(readingSessions.status, status);

    let query = this.getDatabase()
      .select()
      .from(readingSessions)
      .where(conditions)
      .orderBy(desc(readingSessions.updatedAt));

    if (limit) {
      query = query.limit(limit) as any;
    }

    return query.all();
  }

   /**
    * Count sessions by status (excludes orphaned books by default)
    */
   async countByStatus(status: ReadingSession["status"], activeOnly: boolean = true): Promise<number> {
     const sessionConditions = activeOnly
       ? and(eq(readingSessions.status, status), eq(readingSessions.isActive, true))
       : eq(readingSessions.status, status);

     const result = this.getDatabase()
       .select({ count: sql<number>`count(*)` })
       .from(readingSessions)
       .innerJoin(books, eq(readingSessions.bookId, books.id))
       .where(
         and(
           sessionConditions,
           or(eq(books.orphaned, false), sql`${books.orphaned} IS NULL`)
         )
       )
       .get();

     return result?.count ?? 0;
   }

   /**
    * Count sessions by status including orphaned books
    */
   async countByStatusIncludingOrphaned(status: ReadingSession["status"], activeOnly: boolean = true): Promise<number> {
     const conditions = activeOnly
       ? and(eq(readingSessions.status, status), eq(readingSessions.isActive, true))
       : eq(readingSessions.status, status);

     const result = this.getDatabase()
       .select({ count: sql<number>`count(*)` })
       .from(readingSessions)
       .where(conditions)
       .get();

     return result?.count ?? 0;
   }

   /**
    * Count completed reading sessions after a specific date (inclusive)
    * Used for annual reading goals (count books read this year)
    * 
    * @param dateString - Date in YYYY-MM-DD format
    * @returns Number of completed sessions on or after the date
    * 
    * @example
    * const count = await sessionRepository.countCompletedAfterDate("2025-01-01");
    */
   async countCompletedAfterDate(dateString: string): Promise<number> {
     const result = this.getDatabase()
       .select({ count: sql<number>`count(*)` })
       .from(readingSessions)
       .where(
         and(
           eq(readingSessions.status, "read"),
           gte(readingSessions.completedDate, dateString)
         )
       )
       .get();

     return result?.count ?? 0;
   }

  /**
   * Find most recent completed session for a book
   */
  async findMostRecentCompletedByBookId(bookId: number): Promise<ReadingSession | undefined> {
    return this.getDatabase()
      .select()
      .from(readingSessions)
      .where(
        and(
          eq(readingSessions.bookId, bookId),
          eq(readingSessions.status, "read")
        )
      )
      .orderBy(desc(readingSessions.completedDate), desc(readingSessions.sessionNumber))
      .limit(1)
      .get();
  }

  /**
   * Archive a session (set isActive = false)
   */
  async archive(id: number): Promise<ReadingSession | undefined> {
    return this.update(id, { isActive: false } as any);
  }

  /**
   * Get next session number for a book
   */
  async getNextSessionNumber(bookId: number, tx?: any): Promise<number> {
    const latest = await this.findLatestByBookId(bookId, tx);
    return latest ? latest.sessionNumber + 1 : 1;
  }

  /**
   * Check if book has any completed reads
   */
  async hasCompletedReads(bookId: number, tx?: any): Promise<boolean> {
    const database = tx || this.getDatabase();
    const result = database
      .select({ count: sql<number>`count(*)` })
      .from(readingSessions)
      .where(
        and(eq(readingSessions.bookId, bookId), eq(readingSessions.status, "read"))
      )
      .get();

    return (result?.count ?? 0) > 0;
  }

   /**
    * Count total completed reads for a book
    */
   async countCompletedReadsByBookId(bookId: number): Promise<number> {
     const result = this.getDatabase()
       .select({ count: sql<number>`count(*)` })
       .from(readingSessions)
       .where(
         and(eq(readingSessions.bookId, bookId), eq(readingSessions.status, "read"))
       )
       .get();

     return result?.count ?? 0;
   }

   /**
    * Count sessions for a specific book
    */
   async countByBookId(bookId: number): Promise<number> {
     const result = this.getDatabase()
       .select({ count: sql<number>`count(*)` })
       .from(readingSessions)
       .where(eq(readingSessions.bookId, bookId))
       .get();

     return result?.count ?? 0;
   }

   /**
    * Bulk create reading sessions for sync performance optimization
    * 
    * Creates multiple "to-read" sessions in batches for newly synced books.
    * Processes sessions in batches of 1000 to avoid SQLite limits.
    * 
    * This is much more efficient than individual create() calls.
    * For a library with 150k new books, this reduces 150k operations to ~150 operations.
    * 
    * @param sessionsData - Array of session data to create
    * @returns Number of sessions created
    */
   async bulkCreate(sessionsData: NewReadingSession[]): Promise<number> {
     if (sessionsData.length === 0) {
       return 0;
     }

     const db = this.getDatabase();
     const BATCH_SIZE = 1000;
     let totalCreated = 0;

     // Process in batches to avoid SQLite limits
     for (let i = 0; i < sessionsData.length; i += BATCH_SIZE) {
       const batch = sessionsData.slice(i, i + BATCH_SIZE);
       
       // Use a transaction for each batch
       await db.transaction((tx) => {
         for (const sessionData of batch) {
           tx.insert(readingSessions)
             .values(sessionData)
             .run();
         }
       });

       totalCreated += batch.length;
     }

     return totalCreated;
   }
}

// Singleton instance
export const sessionRepository = new SessionRepository();
