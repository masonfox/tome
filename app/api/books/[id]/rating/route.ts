import { NextRequest, NextResponse } from "next/server";
import { bookRepository } from "@/lib/repositories";
import { updateCalibreRating } from "@/lib/db/calibre-write";

/**
 * POST /api/books/:id/rating
 * Update book rating in both Tome DB and Calibre DB
 * 
 * Request Body:
 * {
 *   "rating": number | null  // 1-5 stars or null to remove
 * }
 * 
 * Responses:
 * - 200: Rating updated successfully (returns updated book)
 * - 400: Invalid rating value
 * - 404: Book not found
 * - 500: Update failed
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const bookId = parseInt(params.id);
    
    if (isNaN(bookId)) {
      return NextResponse.json(
        { error: "Invalid book ID format" },
        { status: 400 }
      );
    }
    
    const body = await request.json();
    const { rating } = body;
    
    // Validate rating (1-5 stars or null)
    if (rating !== null && rating !== undefined) {
      if (typeof rating !== 'number' || rating < 1 || rating > 5) {
        return NextResponse.json(
          { error: "Rating must be a number between 1 and 5, or null" },
          { status: 400 }
        );
      }
    }
    
    // Get book
    const book = await bookRepository.findById(bookId);
    if (!book) {
      return NextResponse.json(
        { error: "Book not found" },
        { status: 404 }
      );
    }
    
    // Update Calibre database first (fail fast if Calibre update fails)
    try {
      updateCalibreRating(book.calibreId, rating ?? null);
    } catch (calibreError) {
      console.error("[Rating API] Failed to update Calibre:", calibreError);
      return NextResponse.json(
        { 
          error: "Failed to update rating in Calibre database",
          details: calibreError instanceof Error ? calibreError.message : String(calibreError)
        },
        { status: 500 }
      );
    }
    
    // Update local database
    const updatedBook = await bookRepository.update(bookId, { 
      rating: rating ?? null 
    });
    
    if (!updatedBook) {
      // This shouldn't happen, but handle it anyway
      return NextResponse.json(
        { error: "Failed to update rating in local database" },
        { status: 500 }
      );
    }
    
    console.log(`[Rating API] Updated rating for book ${bookId} (${book.title}): ${rating ?? 'removed'}`);
    
    return NextResponse.json(updatedBook);
  } catch (error) {
    console.error("[Rating API] Unexpected error:", error);
    return NextResponse.json(
      { 
        error: "Failed to update rating",
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}
