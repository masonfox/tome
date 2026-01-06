/**
 * Stats API Types
 * 
 * Type definitions for statistics-related API operations.
 */

/**
 * Statistics overview
 */
export interface StatsOverview {
  booksRead: {
    total: number;
    thisYear: number;
    thisMonth: number;
  };
  currentlyReading: number;
  pagesRead: {
    total: number;
    thisYear: number;
    thisMonth: number;
    today: number;
  };
  avgPagesPerDay: number;
}

/**
 * Streak data for statistics page
 */
export interface StreakData {
  currentStreak: number;
  longestStreak: number;
  dailyThreshold: number;
  totalDaysActive: number;
  streakEnabled: boolean;
  userTimezone: string;
  hoursRemainingToday: number;
}
