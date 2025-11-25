import { NextRequest, NextResponse } from "next/server";
import { streakService } from "@/lib/services/streak.service";
import { progressRepository } from "@/lib/repositories/progress.repository";
import { getLogger } from "@/lib/logger";

const logger = getLogger();

// Force dynamic rendering for this route
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const daysParam = searchParams.get("days");
    const days = daysParam ? parseInt(daysParam) : 365;

    // Validate days parameter (1-365 range)
    if (isNaN(days) || days < 1 || days > 365) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "INVALID_PARAMETER",
            message: "days parameter must be between 1 and 365",
            details: {
              provided: days,
              min: 1,
              max: 365,
            },
          },
        },
        { status: 400 }
      );
    }

    const streak = await streakService.getStreak();
    if (!streak) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "STREAK_NOT_FOUND",
            message: "No streak record found for user",
          },
        },
        { status: 404 }
      );
    }

    // Fetch daily reading history
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    const history = await progressRepository.getActivityCalendar(
      startDate,
      new Date()
    );

    // Enrich history data with thresholdMet boolean flag
    const enrichedHistory = history.map((day) => ({
      date: day.date,
      pagesRead: day.pagesRead,
      thresholdMet: day.pagesRead >= streak.dailyThreshold,
    }));

    // Calculate books ahead/behind (optional, only if reading goal exists)
    // TODO: Implement when reading goal feature is available
    // For now, we'll check if a goal exists and calculate accordingly
    let booksAheadOrBehind: number | undefined = undefined;

    // Return analytics data
    return NextResponse.json({
      success: true,
      data: {
        streak: {
          currentStreak: streak.currentStreak,
          longestStreak: streak.longestStreak,
          dailyThreshold: streak.dailyThreshold,
          totalDaysActive: streak.totalDaysActive,
        },
        dailyReadingHistory: enrichedHistory,
        ...(booksAheadOrBehind !== undefined && { booksAheadOrBehind }),
      },
    });
  } catch (error) {
    logger.error({ error }, "Failed to get streak analytics");
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
