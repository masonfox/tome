import { NextRequest, NextResponse } from "next/server";
import { journalService } from "@/lib/services/journal.service";

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    // Get timezone from query params, default to America/New_York
    const timezone = request.nextUrl.searchParams.get("timezone") || "America/New_York";
    
    const journalEntries = await journalService.getJournalEntries(timezone);
    
    return NextResponse.json(journalEntries);
  } catch (error) {
    const { getLogger } = require("@/lib/logger");
    getLogger().error({ err: error }, "Error fetching journal entries");
    return NextResponse.json(
      { error: "Failed to fetch journal entries" },
      { status: 500 }
    );
  }
}
