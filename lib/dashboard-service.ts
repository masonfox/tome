import { bookRepository, sessionRepository, progressRepository } from "@/lib/repositories";
import { readingStatsService } from "@/lib/services";
import { getLogger } from "@/lib/logger";
import type { BookWithStatusMinimal } from "@/lib/api/domains/book/types";

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

export type BookWithStatus = BookWithStatusMinimal;

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
    const { books: readNext, total: readNextTotal } = await getBooksByStatus("read-next", 8);

    return {
      stats,
      streak,
      currentlyReading,
      currentlyReadingTotal,
      readNext,
      readNextTotal,
    };
  } catch (error) {
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
    // Delegate to shared ReadingStatsService which uses safe calendar-based
    // counting methods (strftime/GLOB) per ADR-014, avoiding the string
    // comparison vulnerability with malformed dates.
    const overview = await readingStatsService.getOverview();

    return {
      booksRead: {
        thisYear: overview.booksRead.thisYear,
        total: overview.booksRead.total,
      },
      currentlyReading: overview.currentlyReading,
      pagesRead: {
        today: overview.pagesRead.today,
        thisMonth: overview.pagesRead.thisMonth,
      },
      avgPagesPerDay: overview.avgPagesPerDay,
    };
  } catch (error) {
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

    // Return null if streak tracking is disabled
    if (!streak.streakEnabled) {
      return null;
    }

    // Get today's pages read using safe date-based query (GLOB-guarded)
    const { formatInTimeZone } = require("date-fns-tz");
    const userTimezone = streak.userTimezone || 'America/New_York';
    const todayInUserTz = formatInTimeZone(new Date(), userTimezone, "yyyy-MM-dd");
    const todayPages = await progressRepository.getPagesReadByDate(todayInUserTz);

    return {
      currentStreak: streak.currentStreak,
      longestStreak: streak.longestStreak,
      dailyThreshold: streak.dailyThreshold,
      hoursRemainingToday: streak.hoursRemainingToday,
      todayPagesRead: todayPages,
    };
  } catch (error) {
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
        lastSynced: book.lastSynced,
        status: status,
        latestProgress,
      });
    }

    return { books: booksWithStatus, total };
  } catch (error) {
    getLogger().error({ err: error, status }, "Failed to fetch books by status");
    return { books: [], total: 0 };
  }
}
