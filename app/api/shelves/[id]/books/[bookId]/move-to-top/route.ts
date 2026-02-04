/**
 * POST /api/shelves/[id]/books/[bookId]/move-to-top
 * 
 * Moves a book to the top of a shelf (position 0)
 * All other books shift down by 1
 */

import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { shelfService } from "@/lib/services/shelf.service";
import { bookRepository } from "@/lib/repositories/book.repository";
import { handleApiError } from "@/lib/api/error-handler";
import { getLogger } from "@/lib/logger";

const logger = getLogger();

export async function POST(
  request: NextRequest,
  props: { params: Promise<{ id: string; bookId: string }> }
) {
  try {
    const params = await props.params;
    const shelfId = parseInt(params.id);
    const bookId = parseInt(params.bookId);

    if (isNaN(shelfId)) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "INVALID_ID",
            message: "Shelf ID must be a valid number",
          },
        },
        { status: 400 }
      );
    }

    if (isNaN(bookId)) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "INVALID_ID",
            message: "Book ID must be a valid number",
          },
        },
        { status: 400 }
      );
    }

    // Validate book exists
    const book = await bookRepository.findById(bookId);
    if (!book) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "NOT_FOUND",
            message: `Book with ID ${bookId} not found`,
          },
        },
        { status: 404 }
      );
    }

    logger.debug({ shelfId, bookId }, "Moving book to top of shelf");
    await shelfService.moveBookToTop(shelfId, bookId);
    logger.info({ shelfId, bookId }, "Book moved to top successfully");

    // Revalidate relevant pages
    revalidatePath(`/shelves/${shelfId}`);
    revalidatePath("/shelves");

    return NextResponse.json({
      success: true,
      data: { moved: true },
    });
  } catch (error) {
    const errorId = crypto.randomUUID();
    logger.error({ error, errorId }, "Failed to move book to top");

    const { code, message, status, errorId: includeErrorId } = handleApiError(error, errorId);

    return NextResponse.json(
      {
        success: false,
        error: {
          code,
          message,
          ...(includeErrorId && { errorId: includeErrorId }),
        },
      },
      { status }
    );
  }
}
