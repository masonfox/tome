/**
 * POST /api/books/validate
 * 
 * Real-time validation endpoint for local book input.
 * Returns validation errors without creating the book.
 */

import { getLogger } from "@/lib/logger";
import { NextRequest, NextResponse } from "next/server";
import { validateLocalBookInputSafe } from "@/lib/validation/local-book.schema";
import { bookService } from "@/lib/services/book.service";

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate input
    const validation = validateLocalBookInputSafe(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          valid: false,
          errors: validation.errors.issues,
        },
        { status: 200 } // 200 OK with validation errors
      );
    }

    // Check for duplicates
    const duplicates = await bookService.checkForDuplicates(
      validation.data.title,
      validation.data.authors
    );

    return NextResponse.json({
      valid: true,
      duplicates: duplicates,
    });
  } catch (error) {
    getLogger().error({ err: error }, "Error validating local book input");
    return NextResponse.json(
      { error: "Failed to validate input" },
      { status: 500 }
    );
  }
}
