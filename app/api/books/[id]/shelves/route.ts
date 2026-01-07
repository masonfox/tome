import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { shelfRepository } from "@/lib/repositories/shelf.repository";
import type { Shelf } from "@/lib/db/schema/shelves";
import { getLogger } from "@/lib/logger";

const logger = getLogger();

/**
 * GET /api/books/[id]/shelves
 * Get all shelves that contain this book
 */
export async function GET(
  _request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const params = await props.params;
    const bookId = parseInt(params.id);
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

    const shelves = await shelfRepository.findShelvesByBookId(bookId);
    return NextResponse.json({ success: true, data: shelves });
  } catch (error) {
    const errorId = crypto.randomUUID();
    logger.error({ error, errorId }, "Failed to get book shelves");
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: "Failed to get book shelves",
          errorId,
        },
      },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/books/[id]/shelves
 * Update which shelves contain this book
 * Body: { shelfIds: number[] }
 */
export async function PUT(
  request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const params = await props.params;
    const bookId = parseInt(params.id);
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

    const body = await request.json();
    const { shelfIds } = body;

    if (!Array.isArray(shelfIds)) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "INVALID_BODY",
            message: "shelfIds must be an array",
          },
        },
        { status: 400 }
      );
    }

    // Validate all shelf IDs are numbers
    if (!shelfIds.every((id) => typeof id === "number" && !isNaN(id))) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "INVALID_BODY",
            message: "All shelf IDs must be valid numbers",
          },
        },
        { status: 400 }
      );
    }

    // Get current shelves for this book
    const currentShelves = await shelfRepository.findShelvesByBookId(bookId);
    const currentShelfIds = currentShelves.map((s: Shelf) => s.id);

    // Determine which shelves to add and remove
    const shelfIdsToAdd = shelfIds.filter((id: number) => !currentShelfIds.includes(id));
    const shelfIdsToRemove = currentShelfIds.filter((id: number) => !shelfIds.includes(id));

    // Add book to new shelves
    for (const shelfId of shelfIdsToAdd) {
      await shelfRepository.addBookToShelf(shelfId, bookId);
    }

    // Remove book from old shelves and reindex each shelf
    for (const shelfId of shelfIdsToRemove) {
      await shelfRepository.removeBookFromShelf(shelfId, bookId);
      // Reindex remaining books to eliminate gaps in sortOrder
      await shelfRepository.reindexShelfBooks(shelfId);
    }

    // Revalidate relevant paths
    revalidatePath(`/books/${bookId}`);
    revalidatePath("/shelves");
    shelfIds.forEach((shelfId) => {
      revalidatePath(`/shelves/${shelfId}`);
    });

    return NextResponse.json({
      success: true,
      data: {
        added: shelfIdsToAdd.length,
        removed: shelfIdsToRemove.length,
      },
    });
  } catch (error) {
    const errorId = crypto.randomUUID();
    logger.error({ error, errorId }, "Failed to update book shelves");
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: "Failed to update book shelves",
          errorId,
        },
      },
      { status: 500 }
    );
  }
}
