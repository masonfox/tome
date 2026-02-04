import { getLogger } from "@/lib/logger";
import { NextRequest, NextResponse } from "next/server";
import { sessionRepository } from "@/lib/repositories";
import { sessionService } from "@/lib/services/session.service";
import { validateDateString } from "@/lib/utils/date-validation";

export const dynamic = 'force-dynamic';

/**
 * PATCH /api/books/:id/sessions/:sessionId
 * Update reading session (dates and/or review)
 * 
 * Request Body:
 * {
 *   "startedDate": string | null   // YYYY-MM-DD string or null
 *   "completedDate": string | null // YYYY-MM-DD string or null
 *   "review": string | null        // Review text or null to remove
 * }
 * 
 * Responses:
 * - 200: Session updated successfully (returns updated session)
 * - 400: Invalid request (invalid IDs, invalid dates)
 * - 404: Session not found or doesn't belong to specified book
 * - 500: Update failed
 */
export async function PATCH(
  request: NextRequest,
  props: { params: Promise<{ id: string; sessionId: string }> }
) {
  const params = await props.params;
  try {
    const bookId = parseInt(params.id);
    const sessionId = parseInt(params.sessionId);
    
    if (isNaN(bookId) || isNaN(sessionId)) {
      return NextResponse.json(
        { error: "Invalid book ID or session ID format" },
        { status: 400 }
      );
    }
    
    const body = await request.json();
    const { startedDate, completedDate, review } = body;
    
    // Get session
    const session = await sessionRepository.findById(sessionId);
    if (!session) {
      return NextResponse.json(
        { error: "Session not found" },
        { status: 404 }
      );
    }
    
    // Verify session belongs to specified book
    if (session.bookId !== bookId) {
      return NextResponse.json(
        { error: "Session does not belong to specified book" },
        { status: 404 }
      );
    }
    
    // Build update object with only provided fields
    const updateData: any = {};
    
    // Handle dates - strict YYYY-MM-DD validation (no ISO string normalization)
    if ('startedDate' in body) {
      if (startedDate) {
        if (!validateDateString(startedDate)) {
          return NextResponse.json(
            { error: "Invalid started date format. Expected valid YYYY-MM-DD" },
            { status: 400 }
          );
        }
        updateData.startedDate = startedDate;
      } else {
        updateData.startedDate = null;
      }
    }
    if ('completedDate' in body) {
      if (completedDate) {
        if (!validateDateString(completedDate)) {
          return NextResponse.json(
            { error: "Invalid completed date format. Expected valid YYYY-MM-DD" },
            { status: 400 }
          );
        }
        updateData.completedDate = completedDate;
      } else {
        updateData.completedDate = null;
      }
    }
    
    // Handle review
    if ('review' in body) {
      updateData.review = review && typeof review === 'string' && review.trim() 
        ? review.trim() 
        : null;
    }
    
    // Check if there are any updates to make
    if (Object.keys(updateData).length === 0) {
      // No updates provided, return current session
      return NextResponse.json(session);
    }
    
    // Update session
    const updatedSession = await sessionRepository.update(sessionId, updateData);
    
    if (!updatedSession) {
      return NextResponse.json(
        { error: "Failed to update session" },
        { status: 500 }
      );
    }
    
    {
      getLogger().info({ sessionId, bookId, sessionNumber: session.sessionNumber }, "[Session API] Updated session");
    }
    
    return NextResponse.json(updatedSession);
  } catch (error) {
    getLogger().error({ err: error }, "[Session API] Unexpected error");
    return NextResponse.json(
      { 
        error: "Failed to update session",
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/books/:id/sessions/:sessionId
 * Delete a reading session and all associated progress logs
 * 
 * If the session is active, a new "to-read" session will be created automatically.
 * 
 * Responses:
 * - 200: Session deleted successfully (returns metadata)
 * - 400: Invalid request (invalid IDs, bookId mismatch)
 * - 404: Session not found
 * - 500: Deletion failed
 */
export async function DELETE(
  request: NextRequest,
  props: { params: Promise<{ id: string; sessionId: string }> }
) {
  const params = await props.params;
  const logger = getLogger().child({ route: "DELETE /api/books/[id]/sessions/[sessionId]" });

  try {
    // Parse and validate IDs
    const bookId = parseInt(params.id);
    const sessionId = parseInt(params.sessionId);

    if (isNaN(bookId) || isNaN(sessionId)) {
      logger.warn({ bookId: params.id, sessionId: params.sessionId }, "Invalid ID format");
      return NextResponse.json(
        { error: "Invalid book ID or session ID" },
        { status: 400 }
      );
    }

    logger.info({ bookId, sessionId }, "Deleting session");

    // Delete session via service
    const result = await sessionService.deleteSession(bookId, sessionId);

    logger.info({
      bookId,
      sessionId,
      deletedSessionNumber: result.deletedSessionNumber,
      wasActive: result.wasActive,
      newSessionCreated: result.newSessionCreated,
    }, "Session deleted successfully");

    return NextResponse.json(result);
  } catch (error) {
    const err = error as Error;
    
    // Handle specific error cases
    if (err.message === "Session not found") {
      logger.warn({ bookId: params.id, sessionId: params.sessionId }, "Session not found");
      return NextResponse.json(
        { error: "Session not found" },
        { status: 404 }
      );
    }

    if (err.message === "Session does not belong to specified book") {
      logger.warn({
        bookId: params.id,
        sessionId: params.sessionId,
      }, "Session bookId mismatch");
      return NextResponse.json(
        { error: "Session does not belong to specified book" },
        { status: 400 }
      );
    }

    // Generic server error
    logger.error({ err, bookId: params.id, sessionId: params.sessionId }, "Failed to delete session");
    return NextResponse.json(
      { error: "Failed to delete session" },
      { status: 500 }
    );
  }
}
