import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { sessionRepository, progressRepository, bookRepository } from "@/lib/repositories";
import { rebuildStreak } from "@/lib/streaks";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const bookId = parseInt(params.id);

    if (isNaN(bookId)) {
      return NextResponse.json({ error: "Invalid book ID format" }, { status: 400 });
    }

    // Get active reading session for this book
    const session = await sessionRepository.findActiveByBookId(bookId);

    if (!session) {
      return NextResponse.json({ status: null });
    }

    return NextResponse.json(session);
  } catch (error) {
    console.error("Error fetching status:", error);
    return NextResponse.json({ error: "Failed to fetch status" }, { status: 500 });
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
    const { status, rating, review, startedDate, completedDate } = body;

    if (!status || !["to-read", "read-next", "reading", "read"].includes(status)) {
      return NextResponse.json(
        { error: "Invalid status. Must be 'to-read', 'read-next', 'reading', or 'read'" },
        { status: 400 }
      );
    }

    // Find active reading session or create new one
    let readingSession = await sessionRepository.findActiveByBookId(bookId);

    // Detect "backward movement" from "reading" to planning statuses
    const isBackwardMovement =
      readingSession &&
      readingSession.status === "reading" &&
      (status === "read-next" || status === "to-read");

    // Check if current session has progress
    let hasProgress = false;
    if (isBackwardMovement && readingSession) {
      hasProgress = await progressRepository.hasProgressForSession(readingSession.id);
    }

    // If moving backward with progress, archive current session and create new one
    if (isBackwardMovement && hasProgress && readingSession) {
      console.log(
        `[Status] Archiving session #${readingSession.sessionNumber} and creating new session for backward movement`
      );

      // Archive current session
      await sessionRepository.archive(readingSession.id);

      // Create new session with new status
      const newSessionNumber = readingSession.sessionNumber + 1;
      const newSession = await sessionRepository.create({
        userId: readingSession.userId,
        bookId,
        sessionNumber: newSessionNumber,
        status: status as any,
        isActive: true,
      });

      // Rebuild streak to ensure consistency
      try {
        console.log("[Status] Rebuilding streak after session archival");
        await rebuildStreak();
      } catch (streakError) {
        console.error("[Status] Failed to rebuild streak:", streakError);
        // Don't fail the request if streak rebuild fails
      }

      // Revalidate pages
      revalidatePath("/");
      revalidatePath("/library");
      revalidatePath("/stats");
      revalidatePath(`/books/${bookId}`);

      return NextResponse.json({
        ...newSession,
        sessionArchived: true,
        archivedSessionNumber: readingSession.sessionNumber,
      });
    }

    // Otherwise, proceed with normal update/create logic
    const updateData: any = {
      status,
    };

    // Set dates based on status (use Date objects for Drizzle)
    if (status === "reading" && !readingSession?.startedDate) {
      updateData.startedDate = startedDate 
        ? new Date(startedDate)
        : new Date();
    }

    if (status === "read") {
      if (!updateData.startedDate && !readingSession?.startedDate) {
        updateData.startedDate = startedDate 
          ? new Date(startedDate)
          : new Date();
      }
      updateData.completedDate = completedDate 
        ? new Date(completedDate)
        : new Date();
      // Auto-archive session when marked as read
      updateData.isActive = false;
    }

    if (review !== undefined) {
      updateData.review = review;
    }

    if (readingSession) {
      // Update existing session
      readingSession = await sessionRepository.update(readingSession.id, updateData);
    } else {
      // Create new session (first time reading this book)
      // Get next session number
      const sessionNumber = await sessionRepository.getNextSessionNumber(bookId);

      readingSession = await sessionRepository.create({
        bookId,
        sessionNumber,
        isActive: true,
        ...updateData,
      });
    }

    // Update book rating if provided (single source of truth: books table)
    if (rating !== undefined) {
      await bookRepository.update(bookId, { rating });
    }
    // Note: Rating is never stored on sessions - only on books (synced with Calibre)

    // Revalidate pages that display book status/reading lists
    revalidatePath("/"); // Dashboard
    revalidatePath("/library"); // Library page
    revalidatePath("/stats"); // Stats page
    revalidatePath(`/books/${bookId}`); // Book detail page

    return NextResponse.json(readingSession);
  } catch (error) {
    console.error("Error updating status:", error);
    return NextResponse.json({ error: "Failed to update status" }, { status: 500 });
  }
}
