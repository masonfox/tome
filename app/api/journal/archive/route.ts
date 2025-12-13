import { NextResponse } from "next/server";
import { journalService } from "@/lib/services/journal.service";

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const archiveData = await journalService.getArchiveMetadata();

    return NextResponse.json(archiveData);
  } catch (error) {
    const { getLogger } = require("@/lib/logger");
    getLogger().error({ err: error }, "Error fetching journal archive metadata");
    return NextResponse.json(
      { error: "Failed to fetch archive metadata" },
      { status: 500 }
    );
  }
}
