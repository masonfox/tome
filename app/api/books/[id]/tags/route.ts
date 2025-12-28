import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { bookService } from "@/lib/services/book.service";

export const dynamic = 'force-dynamic';

/**
 * PATCH /api/books/:id/tags
 * Update book tags in both Tome DB and Calibre DB
 * 
 * Request Body:
 * {
 *   "tags": string[]  // Array of tag names
 * }
 * 
 * Responses:
 * - 200: Tags updated successfully (returns updated book)
 * - 400: Invalid tags value or format
 * - 404: Book not found
 * - 500: Update failed
 */
export async function PATCH(
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
    const { tags } = body;
    
    // Validate tags
    if (!Array.isArray(tags)) {
      return NextResponse.json(
        { error: "Tags must be an array" },
        { status: 400 }
      );
    }
    
    // Validate each tag is a string
    for (const tag of tags) {
      if (typeof tag !== 'string') {
        return NextResponse.json(
          { error: "Each tag must be a string" },
          { status: 400 }
        );
      }
    }
    
    const updatedBook = await bookService.updateTags(bookId, tags);
    
    // Revalidate relevant pages (safe in test environments)
    try {
      revalidatePath('/'); // Dashboard
      revalidatePath('/library'); // Library
      revalidatePath(`/books/${bookId}`); // Book detail page
    } catch (error) {
      // Ignore revalidation errors in test environments
      // where Next.js static generation store is not available
    }
    
    return NextResponse.json(updatedBook);
   } catch (error) {
    const { getLogger } = require("@/lib/logger");
    getLogger().error({ err: error }, "[Tags API] Error");
    
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
        error: "Failed to update tags",
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}
