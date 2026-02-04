import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { shelfService } from "@/lib/services/shelf.service";
import { getLogger } from "@/lib/logger";
import type { ShelfOrderBy, ShelfSortDirection } from "@/lib/repositories/shelf.repository";

const logger = getLogger();

/**
 * GET /api/shelves/[id]
 * Get a specific shelf, optionally with its books
 * Query params:
 *  - withBooks: (optional) Include books in response
 *  - orderBy: (optional) Book ordering: sortOrder | title | author | series | rating | pages | dateAdded
 *  - direction: (optional) Sort direction: asc | desc (default: asc)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const shelfId = parseInt(id);
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
    const withBooks = searchParams.get("withBooks") === "true";
    const orderBy = (searchParams.get("orderBy") || "sortOrder") as ShelfOrderBy;
    const direction = (searchParams.get("direction") || "asc") as ShelfSortDirection;

    if (withBooks) {
      const shelf = await shelfService.getShelfWithBooks(shelfId, orderBy, direction);
      if (!shelf) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: "NOT_FOUND",
              message: `Shelf with ID ${shelfId} not found`,
            },
          },
          { status: 404 }
        );
      }
      return NextResponse.json({ success: true, data: shelf });
    } else {
      const shelf = await shelfService.getShelf(shelfId);
      if (!shelf) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: "NOT_FOUND",
              message: `Shelf with ID ${shelfId} not found`,
            },
          },
          { status: 404 }
        );
      }
      return NextResponse.json({ success: true, data: shelf });
    }
  } catch (error) {
    const errorId = crypto.randomUUID();
    logger.error({ error, errorId }, "Failed to get shelf");
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
 * PATCH /api/shelves/[id]
 * Update a shelf
 * Body: { name?: string, description?: string, color?: string, icon?: string }
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const shelfId = parseInt(id);
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
    const { name, description, color, icon } = body;

    const updates: any = {};
    if (name !== undefined) updates.name = name;
    if (description !== undefined) updates.description = description;
    if (color !== undefined) updates.color = color;
    if (icon !== undefined) updates.icon = icon;

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "No valid fields provided for update",
          },
        },
        { status: 400 }
      );
    }

    const shelf = await shelfService.updateShelf(shelfId, updates);

    // Revalidate relevant pages
    revalidatePath("/shelves");
    revalidatePath(`/shelves/${shelfId}`);
    revalidatePath("/library");

    return NextResponse.json({ success: true, data: shelf });
  } catch (error) {
    const errorId = crypto.randomUUID();
    logger.error({ error, errorId }, "Failed to update shelf");

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

    if (error instanceof Error && error.message.includes("already exists")) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "DUPLICATE_NAME",
            message: error.message,
          },
        },
        { status: 409 }
      );
    }

    if (
      error instanceof Error &&
      (error.message.includes("required") || error.message.includes("cannot be empty"))
    ) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: error.message,
          },
        },
        { status: 400 }
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
 * DELETE /api/shelves/[id]
 * Delete a shelf
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const shelfId = parseInt(id);
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

    const deleted = await shelfService.deleteShelf(shelfId);

    if (!deleted) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "NOT_FOUND",
            message: `Shelf with ID ${shelfId} not found`,
          },
        },
        { status: 404 }
      );
    }

    // Revalidate relevant pages
    revalidatePath("/shelves");
    revalidatePath("/library");

    return NextResponse.json({ success: true, data: { deleted: true } });
  } catch (error) {
    const errorId = crypto.randomUUID();
    logger.error({ error, errorId }, "Failed to delete shelf");

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
