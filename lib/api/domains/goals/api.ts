/**
 * Goals API - Domain helper for reading goals endpoints
 * 
 * Provides type-safe methods for reading goals API calls.
 * Uses the BaseApiClient for HTTP handling and error management.
 */

import { baseApiClient } from "../../base-client";
import type {
  ListGoalsResponse,
  CreateGoalRequest,
  CreateGoalResponse,
  UpdateGoalRequest,
  UpdateGoalResponse,
  DeleteGoalResponse,
} from "./types";

/**
 * Goals API domain helper
 * 
 * Lightweight object with typed methods for reading goals endpoints.
 * All methods return promises and throw ApiError on failure.
 * 
 * @example
 * import { goalsApi } from '@/lib/api';
 * 
 * // List all reading goals
 * const response = await goalsApi.list();
 * const goals = response.data;
 * 
 * // Create a new goal
 * const result = await goalsApi.create({
 *   year: 2024,
 *   booksGoal: 52
 * });
 */
export const goalsApi = {
  /**
   * List all reading goals
   * 
   * @returns List goals response with array of goals
   * @throws {ApiError} When request fails
   * 
   * @example
   * const response = await goalsApi.list();
   * console.log(`Found ${response.data.length} goals`);
   */
  list: (): Promise<ListGoalsResponse> => {
    return baseApiClient["get"]<ListGoalsResponse>('/api/reading-goals');
  },

  /**
   * Create a new reading goal
   * 
   * @param request - Goal data (year and target books)
   * @returns Create goal response with new goal
   * @throws {ApiError} When request fails (e.g., duplicate year)
   * 
   * @example
   * const result = await goalsApi.create({
   *   year: 2024,
   *   booksGoal: 52
   * });
   * 
   * if (result.success) {
   *   console.log('Goal created:', result.data);
   * }
   */
  create: (request: CreateGoalRequest): Promise<CreateGoalResponse> => {
    return baseApiClient["post"]<CreateGoalRequest, CreateGoalResponse>(
      '/api/reading-goals',
      request
    );
  },

  /**
   * Update an existing reading goal
   * 
   * @param goalId - The ID of the goal to update
   * @param request - Updated goal data
   * @returns Update goal response with updated goal
   * @throws {ApiError} When request fails
   * 
   * @example
   * const result = await goalsApi.update(1, {
   *   booksGoal: 60
   * });
   */
  update: (
    goalId: number,
    request: UpdateGoalRequest
  ): Promise<UpdateGoalResponse> => {
    return baseApiClient["patch"]<UpdateGoalRequest, UpdateGoalResponse>(
      `/api/reading-goals/${goalId}`,
      request
    );
  },

  /**
   * Delete a reading goal
   * 
   * @param goalId - The ID of the goal to delete
   * @returns Delete goal response
   * @throws {ApiError} When request fails
   * 
   * @example
   * await goalsApi.delete(1);
   */
  delete: (goalId: number): Promise<DeleteGoalResponse> => {
    return baseApiClient["delete"]<DeleteGoalResponse>(
      `/api/reading-goals/${goalId}`
    );
  },
};
