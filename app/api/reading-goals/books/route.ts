import { NextRequest, NextResponse } from "next/server";
import { readingGoalRepository } from "@/lib/repositories";
import type { Book } from "@/lib/db/schema";
import { getLogger } from "@/lib/logger";

export const dynamic = 'force-dynamic';

const logger = getLogger();

interface BooksResponse {
  success: true;
  data: {
    year: number;
    count: number;
    books: Array<Book & { completedDate: string; sessionId: number }>;  // YYYY-MM-DD format, sessionId for unique React keys
  };
}

interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    errorId?: string;
  };
}

/**
 * GET /api/reading-goals/books
 * Get all books completed in a specific year
 * Query params:
 *  - year: (required) The year to fetch completed books for
 */
export async function GET(
  request: NextRequest
): Promise<NextResponse<BooksResponse | ErrorResponse>> {
  try {
    const searchParams = request.nextUrl.searchParams;
    const yearParam = searchParams.get("year");

    if (!yearParam) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "MISSING_YEAR",
            message: "Year parameter is required",
          },
        },
        { status: 400 }
      );
    }

    const year = parseInt(yearParam);
    if (isNaN(year) || year < 1900 || year > 2100) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "INVALID_YEAR",
            message: "Year must be a valid number between 1900 and 2100",
          },
        },
        { status: 400 }
      );
    }

    logger.info({ year }, "Fetching completed books for year");

    const books = await readingGoalRepository.getBooksByCompletionYear(
      null, // userId - using single-user mode
      year
    );

    return NextResponse.json({
      success: true,
      data: {
        year,
        count: books.length,
        books,
      },
    });
  } catch (error) {
    const errorId = crypto.randomUUID();
    logger.error({ error, errorId }, "Failed to get completed books");
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: process.env.NODE_ENV === 'development' 
            ? (error as Error).message 
            : "An unexpected error occurred",
          errorId,
        },
      },
      { status: 500 }
    );
  }
}
