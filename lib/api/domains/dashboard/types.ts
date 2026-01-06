/**
 * Dashboard API Types
 * 
 * Type definitions for dashboard-related API operations.
 */

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
 */
export interface BookWithStatus {
  id: number;
  title: string;
  authors: string[];
  calibreId: number;
  status?: string | null;
  rating?: number | null;
  latestProgress?: any;
}

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
