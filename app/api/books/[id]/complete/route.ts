import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { bookRepository, sessionRepository } from "@/lib/repositories";
import { sessionService, progressService } from "@/lib/services";
import { getLogger } from "@/lib/logger";

const logger = getLogger().child({ endpoint: "complete-book" });

export const dynamic = 'force-dynamic';

interface CompleteBookRequest {
  totalPages?: number;
  startDate: string;
  endDate: string;
  rating?: number;
  review?: string;
}

/**
 * Complete a book (mark as read from non-reading status)
 *
 * This endpoint handles the full "complete book" workflow for books transitioning
 * from "Want to Read" or "Read Next" to "Read" status. It consolidates all steps
 * into a single transaction:
 *
 * 1. Updates page count if needed
 * 2. Ensures active session exists (creates if needed)
 * 3. Sets session start date
 * 4. Creates progress entries (start → 100%)
 * 5. Updates rating (syncs to Calibre)
 * 6. Updates review
 *
 * The completion flow:
 * - If book has pages: Creates progress from 1 page (start date) to 100% (end date)
 * - If no pages: Directly marks session as read with dates
 * - Rating and review updates are best-effort (won't fail the operation)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const bookId = parseInt(params.id);

    if (isNaN(bookId)) {
      return NextResponse.json({ error: "Invalid book ID format" }, { status: 400 });
    }

    const body: CompleteBookRequest = await request.json();
    const { totalPages, startDate, endDate, rating, review } = body;

    logger.info({ bookId, body }, "Starting complete book workflow");

    // Validate dates
    if (!startDate || !endDate) {
      return NextResponse.json(
        { error: "Both start date and end date are required" },
        { status: 400 }
      );
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return NextResponse.json(
        { error: "Invalid date format" },
        { status: 400 }
      );
    }

    if (end < start) {
      return NextResponse.json(
        { error: "End date must be on or after start date" },
        { status: 400 }
      );
    }

    // Validate rating if provided
    if (rating !== undefined) {
      if (typeof rating !== 'number' || !Number.isInteger(rating)) {
        return NextResponse.json(
          { error: "Rating must be a whole number between 1 and 5" },
          { status: 400 }
        );
      }
      if (rating < 1 || rating > 5) {
        return NextResponse.json(
          { error: "Rating must be between 1 and 5" },
          { status: 400 }
        );
      }
    }

    // Validate totalPages if provided
    if (totalPages !== undefined) {
      if (typeof totalPages !== 'number' || !Number.isInteger(totalPages) || totalPages <= 0) {
        return NextResponse.json(
          { error: "Total pages must be a positive whole number" },
          { status: 400 }
        );
      }
    }

    // Step 1: Get or verify book exists
    const book = await bookRepository.findById(bookId);
    if (!book) {
      return NextResponse.json({ error: "Book not found" }, { status: 404 });
    }

    // Step 2: Update totalPages if provided
    let finalPageCount = book.totalPages;
    if (totalPages !== undefined && totalPages !== book.totalPages) {
      logger.info({ bookId, oldPages: book.totalPages, newPages: totalPages }, "Updating page count");
      await bookRepository.update(bookId, { totalPages });
      finalPageCount = totalPages;
    }

    // Step 3: Ensure book has active session or create one in "reading" status
    let session = await sessionRepository.findActiveByBookId(bookId);
    if (!session) {
      logger.info({ bookId }, "Creating new active session in reading status");
      const sessionNumber = await sessionRepository.getNextSessionNumber(bookId);
      session = await sessionRepository.create({
        bookId,
        status: "reading",  // Must be "reading" to allow progress logging
        isActive: true,
        sessionNumber,
        startedDate: start,
      });
    } else {
      // Update session to "reading" status and set start date
      logger.info({ bookId, sessionId: session.id }, "Updating session to reading status");
      const updated = await sessionRepository.update(session.id, {
        status: "reading",  // Must be "reading" to allow progress logging
        startedDate: start,
      } as any);
      if (updated) {
        session = updated;
      }
    }

    // Step 4: Create progress entries or directly mark as read
    if (finalPageCount) {
      logger.info({ bookId, sessionId: session.id, finalPageCount }, "Creating progress entries");

      // Create start progress (1 page at start date)
      await progressService.logProgress(bookId, {
        currentPage: 1,
        currentPercentage: Math.round((1 / finalPageCount) * 100),
        notes: "Started reading",
        progressDate: start,
      });

      // Create 100% progress entry (triggers auto-completion to "read")
      await progressService.logProgress(bookId, {
        currentPage: finalPageCount,
        currentPercentage: 100,
        notes: "Finished reading",
        progressDate: end,
      });
    } else {
      // No pages - directly update session to "read"
      logger.info({ bookId, sessionId: session.id }, "No pages - directly marking as read");
      await sessionRepository.update(session.id, {
        status: "read",
        completedDate: end,
        isActive: false,
      } as any);

      // Revalidate paths to refresh UI
      revalidatePath(`/books/${bookId}`);
      revalidatePath('/dashboard');
      revalidatePath('/library');
    }

    // Step 5: Update rating (best-effort)
    if (rating !== undefined && rating > 0) {
      try {
        logger.info({ bookId, rating }, "Updating rating");
        await sessionService.updateBookRating(bookId, rating);
      } catch (err) {
        logger.error({ err, bookId }, "Failed to update rating (non-fatal)");
      }
    }

    // Step 6: Update review (best-effort)
    // Find the completed session (it was just archived by the 100% progress)
    if (review) {
      try {
        logger.info({ bookId }, "Updating review");
        const completedSession = await sessionService.findMostRecentCompletedSession(bookId);
        if (completedSession) {
          await sessionService.updateSessionReview(completedSession.id, review);
        } else {
          logger.warn({ bookId }, "No completed session found for review attachment");
        }
      } catch (err) {
        logger.error({ err, bookId }, "Failed to update review (non-fatal)");
      }
    }

    logger.info({ bookId }, "Complete book workflow finished successfully");

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error({ err: error }, "Error completing book");

    // Handle specific errors
    if (error instanceof Error) {
      if (error.message.includes("not found")) {
        return NextResponse.json({ error: error.message }, { status: 404 });
      }
      if (error.message.includes("Cannot") || error.message.includes("required")) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
    }

    return NextResponse.json({ error: "Failed to complete book" }, { status: 500 });
  }
}
