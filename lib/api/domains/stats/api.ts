/**
 * Stats API - Domain helper for statistics endpoints
 * 
 * Provides type-safe methods for statistics-related API calls.
 * Uses the BaseApiClient for HTTP handling and error management.
 */

import { baseApiClient } from "../../base-client";
import type { StatsOverview, StreakData } from "./types";

/**
 * Stats API domain helper
 * 
 * Lightweight object with typed methods for statistics endpoints.
 * All methods return promises and throw ApiError on failure.
 * 
 * @example
 * import { statsApi } from '@/lib/api';
 * 
 * // Get stats overview
 * const overview = await statsApi.getOverview();
 * 
 * // Get streak data
 * const streak = await statsApi.getStreak();
 */
export const statsApi = {
  /**
   * Get statistics overview
   * 
   * Fetches books read, pages read, and average pages per day stats.
   * 
   * @returns Statistics overview with books and pages read
   * @throws {ApiError} When request fails
   * 
   * @example
   * const stats = await statsApi.getOverview();
   * console.log(`Read ${stats.booksRead.thisYear} books this year`);
   */
  getOverview: (): Promise<StatsOverview> => {
    return baseApiClient["get"]<StatsOverview>('/api/stats/overview');
  },

  /**
   * Get streak data
   * 
   * Fetches current streak, longest streak, and streak settings.
   * 
   * @returns Streak data with current/longest streaks and settings
   * @throws {ApiError} When request fails
   * 
   * @example
   * const streak = await statsApi.getStreak();
   * console.log(`Current streak: ${streak.currentStreak} days`);
   */
  getStreak: (): Promise<StreakData> => {
    return baseApiClient["get"]<StreakData>('/api/streaks');
  },
};
