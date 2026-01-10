import { eq, and, desc, asc, sql, gte, lte, lt, gt, SQL } from "drizzle-orm";
import { BaseRepository } from "./base.repository";
import { progressLogs, ProgressLog, NewProgressLog } from "@/lib/db/schema/progress-logs";
import { readingSessions } from "@/lib/db/schema/reading-sessions";
import { books } from "@/lib/db/schema/books";
import { db } from "@/lib/db/sqlite";
import { calculatePercentage } from "@/lib/utils/progress-calculations";
import { toDateString } from "@/utils/dateHelpers.server";

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
  async findBySessionId(sessionId: number, tx?: any): Promise<ProgressLog[]> {
    const database = tx || this.getDatabase();
    return database
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
  async findLatestBySessionId(sessionId: number, tx?: any): Promise<ProgressLog | undefined> {
    const database = tx || this.getDatabase();
    return database
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
    const dateString = toDateString(date);
    return this.getDatabase()
      .select()
      .from(progressLogs)
      .where(gte(progressLogs.progressDate, dateString))
      .orderBy(asc(progressLogs.progressDate))
      .all();
  }

  /**
   * Find progress entries BEFORE a specific date for a session
   * Used to validate that new entry has progress ≥ all previous entries
   * @param date - Date string in YYYY-MM-DD format
   */
  async findBeforeDateForSession(
    sessionId: number,
    date: string
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
   * @param date - Date string in YYYY-MM-DD format
   */
  async findAfterDateForSession(
    sessionId: number,
    date: string
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
    const dateString = toDateString(date);
    return this.getDatabase()
      .select()
      .from(progressLogs)
      .where(
        and(
          eq(progressLogs.sessionId, sessionId),
          lt(progressLogs.progressDate, dateString)
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
    const dateString = toDateString(date);
    return this.getDatabase()
      .select()
      .from(progressLogs)
      .where(
        and(
          eq(progressLogs.sessionId, sessionId),
          gt(progressLogs.progressDate, dateString)
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
   * Calculate pages read after a UTC date (timezone-agnostic)
   * Compares UTC timestamps directly without timezone conversion
   * 
   * IMPORTANT: Caller must convert user's day boundary to UTC before calling.
   * Use toZonedTime/fromZonedTime to get user's "today" in UTC.
   * 
   * @param date UTC timestamp representing the start of a day in user's timezone
   * @example
   * // Get pages read "today" for user in Tokyo
   * const now = new Date();
   * const todayInUserTz = startOfDay(toZonedTime(now, 'Asia/Tokyo'));
   * const todayUtc = fromZonedTime(todayInUserTz, 'Asia/Tokyo');
   * const pages = await progressRepository.getPagesReadAfterDate(todayUtc);
   */
  async getPagesReadAfterDate(date: Date): Promise<number> {
    const result = this.getDatabase()
      .select({ total: sql<number>`COALESCE(SUM(${progressLogs.pagesRead}), 0)` })
      .from(progressLogs)
      .where(gte(progressLogs.progressDate, toDateString(date)))
      .get();

    return result?.total ?? 0;
  }

  /**
   * Get activity calendar (dates with page counts)
   * 
   * @param startDate Start of date range in UTC
   * @param endDate End of date range in UTC
   * @param timezone DEPRECATED - no longer used, progressDate is already a calendar day
   * @returns Array of {date: 'YYYY-MM-DD', pagesRead: number} grouped by progressDate
   * 
   * @example
   * const calendar = await progressRepository.getActivityCalendar(
   *   startDateUtc, 
   *   endDateUtc, 
   *   'America/New_York'
   * );
   * // Returns dates like '2025-12-02' (the progressDate calendar day)
   */
  async getActivityCalendar(
    startDate: Date,
    endDate: Date,
    timezone: string = 'America/New_York'
  ): Promise<{ date: string; pagesRead: number }[]> {
    // Get all progress logs in date range
    const logs = this.getDatabase()
      .select()
      .from(progressLogs)
      .where(
        and(
          gte(progressLogs.progressDate, toDateString(startDate)),
          lte(progressLogs.progressDate, toDateString(endDate))
        )
      )
      .all();

    // Group by date (progressDate is already the calendar day string)
    const dailyMap = new Map<string, number>();
    
    logs.forEach(log => {
      // progressDate is YYYY-MM-DD string - use it directly as the calendar day
      const dateKey = log.progressDate;
      const current = dailyMap.get(dateKey) || 0;
      dailyMap.set(dateKey, current + (log.pagesRead || 0));
    });

    // Convert to array and sort
    return Array.from(dailyMap.entries())
      .map(([date, pagesRead]) => ({ date, pagesRead }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  /**
   * Get average pages per day over a period in user's timezone
   * 
   * IMPORTANT: Caller must provide start date in UTC (representing start of day in user TZ)
   * 
   * @param startDateUtc Start of period in UTC (user's day boundary converted to UTC)
   * @param timezone IANA timezone identifier for grouping by calendar day
   * @returns Average pages per day, rounded to nearest integer
   * 
   * @example
   * // Get average pages per day for last 30 days for user in Tokyo
   * const now = new Date();
   * const todayInUserTz = startOfDay(toZonedTime(now, 'Asia/Tokyo'));
   * const thirtyDaysAgoInUserTz = subDays(todayInUserTz, 30);
   * const startDateUtc = fromZonedTime(thirtyDaysAgoInUserTz, 'Asia/Tokyo');
   * const avg = await progressRepository.getAveragePagesPerDay(startDateUtc, 'Asia/Tokyo');
   */
  async getAveragePagesPerDay(startDateUtc: Date, timezone: string = 'America/New_York'): Promise<number> {
    // Get all logs since start date
    const logs = this.getDatabase()
      .select()
      .from(progressLogs)
      .where(gte(progressLogs.progressDate, toDateString(startDateUtc)))
      .all();

    if (logs.length === 0) {
      return 0;
    }

    // Group by date in user's timezone
    const { toZonedTime } = require('date-fns-tz');
    const { startOfDay, format } = require('date-fns');
    
    const dailyMap = new Map<string, number>();
    
    logs.forEach(log => {
      // progressDate is YYYY-MM-DD string, parse as midnight UTC
      const progressDateUtc = new Date(log.progressDate + "T00:00:00Z");
      const dateInUserTz = toZonedTime(progressDateUtc, timezone);
      const dayStart = startOfDay(dateInUserTz);
      const dateKey = format(dayStart, 'yyyy-MM-dd');
      
      const current = dailyMap.get(dateKey) || 0;
      dailyMap.set(dateKey, current + (log.pagesRead || 0));
    });

    // Calculate average
    const totalPages = Array.from(dailyMap.values()).reduce((sum, pages) => sum + pages, 0);
    const avgPages = dailyMap.size > 0 ? totalPages / dailyMap.size : 0;

    return Math.round(avgPages);
  }

  /**
   * Check if there's progress logged for a session
   */
  async hasProgressForSession(sessionId: number, tx?: any): Promise<boolean> {
    const database = tx || this.getDatabase();
    const result = database
      .select({ count: sql<number>`count(*)` })
      .from(progressLogs)
      .where(eq(progressLogs.sessionId, sessionId))
      .get();

    return (result?.count ?? 0) > 0;
  }

  /**
   * Get progress for a specific date in user's timezone
   * 
   * IMPORTANT: Caller must provide UTC timestamps for start/end of day in user's timezone
   * 
   * @param dateStartUtc Start of day in UTC (user's midnight converted to UTC)
   * @param dateEndUtc End of day in UTC (user's 23:59:59 converted to UTC)
   * @returns Total pages read during that calendar day in user's timezone
   * 
   * @example
   * // Get progress for "today" for user in Tokyo
   * const now = new Date();
   * const todayInUserTz = startOfDay(toZonedTime(now, 'Asia/Tokyo'));
   * const tomorrowInUserTz = endOfDay(todayInUserTz);
   * const startUtc = fromZonedTime(todayInUserTz, 'Asia/Tokyo');
   * const endUtc = fromZonedTime(tomorrowInUserTz, 'Asia/Tokyo');
   * const progress = await progressRepository.getProgressForDate(startUtc, endUtc);
   */
  async getProgressForDate(dateStartUtc: Date, dateEndUtc: Date): Promise<{ pagesRead: number }> {
    const result = this.getDatabase()
      .select({ pagesRead: sql<number>`COALESCE(SUM(${progressLogs.pagesRead}), 0)` })
      .from(progressLogs)
      .where(
        and(
          gte(progressLogs.progressDate, toDateString(dateStartUtc)),
          lte(progressLogs.progressDate, toDateString(dateEndUtc))
        )
      )
      .get();

    return result || { pagesRead: 0 };
  }

  /**
   * Get the highest currentPage across all progress logs for active sessions of a book
   * Used to validate page count reductions don't contradict existing progress
   *
   * @param bookId - The book ID to check
   * @returns The maximum currentPage value from active sessions, or 0 if no active progress exists
   */
  async getHighestCurrentPageForActiveSessions(bookId: number): Promise<number> {

    const result = this.getDatabase()
      .select({ maxPage: sql<number>`MAX(${this.table.currentPage})` })
      .from(this.table)
      .innerJoin(
        readingSessions,
        eq(this.table.sessionId, readingSessions.id)
      )
      .where(
        and(
          eq(this.table.bookId, bookId),
          eq(readingSessions.isActive, true),
          eq(readingSessions.status, 'reading')
        )
      )
      .get();

    return result?.maxPage ?? 0;
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

  /**
   * Get all progress logs with book information for journal view
   * Ordered by date descending (most recent first)
   */
  async getAllProgressWithBooks(): Promise<Array<ProgressLog & { book: { id: number; title: string; authors: string[] } }>> {
    const { books } = require("../db/schema/books");
    
    return this.getDatabase()
      .select({
        id: progressLogs.id,
        userId: progressLogs.userId,
        bookId: progressLogs.bookId,
        sessionId: progressLogs.sessionId,
        currentPage: progressLogs.currentPage,
        currentPercentage: progressLogs.currentPercentage,
        progressDate: progressLogs.progressDate,
        notes: progressLogs.notes,
        pagesRead: progressLogs.pagesRead,
        createdAt: progressLogs.createdAt,
        book: {
          id: books.id,
          title: books.title,
          authors: books.authors,
        },
      })
      .from(progressLogs)
      .innerJoin(books, eq(progressLogs.bookId, books.id))
      .orderBy(desc(progressLogs.progressDate))
      .all();
  }

  /**
   * Get the earliest progress date across all logs
   * Returns null if no progress logs exist
   */
  async getEarliestProgressDate(): Promise<Date | null> {
    const result = this.getDatabase()
      .select({ earliestDate: sql<string>`MIN(${progressLogs.progressDate})` })
      .from(progressLogs)
      .get();

    if (!result?.earliestDate) {
      return null;
    }

    // progressDate is now TEXT in YYYY-MM-DD format
    // Parse it as midnight UTC
    const [year, month, day] = result.earliestDate.split('-').map(Number);
    return new Date(Date.UTC(year, month - 1, day));
  }

  /**
   * Get the earliest progress date as a YYYY-MM-DD string
   * Returns null if no progress exists
   * This avoids timezone conversion issues when comparing dates
   */
  async getEarliestProgressDateString(): Promise<string | null> {
    const result = this.getDatabase()
      .select({ earliestDate: sql<string>`MIN(${progressLogs.progressDate})` })
      .from(progressLogs)
      .get();

    return result?.earliestDate ?? null;
  }

  /**
   * Recalculate progress percentages for all active sessions of a book
   * Used when book's totalPages is updated
   * 
   * @param bookId - The book ID
   * @param newTotalPages - The new total page count
   * @param tx - Optional transaction context (for use in transactions)
   * @returns Number of progress logs updated
   */
  recalculatePercentagesForBook(
    bookId: number,
    newTotalPages: number,
    tx?: any
  ): number {
    const database = tx || this.getDatabase();

    // 1. Find active sessions for this book
    const activeSessions = database
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

    // 2. For each active session, recalculate progress log percentages
    let totalLogsUpdated = 0;
    for (const session of activeSessions) {
      // Get progress logs for this session
      const logs = database
        .select()
        .from(progressLogs)
        .where(eq(progressLogs.sessionId, session.id))
        .all();

      // Update each log with new percentage
      for (const log of logs) {
        const newPercentage = calculatePercentage(log.currentPage, newTotalPages);
        database
          .update(progressLogs)
          .set({ currentPercentage: newPercentage })
          .where(eq(progressLogs.id, log.id))
          .run();
        totalLogsUpdated++;
      }
    }

    return totalLogsUpdated;
  }
}

// Singleton instance
export const progressRepository = new ProgressRepository();
