import { NextResponse } from "next/server";
import { sessionRepository, progressRepository } from "@/lib/repositories";
import { startOfYear, startOfMonth, startOfDay } from "date-fns";

export async function GET() {
  try {
    const now = new Date();
    const yearStart = startOfYear(now);
    const monthStart = startOfMonth(now);
    const today = startOfDay(now);

    // Books read (all time, this year, this month)
    const booksReadTotal = await sessionRepository.countByStatus("read", false);

    const booksReadThisYear = await sessionRepository.countCompletedAfterDate(yearStart);

    const booksReadThisMonth = await sessionRepository.countCompletedAfterDate(monthStart);

    // Currently reading (only count active sessions)
    const currentlyReading = await sessionRepository.countByStatus("reading", true);

    // Pages read (total, this year, this month, today)
    const pagesReadTotal = await progressRepository.getTotalPagesRead();

    const pagesReadThisYear = await progressRepository.getPagesReadAfterDate(yearStart);

    const pagesReadThisMonth = await progressRepository.getPagesReadAfterDate(monthStart);

    const pagesReadToday = await progressRepository.getPagesReadAfterDate(today);

    // Calculate average reading speed (pages per day) for the last 30 days
    const avgPagesPerDay = await progressRepository.getAveragePagesPerDay(30);

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
    console.error("Error fetching stats:", error);
    return NextResponse.json({ error: "Failed to fetch statistics" }, { status: 500 });
  }
}
