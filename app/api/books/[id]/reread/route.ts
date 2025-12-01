import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { SessionService } from "@/lib/services/session.service";
import { sessionRepository } from "@/lib/repositories";

export const dynamic = 'force-dynamic';

const sessionService = new SessionService();

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const bookId = parseInt(params.id);

    if (isNaN(bookId)) {
      return NextResponse.json({ error: "Invalid book ID format" }, { status: 400 });
    }

    // Check if there's already an active session
    const existingActiveSession = await sessionRepository.findActiveByBookId(bookId);

    // Check if there are completed reads (must have at least one completed read to re-read)
    const hasCompletedReads = await sessionRepository.hasCompletedReads(bookId);
    
    if (!hasCompletedReads) {
      // If active session is to-read or read-next, provide specific error message
      if (existingActiveSession && (existingActiveSession.status === "to-read" || existingActiveSession.status === "read-next")) {
        return NextResponse.json(
          { error: "Can only re-read books with completed reads" },
          { status: 400 }
        );
      }
      
      // Default error message for no completed reads
      return NextResponse.json(
        { error: "Cannot start re-read: no completed reads found" },
        { status: 400 }
      );
    }

    // If there are completed reads AND active session exists, reject
    if (existingActiveSession) {
      return NextResponse.json(
        { error: "An active reading session already exists for this book" },
        { status: 400 }
      );
    }

    // Get last session before creating new one (for response)
    const lastSession = await sessionRepository.findLatestByBookId(bookId);

    const newSession = await sessionService.startReread(bookId);

    // Revalidate the dashboard to update book status display
    revalidatePath('/');

    return NextResponse.json({
      message: "Re-reading session started successfully",
      session: newSession,
      previousSession: lastSession ? {
        id: lastSession.id,
        sessionNumber: lastSession.sessionNumber,
      } : undefined,
    });
  } catch (error: any) {
    const { getLogger } = require("@/lib/logger");
    getLogger().error({ err: error }, "Error starting re-read");

    // Handle specific errors
    if (error instanceof Error) {
      if (error.message.includes("not found")) {
        return NextResponse.json({ error: error.message }, { status: 404 });
      }
      if (error.message.includes("Cannot") || error.message.includes("already exists") || error.message.includes("no completed reads")) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
    }

    // Handle SQLite unique constraint error (race condition)
    if (error.message?.includes("UNIQUE constraint failed")) {
      return NextResponse.json(
        { error: "An active reading session already exists for this book" },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Failed to start re-reading session" },
      { status: 500 }
    );
  }
}
