import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db/mongodb";
import Book from "@/models/Book";
import ProgressLog from "@/models/ProgressLog";
import ReadingStatus from "@/models/ReadingStatus";
import { updateStreaks } from "@/lib/streaks";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await connectDB();

    const progressLogs = await ProgressLog.find({ bookId: params.id }).sort({
      progressDate: -1,
    });

    return NextResponse.json(progressLogs);
  } catch (error) {
    console.error("Error fetching progress:", error);
    return NextResponse.json(
      { error: "Failed to fetch progress" },
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
    const { currentPage, currentPercentage, notes } = body;

    const book = await Book.findById(params.id);

    if (!book) {
      return NextResponse.json({ error: "Book not found" }, { status: 404 });
    }

    // Get the last progress entry to calculate pages read
    const lastProgress = await ProgressLog.findOne({ bookId: params.id })
      .sort({ progressDate: -1 })
      .limit(1);

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

    const progressLog = await ProgressLog.create({
      bookId: params.id,
      currentPage: finalCurrentPage,
      currentPercentage: finalCurrentPercentage,
      progressDate: new Date(),
      notes,
      pagesRead,
    });

    // Update streak
    await updateStreaks();

    // If book is completed, update status
    if (finalCurrentPercentage >= 100) {
      const status = await ReadingStatus.findOne({ bookId: params.id });
      if (status && status.status !== "read") {
        status.status = "read";
        status.completedDate = new Date();
        await status.save();
      } else if (!status) {
        await ReadingStatus.create({
          bookId: params.id,
          status: "read",
          completedDate: new Date(),
          startedDate: new Date(),
        });
      }
    }

    return NextResponse.json(progressLog);
  } catch (error) {
    console.error("Error logging progress:", error);
    return NextResponse.json(
      { error: "Failed to log progress" },
      { status: 500 }
    );
  }
}
