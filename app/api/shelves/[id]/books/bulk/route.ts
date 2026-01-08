import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { shelfService } from "@/lib/services/shelf.service";
import { getLogger } from "@/lib/logger";

const logger = getLogger();

/**
 * POST /api/shelves/[id]/books/bulk
 * Add multiple books to a shelf (bulk operation)
 * Body: { bookIds: number[] }
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
    const { bookIds } = body;

    // Validate required fields
    if (!bookIds || !Array.isArray(bookIds)) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "bookIds is required and must be an array",
          },
        },
        { status: 400 }
      );
    }

    if (bookIds.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "bookIds array cannot be empty",
          },
        },
        { status: 400 }
      );
    }

    // Validate all bookIds are numbers
    if (!bookIds.every((id: any) => typeof id === "number")) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "All bookIds must be numbers",
          },
        },
        { status: 400 }
      );
    }

    const result = await shelfService.addBooksToShelf(shelfId, bookIds);

    // Revalidate relevant pages
    revalidatePath("/shelves");
    revalidatePath(`/shelves/${shelfId}`);
    revalidatePath("/library");
    // Revalidate each book's detail page
    for (const bookId of result.addedBookIds) {
      revalidatePath(`/books/${bookId}`);
    }

    return NextResponse.json(
      {
        success: true,
        data: {
          added: true,
          count: result.count,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    const errorId = crypto.randomUUID();
    logger.error({ error, errorId }, "Failed to bulk add books to shelf");

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
 * DELETE /api/shelves/[id]/books/bulk
 * Remove multiple books from a shelf (bulk operation)
 * Body: { bookIds: number[] }
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

    const body = await request.json();
    const { bookIds } = body;

    // Validate required fields
    if (!bookIds || !Array.isArray(bookIds)) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "bookIds is required and must be an array",
          },
        },
        { status: 400 }
      );
    }

    if (bookIds.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "bookIds array cannot be empty",
          },
        },
        { status: 400 }
      );
    }

    // Validate all bookIds are numbers
    if (!bookIds.every((id: any) => typeof id === "number")) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "All bookIds must be numbers",
          },
        },
        { status: 400 }
      );
    }

    const result = await shelfService.removeBooksFromShelf(shelfId, bookIds);

    // Revalidate relevant pages
    revalidatePath("/shelves");
    revalidatePath(`/shelves/${shelfId}`);
    revalidatePath("/library");
    // Revalidate each book's detail page
    for (const bookId of result.removedBookIds) {
      revalidatePath(`/books/${bookId}`);
    }

    return NextResponse.json(
      {
        success: true,
        data: {
          removed: true,
          count: result.count,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    const errorId = crypto.randomUUID();
    logger.error({ error, errorId }, "Failed to bulk remove books from shelf");

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
