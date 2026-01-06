import { getLogger } from "@/lib/logger";
import { NextRequest, NextResponse } from "next/server";
import { journalService } from "@/lib/services/journal.service";
import { API_LIMITS } from "@/lib/constants";

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    // Get timezone from query params, default to America/New_York
    const timezone = request.nextUrl.searchParams.get("timezone") || "America/New_York";
    
    // Validate and sanitize limit
    let limit = parseInt(request.nextUrl.searchParams.get("limit") || API_LIMITS.DEFAULT_PAGE_SIZE.toString());
    if (isNaN(limit) || limit < 1) limit = API_LIMITS.DEFAULT_PAGE_SIZE;
    if (limit > API_LIMITS.MAX_JOURNAL_ENTRIES_PER_REQUEST) limit = API_LIMITS.MAX_JOURNAL_ENTRIES_PER_REQUEST;
    
    // Validate and sanitize skip
    let skip = parseInt(request.nextUrl.searchParams.get("skip") || "0");
    if (isNaN(skip) || skip < 0) skip = 0;
    
    const result = await journalService.getJournalEntries(timezone, limit, skip);
    
    return NextResponse.json(result);
  } catch (error) {
    getLogger().error({ err: error }, "Error fetching journal entries");
    return NextResponse.json(
      { error: "Failed to fetch journal entries" },
      { status: 500 }
    );
  }
}
