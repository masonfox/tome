import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { readingGoalsService } from "@/lib/services";
import { getLogger } from "@/lib/logger";

const logger = getLogger();

type RouteParams = {
  params: Promise<{ id: string }>;
};

/**
 * PATCH /api/reading-goals/[id]
 * Update an existing reading goal
 * Body: { booksGoal: number }
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const goalId = parseInt(id);

    if (isNaN(goalId)) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "INVALID_ID",
            message: "Goal ID must be a valid number",
          },
        },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { booksGoal } = body;

    if (booksGoal === undefined) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "MISSING_FIELD",
            message: "booksGoal is required",
          },
        },
        { status: 400 }
      );
    }

    if (typeof booksGoal !== "number") {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "INVALID_TYPE",
            message: "booksGoal must be a number",
          },
        },
        { status: 400 }
      );
    }

    try {
      const updated = await readingGoalsService.updateGoal(goalId, booksGoal);
      
      // Revalidate pages that display goal data
      revalidatePath('/goals');
      revalidatePath('/');
      
      return NextResponse.json({ success: true, data: updated });
    } catch (error: any) {
      if (error.message.includes("not found")) {
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

      if (error.message.includes("past years")) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: "PAST_YEAR_READONLY",
              message: error.message,
            },
          },
          { status: 400 }
        );
      }

      if (error.message.includes("must be")) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: "INVALID_INPUT",
              message: error.message,
            },
          },
          { status: 400 }
        );
      }

      throw error;
    }
  } catch (error) {
    logger.error({ error }, "Failed to update reading goal");
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: "An unexpected error occurred",
        },
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/reading-goals/[id]
 * Delete a reading goal
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const goalId = parseInt(id);

    if (isNaN(goalId)) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "INVALID_ID",
            message: "Goal ID must be a valid number",
          },
        },
        { status: 400 }
      );
    }

    try {
      await readingGoalsService.deleteGoal(goalId);
      
      // Revalidate pages that display goal data
      revalidatePath('/goals');
      revalidatePath('/');
      
      return NextResponse.json({ success: true });
    } catch (error: any) {
      if (error.message.includes("not found")) {
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

      if (error.message.includes("past years")) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: "PAST_YEAR_READONLY",
              message: error.message,
            },
          },
          { status: 400 }
        );
      }

      throw error;
    }
  } catch (error) {
    logger.error({ error }, "Failed to delete reading goal");
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: "An unexpected error occurred",
        },
      },
      { status: 500 }
    );
  }
}
