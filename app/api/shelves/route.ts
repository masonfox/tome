import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { shelfService } from "@/lib/services/shelf.service";
import { getLogger } from "@/lib/logger";

const logger = getLogger();

/**
 * GET /api/shelves
 * Get all shelves, optionally with book counts
 * Query params:
 *  - withCounts: (optional) Include book counts in response
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const withCounts = searchParams.get("withCounts") === "true";

    if (withCounts) {
      const shelves = await shelfService.getAllShelvesWithBookCount(null);
      return NextResponse.json({ success: true, data: shelves });
    } else {
      const shelves = await shelfService.getAllShelves(null);
      return NextResponse.json({ success: true, data: shelves });
    }
  } catch (error) {
    const errorId = crypto.randomUUID();
    logger.error({ error, errorId }, "Failed to get shelves");
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
 * POST /api/shelves
 * Create a new shelf
 * Body: { name: string, description?: string, color?: string, icon?: string }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, description, color, icon } = body;

    // Validate required fields
    if (!name || typeof name !== "string") {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "Shelf name is required and must be a string",
          },
        },
        { status: 400 }
      );
    }

    const shelf = await shelfService.createShelf(name, {
      description,
      color,
      icon,
      userId: null, // Single-user mode
    });

    // Revalidate relevant pages
    revalidatePath("/shelves");
    revalidatePath("/library");

    return NextResponse.json(
      { success: true, data: shelf },
      { status: 201 }
    );
  } catch (error) {
    const errorId = crypto.randomUUID();
    logger.error({ error, errorId }, "Failed to create shelf");

    // Check for validation errors
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

    if (error instanceof Error && error.message.includes("required")) {
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
