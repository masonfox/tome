/**
 * TypeScript types for Streak API requests and responses
 */

import type { Streak } from "@/lib/db/schema";

// ============================================================================
// Streak Response Types
// ============================================================================

/**
 * Standard success response
 */
export interface StreakSuccessResponse {
  success: boolean;
  message?: string;
}

/**
 * Response with streak data
 */
export interface StreakDataResponse {
  success: boolean;
  data: Streak;
}

// ============================================================================
// Rebuild Streak API Types
// ============================================================================

/**
 * Response from rebuilding streak
 */
export interface RebuildStreakResponse extends StreakSuccessResponse {
  data?: {
    currentStreak: number;
    longestStreak: number;
    totalDaysActive: number;
  };
}

// ============================================================================
// Update Threshold API Types
// ============================================================================

/**
 * Request to update daily reading threshold
 */
export interface UpdateThresholdRequest {
  dailyThreshold: number;
}

/**
 * Response from updating threshold
 */
export interface UpdateThresholdResponse extends StreakDataResponse {}

// ============================================================================
// Update Timezone API Types
// ============================================================================

/**
 * Request to update user timezone
 */
export interface UpdateTimezoneRequest {
  timezone: string;
}

/**
 * Response from updating timezone
 */
export interface UpdateTimezoneResponse extends StreakDataResponse {}
