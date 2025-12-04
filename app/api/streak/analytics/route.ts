import { NextRequest, NextResponse } from "next/server";
import { streakService } from "@/lib/services/streak.service";
import { progressRepository } from "@/lib/repositories/progress.repository";
import { getLogger } from "@/lib/logger";
import { toZonedTime, formatInTimeZone, fromZonedTime } from "date-fns-tz";

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

    // Get user timezone for date calculations
    const userTimezone = streak.userTimezone || "America/New_York";

    // Calculate date range using UTC (to match database DATE() output)
    // Database uses SQLite's DATE(timestamp, 'unixepoch') which gives UTC dates
    const requestedStartDate = new Date();
    requestedStartDate.setUTCDate(requestedStartDate.getUTCDate() - days);
    requestedStartDate.setUTCHours(0, 0, 0, 0);
    
    const endDate = new Date();
    endDate.setUTCHours(23, 59, 59, 999); // End of today UTC
    
    // Get the earliest progress date to avoid showing empty days before tracking started
    const earliestProgressDate = await progressRepository.getEarliestProgressDate();
    
    // Use the later of: requested start date OR earliest progress date
    // This prevents showing empty data before the user started tracking
    const actualStartDate = earliestProgressDate && earliestProgressDate > requestedStartDate
      ? earliestProgressDate
      : requestedStartDate;
    
    const history = await progressRepository.getActivityCalendar(
      actualStartDate,
      endDate,
      userTimezone
    );

    // Create a map of existing data for quick lookup
    const dataMap = new Map<string, number>();
    history.forEach((day) => {
      dataMap.set(day.date, day.pagesRead);
    });

    // Fill in all days in the range, including days with no data (0 pages)
    // getActivityCalendar returns dates in the user's timezone, so we iterate through
    // dates in the user's timezone as well
    const allDays: { date: string; pagesRead: number; thresholdMet: boolean }[] = [];
    
    // Get the start date in the user's timezone
    const startDateInUserTz = toZonedTime(actualStartDate, userTimezone);
    startDateInUserTz.setHours(0, 0, 0, 0);
    
    // Get today's date in the user's timezone to know when to stop
    // This ensures we only show data up to the current day in the user's timezone
    // (not UTC, which could be a day ahead)
    const nowInUserTz = toZonedTime(new Date(), userTimezone);
    nowInUserTz.setHours(23, 59, 59, 999);
    
    const currentDate = new Date(startDateInUserTz);
    while (currentDate <= nowInUserTz) {
      // Format as a date string in the user's timezone
      const dateStr = formatInTimeZone(
        fromZonedTime(currentDate, userTimezone),
        userTimezone,
        'yyyy-MM-dd'
      );
      const pagesRead = dataMap.get(dateStr) || 0;
      
      allDays.push({
        date: dateStr,
        pagesRead,
        thresholdMet: pagesRead >= streak.dailyThreshold,
      });
      
      currentDate.setDate(currentDate.getDate() + 1);
    }

    const enrichedHistory = allDays;

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
