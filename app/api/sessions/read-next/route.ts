/**
 * GET /api/sessions/read-next
 * 
 * Fetches all read-next status books with full book data, sorted by readNextOrder ascending.
 * Supports optional search parameter (currently unused, for future enhancement).
 */

import { NextResponse } from "next/server";
import { sessionRepository } from "@/lib/repositories/session.repository";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search")?.toLowerCase();

    // Fetch all read-next sessions with joined book data
    // Already sorted by readNextOrder ASC in repository
    const sessions = await sessionRepository.findReadNextWithBooks();

    // Note: Search filtering is handled client-side for v1
    // Server-side search can be added in future if needed

    return NextResponse.json(sessions);
  } catch (error) {
    console.error("[API /api/sessions/read-next] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch read-next books" },
      { status: 500 }
    );
  }
}
