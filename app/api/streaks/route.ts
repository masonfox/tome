import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db/mongodb";
import { getOrCreateStreak, getActivityCalendar } from "@/lib/streaks";

export async function GET() {
  try {
    await connectDB();

    const streak = await getOrCreateStreak();

    return NextResponse.json(JSON.parse(JSON.stringify(streak)));
  } catch (error) {
    console.error("Error fetching streak:", error);
    return NextResponse.json(
      { error: "Failed to fetch streak" },
      { status: 500 }
    );
  }
}
