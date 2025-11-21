import { NextRequest, NextResponse } from "next/server";
import { BookService } from "@/lib/services/book.service";

const bookService = new BookService();

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
    
    // Validate rating type and value
    if (rating !== null && rating !== undefined) {
      // Check if rating is a number
      if (typeof rating !== 'number') {
        return NextResponse.json(
          { error: "Rating must be a number between 1 and 5" },
          { status: 400 }
        );
      }
      
      // Check if rating is an integer
      if (!Number.isInteger(rating)) {
        return NextResponse.json(
          { error: "Rating must be a whole number between 1 and 5" },
          { status: 400 }
        );
      }
      
      // Check range (will be checked again in service, but fail fast here)
      if (rating < 1 || rating > 5) {
        return NextResponse.json(
          { error: "Rating must be between 1 and 5" },
          { status: 400 }
        );
      }
    }
    
    const updatedBook = await bookService.updateRating(bookId, rating ?? null);
    
    return NextResponse.json(updatedBook);
  } catch (error) {
    console.error("[Rating API] Error:", error);
    
    // Handle specific errors
    if (error instanceof Error) {
      if (error.message.includes("not found")) {
        return NextResponse.json({ error: error.message }, { status: 404 });
      }
      if (error.message.includes("must be")) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
    }
    
    return NextResponse.json(
      { 
        error: "Failed to update rating",
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}
