import { getLogger } from "@/lib/logger";
import { NextRequest, NextResponse } from "next/server";
import { journalService } from "@/lib/services/journal.service";

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    // Get timezone from query params, default to America/New_York
    const timezone = request.nextUrl.searchParams.get("timezone") || "America/New_York";
    
    const archiveData = await journalService.getArchiveMetadata(timezone);

    return NextResponse.json(archiveData);
  } catch (error) {
    getLogger().error({ err: error }, "Error fetching journal archive metadata");
    return NextResponse.json(
      { error: "Failed to fetch archive metadata" },
      { status: 500 }
    );
  }
}
