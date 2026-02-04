/**
 * Dashboard API Types
 * 
 * Type definitions for dashboard-related API operations.
 */

import type { BookWithStatusMinimal } from "@/lib/api/domains/book/types";

/**
 * Latest progress entry for a book
 */
export interface LatestProgress {
  id: number;
  userId: number | null;
  bookId: number;
  sessionId: number | null;
  currentPage: number;
  currentPercentage: number;
  progressDate: Date;
  notes: string | null;
  pagesRead: number;
  createdAt: Date;
}

/**
 * Dashboard statistics
 */
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

/**
 * Dashboard streak information
 */
export interface DashboardStreak {
  currentStreak: number;
  longestStreak: number;
  dailyThreshold: number;
  hoursRemainingToday: number;
  todayPagesRead: number;
}

/**
 * Book with status information for dashboard
 * @see BookWithStatusMinimal
 */
export type BookWithStatus = BookWithStatusMinimal;

/**
 * Complete dashboard data response
 */
export interface DashboardData {
  stats: DashboardStats | null;
  streak: DashboardStreak | null;
  currentlyReading: BookWithStatus[];
  currentlyReadingTotal: number;
  readNext: BookWithStatus[];
  readNextTotal: number;
}
