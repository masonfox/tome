import { NextResponse } from "next/server";
import { getOrCreateStreak } from "@/lib/streaks";

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const streak = await getOrCreateStreak();

    return NextResponse.json(streak);
  } catch (error) {
    const { getLogger } = require("@/lib/logger");
    getLogger().error({ err: error }, "Error fetching streak");
    return NextResponse.json({ error: "Failed to fetch streak" }, { status: 500 });
  }
}
