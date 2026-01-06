import { getLogger } from "@/lib/logger";
import { NextResponse } from "next/server";

/**
 * Standard API error response structure
 */
export interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    errorId?: string;
  };
}

/**
 * Standard API success response structure
 */
export interface ApiSuccessResponse<T = unknown> {
  success: true;
  data: T;
}

/**
 * Error codes for common API errors
 */
export const ErrorCodes = {
  // Client errors (4xx)
  INVALID_INPUT: "INVALID_INPUT",
  MISSING_FIELD: "MISSING_FIELD",
  INVALID_TYPE: "INVALID_TYPE",
  INVALID_ID: "INVALID_ID",
  NOT_FOUND: "NOT_FOUND",
  UNAUTHORIZED: "UNAUTHORIZED",
  FORBIDDEN: "FORBIDDEN",
  ALREADY_EXISTS: "ALREADY_EXISTS",
  
  // Server errors (5xx)
  INTERNAL_ERROR: "INTERNAL_ERROR",
  DATABASE_ERROR: "DATABASE_ERROR",
} as const;

/**
 * Creates a standardized error response
 * 
 * @param code - Error code from ErrorCodes
 * @param message - User-friendly error message
 * @param status - HTTP status code (default: 500)
 * @param errorId - Optional error ID for tracking (auto-generated for 500 errors)
 * @returns NextResponse with standardized error format
 * 
 * @example
 * return createErrorResponse(
 *   ErrorCodes.NOT_FOUND,
 *   "Book not found",
 *   404
 * );
 */
export function createErrorResponse(
  code: string,
  message: string,
  status: number = 500,
  errorId?: string
): NextResponse<ApiErrorResponse> {
  const response: ApiErrorResponse = {
    success: false,
    error: {
      code,
      message,
    },
  };

  // Auto-generate errorId for server errors (5xx)
  if (status >= 500 && !errorId) {
    response.error.errorId = crypto.randomUUID();
  } else if (errorId) {
    response.error.errorId = errorId;
  }

  return NextResponse.json(response, { status });
}

/**
 * Creates a standardized success response
 * 
 * @param data - Response data
 * @param status - HTTP status code (default: 200)
 * @returns NextResponse with standardized success format
 * 
 * @example
 * return createSuccessResponse({ id: 1, name: "Book" }, 201);
 */
export function createSuccessResponse<T>(
  data: T,
  status: number = 200
): NextResponse<ApiSuccessResponse<T>> {
  return NextResponse.json(
    {
      success: true,
      data,
    },
    { status }
  );
}

/**
 * Wraps an API route handler with standardized error handling
 * Catches any unhandled errors and returns a standardized error response
 * 
 * @param handler - The API route handler function
 * @param logger - Optional logger instance
 * @returns Wrapped handler with error handling
 * 
 * @example
 * export const GET = withErrorHandler(async (request) => {
 *   const data = await fetchData();
 *   return createSuccessResponse(data);
 * }, getLogger());
 */
export function withErrorHandler<T extends (...args: any[]) => Promise<NextResponse>>(
  handler: T,
  logger?: any
): T {
  return (async (...args: any[]) => {
    try {
      return await handler(...args);
    } catch (error) {
      const errorId = crypto.randomUUID();
      
      if (logger) {
        logger.error({ error, errorId }, "Unhandled API error");
      }
      
      return createErrorResponse(
        ErrorCodes.INTERNAL_ERROR,
        process.env.NODE_ENV === "development"
          ? (error as Error).message
          : "An unexpected error occurred",
        500,
        errorId
      );
    }
  }) as T;
}
