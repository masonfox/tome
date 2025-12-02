import { bookRepository, sessionRepository, progressRepository, streakRepository } from "@/lib/repositories";
import { startOfYear, startOfMonth, startOfDay } from "date-fns";

export interface DashboardStats {
  booksRead: {
    thisYear: number;
    total: number;
  };
  currentlyReading: number;
  pagesRead: {
    today: number;
    thisMonth: number;
  };
  avgPagesPerDay: number;
}

export interface DashboardStreak {
  currentStreak: number;
  longestStreak: number;
  dailyThreshold: number;
  hoursRemainingToday: number;
  todayPagesRead: number;
}

export interface BookWithStatus {
  id: number;
  title: string;
  authors: string[];
  calibreId: number;
  status?: string | null;
  rating?: number | null;
  latestProgress?: any;
}

export interface DashboardData {
  stats: DashboardStats | null;
  streak: DashboardStreak | null;
  currentlyReading: BookWithStatus[];
  currentlyReadingTotal: number;
  readNext: BookWithStatus[];
  readNextTotal: number;
}

export async function getDashboardData(): Promise<DashboardData> {
  try {
    // Get stats
    const stats = await getStats();

    // Get streak
    const streak = await getStreak();

    // Get currently reading books with total count
    const { books: currentlyReading, total: currentlyReadingTotal } = await getBooksByStatus(
      "reading",
      6
    );

    // Get read next books with total count
    const { books: readNext, total: readNextTotal } = await getBooksByStatus("read-next", 6);

    return {
      stats,
      streak,
      currentlyReading,
      currentlyReadingTotal,
      readNext,
      readNextTotal,
    };
  } catch (error) {
    const { getLogger } = require("@/lib/logger");
    getLogger().error({ err: error }, "Failed to fetch dashboard data");
    return {
      stats: null,
      streak: null,
      currentlyReading: [],
      currentlyReadingTotal: 0,
      readNext: [],
      readNextTotal: 0,
    };
  }
}

async function getStats(): Promise<DashboardStats | null> {
  try {
    // Get user timezone from streak record to ensure consistency
    const streak = await streakRepository.getOrCreate(null);
    const userTimezone = streak.userTimezone || 'America/New_York';
    
    const { toZonedTime, fromZonedTime } = require("date-fns-tz");
    const { subDays } = require("date-fns");
    const now = new Date();
    
    // Calculate all date boundaries in user's timezone
    const todayInUserTz = startOfDay(toZonedTime(now, userTimezone));
    const todayUtc = fromZonedTime(todayInUserTz, userTimezone);
    
    const monthStartInUserTz = startOfMonth(toZonedTime(now, userTimezone));
    const monthStartUtc = fromZonedTime(monthStartInUserTz, userTimezone);
    
    const yearStartInUserTz = startOfYear(toZonedTime(now, userTimezone));
    const yearStartUtc = fromZonedTime(yearStartInUserTz, userTimezone);
    
    const thirtyDaysAgoInUserTz = subDays(todayInUserTz, 30);
    const thirtyDaysAgoUtc = fromZonedTime(thirtyDaysAgoInUserTz, userTimezone);

    // Books read this year (using user's year boundary)
    const booksReadThisYear = await sessionRepository.countCompletedAfterDate(yearStartUtc);

    // Total books read
    const totalBooksRead = await sessionRepository.countByStatus("read", false);

    // Currently reading count
    const currentlyReadingCount = await sessionRepository.countByStatus("reading", true);

    // Pages read today (using user's today)
    const pagesToday = await progressRepository.getPagesReadAfterDate(todayUtc);

    // Pages read this month (using user's month boundary)
    const pagesThisMonth = await progressRepository.getPagesReadAfterDate(monthStartUtc);

    // Average pages per day (last 30 days in user's timezone)
    const avgPages = await progressRepository.getAveragePagesPerDay(thirtyDaysAgoUtc, userTimezone);

    return {
      booksRead: {
        thisYear: booksReadThisYear,
        total: totalBooksRead,
      },
      currentlyReading: currentlyReadingCount,
      pagesRead: {
        today: pagesToday,
        thisMonth: pagesThisMonth,
      },
      avgPagesPerDay: avgPages,
    };
  } catch (error) {
    const { getLogger } = require("@/lib/logger");
    getLogger().error({ err: error }, "Failed to fetch stats");
    return null;
  }
}

async function getStreak(): Promise<DashboardStreak | null> {
  try {
    const { streakService } = await import("@/lib/services/streak.service");

    // First, check and reset streak if needed (explicit write operation)
    await streakService.checkAndResetStreakIfNeeded(null);

    // Then, get the current streak data (read-only operation)
    const streak = await streakService.getStreak(null);

    // Get today's pages read (use user's timezone from streak record)
    const { toZonedTime, fromZonedTime } = require("date-fns-tz");
    const userTimezone = streak.userTimezone || 'America/New_York';
    const now = new Date();
    const todayInUserTz = startOfDay(toZonedTime(now, userTimezone));
    const todayUtc = fromZonedTime(todayInUserTz, userTimezone);
    const todayPages = await progressRepository.getPagesReadAfterDate(todayUtc);

    return {
      currentStreak: streak.currentStreak,
      longestStreak: streak.longestStreak,
      dailyThreshold: streak.dailyThreshold,
      hoursRemainingToday: streak.hoursRemainingToday,
      todayPagesRead: todayPages,
    };
  } catch (error) {
    const { getLogger } = require("@/lib/logger");
    getLogger().error({ err: error }, "Failed to fetch streak");
    return null;
  }
}

async function getBooksByStatus(
  status: string,
  limit: number
): Promise<{ books: BookWithStatus[]; total: number }> {
  try {
    // Get total count for this status (excludes orphaned books by default)
    const total = await sessionRepository.countByStatus(status as any, true);

    // Get limited session records sorted by most recently updated (excludes orphaned books by default)
    const sessionRecords = await sessionRepository.findByStatus(status as any, true, limit);

    const bookIds = sessionRecords.map((s) => s.bookId);

    if (bookIds.length === 0) {
      return { books: [], total };
    }

    // Get books for these sessions
    const books = await Promise.all(
      bookIds.map(async (bookId) => {
        const book = await bookRepository.findById(bookId);
        return book;
      })
    );

    // Filter out orphaned books and create a map
    const bookMap = new Map<number, any>();
    books.forEach((book) => {
      if (book && !book.orphaned) {
        bookMap.set(book.id, book);
      }
    });

    // Build results in the order of sessionRecords (sorted by updatedAt)
    const booksWithStatus: BookWithStatus[] = [];
    for (const session of sessionRecords) {
      const book = bookMap.get(session.bookId);
      if (!book) continue; // Skip if book was filtered out (orphaned)

      // Get latest progress
      let latestProgress = null;
      latestProgress = await progressRepository.findLatestByBookIdAndSessionId(
        book.id,
        session.id
      );

      booksWithStatus.push({
        id: book.id,
        title: book.title,
        authors: book.authors,
        calibreId: book.calibreId,
        status: status,
        latestProgress,
      });
    }

    return { books: booksWithStatus, total };
  } catch (error) {
    const { getLogger } = require("@/lib/logger");
    getLogger().error({ err: error, status }, "Failed to fetch books by status");
    return { books: [], total: 0 };
  }
}
