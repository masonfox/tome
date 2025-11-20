import { NextRequest, NextResponse } from "next/server";
import { bookRepository, sessionRepository, progressRepository } from "@/lib/repositories";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const bookId = parseInt(params.id);

    if (isNaN(bookId)) {
      return NextResponse.json({ error: "Invalid book ID format" }, { status: 400 });
    }

    const book = await bookRepository.findById(bookId);

    if (!book) {
      return NextResponse.json({ error: "Book not found" }, { status: 404 });
    }

    // Get active reading session
    const activeSession = await sessionRepository.findActiveByBookId(book.id);

    // Get latest progress for active session only
    let latestProgress = null;
    if (activeSession) {
      latestProgress = await progressRepository.findLatestBySessionId(activeSession.id);
    }

    // Check if there are any completed reads (for re-reading feature)
    const completedReadsCount = await sessionRepository.countCompletedReadsByBookId(book.id);

    return NextResponse.json({
      ...book,
      activeSession,
      latestProgress,
      hasCompletedReads: completedReadsCount > 0,
      totalReads: completedReadsCount,
    });
  } catch (error) {
    console.error("Error fetching book:", error);
    return NextResponse.json({ error: "Failed to fetch book" }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const bookId = parseInt(params.id);

    if (isNaN(bookId)) {
      return NextResponse.json({ error: "Invalid book ID format" }, { status: 400 });
    }

    const body = await request.json();
    const { totalPages } = body;

    const book = await bookRepository.update(bookId, { totalPages });

    if (!book) {
      return NextResponse.json({ error: "Book not found" }, { status: 404 });
    }

    return NextResponse.json(book);
  } catch (error) {
    console.error("Error updating book:", error);
    return NextResponse.json({ error: "Failed to update book" }, { status: 500 });
  }
}
