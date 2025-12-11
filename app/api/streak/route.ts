import { NextRequest, NextResponse } from "next/server";
import { streakService } from "@/lib/services/streak.service";
import { getLogger } from "@/lib/logger";

const logger = getLogger();

/**
 * GET /api/streak
 * Get current streak with enhanced data
 * Auto-creates streak record if it doesn't exist
 * Automatically checks and resets streak if days have been missed
 */
export async function GET(request: NextRequest) {
  try {
    // First, check and reset streak if needed (explicit write operation)
    await streakService.checkAndResetStreakIfNeeded(null);

    // Then, get the current streak data (read-only operation)
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
 * Update daily threshold or enable/disable streak tracking
 */
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { dailyThreshold, streakEnabled } = body;

    // Handle enable/disable
    if (streakEnabled !== undefined) {
      if (typeof streakEnabled !== "boolean") {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: "INVALID_TYPE",
              message: "streakEnabled must be a boolean",
              details: {
                provided: typeof streakEnabled,
                expected: "boolean",
              },
            },
          },
          { status: 400 }
        );
      }

      const updated = await streakService.setStreakEnabled(null, streakEnabled, dailyThreshold);
      return NextResponse.json({ success: true, data: updated });
    }

    // Handle threshold update
    if (dailyThreshold !== undefined) {
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
    }

    // No valid fields provided
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "MISSING_FIELD",
          message: "dailyThreshold or streakEnabled is required",
        },
      },
      { status: 400 }
    );
  } catch (error) {
    logger.error({ error }, "Failed to update streak");
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
