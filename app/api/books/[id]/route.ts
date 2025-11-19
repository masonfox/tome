import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db/mongodb";
import Book from "@/models/Book";
import ReadingSession from "@/models/ReadingSession";
import ProgressLog from "@/models/ProgressLog";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await connectDB();

    const book = await Book.findById(params.id);

    if (!book) {
      return NextResponse.json({ error: "Book not found" }, { status: 404 });
    }

    // Get active reading session
    const activeSession = await ReadingSession.findOne({
      bookId: book._id,
      isActive: true,
    });

    // Get latest progress for active session only
    let latestProgress = null;
    if (activeSession) {
      latestProgress = await ProgressLog.findOne({
        bookId: book._id,
        sessionId: activeSession._id,
      })
        .sort({ progressDate: -1 })
        .limit(1);
    }

    // Check if there are any completed reads (for re-reading feature)
    const completedReadsCount = await ReadingSession.countDocuments({
      bookId: book._id,
      status: "read",
    });

    return NextResponse.json({
      ...JSON.parse(JSON.stringify(book)),
      activeSession: activeSession ? JSON.parse(JSON.stringify(activeSession)) : null,
      latestProgress: latestProgress ? JSON.parse(JSON.stringify(latestProgress)) : null,
      hasCompletedReads: completedReadsCount > 0,
      totalReads: completedReadsCount,
    });
  } catch (error) {
    console.error("Error fetching book:", error);
    return NextResponse.json(
      { error: "Failed to fetch book" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await connectDB();

    const body = await request.json();
    const { totalPages } = body;

    const book = await Book.findByIdAndUpdate(
      params.id,
      { totalPages },
      { new: true }
    );

    if (!book) {
      return NextResponse.json({ error: "Book not found" }, { status: 404 });
    }

    return NextResponse.json(JSON.parse(JSON.stringify(book)));
  } catch (error) {
    console.error("Error updating book:", error);
    return NextResponse.json(
      { error: "Failed to update book" },
      { status: 500 }
    );
  }
}
