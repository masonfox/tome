import { NextRequest, NextResponse } from "next/server";
import { readingGoalRepository } from "@/lib/repositories";
import { getLogger } from "@/lib/logger";

const logger = getLogger();

/**
 * GET /api/reading-goals/books
 * Get all books completed in a specific year
 * Query params:
 *  - year: (required) The year to fetch completed books for
 */
export async function GET(request: NextRequest) {
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
    logger.error({ error }, "Failed to get completed books");
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: "An unexpected error occurred",
        },
      },
      { status: 500 }
    );
  }
}
