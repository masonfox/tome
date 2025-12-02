import { NextRequest, NextResponse } from "next/server";
import { ProgressService } from "@/lib/services/progress.service";

export const dynamic = 'force-dynamic';

const progressService = new ProgressService();

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const bookId = parseInt(params.id);

    if (isNaN(bookId)) {
      return NextResponse.json({ error: "Invalid book ID format" }, { status: 400 });
    }

    // Check for sessionId query parameter
    const sessionIdParam = request.nextUrl.searchParams.get("sessionId");

    if (sessionIdParam) {
      // Get progress for specific session
      const sessionId = parseInt(sessionIdParam);
      if (isNaN(sessionId)) {
        return NextResponse.json({ error: "Invalid session ID format" }, { status: 400 });
      }

      const progressLogs = await progressService.getProgressForSession(sessionId);
      return NextResponse.json(progressLogs);
    } else {
      // Get progress for active session only
      const progressLogs = await progressService.getProgressForActiveSession(bookId);
      return NextResponse.json(progressLogs);
    }
  } catch (error) {
    const { getLogger } = require("@/lib/logger");
    getLogger().error({ err: error }, "Error fetching progress");
    return NextResponse.json({ error: "Failed to fetch progress" }, { status: 500 });
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
    const { currentPage, currentPercentage, notes, progressDate } = body;

    const progressData = {
      currentPage,
      currentPercentage,
      notes,
      progressDate: progressDate ? new Date(progressDate) : undefined,
    };

    const progressLog = await progressService.logProgress(bookId, progressData);

    // Note: Cache invalidation handled by ProgressService.invalidateCache()

    return NextResponse.json(progressLog);
  } catch (error) {
    const { getLogger } = require("@/lib/logger");
    getLogger().error({ err: error }, "Error logging progress");
    
    // Handle specific errors
    if (error instanceof Error) {
      if (error.message.includes("not found")) {
        return NextResponse.json({ error: error.message }, { status: 404 });
      }
      if (error.message.includes("required") || 
          error.message.includes("must be") ||
          error.message.includes("Cannot log")) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
    }
    
    return NextResponse.json({ error: "Failed to log progress" }, { status: 500 });
  }
}
