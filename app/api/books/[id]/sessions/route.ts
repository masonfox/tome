import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db/mongodb";
import mongoose from "mongoose";
import ReadingSession from "@/models/ReadingSession";
import ProgressLog from "@/models/ProgressLog";
import Book from "@/models/Book";

export async function GET(
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

    // Get all reading sessions for this book, sorted by session number (newest first)
    const sessions = await ReadingSession.find({ bookId: params.id })
      .sort({ sessionNumber: -1 })
      .lean();

    // For each session, get progress summary
    const sessionsWithProgress = await Promise.all(
      sessions.map(async (session) => {
        // Get progress logs for this session
        const progressLogs = await ProgressLog.find({ sessionId: session._id })
          .sort({ progressDate: -1 })
          .lean();

        // Get latest progress
        const latestProgress = progressLogs[0] || null;

        // Calculate summary stats
        const totalProgressEntries = progressLogs.length;
        const totalPagesRead = progressLogs.reduce(
          (sum, log) => sum + (log.pagesRead || 0),
          0
        );

        return {
          ...session,
          progressSummary: {
            totalEntries: totalProgressEntries,
            totalPagesRead,
            latestProgress: latestProgress
              ? {
                  currentPage: latestProgress.currentPage,
                  currentPercentage: latestProgress.currentPercentage,
                  progressDate: latestProgress.progressDate,
                  notes: latestProgress.notes,
                }
              : null,
            firstProgressDate: progressLogs.length > 0
              ? progressLogs[progressLogs.length - 1].progressDate
              : null,
            lastProgressDate: progressLogs.length > 0
              ? progressLogs[0].progressDate
              : null,
          },
        };
      })
    );

    return NextResponse.json(sessionsWithProgress);
  } catch (error) {
    console.error("Error fetching reading sessions:", error);
    return NextResponse.json(
      { error: "Failed to fetch reading sessions" },
      { status: 500 }
    );
  }
}
