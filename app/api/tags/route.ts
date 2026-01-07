import { getLogger } from "@/lib/logger";
import { NextResponse } from "next/server";
import { tagService } from "@/lib/services";

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // Get all unique tags from all books
    const tagStats = await tagService.getTagStats();
    const tags = tagStats.map(stat => stat.name);

    return NextResponse.json(tags);
  } catch (error) {
    getLogger().error({ err: error }, "Error fetching tags");
    return NextResponse.json({ error: "Failed to fetch tags" }, { status: 500 });
  }
}
