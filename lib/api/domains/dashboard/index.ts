/**
 * Dashboard API Domain
 * 
 * Barrel export for dashboard API types and methods.
 * 
 * @example
 * import { dashboardApi, type DashboardData } from '@/lib/api/domains/dashboard';
 */

export { dashboardApi } from "./api";
export type {
  DashboardData,
  DashboardStats,
  DashboardStreak,
  BookWithStatus,
} from "./types";
