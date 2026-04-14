import { getLogger } from "@/lib/logger";
import { NextRequest, NextResponse } from "next/server";
import { bookRepository, sessionRepository } from "@/lib/repositories";

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const bookId = parseInt(params.id);

    if (isNaN(bookId)) {
      return NextResponse.json({ error: "Invalid book ID format" }, { status: 400 });
    }

    // Check if book exists
    const book = await bookRepository.findById(bookId);
    if (!book) {
      return NextResponse.json({ error: "Book not found" }, { status: 404 });
    }

    // OPTIMIZED: Get all reading sessions with progress summaries in a single query
    const sessionsWithProgress = await sessionRepository.findAllByBookIdWithProgress(bookId);

    // Get chronologically ordered sessions to calculate display numbers
    const orderedSessions = await sessionRepository.findAllByBookIdOrdered(bookId);
    
    // Create a map of sessionId -> displayNumber
    const displayNumberMap = new Map(
      orderedSessions.map((session, index) => [session.id, index + 1])
    );

    // Add displayNumber to each session
    const sessionsWithDisplayNumbers = sessionsWithProgress.map(session => ({
      ...session,
      displayNumber: displayNumberMap.get(session.id) ?? session.sessionNumber,
    }));

    return NextResponse.json(sessionsWithDisplayNumbers, {
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    });
  } catch (error) {
    getLogger().error({ err: error }, "Error fetching reading sessions");
    return NextResponse.json(
      { error: "Failed to fetch reading sessions" },
      { status: 500 }
    );
  }
}
