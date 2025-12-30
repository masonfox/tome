import { NextRequest, NextResponse } from "next/server";
import { sessionService } from "@/lib/services";

export const dynamic = 'force-dynamic';

/**
 * Mark a book as read with optional rating and review
 *
 * This endpoint orchestrates the full "mark as read" workflow:
 * - Ensures book is in reading status
 * - Creates 100% progress entry if needed
 * - Updates rating (syncs to Calibre)
 * - Updates review
 * - Handles books without totalPages
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

    const body = await request.json();
    const { rating, review, completedDate } = body;

    // Validate rating if provided
    if (rating !== undefined && rating !== null) {
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

    const result = await sessionService.markAsRead({
      bookId,
      rating,
      review,
      completedDate: completedDate ? new Date(completedDate) : undefined,
    });

    // Note: Cache invalidation handled by SessionService.invalidateCache()

    return NextResponse.json(result);
  } catch (error) {
    const { getLogger } = require("@/lib/logger");
    getLogger().error({ err: error }, "Error marking book as read");

    // Handle specific errors
    if (error instanceof Error) {
      if (error.message.includes("not found")) {
        return NextResponse.json({ error: error.message }, { status: 404 });
      }
      if (error.message.includes("Cannot") || error.message.includes("required")) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
    }

    return NextResponse.json({ error: "Failed to mark book as read" }, { status: 500 });
  }
}
