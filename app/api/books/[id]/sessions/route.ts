import { NextRequest, NextResponse } from "next/server";
import { bookRepository, sessionRepository, progressRepository } from "@/lib/repositories";

export const dynamic = 'force-dynamic';

export async function GET(
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

    // Get all reading sessions for this book, sorted by session number (newest first)
    const sessions = await sessionRepository.findAllByBookId(bookId);

    // For each session, get progress summary
    const sessionsWithProgress = await Promise.all(
      sessions.map(async (session) => {
        // Get progress logs for this session
        const progressLogs = await progressRepository.findBySessionId(session.id);

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
