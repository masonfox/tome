/**
 * Progress log generation helpers for development seeding
 * Generates realistic reading patterns for testing streak tracking
 */

import { subDays, subMonths, setHours, setMinutes, startOfDay } from "date-fns";
import { calculatePercentage } from "@/lib/utils/progress-calculations";

export interface ProgressLogData {
  bookId: number;
  sessionId?: number;
  currentPage: number;
  currentPercentage: number;
  pagesRead: number;
  progressDate: Date;
  notes?: string;
}

/**
 * Generates consecutive daily progress for an active streak
 * @param bookId - Book ID
 * @param sessionId - Optional session ID
 * @param totalPages - Total pages in the book
 * @param daysBack - Number of consecutive days (default 7)
 * @param startPage - Page to start from (default 0)
 * @returns Array of progress logs with 40-80 pages per day
 */
export function generateActiveStreak(
  bookId: number,
  sessionId: number | undefined,
  totalPages: number,
  daysBack: number = 7,
  startPage: number = 0
): ProgressLogData[] {
  const logs: ProgressLogData[] = [];
  let currentPage = startPage;

  for (let i = daysBack - 1; i >= 0; i--) {
    // Generate 40-80 pages per day (above default threshold)
    const pagesRead = Math.floor(Math.random() * 41) + 40; // 40-80 pages
    currentPage = Math.min(currentPage + pagesRead, totalPages);

    // Random evening time (7-10 PM)
    const hour = Math.floor(Math.random() * 4) + 19; // 19-22 (7pm-10pm)
    const minute = Math.floor(Math.random() * 60);

    const progressDate = setMinutes(
      setHours(subDays(startOfDay(new Date()), i), hour),
      minute
    );

    logs.push({
      bookId,
      sessionId,
      currentPage,
      currentPercentage: calculatePercentage(currentPage, totalPages),
      pagesRead,
      progressDate,
      notes: i === 0 ? "Today's reading session" : undefined,
    });

    // Stop if we've reached the end of the book
    if (currentPage >= totalPages) {
      break;
    }
  }

  return logs;
}

/**
 * Generates realistic historical progress over several months
 * Includes gaps (not every day) and variable pages per session
 * @param bookId - Book ID
 * @param sessionId - Optional session ID
 * @param totalPages - Total pages in the book
 * @param monthsBack - Number of months to generate data for (default 3)
 * @param targetCompletion - Target completion percentage (default 100)
 * @returns Array of progress logs with realistic patterns
 */
export function generateHistoricalProgress(
  bookId: number,
  sessionId: number | undefined,
  totalPages: number,
  monthsBack: number = 3,
  targetCompletion: number = 100
): ProgressLogData[] {
  const logs: ProgressLogData[] = [];
  const targetPage = Math.floor((totalPages * targetCompletion) / 100);

  // Calculate total days and reading days (3-5 days per week)
  const totalDays = monthsBack * 30;
  const readingDaysPerWeek = 3 + Math.floor(Math.random() * 3); // 3-5 days
  const totalReadingDays = Math.floor((totalDays / 7) * readingDaysPerWeek);

  // Calculate average pages per session
  const avgPagesPerSession = Math.max(1, Math.floor(targetPage / totalReadingDays));

  let currentPage = 0;
  const startDate = subMonths(new Date(), monthsBack);

  // Generate reading days with gaps
  for (let dayOffset = 0; dayOffset < totalDays && currentPage < targetPage; dayOffset++) {
    // Randomly skip days (to create gaps in the streak)
    if (Math.random() > 0.45) { // ~45% chance of reading on any given day
      // Variable pages per session (50-150% of average)
      const variation = 0.5 + Math.random();
      const pagesRead = Math.floor(avgPagesPerSession * variation);
      currentPage = Math.min(currentPage + pagesRead, targetPage);

      // Random time throughout the day
      const hour = Math.floor(Math.random() * 16) + 8; // 8am-11pm
      const minute = Math.floor(Math.random() * 60);

      const progressDate = setMinutes(
        setHours(subDays(startOfDay(startDate), -dayOffset), hour),
        minute
      );

      logs.push({
        bookId,
        sessionId,
        currentPage,
        currentPercentage: calculatePercentage(currentPage, totalPages),
        pagesRead,
        progressDate,
      });
    }
  }

  // Sort by date (oldest first)
  logs.sort((a, b) => a.progressDate.getTime() - b.progressDate.getTime());

  // Recalculate currentPage to be cumulative
  let cumulativePage = 0;
  for (const log of logs) {
    cumulativePage += log.pagesRead;
    log.currentPage = Math.min(cumulativePage, targetPage);
    log.currentPercentage = calculatePercentage(log.currentPage, totalPages);
  }

  return logs;
}

