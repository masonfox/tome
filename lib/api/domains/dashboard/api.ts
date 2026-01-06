/**
 * Dashboard API - Domain helper for dashboard endpoints
 * 
 * Provides type-safe methods for dashboard data API calls.
 * Uses the BaseApiClient for HTTP handling and error management.
 */

import { baseApiClient } from "../../base-client";
import type { DashboardData } from "./types";

/**
 * Dashboard API domain helper
 * 
 * Lightweight object with typed methods for dashboard endpoints.
 * All methods return promises and throw ApiError on failure.
 * 
 * @example
 * import { dashboardApi } from '@/lib/api';
 * 
 * // Get dashboard data
 * const data = await dashboardApi.get();
 */
export const dashboardApi = {
  /**
   * Get complete dashboard data
   * 
   * Fetches stats, streak info, currently reading books, and read next list.
   * 
   * @returns Dashboard data with stats, streak, and book lists
   * @throws {ApiError} When request fails
   * 
   * @example
   * const dashboard = await dashboardApi.get();
   * console.log(`Reading ${dashboard.currentlyReading.length} books`);
   */
  get: (): Promise<DashboardData> => {
    return baseApiClient["get"]<DashboardData>('/api/dashboard');
  },
};
