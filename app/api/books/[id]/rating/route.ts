import { NextRequest, NextResponse } from "next/server";
import { bookRepository } from "@/lib/repositories";
import { sessionService } from "@/lib/services";
import { revalidatePath } from "next/cache";
import { getLogger } from "@/lib/logger";

const logger = getLogger().child({ api: "rating" });

export const dynamic = 'force-dynamic';

/**
 * Update book rating and/or review
 * 
 * This endpoint is separate from the status endpoint to allow updating
 * rating/review independently of the book's reading status.
 */
export async function PATCH(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const bookId = parseInt(params.id);

    if (isNaN(bookId)) {
      return NextResponse.json({ error: "Invalid book ID format" }, { status: 400 });
    }

    const body = await request.json();
    const { rating, review } = body;

    // Validate rating if provided
    if (rating !== undefined && rating !== null) {
      // Type validation - must be a number
      if (typeof rating !== 'number') {
        return NextResponse.json(
          { error: "Rating must be a number between 1 and 5" },
          { status: 400 }
        );
      }

      // Whole number validation
      if (!Number.isInteger(rating)) {
        return NextResponse.json(
          { error: "Rating must be a whole number" },
          { status: 400 }
        );
      }

      // Range validation (1-5)
      if (rating < 1 || rating > 5) {
        return NextResponse.json(
          { error: "Rating must be between 1 and 5" },
          { status: 400 }
        );
      }
    }

    // Verify book exists
    const book = await bookRepository.findById(bookId);
    if (!book) {
      return NextResponse.json({ error: "Book not found" }, { status: 404 });
    }

    // Build update data
    const updateData: any = {};
    if (rating !== undefined) {
      updateData.rating = rating ?? null;
    }
    if (review !== undefined) {
      updateData.review = review;
    }

    // If nothing to update, return the book as-is
    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(book);
    }

    // Update rating using SessionService (handles Calibre sync)
    if (rating !== undefined) {
      await sessionService.updateBookRating(bookId, rating);
      logger.info({ bookId, rating }, 'Updated rating via SessionService');
    }

    // Update review in database if provided
    if (review !== undefined) {
      // Get active session for the book
      const activeSession = await sessionService.getActiveSession(bookId);
      if (!activeSession) {
        return NextResponse.json(
          { error: "No active reading session found for this book" },
          { status: 400 }
        );
      }
      
      await sessionService.updateSessionReview(activeSession.id, review);
      logger.info({ bookId, sessionId: activeSession.id, hasReview: !!review }, 'Updated review');
    }

    // Invalidate cache
    revalidatePath("/");
    revalidatePath("/library");
    revalidatePath("/stats");
    revalidatePath(`/books/${bookId}`);

    // Return the updated book
    const updatedBook = await bookRepository.findById(bookId);
    return NextResponse.json(updatedBook);
  } catch (error) {
    logger.error({ err: error }, "Error updating rating/review");
    return NextResponse.json({ error: "Failed to update rating/review" }, { status: 500 });
  }
}
