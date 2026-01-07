import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { shelfService } from "@/lib/services/shelf.service";
import { getLogger } from "@/lib/logger";

const logger = getLogger();

/**
 * POST /api/shelves/[id]/books
 * Add a book to a shelf
 * Body: { bookId: number, sortOrder?: number }
 */
export async function POST(
  request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const params = await props.params;
    const shelfId = parseInt(params.id);
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

    const body = await request.json();
    const { bookId, sortOrder } = body;

    // Validate required fields
    if (!bookId || typeof bookId !== "number") {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "Book ID is required and must be a number",
          },
        },
        { status: 400 }
      );
    }

    await shelfService.addBookToShelf(
      shelfId,
      bookId,
      sortOrder !== undefined ? sortOrder : undefined
    );

    // Revalidate relevant pages
    revalidatePath("/shelves");
    revalidatePath(`/shelves/${shelfId}`);
    revalidatePath("/library");
    revalidatePath(`/books/${bookId}`);

    return NextResponse.json(
      { success: true, data: { added: true } },
      { status: 201 }
    );
  } catch (error) {
    const errorId = crypto.randomUUID();
    logger.error({ error, errorId }, "Failed to add book to shelf");

    // Check for validation errors
    if (error instanceof Error && error.message.includes("not found")) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "NOT_FOUND",
            message: error.message,
          },
        },
        { status: 404 }
      );
    }

    if (
      error instanceof Error &&
      error.message.includes("already on this shelf")
    ) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "DUPLICATE_ENTRY",
            message: error.message,
          },
        },
        { status: 409 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message:
            process.env.NODE_ENV === "development"
              ? (error as Error).message
              : "An unexpected error occurred",
          errorId,
        },
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/shelves/[id]/books
 * Remove a book from a shelf
 * Query params:
 *  - bookId: number (required)
 */
export async function DELETE(
  request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const params = await props.params;
    const shelfId = parseInt(params.id);
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

    const searchParams = request.nextUrl.searchParams;
    const bookIdParam = searchParams.get("bookId");

    if (!bookIdParam) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "Book ID is required",
          },
        },
        { status: 400 }
      );
    }

    const bookId = parseInt(bookIdParam);
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

    const removed = await shelfService.removeBookFromShelf(shelfId, bookId);

    if (!removed) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "NOT_FOUND",
            message: "Book not found on shelf",
          },
        },
        { status: 404 }
      );
    }

    // Revalidate relevant pages
    revalidatePath("/shelves");
    revalidatePath(`/shelves/${shelfId}`);
    revalidatePath("/library");
    revalidatePath(`/books/${bookId}`);

    return NextResponse.json({ success: true, data: { removed: true } });
  } catch (error) {
    const errorId = crypto.randomUUID();
    logger.error({ error, errorId }, "Failed to remove book from shelf");

    return NextResponse.json(
      {
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message:
            process.env.NODE_ENV === "development"
              ? (error as Error).message
              : "An unexpected error occurred",
          errorId,
        },
      },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/shelves/[id]/books
 * Update book order on shelf
 * Body: { bookId: number, sortOrder: number }
 */
export async function PATCH(
  request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const params = await props.params;
    const shelfId = parseInt(params.id);
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

    const body = await request.json();
    const { bookId, sortOrder } = body;

    // Validate required fields
    if (!bookId || typeof bookId !== "number") {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "Book ID is required and must be a number",
          },
        },
        { status: 400 }
      );
    }

    if (sortOrder === undefined || typeof sortOrder !== "number") {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "Sort order is required and must be a number",
          },
        },
        { status: 400 }
      );
    }

    await shelfService.updateBookOrder(shelfId, bookId, sortOrder);

    // Revalidate relevant pages
    revalidatePath(`/shelves/${shelfId}`);

    return NextResponse.json({ success: true, data: { updated: true } });
  } catch (error) {
    const errorId = crypto.randomUUID();
    logger.error({ error, errorId }, "Failed to update book order on shelf");

    if (error instanceof Error && error.message.includes("not found")) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "NOT_FOUND",
            message: error.message,
          },
        },
        { status: 404 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message:
            process.env.NODE_ENV === "development"
              ? (error as Error).message
              : "An unexpected error occurred",
          errorId,
        },
      },
      { status: 500 }
    );
  }
}
