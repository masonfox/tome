import { getLogger } from "@/lib/logger";
import { NextResponse } from "next/server";
import { tagService } from "@/lib/services";

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // Get tag statistics with book counts
    const tags = await tagService.getTagStats();
    
    // Get total count of unique books with tags
    const totalBooks = await tagService.countBooksWithTags();

    return NextResponse.json({ tags, totalBooks });
  } catch (error) {
    getLogger().error({ err: error }, "Error fetching tag statistics");
    return NextResponse.json({ error: "Failed to fetch tag statistics" }, { status: 500 });
  }
}
