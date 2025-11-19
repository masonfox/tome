import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { connectDB } from "@/lib/db/mongodb";
import mongoose from "mongoose";
import Book from "@/models/Book";
import ReadingSession from "@/models/ReadingSession";
import { rebuildStreak } from "@/lib/streaks";

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await connectDB();

    // Validate ObjectId format
    if (!mongoose.Types.ObjectId.isValid(params.id)) {
      return NextResponse.json(
        { error: "Invalid book ID format" },
        { status: 400 }
      );
    }

    // Check if book exists
    const book = await Book.findById(params.id);
    if (!book) {
      return NextResponse.json({ error: "Book not found" }, { status: 404 });
    }

    // Find the most recent session (should be archived with status='read')
    const lastSession = await ReadingSession.findOne({
      bookId: params.id,
    }).sort({ sessionNumber: -1 });

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
    const existingActiveSession = await ReadingSession.findOne({
      bookId: params.id,
      isActive: true,
    });

    if (existingActiveSession) {
      return NextResponse.json(
        { error: "An active reading session already exists for this book" },
        { status: 400 }
      );
    }

    console.log(
      `[Reread] Starting re-read after completed session #${lastSession.sessionNumber} for book ${params.id}`
    );

    // Create a new reading session
    const newSessionNumber = lastSession.sessionNumber + 1;
    const newSession = new ReadingSession({
      userId: lastSession.userId,
      bookId: params.id,
      sessionNumber: newSessionNumber,
      status: "reading", // Start as 'reading' when re-reading
      startedDate: new Date(),
      isActive: true,
    });

    await newSession.save();

    console.log(
      `[Reread] Created new session #${newSessionNumber} for book ${params.id}`
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
    revalidatePath(`/books/${params.id}`); // Book detail page

    return NextResponse.json({
      message: "Re-reading session started successfully",
      session: newSession,
      previousSession: {
        id: lastSession._id,
        sessionNumber: lastSession.sessionNumber,
      },
    });
  } catch (error: any) {
    console.error("Error starting re-read:", error);

    // Handle MongoDB duplicate key error (race condition)
    if (error.code === 11000) {
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
