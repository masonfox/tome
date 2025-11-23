import { NextRequest, NextResponse } from "next/server";
import { SessionService } from "@/lib/services/session.service";

export const dynamic = 'force-dynamic';

const sessionService = new SessionService();

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const bookId = parseInt(params.id);

    if (isNaN(bookId)) {
      return NextResponse.json({ error: "Invalid book ID format" }, { status: 400 });
    }

    const session = await sessionService.getActiveSession(bookId);

    if (!session) {
      return NextResponse.json({ status: null });
    }

    return NextResponse.json(session);
  } catch (error) {
    console.error("Error fetching status:", error);
    return NextResponse.json({ error: "Failed to fetch status" }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const bookId = parseInt(params.id);

    if (isNaN(bookId)) {
      return NextResponse.json({ error: "Invalid book ID format" }, { status: 400 });
    }

    const body = await request.json();
    const { status, rating, review, startedDate, completedDate } = body;

    // Convert date strings to Date objects if provided
    const statusData = {
      status,
      rating,
      review,
      startedDate: startedDate ? new Date(startedDate) : undefined,
      completedDate: completedDate ? new Date(completedDate) : undefined,
    };

    const result = await sessionService.updateStatus(bookId, statusData);

    // Return full result if session was archived, otherwise just the session
    if (result.sessionArchived) {
      return NextResponse.json({
        ...result.session,
        sessionArchived: result.sessionArchived,
        archivedSessionNumber: result.archivedSessionNumber,
      });
    }

    return NextResponse.json(result.session);
  } catch (error) {
    console.error("Error updating status:", error);
    
    // Handle specific errors
    if (error instanceof Error) {
      if (error.message.includes("not found")) {
        return NextResponse.json({ error: error.message }, { status: 404 });
      }
      if (error.message.includes("Invalid status")) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
    }
    
    return NextResponse.json({ error: "Failed to update status" }, { status: 500 });
  }
}
