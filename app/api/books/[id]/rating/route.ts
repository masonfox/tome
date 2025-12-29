import { NextRequest, NextResponse } from "next/server";
import { bookRepository } from "@/lib/repositories";
import { calibreService } from "@/lib/services/calibre.service";
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
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const bookId = parseInt(params.id);

    if (isNaN(bookId)) {
      return NextResponse.json({ error: "Invalid book ID format" }, { status: 400 });
    }

    const body = await request.json();
    const { rating, review } = body;

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

    // Update rating/review in database
    await bookRepository.update(bookId, updateData);

    // Sync rating to Calibre (best effort)
    if (rating !== undefined) {
      try {
        await calibreService.updateRating(book.calibreId, rating);
        logger.info({ bookId, calibreId: book.calibreId, rating }, 'Synced rating to Calibre');
      } catch (calibreError) {
        logger.error({ err: calibreError, bookId }, 'Failed to sync rating to Calibre');
        // Don't fail the request if Calibre sync fails
      }
    }

    // Invalidate cache
    revalidatePath("/");
    revalidatePath("/library");
    revalidatePath("/stats");
    revalidatePath(`/books/${bookId}`);

    logger.info({ bookId, rating, hasReview: !!review }, 'Updated book rating/review');

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error({ err: error }, "Error updating rating/review");
    return NextResponse.json({ error: "Failed to update rating/review" }, { status: 500 });
  }
}
