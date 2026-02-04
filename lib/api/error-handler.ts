/**
 * API Error Handler Utilities
 * 
 * Provides consistent error handling for API routes
 */

interface ApiErrorResponse {
  code: string;
  message: string;
  status: number;
  errorId?: string;
}

/**
 * Maps common error patterns to appropriate HTTP responses
 * 
 * @param error - The error object to handle
 * @param errorId - Unique identifier for logging/tracking
 * @returns Object with error code, message, status, and optional errorId
 */
export function handleApiError(error: unknown, errorId: string): ApiErrorResponse {
  if (error instanceof Error) {
    // Not found errors (404)
    if (error.message.includes("not found")) {
      return {
        code: "NOT_FOUND",
        message: error.message,
        status: 404,
      };
    }

    // Invalid status/state errors (400)
    if (
      error.message.includes("not on shelf") ||
      error.message.includes("not in read-next status")
    ) {
      return {
        code: "INVALID_STATUS",
        message: error.message,
        status: 400,
      };
    }
  }

  // Internal server error (500)
  return {
    code: "INTERNAL_ERROR",
    message:
      process.env.NODE_ENV === "development"
        ? (error as Error).message
        : "An unexpected error occurred",
    status: 500,
    errorId,
  };
}
