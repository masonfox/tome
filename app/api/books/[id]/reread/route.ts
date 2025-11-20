import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { bookRepository, sessionRepository } from "@/lib/repositories";
import { rebuildStreak } from "@/lib/streaks";

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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

    // Find the most recent session (should be archived with status='read')
    const lastSession = await sessionRepository.findLatestByBookId(bookId);

    if (!lastSession) {
      return NextResponse.json(
        { error: "No reading sessions found for this book" },
        { status: 404 }
      );
    }

    // Check if the last session is completed
    // Only allow re-reading if the book has been completed
    if (lastSession.status !== "read") {
      return NextResponse.json(
        { error: "Can only re-read books that have been marked as 'read'" },
        { status: 400 }
      );
    }

    // Check if there's already an active session
    const existingActiveSession = await sessionRepository.findActiveByBookId(bookId);

    if (existingActiveSession) {
      return NextResponse.json(
        { error: "An active reading session already exists for this book" },
        { status: 400 }
      );
    }

    console.log(
      `[Reread] Starting re-read after completed session #${lastSession.sessionNumber} for book ${bookId}`
    );

    // Archive the last session first (if it's still active)
    if (lastSession.isActive) {
      await sessionRepository.archive(lastSession.id);
    }

    // Create a new reading session
    const newSessionNumber = lastSession.sessionNumber + 1;
    const newSession = await sessionRepository.create({
      userId: lastSession.userId,
      bookId,
      sessionNumber: newSessionNumber,
      status: "reading", // Start as 'reading' when re-reading
      startedDate: new Date(),
      isActive: true,
    });

    console.log(
      `[Reread] Created new session #${newSessionNumber} for book ${bookId}`
    );

    // Rebuild streak from all progress logs to ensure consistency
    try {
      console.log("[Reread] Rebuilding streak...");
      const updatedStreak = await rebuildStreak();
      console.log("[Reread] Streak rebuilt:", {
        currentStreak: updatedStreak.currentStreak,
        longestStreak: updatedStreak.longestStreak,
      });
    } catch (streakError) {
      console.error("[Reread] Failed to rebuild streak:", streakError);
      // Don't fail the entire request if streak rebuild fails
    }

    // Revalidate pages
    revalidatePath("/"); // Dashboard
    revalidatePath("/library"); // Library page
    revalidatePath(`/books/${bookId}`); // Book detail page

    return NextResponse.json({
      message: "Re-reading session started successfully",
      session: newSession,
      previousSession: {
        id: lastSession.id,
        sessionNumber: lastSession.sessionNumber,
      },
    });
  } catch (error: any) {
    console.error("Error starting re-read:", error);

    // Handle SQLite unique constraint error (race condition)
    if (error.message?.includes("UNIQUE constraint failed")) {
      return NextResponse.json(
        { error: "An active reading session already exists for this book" },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Failed to start re-reading session" },
      { status: 500 }
    );
  }
}
