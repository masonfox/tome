import { NextRequest, NextResponse } from "next/server";
import { sessionRepository } from "@/lib/repositories";

export const dynamic = 'force-dynamic';

/**
 * PATCH /api/books/:id/sessions/:sessionId
 * Update reading session (dates and/or review)
 * 
 * Request Body:
 * {
 *   "startedDate": string | null   // ISO date string or null
 *   "completedDate": string | null // ISO date string or null
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
  { params }: { params: { id: string; sessionId: string } }
) {
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
    
    // Handle dates
    if ('startedDate' in body) {
      updateData.startedDate = startedDate ? new Date(startedDate) : null;
    }
    if ('completedDate' in body) {
      updateData.completedDate = completedDate ? new Date(completedDate) : null;
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
      const { getLogger } = require("@/lib/logger");
      getLogger().info({ sessionId, bookId, sessionNumber: session.sessionNumber }, "[Session API] Updated session");
    }
    
    return NextResponse.json(updatedSession);
  } catch (error) {
    const { getLogger } = require("@/lib/logger");
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
