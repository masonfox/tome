/**
 * POST /api/sessions/read-next/[id]/move-to-top
 * 
 * Moves a read-next session to the top of the queue (position 0)
 * All other sessions shift down by 1
 */

import { NextRequest, NextResponse } from "next/server";
import { sessionRepository } from "@/lib/repositories/session.repository";
import { getLogger } from "@/lib/logger";

const logger = getLogger();

export async function POST(
  request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const params = await props.params;
    const sessionId = parseInt(params.id);

    if (isNaN(sessionId)) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "INVALID_ID",
            message: "Session ID must be a valid number",
          },
        },
        { status: 400 }
      );
    }

    logger.debug({ sessionId }, "Moving read-next session to top");
    await sessionRepository.moveReadNextToTop(sessionId);
    logger.info({ sessionId }, "Session moved to top successfully");

    return NextResponse.json({ 
      success: true,
      data: { moved: true }
    });
  } catch (error) {
    const errorId = crypto.randomUUID();
    logger.error({ error, errorId }, "Failed to move session to top");

    if (error instanceof Error) {
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

      if (error.message.includes("not in read-next status")) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: "INVALID_STATUS",
              message: error.message,
            },
          },
          { status: 400 }
        );
      }
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
