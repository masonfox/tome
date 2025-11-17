import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db/mongodb";
import Book from "@/models/Book";
import ReadingStatus from "@/models/ReadingStatus";
import ProgressLog from "@/models/ProgressLog";
import { startOfYear, startOfMonth, startOfDay } from "date-fns";

export async function GET() {
  try {
    await connectDB();

    const now = new Date();
    const yearStart = startOfYear(now);
    const monthStart = startOfMonth(now);
    const today = startOfDay(now);

    // Books read (all time, this year, this month)
    const booksReadTotal = await ReadingStatus.countDocuments({
      status: "read",
    });

    const booksReadThisYear = await ReadingStatus.countDocuments({
      status: "read",
      completedDate: { $gte: yearStart },
    });

    const booksReadThisMonth = await ReadingStatus.countDocuments({
      status: "read",
      completedDate: { $gte: monthStart },
    });

    // Currently reading
    const currentlyReading = await ReadingStatus.countDocuments({
      status: "reading",
    });

    // Pages read (total, this year, this month, today)
    const pagesReadTotal = await ProgressLog.aggregate([
      {
        $group: {
          _id: null,
          total: { $sum: "$pagesRead" },
        },
      },
    ]);

    const pagesReadThisYear = await ProgressLog.aggregate([
      {
        $match: { progressDate: { $gte: yearStart } },
      },
      {
        $group: {
          _id: null,
          total: { $sum: "$pagesRead" },
        },
      },
    ]);

    const pagesReadThisMonth = await ProgressLog.aggregate([
      {
        $match: { progressDate: { $gte: monthStart } },
      },
      {
        $group: {
          _id: null,
          total: { $sum: "$pagesRead" },
        },
      },
    ]);

    const pagesReadToday = await ProgressLog.aggregate([
      {
        $match: { progressDate: { $gte: today } },
      },
      {
        $group: {
          _id: null,
          total: { $sum: "$pagesRead" },
        },
      },
    ]);

    // Calculate average reading speed (pages per day) for the last 30 days
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const recentProgress = await ProgressLog.aggregate([
      {
        $match: { progressDate: { $gte: thirtyDaysAgo } },
      },
      {
        $group: {
          _id: null,
          total: { $sum: "$pagesRead" },
          days: {
            $addToSet: {
              $dateToString: { format: "%Y-%m-%d", date: "$progressDate" },
            },
          },
        },
      },
    ]);

    const avgPagesPerDay =
      recentProgress.length > 0 && recentProgress[0].days.length > 0
        ? Math.round(recentProgress[0].total / recentProgress[0].days.length)
        : 0;

    return NextResponse.json({
      booksRead: {
        total: booksReadTotal,
        thisYear: booksReadThisYear,
        thisMonth: booksReadThisMonth,
      },
      currentlyReading,
      pagesRead: {
        total: pagesReadTotal[0]?.total || 0,
        thisYear: pagesReadThisYear[0]?.total || 0,
        thisMonth: pagesReadThisMonth[0]?.total || 0,
        today: pagesReadToday[0]?.total || 0,
      },
      avgPagesPerDay,
    });
  } catch (error) {
    console.error("Error fetching stats:", error);
    return NextResponse.json(
      { error: "Failed to fetch statistics" },
      { status: 500 }
    );
  }
}
