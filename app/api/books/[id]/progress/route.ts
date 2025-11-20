import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { bookRepository, sessionRepository, progressRepository } from "@/lib/repositories";
import { updateStreaks } from "@/lib/streaks";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const bookId = parseInt(params.id);

    if (isNaN(bookId)) {
      return NextResponse.json({ error: "Invalid book ID format" }, { status: 400 });
    }

    // Check for sessionId query parameter
    const sessionIdParam = request.nextUrl.searchParams.get("sessionId");

    if (sessionIdParam) {
      // Get progress for specific session
      const sessionId = parseInt(sessionIdParam);
      if (isNaN(sessionId)) {
        return NextResponse.json({ error: "Invalid session ID format" }, { status: 400 });
      }

      const progressLogs = await progressRepository.findBySessionId(sessionId);
      return NextResponse.json(progressLogs);
    } else {
      // Get progress for active session only
      const activeSession = await sessionRepository.findActiveByBookId(bookId);

      if (!activeSession) {
        return NextResponse.json([]);
      }

      const progressLogs = await progressRepository.findBySessionId(activeSession.id);
      return NextResponse.json(progressLogs);
    }
  } catch (error) {
    console.error("Error fetching progress:", error);
    return NextResponse.json({ error: "Failed to fetch progress" }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const bookId = parseInt(params.id);

    if (isNaN(bookId)) {
      return NextResponse.json({ error: "Invalid book ID format" }, { status: 400 });
    }

    const body = await request.json();
    const { currentPage, currentPercentage, notes, progressDate } = body;

    const book = await bookRepository.findById(bookId);

    if (!book) {
      return NextResponse.json({ error: "Book not found" }, { status: 404 });
    }

    // Get the active reading session
    const activeSession = await sessionRepository.findActiveByBookId(bookId);

    if (!activeSession) {
      return NextResponse.json(
        { error: "No active reading session found. Please set a reading status first." },
        { status: 400 }
      );
    }

    // Only allow progress logging for books currently being read
    if (activeSession.status !== "reading") {
      return NextResponse.json(
        { error: "Can only log progress for books with 'reading' status" },
        { status: 400 }
      );
    }

    // Get the last progress entry for this session to calculate pages read
    const lastProgress = await progressRepository.findLatestBySessionId(activeSession.id);

    let finalCurrentPage = currentPage;
    let finalCurrentPercentage = currentPercentage;

    // Calculate based on what was provided
    if (currentPage !== undefined && book.totalPages) {
      finalCurrentPercentage = (currentPage / book.totalPages) * 100;
    } else if (currentPercentage !== undefined && book.totalPages) {
      finalCurrentPage = Math.floor((currentPercentage / 100) * book.totalPages);
    } else if (currentPage !== undefined) {
      finalCurrentPercentage = 0; // Can't calculate without total pages
    } else {
      return NextResponse.json(
        { error: "Either currentPage or currentPercentage is required" },
        { status: 400 }
      );
    }

    const pagesRead = lastProgress
      ? Math.max(0, finalCurrentPage - (lastProgress.currentPage || 0))
      : finalCurrentPage;

    const progressLog = await progressRepository.create({
      bookId,
      sessionId: activeSession.id,
      currentPage: finalCurrentPage,
      currentPercentage: finalCurrentPercentage,
      progressDate: progressDate ? new Date(progressDate) : new Date(),
      notes,
      pagesRead,
    });

    // Touch the session to update its updatedAt timestamp (for sorting on dashboard)
    await sessionRepository.update(activeSession.id, {
      updatedAt: new Date(),
    } as any);

    // Update streak
    try {
      console.log("[Streak] Updating streak after progress log");
      const updatedStreak = await updateStreaks();
      console.log("[Streak] Updated:", {
        currentStreak: updatedStreak.currentStreak,
        longestStreak: updatedStreak.longestStreak,
        lastActivityDate: updatedStreak.lastActivityDate,
        totalDaysActive: updatedStreak.totalDaysActive,
      });
    } catch (streakError) {
      console.error("[Streak] Failed to update streak:", streakError);
      // Don't fail the entire request if streak update fails
    }

    // If book is completed, update session status to "read"
    if (finalCurrentPercentage >= 100 && activeSession.status === "reading") {
      await sessionRepository.update(activeSession.id, {
        status: "read",
        completedDate: new Date(),
      } as any);
      console.log(`[Progress] Book completed, session status updated to 'read'`);
    }

    // Revalidate pages that display streak data
    revalidatePath("/"); // Dashboard
    revalidatePath("/stats"); // Stats page

    return NextResponse.json(progressLog);
  } catch (error) {
    console.error("Error logging progress:", error);
    return NextResponse.json({ error: "Failed to log progress" }, { status: 500 });
  }
}
