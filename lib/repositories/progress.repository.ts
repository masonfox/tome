import { eq, and, desc, asc, sql, gte, lte, lt, gt, SQL } from "drizzle-orm";
import { BaseRepository } from "./base.repository";
import { progressLogs, ProgressLog, NewProgressLog } from "@/lib/db/schema/progress-logs";
import { db } from "@/lib/db/sqlite";

export class ProgressRepository extends BaseRepository<
  ProgressLog,
  NewProgressLog,
  typeof progressLogs
> {
  constructor() {
    super(progressLogs);
  }

  /**
   * Find all progress logs for a book, sorted by date (descending)
   */
  async findByBookId(bookId: number): Promise<ProgressLog[]> {
    return this.getDatabase()
      .select()
      .from(progressLogs)
      .where(eq(progressLogs.bookId, bookId))
      .orderBy(desc(progressLogs.progressDate))
      .all();
  }

  /**
   * Find progress logs for a specific session
   */
  async findBySessionId(sessionId: number): Promise<ProgressLog[]> {
    return this.getDatabase()
      .select()
      .from(progressLogs)
      .where(eq(progressLogs.sessionId, sessionId))
      .orderBy(desc(progressLogs.progressDate))
      .all();
  }

  /**
   * Find latest progress for a book
   */
  async findLatestByBookId(bookId: number): Promise<ProgressLog | undefined> {
    return this.getDatabase()
      .select()
      .from(progressLogs)
      .where(eq(progressLogs.bookId, bookId))
      .orderBy(desc(progressLogs.progressDate))
      .limit(1)
      .get();
  }

  /**
   * Find latest progress for a session
   */
  async findLatestBySessionId(sessionId: number): Promise<ProgressLog | undefined> {
    return this.getDatabase()
      .select()
      .from(progressLogs)
      .where(eq(progressLogs.sessionId, sessionId))
      .orderBy(desc(progressLogs.progressDate))
      .limit(1)
      .get();
  }

  /**
   * Find progress logs for a book and session
   */
  async findByBookIdAndSessionId(bookId: number, sessionId: number): Promise<ProgressLog[]> {
    return this.getDatabase()
      .select()
      .from(progressLogs)
      .where(
        and(eq(progressLogs.bookId, bookId), eq(progressLogs.sessionId, sessionId))
      )
      .orderBy(desc(progressLogs.progressDate))
      .all();
  }

  /**
   * Find latest progress for a book and session
   */
  async findLatestByBookIdAndSessionId(
    bookId: number,
    sessionId: number
  ): Promise<ProgressLog | undefined> {
    return this.getDatabase()
      .select()
      .from(progressLogs)
      .where(
        and(eq(progressLogs.bookId, bookId), eq(progressLogs.sessionId, sessionId))
      )
      .orderBy(desc(progressLogs.progressDate))
      .limit(1)
      .get();
  }

  /**
   * Find progress logs after a certain date
   */
  async findAfterDate(date: Date): Promise<ProgressLog[]> {
    return this.getDatabase()
      .select()
      .from(progressLogs)
      .where(gte(progressLogs.progressDate, date))
      .orderBy(asc(progressLogs.progressDate))
      .all();
  }

  /**
   * Find progress entries BEFORE a specific date for a session
   * Used to validate that new entry has progress ≥ all previous entries
   */
  async findBeforeDateForSession(
    sessionId: number,
    date: Date
  ): Promise<ProgressLog[]> {
    return this.getDatabase()
      .select()
      .from(progressLogs)
      .where(
        and(
          eq(progressLogs.sessionId, sessionId),
          lt(progressLogs.progressDate, date)
        )
      )
      .orderBy(desc(progressLogs.progressDate))
      .all();
  }

  /**
   * Find progress entries AFTER a specific date for a session
   * Used to validate that new entry has progress ≤ all future entries
   */
  async findAfterDateForSession(
    sessionId: number,
    date: Date
  ): Promise<ProgressLog[]> {
    return this.getDatabase()
      .select()
      .from(progressLogs)
      .where(
        and(
          eq(progressLogs.sessionId, sessionId),
          gt(progressLogs.progressDate, date)
        )
      )
      .orderBy(asc(progressLogs.progressDate))
      .all();
  }

  /**
   * Find the closest progress entry before a date
   */
  async findClosestBeforeDate(
    sessionId: number,
    date: Date
  ): Promise<ProgressLog | undefined> {
    return this.getDatabase()
      .select()
      .from(progressLogs)
      .where(
        and(
          eq(progressLogs.sessionId, sessionId),
          lt(progressLogs.progressDate, date)
        )
      )
      .orderBy(desc(progressLogs.progressDate))
      .limit(1)
      .get();
  }

  /**
   * Find the closest progress entry after a date
   */
  async findClosestAfterDate(
    sessionId: number,
    date: Date
  ): Promise<ProgressLog | undefined> {
    return this.getDatabase()
      .select()
      .from(progressLogs)
      .where(
        and(
          eq(progressLogs.sessionId, sessionId),
          gt(progressLogs.progressDate, date)
        )
      )
      .orderBy(asc(progressLogs.progressDate))
      .limit(1)
      .get();
  }

  /**
   * Calculate total pages read
   */
  async getTotalPagesRead(): Promise<number> {
    const result = this.getDatabase()
      .select({ total: sql<number>`COALESCE(SUM(${progressLogs.pagesRead}), 0)` })
      .from(progressLogs)
      .get();

    return result?.total ?? 0;
  }

  /**
   * Calculate pages read after a date
   * Uses timezone-aware comparison: converts both stored UTC timestamps and query date
   * to local time before comparing, as per spec requirement for timezone support
   */
  async getPagesReadAfterDate(date: Date): Promise<number> {
    // Convert the input date to YYYY-MM-DD format in LOCAL timezone
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const localDateStr = `${year}-${month}-${day}`;
    
    // Query using SQLite's datetime with 'localtime' to convert stored UTC to local time
    // Then compare just the date portion
    const result = this.getDatabase()
      .select({ total: sql<number>`COALESCE(SUM(${progressLogs.pagesRead}), 0)` })
      .from(progressLogs)
      .where(sql`DATE(${progressLogs.progressDate}, 'unixepoch', 'localtime') >= ${localDateStr}`)
      .get();

    return result?.total ?? 0;
  }

  /**
   * Get activity calendar (dates with page counts)
   */
  async getActivityCalendar(
    startDate: Date,
    endDate: Date
  ): Promise<{ date: string; pagesRead: number }[]> {
    const results = this.getDatabase()
      .select({
        date: sql<string>`DATE(${progressLogs.progressDate}, 'unixepoch')`,
        pagesRead: sql<number>`SUM(${progressLogs.pagesRead})`,
      })
      .from(progressLogs)
      .where(
        and(
          gte(progressLogs.progressDate, startDate),
          lte(progressLogs.progressDate, endDate)
        )
      )
      .groupBy(sql`DATE(${progressLogs.progressDate}, 'unixepoch')`)
      .orderBy(sql`DATE(${progressLogs.progressDate}, 'unixepoch')`)
      .all();

    return results;
  }

  /**
   * Get average pages per day over a period
   */
  async getAveragePagesPerDay(days: number): Promise<number> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const result = this.getDatabase()
      .select({
        avgPages: sql<number>`
          COALESCE(
            AVG(daily_pages),
            0
          )
        `,
      })
      .from(
        db
          .select({
            daily_pages: sql<number>`SUM(${progressLogs.pagesRead})`.as("daily_pages"),
          })
          .from(progressLogs)
          .where(gte(progressLogs.progressDate, startDate))
          .groupBy(sql`DATE(${progressLogs.progressDate}, 'unixepoch')`)
          .as("daily_totals")
      )
      .get();

    return Math.round(result?.avgPages ?? 0);
  }

  /**
   * Check if there's progress logged for a session
   */
  async hasProgressForSession(sessionId: number): Promise<boolean> {
    const result = this.getDatabase()
      .select({ count: sql<number>`count(*)` })
      .from(progressLogs)
      .where(eq(progressLogs.sessionId, sessionId))
      .get();

    return (result?.count ?? 0) > 0;
  }

  /**
   * Get progress for a specific date (timezone-aware)
   * Uses SQLite's localtime conversion to match the calendar day in the user's timezone
   */
  async getProgressForDate(date: Date): Promise<{ pagesRead: number } | undefined> {
    // Convert the input date to YYYY-MM-DD format in LOCAL timezone
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const localDateStr = `${year}-${month}-${day}`;

    const result = this.getDatabase()
      .select({ pagesRead: sql<number>`COALESCE(SUM(${progressLogs.pagesRead}), 0)` })
      .from(progressLogs)
      .where(sql`DATE(${progressLogs.progressDate}, 'unixepoch', 'localtime') = ${localDateStr}`)
      .get();

    return result || { pagesRead: 0 };
  }

  /**
   * Get all progress logs ordered by date
   */
  async getAllProgressOrdered(): Promise<ProgressLog[]> {
    return this.getDatabase()
      .select()
      .from(progressLogs)
      .orderBy(asc(progressLogs.progressDate))
      .all();
  }
}

// Singleton instance
export const progressRepository = new ProgressRepository();
