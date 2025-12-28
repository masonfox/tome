import { NextResponse } from "next/server";
import { bookService } from "@/lib/services";

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // Get tag statistics with book counts
    const tags = await bookService.getTagStats();
    
    // Get total count of unique books with tags
    const totalBooks = await bookService.countBooksWithTags();

    return NextResponse.json({ tags, totalBooks });
  } catch (error) {
    const { getLogger } = require("@/lib/logger");
    getLogger().error({ err: error }, "Error fetching tag statistics");
    return NextResponse.json({ error: "Failed to fetch tag statistics" }, { status: 500 });
  }
}
