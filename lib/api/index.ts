/**
 * API Client Barrel Export
 * 
 * Central export point for all API-related modules.
 * Makes it easy to import API functionality throughout the app.
 * 
 * @example
 * import { bookApi, ApiError } from '@/lib/api';
 * 
 * try {
 *   await bookApi.updateStatus('123', { status: 'reading' });
 * } catch (error) {
 *   if (error instanceof ApiError) {
 *     console.log('API error:', error.statusCode);
 *   }
 * }
 */

// Re-export base client classes and utilities
export { baseApiClient, BaseApiClient, ApiError } from "./base-client";

// Re-export domain API helpers
export { bookApi } from "./domains/book";
export { goalsApi } from "./domains/goals";
export { streakApi } from "./domains/streak";
export { dashboardApi } from "./domains/dashboard";
export { statsApi } from "./domains/stats";
export { sessionApi } from "./domains/session";
export { tagApi } from "./domains/tag";
export { journalApi } from "./domains/journal";
export { shelfApi } from "./domains/shelf";

// Re-export all types (type-only imports)
export type * from "./domains/book";
export type * from "./domains/goals";
export type * from "./domains/streak";
export type * from "./domains/dashboard";
export type * from "./domains/stats";
export type * from "./domains/session";
export type * from "./domains/tag";
export type * from "./domains/journal";
export type * from "./domains/shelf";
