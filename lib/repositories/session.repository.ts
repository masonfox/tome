import { eq, and, desc, sql, SQL, asc, gte } from "drizzle-orm";
import { BaseRepository } from "./base.repository";
import { readingSessions, ReadingSession, NewReadingSession } from "@/lib/db/schema/reading-sessions";
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
  async findActiveByBookId(bookId: number): Promise<ReadingSession | undefined> {
    return this.getDatabase()
      .select()
      .from(readingSessions)
      .where(and(eq(readingSessions.bookId, bookId), eq(readingSessions.isActive, true)))
      .get();
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
  async findAllByBookId(bookId: number): Promise<ReadingSession[]> {
    return this.getDatabase()
      .select()
      .from(readingSessions)
      .where(eq(readingSessions.bookId, bookId))
      .orderBy(desc(readingSessions.sessionNumber))
      .all();
  }

  /**
   * Find latest session for a book (highest session number)
   */
  async findLatestByBookId(bookId: number): Promise<ReadingSession | undefined> {
    return this.getDatabase()
      .select()
      .from(readingSessions)
      .where(eq(readingSessions.bookId, bookId))
      .orderBy(desc(readingSessions.sessionNumber))
      .limit(1)
      .get();
  }

  /**
   * Find sessions by status
   */
  async findByStatus(
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
    * Count sessions by status
    */
   async countByStatus(status: ReadingSession["status"], activeOnly: boolean = true): Promise<number> {
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
    * Count completed sessions (status='read') after a date
    */
   async countCompletedAfterDate(date: Date): Promise<number> {
     const result = this.getDatabase()
       .select({ count: sql<number>`count(*)` })
       .from(readingSessions)
       .where(
         and(
           eq(readingSessions.status, "read"),
           gte(readingSessions.completedDate, date)
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
  async getNextSessionNumber(bookId: number): Promise<number> {
    const latest = await this.findLatestByBookId(bookId);
    return latest ? latest.sessionNumber + 1 : 1;
  }

  /**
   * Check if book has any completed reads
   */
  async hasCompletedReads(bookId: number): Promise<boolean> {
    const result = this.getDatabase()
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
}

// Singleton instance
export const sessionRepository = new SessionRepository();
