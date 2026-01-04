import { NextRequest, NextResponse } from "next/server";
import { readingGoalsService } from "@/lib/services";
import { getLogger } from "@/lib/logger";

export const dynamic = 'force-dynamic';

const logger = getLogger();

/**
 * GET /api/reading-goals/monthly?year=2025
 * Get monthly breakdown of books completed for a specific year
 * Query params:
 *  - year: (required) Year to get monthly breakdown for
 * Returns: {
 *   success: true,
 *   data: {
 *     year: number,
 *     goal: ReadingGoal | null,
 *     monthlyData: Array<{ month: number, count: number }>
 *   }
 * }
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
            code: "MISSING_PARAMETER",
            message: "year parameter is required",
          },
        },
        { status: 400 }
      );
    }

    const year = parseInt(yearParam);
    
    if (isNaN(year)) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "INVALID_YEAR",
            message: "Year must be a valid number",
          },
        },
        { status: 400 }
      );
    }

    // Get monthly breakdown
    const monthlyData = await readingGoalsService.getMonthlyBreakdown(null, year);
    
    // Get goal data for the year (if exists)
    const goalData = await readingGoalsService.getGoal(null, year);

    return NextResponse.json({
      success: true,
      data: {
        year,
        goal: goalData?.goal ?? null,
        monthlyData,
      },
    });
  } catch (error: any) {
    // Handle validation errors from service
    if (error.message.includes("must be") || error.message.includes("between")) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "INVALID_INPUT",
            message: error.message,
          },
        },
        { status: 400 }
      );
    }

    logger.error({ error, year: request.nextUrl.searchParams.get("year") }, "Failed to get monthly breakdown");
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
