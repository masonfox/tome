import { NextResponse } from "next/server";
import { getOrCreateStreak } from "@/lib/streaks";

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const streak = await getOrCreateStreak();

    return NextResponse.json(streak);
  } catch (error) {
    console.error("Error fetching streak:", error);
    return NextResponse.json({ error: "Failed to fetch streak" }, { status: 500 });
  }
}
