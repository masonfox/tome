import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db/mongodb";
import { getActivityCalendar } from "@/lib/streaks";
import ProgressLog from "@/models/ProgressLog";
import { startOfYear } from "date-fns";

export async function GET(request: NextRequest) {
  try {
    await connectDB();

    const searchParams = request.nextUrl.searchParams;
    const year = parseInt(searchParams.get("year") || new Date().getFullYear().toString());
    const month = searchParams.get("month")
      ? parseInt(searchParams.get("month")!)
      : undefined;

    const activityData = await getActivityCalendar(undefined, year, month);

    // Also get monthly totals for the year
    const yearStart = startOfYear(new Date(year, 0, 1));
    const yearEnd = new Date(year, 11, 31);

    const monthlyData = await ProgressLog.aggregate([
      {
        $match: {
          progressDate: {
            $gte: yearStart,
            $lte: yearEnd,
          },
        },
      },
      {
        $group: {
          _id: {
            month: { $month: "$progressDate" },
            year: { $year: "$progressDate" },
          },
          pagesRead: { $sum: "$pagesRead" },
        },
      },
      {
        $sort: { "_id.month": 1 },
      },
    ]);

    return NextResponse.json({
      calendar: activityData,
      monthly: monthlyData.map((m) => ({
        month: m._id.month,
        year: m._id.year,
        pagesRead: m.pagesRead,
      })),
    });
  } catch (error) {
    console.error("Error fetching activity:", error);
    return NextResponse.json(
      { error: "Failed to fetch activity" },
      { status: 500 }
    );
  }
}
