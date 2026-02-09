import { getLogger } from "@/lib/logger";
import { NextResponse } from "next/server";
import { readingStatsService } from "@/lib/services";

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const overview = await readingStatsService.getOverview();

    return NextResponse.json(overview);
  } catch (error) {
    getLogger().error({ err: error }, "Error fetching stats");
    return NextResponse.json({ error: "Failed to fetch statistics" }, { status: 500 });
  }
}
