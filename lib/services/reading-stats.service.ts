import { sessionRepository, progressRepository, streakRepository } from "@/lib/repositories";
import { getLogger } from "@/lib/logger";
import { subDays, startOfDay } from "date-fns";
import { formatInTimeZone, toZonedTime, fromZonedTime } from "date-fns-tz";
import { toDateString } from "@/utils/dateHelpers.server";

const logger = getLogger();

export interface BooksReadStats {
  total: number;
  thisYear: number;
  thisMonth: number;
}

export interface PagesReadStats {
  total: number;
  thisYear: number;
  thisMonth: number;
  today: number;
}

export interface StatsOverview {
  booksRead: BooksReadStats;
  currentlyReading: number;
  pagesRead: PagesReadStats;
  avgPagesPerDay: number;
}

/**
 * Shared service for reading statistics.
 * 
 * Provides a single source of truth for book and page counts
 * used by both the Stats page and Goals page.
 * 
 * Uses string-based calendar filters (strftime/GLOB) per ADR-014,
 * with GLOB date validation to defensively reject malformed dates.
 */
export class ReadingStatsService {
  /**
   * Get complete stats overview for the Stats page.
   * 
   * @returns Stats overview with books read, pages read, and avg pages/day
   */
  async getOverview(): Promise<StatsOverview> {
    // Get user timezone for "today" calculation
    const streak = await streakRepository.getOrCreate(null);
    const userTimezone = streak.userTimezone || "America/New_York";

    const now = new Date();
    const todayInUserTz = formatInTimeZone(now, userTimezone, "yyyy-MM-dd");
    
    // Parse the user's current month from their timezone
    const currentMonthInUserTz = parseInt(formatInTimeZone(now, userTimezone, "MM"), 10);
    const currentYearInUserTz = parseInt(formatInTimeZone(now, userTimezone, "yyyy"), 10);

    // Books read stats
    const booksReadTotal = await sessionRepository.countByStatus("read", false);
    const booksReadThisYear = await sessionRepository.countCompletedByYear(currentYearInUserTz);
    const booksReadThisMonth = await sessionRepository.countCompletedByYearMonth(currentYearInUserTz, currentMonthInUserTz);

    // Currently reading
    const currentlyReading = await sessionRepository.countByStatus("reading", true);

    // Pages read stats
    const pagesReadTotal = await progressRepository.getTotalPagesRead();
    const pagesReadThisYear = await progressRepository.getPagesReadByYear(currentYearInUserTz);
    const pagesReadThisMonth = await progressRepository.getPagesReadByYearMonth(currentYearInUserTz, currentMonthInUserTz);
    const pagesReadToday = await progressRepository.getPagesReadByDate(todayInUserTz);

    // Average pages per day (last 30 days) - keep existing logic as it's a rolling window
    const todayInUserTzDate = toZonedTime(now, userTimezone);
    const todayStart = startOfDay(todayInUserTzDate);
    const thirtyDaysAgoInUserTz = subDays(todayStart, 30);
    const thirtyDaysAgoUtc = fromZonedTime(thirtyDaysAgoInUserTz, userTimezone);
    const avgPagesPerDay = await progressRepository.getAveragePagesPerDay(toDateString(thirtyDaysAgoUtc), userTimezone);

    logger.debug(
      { currentYearInUserTz, currentMonthInUserTz, todayInUserTz, booksReadThisYear, booksReadThisMonth },
      "Stats overview calculated"
    );

    return {
      booksRead: {
        total: booksReadTotal,
        thisYear: booksReadThisYear,
        thisMonth: booksReadThisMonth,
      },
      currentlyReading,
      pagesRead: {
        total: pagesReadTotal,
        thisYear: pagesReadThisYear,
        thisMonth: pagesReadThisMonth,
        today: pagesReadToday,
      },
      avgPagesPerDay,
    };
  }

  /**
   * Get books completed in a specific year.
   * Shared between Stats and Goals pages.
   * 
   * @param year - The year to count
   * @returns Number of books completed in the year
   */
  async getBooksCompletedInYear(year: number): Promise<number> {
    return sessionRepository.countCompletedByYear(year);
  }

  /**
   * Get books completed in a specific year and month.
   * 
   * @param year - The year
   * @param month - The month (1-12)
   * @returns Number of books completed in the year/month
   */
  async getBooksCompletedInMonth(year: number, month: number): Promise<number> {
    return sessionRepository.countCompletedByYearMonth(year, month);
  }

  /**
   * Get pages read in a specific year.
   * 
   * @param year - The year to sum pages for
   * @returns Total pages read in the year
   */
  async getPagesReadInYear(year: number): Promise<number> {
    return progressRepository.getPagesReadByYear(year);
  }

  /**
   * Get pages read in a specific year and month.
   * 
   * @param year - The year
   * @param month - The month (1-12)
   * @returns Total pages read in the year/month
   */
  async getPagesReadInMonth(year: number, month: number): Promise<number> {
    return progressRepository.getPagesReadByYearMonth(year, month);
  }
}

export const readingStatsService = new ReadingStatsService();
