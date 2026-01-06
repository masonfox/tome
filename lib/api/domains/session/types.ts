/**
 * Session API Types
 *
 * Type definitions for session-related API operations.
 */

/**
 * Request body for updating session details
 */
export interface UpdateSessionRequest {
  startedDate?: string | null;
}

/**
 * Session response from the API
 */
export interface SessionResponse {
  id: number;
  bookId: string;
  startedDate?: string | null;
  // Add other session fields as needed
}
