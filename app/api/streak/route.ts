import { NextRequest, NextResponse } from "next/server";
import { streakService } from "@/lib/services/streak.service";
import { getLogger } from "@/lib/logger";

const logger = getLogger();

/**
 * GET /api/streak
 * Get current streak with enhanced data
 * Auto-creates streak record if it doesn't exist
 */
export async function GET(request: NextRequest) {
  try {
    const streak = await streakService.getStreak(null);
    return NextResponse.json({ success: true, data: streak });
  } catch (error) {
    logger.error({ error }, "Failed to get streak");
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
 * PATCH /api/streak
 * Update daily threshold
 */
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { dailyThreshold } = body;

    // Validate required field
    if (dailyThreshold === undefined) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "MISSING_FIELD",
            message: "dailyThreshold is required",
          },
        },
        { status: 400 }
      );
    }

    // Validate type
    if (typeof dailyThreshold !== "number") {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "INVALID_TYPE",
            message: "dailyThreshold must be a number",
            details: {
              provided: typeof dailyThreshold,
              expected: "number",
            },
          },
        },
        { status: 400 }
      );
    }

    // Update threshold (validation and auto-creation happens in service layer)
    try {
      const updated = await streakService.updateThreshold(null, dailyThreshold);
      return NextResponse.json({ success: true, data: updated });
    } catch (error: any) {
      // Check for validation errors
      if (
        error.message.includes("must be between") ||
        error.message.includes("must be an integer")
      ) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: "INVALID_THRESHOLD",
              message: error.message,
              details: {
                provided: dailyThreshold,
                min: 1,
                max: 9999,
              },
            },
          },
          { status: 400 }
        );
      }

      // Re-throw other errors
      throw error;
    }
  } catch (error) {
    logger.error({ error }, "Failed to update threshold");
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
