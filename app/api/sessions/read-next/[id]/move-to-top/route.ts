/**
 * POST /api/sessions/read-next/[id]/move-to-top
 * 
 * Moves a read-next session to the top of the queue (position 0)
 * All other sessions shift down by 1
 */

import { NextRequest, NextResponse } from "next/server";
import { sessionRepository } from "@/lib/repositories/session.repository";
import { handleApiError } from "@/lib/api/error-handler";
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
