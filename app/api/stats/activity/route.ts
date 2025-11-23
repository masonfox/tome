import { NextRequest, NextResponse } from "next/server";
import { getActivityCalendar } from "@/lib/streaks";
import { progressRepository } from "@/lib/repositories";
import { startOfYear } from "date-fns";

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const year = parseInt(searchParams.get("year") || new Date().getFullYear().toString());
    const month = searchParams.get("month")
      ? parseInt(searchParams.get("month")!)
      : undefined;

    const activityData = await getActivityCalendar(undefined, year, month);

    // Also get monthly totals for the year
    const yearStart = startOfYear(new Date(year, 0, 1));
    const yearEnd = new Date(year, 11, 31);

    // Get activity calendar data for the whole year to calculate monthly totals
    const yearlyActivity = await progressRepository.getActivityCalendar(yearStart, yearEnd);
    
    // Group by month
    const monthlyMap = new Map<number, { pagesRead: number }>();
    yearlyActivity.forEach(item => {
      const date = new Date(item.date);
      const month = date.getMonth() + 1; // JavaScript months are 0-indexed
      const existing = monthlyMap.get(month) || { pagesRead: 0 };
      monthlyMap.set(month, { pagesRead: existing.pagesRead + item.pagesRead });
    });

    const monthlyData = Array.from(monthlyMap.entries()).map(([month, data]) => ({
      month,
      year,
      pagesRead: data.pagesRead,
    })).sort((a, b) => a.month - b.month);

    return NextResponse.json({
      calendar: activityData,
      monthly: monthlyData,
    });
  } catch (error) {
    const { getLogger } = require("@/lib/logger");
    getLogger().error({ err: error }, "Error fetching activity");
    return NextResponse.json(
      { error: "Failed to fetch activity" },
      { status: 500 }
    );
  }
}
