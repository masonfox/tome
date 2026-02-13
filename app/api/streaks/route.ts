import { getLogger } from "@/lib/logger";
import { NextResponse } from "next/server";
import { streakService } from "@/lib/services/streak.service";

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // First, check and reset streak if needed (explicit write operation)
    await streakService.checkAndResetStreakIfNeeded(null);

    // Then, get the current streak data (read-only operation)
    const streak = await streakService.getStreakBasic(null);

    return NextResponse.json(streak);
  } catch (error) {
    getLogger().error({ err: error }, "Error fetching streak");
    return NextResponse.json({ error: "Failed to fetch streak" }, { status: 500 });
  }
}
