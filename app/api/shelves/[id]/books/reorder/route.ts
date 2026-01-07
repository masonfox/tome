import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { shelfService } from "@/lib/services/shelf.service";
import { getLogger } from "@/lib/logger";

const logger = getLogger();

/**
 * PUT /api/shelves/[id]/books/reorder
 * Batch reorder books on a shelf
 * Body: { bookIds: number[] }
 */
export async function PUT(
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
    if (!Array.isArray(bookIds)) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "Book IDs must be an array",
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
            message: "Book IDs array cannot be empty",
          },
        },
        { status: 400 }
      );
    }

    // Validate all IDs are numbers
    if (!bookIds.every((id) => typeof id === "number")) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "All book IDs must be numbers",
          },
        },
        { status: 400 }
      );
    }

    await shelfService.reorderBooksInShelf(shelfId, bookIds);

    // Revalidate relevant pages
    revalidatePath(`/shelves/${shelfId}`);
    revalidatePath("/shelves");

    return NextResponse.json({ success: true, data: { reordered: true } });
  } catch (error) {
    const errorId = crypto.randomUUID();
    logger.error({ error, errorId }, "Failed to reorder books on shelf");

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
