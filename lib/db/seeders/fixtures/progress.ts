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
 * @param maxPercentage - Maximum percentage to cap progress at (default 95 to avoid auto-completion)
 * @returns Array of progress logs with 40-80 pages per day
 */
export function generateActiveStreak(
  bookId: number,
  sessionId: number | undefined,
  totalPages: number,
  daysBack: number = 7,
  startPage: number = 0,
  maxPercentage: number = 95
): ProgressLogData[] {
  const logs: ProgressLogData[] = [];
  let currentPage = startPage;
  
  // Calculate max page from percentage to avoid hitting 100% and triggering auto-completion
  const maxPage = Math.floor(totalPages * maxPercentage / 100);

  for (let i = daysBack - 1; i >= 0; i--) {
    // Generate 40-80 pages per day (above default threshold)
    const pagesRead = Math.floor(Math.random() * 41) + 40; // 40-80 pages
    currentPage = Math.min(currentPage + pagesRead, maxPage);

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

    // Stop if we've reached the max page
    if (currentPage >= maxPage) {
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
 * @param maxPercentage - Maximum percentage to cap progress at (default 95 to avoid auto-completion)
 * @returns Array of progress logs with realistic patterns
 */
export function generateHistoricalProgress(
  bookId: number,
  sessionId: number | undefined,
  totalPages: number,
  monthsBack: number = 3,
  targetCompletion: number = 100,
  maxPercentage: number = 95
): ProgressLogData[] {
  const logs: ProgressLogData[] = [];
  
  // Cap target completion at maxPercentage to avoid auto-completion
  const cappedTargetCompletion = Math.min(targetCompletion, maxPercentage);
  const targetPage = Math.floor((totalPages * cappedTargetCompletion) / 100);

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

  // Recalculate currentPage to be cumulative and ensure monotonic progression
  let cumulativePage = 0;
  let lastPage = 0;
  for (const log of logs) {
    cumulativePage += log.pagesRead;
    log.currentPage = Math.min(cumulativePage, targetPage);
    
    // Ensure monotonic progression - current page must be >= last page
    if (log.currentPage < lastPage) {
      log.currentPage = lastPage + log.pagesRead;
    }
    
    // Cap at target page
    log.currentPage = Math.min(log.currentPage, targetPage);
    log.currentPercentage = calculatePercentage(log.currentPage, totalPages);
    lastPage = log.currentPage;
  }

  return logs;
}

/**
 * Generates progress to reach a specific completion percentage
 * Spreads progress over several weeks with realistic pacing
 * @param bookId - Book ID
 * @param sessionId - Optional session ID
 * @param totalPages - Total pages in the book
 * @param percentComplete - Target completion percentage (0-100, capped at 95 to avoid auto-completion)
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
  // Cap at 95% to avoid auto-completion triggered at 100%
  const cappedPercentComplete = Math.min(percentComplete, 95);
  
  const targetPage = Math.floor((totalPages * cappedPercentComplete) / 100);
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
 * 
 * @warning Only use for books with "read" status - creates 100% progress which triggers auto-completion
 * 
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

/**
 * Generates progress logs for a DNF (Did Not Finish) book
 * Creates realistic partial progress that ends before completion
 * 
 * @param bookId - Book ID
 * @param sessionId - Optional session ID
 * @param totalPages - Total pages in the book
 * @param percentComplete - How far they got before DNF (default 15-40%)
 * @param weeksAgo - How many weeks ago they DNF'd (default 2-8 weeks)
 * @returns Array of progress logs for DNF book
 */
export function generateDNFProgress(
  bookId: number,
  sessionId: number | undefined,
  totalPages: number,
  percentComplete?: number,
  weeksAgo?: number
): ProgressLogData[] {
  // Random progress between 15-40% if not specified
  const progress = percentComplete || (15 + Math.floor(Math.random() * 26));
  const weeks = weeksAgo || (2 + Math.floor(Math.random() * 7)); // 2-8 weeks ago
  
  const targetPage = Math.floor((totalPages * progress) / 100);
  const totalDays = weeks * 7;
  
  // DNF books tend to have inconsistent reading patterns (read 2-3 days per week)
  const readingDays = weeks * (2 + Math.floor(Math.random() * 2));
  const avgPagesPerSession = Math.max(1, Math.floor(targetPage / readingDays));
  
  const logs: ProgressLogData[] = [];
  let currentPage = 0;
  let daysProcessed = 0;
  
  while (currentPage < targetPage && daysProcessed < totalDays) {
    // Randomly skip days - DNF books have more gaps
    if (Math.random() > 0.6) { // 40% chance of reading (less than normal)
      const pagesRead = Math.floor(avgPagesPerSession * (0.5 + Math.random() * 0.8)); // 50-130% of average
      currentPage = Math.min(currentPage + pagesRead, targetPage);
      
      const hour = 19 + Math.floor(Math.random() * 4); // 7-10 PM
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
