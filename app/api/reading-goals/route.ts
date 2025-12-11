import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { readingGoalsService } from "@/lib/services";
import { getLogger } from "@/lib/logger";

const logger = getLogger();

/**
 * GET /api/reading-goals
 * Get all goals or a specific goal by year
 * Query params:
 *  - year: (optional) Return only goal for specific year
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const yearParam = searchParams.get("year");

    if (yearParam) {
      // Get specific year's goal
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

      const goalData = await readingGoalsService.getGoal(null, year);
      if (!goalData) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: "NOT_FOUND",
              message: `No goal found for year ${year}`,
            },
          },
          { status: 404 }
        );
      }

      return NextResponse.json({ success: true, data: goalData });
    } else {
      // Get all goals
      const goals = await readingGoalsService.getAllGoals(null);
      return NextResponse.json({ success: true, data: goals });
    }
  } catch (error) {
    logger.error({ error }, "Failed to get reading goals");
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

/**
 * POST /api/reading-goals
 * Create a new reading goal
 * Body: { year: number, booksGoal: number }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { year, booksGoal } = body;

    // Validate required fields
    if (year === undefined || booksGoal === undefined) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "MISSING_FIELD",
            message: "year and booksGoal are required",
          },
        },
        { status: 400 }
        );
    }

    // Validate types
    if (typeof year !== "number" || typeof booksGoal !== "number") {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "INVALID_TYPE",
            message: "year and booksGoal must be numbers",
          },
        },
        { status: 400 }
      );
    }

    try {
      const goal = await readingGoalsService.createGoal(null, year, booksGoal);
      
      // Revalidate pages that display goal data
      revalidatePath('/goals');
      revalidatePath('/');
      
      return NextResponse.json({ success: true, data: goal }, { status: 201 });
    } catch (error: any) {
      // Handle validation errors from service
      if (error.message.includes("already have a goal")) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: "GOAL_EXISTS",
              message: error.message,
            },
          },
          { status: 400 }
        );
      }

      if (
        error.message.includes("must be") ||
        error.message.includes("between")
      ) {
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

      throw error;
    }
  } catch (error) {
    logger.error({ error }, "Failed to create reading goal");
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
