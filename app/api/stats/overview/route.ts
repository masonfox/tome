import { getLogger } from "@/lib/logger";
import { toDateString } from "@/utils/dateHelpers.server";
import { NextResponse } from "next/server";
import { sessionRepository, progressRepository, streakRepository } from "@/lib/repositories";
import { startOfYear, startOfMonth, startOfDay, subDays, format } from "date-fns";
import { toZonedTime, fromZonedTime } from "date-fns-tz";

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // Get user timezone from streak record (null = default user in single-user app)
    const streak = await streakRepository.getOrCreate(null);
    const userTimezone = streak.userTimezone || "America/New_York";

    // All date boundaries must be calculated in user's timezone, then converted to UTC
    const now = new Date();
    
    // Year start in user timezone
    const yearStartInUserTz = startOfYear(toZonedTime(now, userTimezone));
    const yearStartUtc = fromZonedTime(yearStartInUserTz, userTimezone);
    
    // Month start in user timezone
    const monthStartInUserTz = startOfMonth(toZonedTime(now, userTimezone));
    const monthStartUtc = fromZonedTime(monthStartInUserTz, userTimezone);
    
    // Today start in user timezone
    const todayInUserTz = startOfDay(toZonedTime(now, userTimezone));
    const todayUtc = fromZonedTime(todayInUserTz, userTimezone);
    
    // 30 days ago in user timezone
    const thirtyDaysAgoInUserTz = subDays(todayInUserTz, 30);
    const thirtyDaysAgoUtc = fromZonedTime(thirtyDaysAgoInUserTz, userTimezone);

    // Books read (all time, this year, this month)
    const booksReadTotal = await sessionRepository.countByStatus("read", false);

    const booksReadThisYear = await sessionRepository.countCompletedAfterDate(toDateString(yearStartUtc));

    const booksReadThisMonth = await sessionRepository.countCompletedAfterDate(toDateString(monthStartUtc));

    // Currently reading (only count active sessions)
    const currentlyReading = await sessionRepository.countByStatus("reading", true);

    // Pages read (total, this year, this month, today)
    const pagesReadTotal = await progressRepository.getTotalPagesRead();

    const pagesReadThisYear = await progressRepository.getPagesReadAfterDate(toDateString(yearStartUtc));

    const pagesReadThisMonth = await progressRepository.getPagesReadAfterDate(toDateString(monthStartUtc));

    const pagesReadToday = await progressRepository.getPagesReadAfterDate(toDateString(todayUtc));

    // Calculate average reading speed (pages per day) for the last 30 days in user timezone
    const avgPagesPerDay = await progressRepository.getAveragePagesPerDay(toDateString(thirtyDaysAgoUtc), userTimezone);

    return NextResponse.json({
      booksRead: {
        total: booksReadTotal,
        thisYear: booksReadThisYear,
        thisMonth: booksReadThisMonth,
      },
      currentlyReading,
      pagesRead: {
        total: pagesReadTotal,
        thisYear: pagesReadThisYear,
        thisMonth: pagesReadThisMonth,
        today: pagesReadToday,
      },
      avgPagesPerDay,
    });
  } catch (error) {
    getLogger().error({ err: error }, "Error fetching stats");
    return NextResponse.json({ error: "Failed to fetch statistics" }, { status: 500 });
  }
}
