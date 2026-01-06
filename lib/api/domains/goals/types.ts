/**
 * TypeScript types for Reading Goals API requests and responses
 */

import type { ReadingGoal } from "@/lib/db/schema";

// ============================================================================
// Reading Goal Types
// ============================================================================

/**
 * Reading goal with progress statistics
 */
export interface ReadingGoalWithProgress extends ReadingGoal {
  booksRead?: number;
  progressPercentage?: number;
}

// ============================================================================
// List Goals API Types
// ============================================================================

/**
 * Response from listing reading goals
 */
export interface ListGoalsResponse {
  success: boolean;
  data: ReadingGoal[];
}

// ============================================================================
// Create Goal API Types
// ============================================================================

/**
 * Request to create a new reading goal
 */
export interface CreateGoalRequest {
  year: number;
  booksGoal: number;
}

/**
 * Response from creating a reading goal
 */
export interface CreateGoalResponse {
  success: boolean;
  data: ReadingGoal;
}

// ============================================================================
// Update Goal API Types
// ============================================================================

/**
 * Request to update an existing reading goal
 */
export interface UpdateGoalRequest {
  booksGoal: number;
}

/**
 * Response from updating a reading goal
 */
export interface UpdateGoalResponse {
  success: boolean;
  data: ReadingGoal;
}

// ============================================================================
// Delete Goal API Types
// ============================================================================

/**
 * Response from deleting a reading goal
 */
export interface DeleteGoalResponse {
  success: boolean;
  message: string;
}
