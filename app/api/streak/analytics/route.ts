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
    
    let days: number;
    const now = new Date();
    
    // Handle special time period options
    if (daysParam === "this-year") {
      // Calculate days from January 1st of current year to today
      const startOfYear = new Date(now.getFullYear(), 0, 1);
      days = Math.ceil((now.getTime() - startOfYear.getTime()) / (1000 * 60 * 60 * 24));
    } else if (daysParam === "all-time") {
      // Use a large number to fetch all available data
      days = 3650; // ~10 years
    } else {
      // Parse as numeric days
      days = daysParam ? parseInt(daysParam) : 365;
      
      // Validate numeric days parameter (1-3650 range for all-time support)
      if (isNaN(days) || days < 1 || days > 3650) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: "INVALID_PARAMETER",
              message: "days parameter must be between 1 and 3650, or 'this-year', or 'all-time'",
              details: {
                provided: daysParam,
                validNumericRange: "1-3650",
                validSpecialValues: ["this-year", "all-time"],
              },
            },
          },
          { status: 400 }
        );
      }
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
