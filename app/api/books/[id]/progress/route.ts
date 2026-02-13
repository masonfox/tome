import { getLogger } from "@/lib/logger";
import { NextRequest, NextResponse } from "next/server";
import { ProgressService } from "@/lib/services/progress.service";
import { createProgressSchema } from "@/lib/api/schemas/progress.schemas";
import { ZodError } from "zod";

export const dynamic = 'force-dynamic';

const progressService = new ProgressService();

export async function GET(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
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
    getLogger().error({ err: error }, "Error fetching progress");
    return NextResponse.json({ error: "Failed to fetch progress" }, { status: 500 });
  }
}

export async function POST(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const bookId = parseInt(params.id);

    if (isNaN(bookId)) {
      return NextResponse.json({ error: "Invalid book ID format" }, { status: 400 });
    }

    const body = await request.json();
    
    // Validate request body with Zod
    const validatedData = createProgressSchema.parse(body);

    const progressData = {
      currentPage: validatedData.currentPage,
      currentPercentage: validatedData.currentPercentage,
      notes: validatedData.notes,
      progressDate: validatedData.progressDate,
    };

    const result = await progressService.logProgress(bookId, progressData);

    // Note: Cache invalidation handled by ProgressService.invalidateCache()

    return NextResponse.json(result);
  } catch (error) {
    getLogger().error({ err: error }, "Error logging progress");
    
    // Handle Zod validation errors
    if (error instanceof ZodError) {
      const errorMessage = error.issues.map((e) => e.message).join(", ");
      return NextResponse.json({ error: errorMessage }, { status: 400 });
    }
    
    // Handle specific errors
    if (error instanceof Error) {
      if (error.message.includes("not found")) {
        return NextResponse.json({ error: error.message }, { status: 404 });
      }
      if (error.message.includes("required") || 
          error.message.includes("must be") ||
          error.message.includes("Cannot log") ||
          error.message.includes("exceeds")) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
    }
    
    return NextResponse.json({ error: "Failed to log progress" }, { status: 500 });
  }
}
