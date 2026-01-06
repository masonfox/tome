/**
 * Session API
 *
 * Domain API for managing reading sessions.
 */

import { baseApiClient } from "../../base-client";
import type { UpdateSessionRequest, SessionResponse } from "./types";

/**
 * Session API operations
 */
export const sessionApi = {
  /**
   * Update session details
   * 
   * @param bookId - The book ID
   * @param sessionId - The session ID to update
   * @param data - Update request with session fields
   * @returns Updated session response
   * @throws {ApiError} When request fails
   * 
   * @example
   * const result = await sessionApi.update("123", 456, {
   *   startedDate: "2024-01-01T00:00:00.000Z"
   * });
   */
  update: (
    bookId: string,
    sessionId: number,
    data: UpdateSessionRequest
  ): Promise<SessionResponse> => {
    return baseApiClient["patch"]<UpdateSessionRequest, SessionResponse>(
      `/api/books/${bookId}/sessions/${sessionId}`,
      data
    );
  },
} as const;