/**
 * Generates progress to reach a specific completion percentage
 * Spreads progress over several weeks with realistic pacing
 * @param bookId - Book ID
 * @param sessionId - Optional session ID
 * @param totalPages - Total pages in the book
 * @param percentComplete - Target completion percentage (0-100)
 * @param weeksToComplete - Number of weeks to spread progress over (default 2-4)
 * @returns Array of progress logs
 */
export function generateBookInProgress(
  bookId: number,
  sessionId: number | undefined,
  totalPages: number,
  percentComplete: number,
  weeksToComplete?: number
): ProgressLogData[] {
  const targetPage = Math.floor((totalPages * percentComplete) / 100);
  const weeks = weeksToComplete || (2 + Math.floor(Math.random() * 3)); // 2-4 weeks
  const totalDays = weeks * 7;

  // Read 3-4 days per week
  const readingDays = weeks * (3 + Math.floor(Math.random() * 2));
  const avgPagesPerSession = Math.max(1, Math.floor(targetPage / readingDays));

  const logs: ProgressLogData[] = [];
  let currentPage = 0;
  let daysProcessed = 0;

  while (currentPage < targetPage && daysProcessed < totalDays) {
    // Randomly skip days
    if (Math.random() > 0.5) { // 50% chance of reading
      const pagesRead = Math.floor(avgPagesPerSession * (0.7 + Math.random() * 0.6)); // 70-130% of average
      currentPage = Math.min(currentPage + pagesRead, targetPage);

      const hour = 19 + Math.floor(Math.random() * 3); // 7-9 PM
      const minute = Math.floor(Math.random() * 60);

      const progressDate = setMinutes(
        setHours(subDays(startOfDay(new Date()), totalDays - daysProcessed), hour),
        minute
      );

      logs.push({
        bookId,
        sessionId,
        currentPage,
        currentPercentage: calculatePercentage(currentPage, totalPages),
        pagesRead,
        progressDate,
      });
    }

    daysProcessed++;
  }

  return logs;
}

/**
 * Generates a single completion progress log
 * @param bookId - Book ID
 * @param sessionId - Optional session ID
 * @param totalPages - Total pages in the book
 * @param daysAgo - How many days ago the book was completed (default 14-28)
 * @returns Single progress log marking completion
 */
export function generateCompletedBook(
  bookId: number,
  sessionId: number | undefined,
  totalPages: number,
  daysAgo?: number
): ProgressLogData {
  const days = daysAgo || (14 + Math.floor(Math.random() * 15)); // 14-28 days ago

  const hour = 20 + Math.floor(Math.random() * 2); // 8-9 PM
  const minute = Math.floor(Math.random() * 60);

  const progressDate = setMinutes(
    setHours(subDays(startOfDay(new Date()), days), hour),
    minute
  );

  return {
    bookId,
    sessionId,
    currentPage: totalPages,
    currentPercentage: 100,
    pagesRead: 0, // Last log, no new pages
    progressDate,
    notes: "Finished! Great book.",
  };
}
