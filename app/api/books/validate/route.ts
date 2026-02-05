/**
 * POST /api/books/validate
 * 
 * Real-time validation endpoint for manual book input.
 * Returns validation errors without creating the book.
 */

import { getLogger } from "@/lib/logger";
import { NextRequest, NextResponse } from "next/server";
import { validateManualBookInputSafe } from "@/lib/validation/manual-book.schema";
import { bookService } from "@/lib/services/book.service";

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate input
    const validation = validateManualBookInputSafe(body);

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
    getLogger().error({ err: error }, "Error validating manual book input");
    return NextResponse.json(
      { error: "Failed to validate input" },
      { status: 500 }
    );
  }
}
