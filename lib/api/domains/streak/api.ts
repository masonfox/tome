/**
 * Streak API - Domain helper for streak tracking endpoints
 * 
 * Provides type-safe methods for streak management API calls.
 * Uses the BaseApiClient for HTTP handling and error management.
 */

import { baseApiClient } from "../../base-client";
import type {
  RebuildStreakResponse,
  UpdateThresholdRequest,
  UpdateThresholdResponse,
  UpdateTimezoneRequest,
  UpdateTimezoneResponse,
} from "./types";

/**
 * Streak API domain helper
 * 
 * Lightweight object with typed methods for streak endpoints.
 * All methods return promises and throw ApiError on failure.
 * 
 * @example
 * import { streakApi } from '@/lib/api';
 * 
 * // Rebuild streak from history
 * await streakApi.rebuild();
 * 
 * // Update daily threshold
 * await streakApi.updateThreshold({ dailyThreshold: 10 });
 */
export const streakApi = {
  /**
   * Rebuild streak from reading history
   * 
   * Recalculates current and longest streaks based on progress logs.
   * 
   * @returns Rebuild response with updated streak stats
   * @throws {ApiError} When request fails
   * 
   * @example
   * const result = await streakApi.rebuild();
   * console.log(`Current streak: ${result.data.currentStreak} days`);
   */
  rebuild: (): Promise<RebuildStreakResponse> => {
    return baseApiClient["post"]<void, RebuildStreakResponse>(
      '/api/streak/rebuild',
      undefined
    );
  },

  /**
   * Update daily reading threshold
   * 
   * Sets the minimum pages required per day to maintain streak.
   * 
   * @param request - New threshold value
   * @returns Update response with updated streak data
   * @throws {ApiError} When request fails
   * 
   * @example
   * await streakApi.updateThreshold({ dailyThreshold: 10 });
   */
  updateThreshold: (
    request: UpdateThresholdRequest
  ): Promise<UpdateThresholdResponse> => {
    return baseApiClient["patch"]<UpdateThresholdRequest, UpdateThresholdResponse>(
      '/api/streak',
      request
    );
  },

  /**
   * Update user timezone
   * 
   * Changes the timezone used for day boundaries in streak calculations.
   * Triggers automatic streak rebuild with new timezone.
   * 
   * @param request - Timezone string (e.g., "America/New_York")
   * @returns Update response with updated streak data
   * @throws {ApiError} When request fails
   * 
   * @example
   * await streakApi.updateTimezone({ timezone: "Europe/London" });
   */
  updateTimezone: (
    request: UpdateTimezoneRequest
  ): Promise<UpdateTimezoneResponse> => {
    return baseApiClient["patch"]<UpdateTimezoneRequest, UpdateTimezoneResponse>(
      '/api/streak/timezone',
      request
    );
  },
};
