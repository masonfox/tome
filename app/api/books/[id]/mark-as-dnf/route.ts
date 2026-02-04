import { getLogger } from "@/lib/logger";
import { NextRequest, NextResponse } from "next/server";
import { sessionService } from "@/lib/services";
import { validateDateString } from "@/lib/utils/date-validation";

export const dynamic = 'force-dynamic';

/**
 * Mark a book as DNF (Did Not Finish) with optional rating and review
 *
 * This endpoint orchestrates the full "mark as DNF" workflow:
 * - Validates active reading session exists
 * - Archives the session with dnfDate
 * - Updates rating (syncs to Calibre) - optional
 * - Updates review - optional
 * - Returns last progress log for UI prefilling
 */
export async function POST(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const bookId = parseInt(params.id);

    if (isNaN(bookId)) {
      return NextResponse.json({ error: "Invalid book ID format" }, { status: 400 });
    }

    const body = await request.json();
    const { rating, review, dnfDate } = body;

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

    // Validate dnfDate format if provided
    if (dnfDate) {
      if (!validateDateString(dnfDate)) {
        return NextResponse.json(
          { error: "Invalid DNF date format. Expected valid YYYY-MM-DD" },
          { status: 400 }
        );
      }
    }

    const result = await sessionService.markAsDNF({
      bookId,
      rating,
      review,
      dnfDate,
    });

    // Note: Cache invalidation handled by SessionService.invalidateCache()

    return NextResponse.json(result);
  } catch (error) {
    getLogger().error({ err: error }, "Error marking book as DNF");

    // Handle specific errors
    if (error instanceof Error) {
      if (error.message.includes("not found")) {
        return NextResponse.json({ error: error.message }, { status: 404 });
      }
      if (error.message.includes("Cannot") || error.message.includes("No active")) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
    }

    return NextResponse.json({ error: "Failed to mark book as DNF" }, { status: 500 });
  }
}
