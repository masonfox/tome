import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { connectDB } from "@/lib/db/mongodb";
import ReadingSession from "@/models/ReadingSession";
import ProgressLog from "@/models/ProgressLog";
import { rebuildStreak } from "@/lib/streaks";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await connectDB();

    // Get active reading session for this book
    const session = await ReadingSession.findOne({
      bookId: params.id,
      isActive: true,
    });

    if (!session) {
      return NextResponse.json({ status: null });
    }

    return NextResponse.json(session);
  } catch (error) {
    console.error("Error fetching status:", error);
    return NextResponse.json(
      { error: "Failed to fetch status" },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await connectDB();

    const body = await request.json();
    const { status, review, startedDate, completedDate } = body;

    if (!status || !["to-read", "read-next", "reading", "read"].includes(status)) {
      return NextResponse.json(
        { error: "Invalid status. Must be 'to-read', 'read-next', 'reading', or 'read'" },
        { status: 400 }
      );
    }

    // Find active reading session or create new one
    let readingSession = await ReadingSession.findOne({
      bookId: params.id,
      isActive: true,
    });

    // Detect "backward movement" from "reading" to planning statuses
    const isBackwardMovement =
      readingSession &&
      readingSession.status === "reading" &&
      (status === "read-next" || status === "to-read");

    // Check if current session has progress
    let hasProgress = false;
    if (isBackwardMovement && readingSession) {
      const progressExists = await ProgressLog.exists({ sessionId: readingSession._id });
      hasProgress = !!progressExists; // Convert to boolean
    }

    // If moving backward with progress, archive current session and create new one
    if (isBackwardMovement && hasProgress && readingSession) {
      console.log(
        `[Status] Archiving session #${readingSession.sessionNumber} and creating new session for backward movement`
      );

      // Archive current session
      readingSession.isActive = false;
      await readingSession.save();

      // Create new session with new status
      const newSessionNumber = readingSession.sessionNumber + 1;
      const newSession = await ReadingSession.create({
        userId: readingSession.userId,
        bookId: params.id,
        sessionNumber: newSessionNumber,
        status,
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
      revalidatePath(`/books/${params.id}`);

      return NextResponse.json({
        ...newSession.toObject(),
        sessionArchived: true,
        archivedSessionNumber: readingSession.sessionNumber,
      });
    }

    // Otherwise, proceed with normal update/create logic
    const updateData: any = {
      status,
    };

    // Set dates based on status
    if (status === "reading" && !readingSession?.startedDate) {
      updateData.startedDate = startedDate || new Date();
    }

    if (status === "read") {
      if (!updateData.startedDate && !readingSession?.startedDate) {
        updateData.startedDate = startedDate || new Date();
      }
      updateData.completedDate = completedDate || new Date();
      // Auto-archive session when marked as read
      updateData.isActive = false;
    }

    if (review !== undefined) {
      updateData.review = review;
    }

    if (readingSession) {
      // Update existing session
      readingSession = await ReadingSession.findByIdAndUpdate(
        readingSession._id,
        updateData,
        { new: true }
      );
    } else {
      // Create new session (first time reading this book)
      // Find the highest session number for this book
      const lastSession = await ReadingSession.findOne({ bookId: params.id })
        .sort({ sessionNumber: -1 })
        .limit(1);

      const sessionNumber = lastSession ? lastSession.sessionNumber + 1 : 1;

      readingSession = await ReadingSession.create({
        bookId: params.id,
        sessionNumber,
        isActive: true,
        ...updateData,
      });
    }

    // Revalidate pages that display book status/reading lists
    revalidatePath("/"); // Dashboard
    revalidatePath("/library"); // Library page
    revalidatePath("/stats"); // Stats page
    revalidatePath(`/books/${params.id}`); // Book detail page

    return NextResponse.json(readingSession);
  } catch (error) {
    console.error("Error updating status:", error);
    return NextResponse.json(
      { error: "Failed to update status" },
      { status: 500 }
    );
  }
}
