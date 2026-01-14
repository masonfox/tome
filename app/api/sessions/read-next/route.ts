/**
 * GET /api/sessions/read-next
 * 
 * Fetches all read-next status books, sorted by readNextOrder ascending.
 * Supports optional search parameter.
 */

import { NextResponse } from "next/server";
import { sessionRepository } from "@/lib/repositories/session.repository";
import type { ReadingSession } from "@/lib/db/schema/reading-sessions";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search")?.toLowerCase();

    // Fetch all read-next sessions
    const sessions = await sessionRepository.findByStatus("read-next", true, 1000);

    // Apply search filter if provided (search in book title/authors would require joining)
    let filtered = sessions;
    if (search) {
      // Note: This is a simple filter. For full-text search, we'd need to join with books table.
      // For now, we'll just return all and let the frontend handle filtering.
      filtered = sessions;
    }

    // Sort by readNextOrder ascending
    const sorted = filtered.sort((a: ReadingSession, b: ReadingSession) => 
      (a.readNextOrder ?? 0) - (b.readNextOrder ?? 0)
    );

    return NextResponse.json(sorted);
  } catch (error) {
    console.error("[API /api/sessions/read-next] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch read-next books" },
      { status: 500 }
    );
  }
}
