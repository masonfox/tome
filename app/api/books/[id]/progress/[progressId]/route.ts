import { NextRequest, NextResponse } from "next/server";
import { ProgressService } from "@/lib/services/progress.service";
import { progressRepository } from "@/lib/repositories";

export const dynamic = 'force-dynamic';

const progressService = new ProgressService();

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string; progressId: string } }
) {
  try {
    const bookId = parseInt(params.id);
    const progressId = parseInt(params.progressId);

    if (isNaN(bookId) || isNaN(progressId)) {
      return NextResponse.json(
        { error: "Invalid book ID or progress ID format" },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { currentPage, currentPercentage, notes, progressDate } = body;

    // Verify the progress entry belongs to this book
    const existingEntry = await progressRepository.findById(progressId);
    if (existingEntry && existingEntry.bookId !== bookId) {
      return NextResponse.json(
        { error: "Progress entry does not belong to this book" },
        { status: 403 }
      );
    }

    const updateData = {
      currentPage,
      currentPercentage,
      notes,
      progressDate: progressDate ? new Date(progressDate) : undefined,
    };

    const updatedEntry = await progressService.updateProgress(progressId, updateData);

    // Note: Cache invalidation handled by ProgressService.invalidateCache()

    return NextResponse.json(updatedEntry);
  } catch (error: any) {
    const { getLogger } = require("@/lib/logger");
    getLogger().error({ err: error }, "Error updating progress");
    
    // Handle specific errors
    if (error instanceof Error) {
      if (error.message.includes("not found")) {
        return NextResponse.json({ error: error.message }, { status: 404 });
      }
      if (error.message.includes("must be") || 
          error.message.includes("cannot exceed") ||
          error.message.includes("no associated session")) {
        // Include conflictingEntry if available (for temporal validation errors)
        const response: any = { error: error.message };
        if ((error as any).conflictingEntry) {
          response.conflictingEntry = (error as any).conflictingEntry;
        }
        return NextResponse.json(response, { status: 400 });
      }
    }
    
    return NextResponse.json({ error: "Failed to update progress" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string; progressId: string } }
) {
  try {
    const bookId = parseInt(params.id);
    const progressId = parseInt(params.progressId);

    if (isNaN(bookId) || isNaN(progressId)) {
      return NextResponse.json(
        { error: "Invalid book ID or progress ID format" },
        { status: 400 }
      );
    }

    // Verify the progress entry belongs to this book
    const existingEntry = await progressRepository.findById(progressId);
    
    if (!existingEntry) {
      return NextResponse.json({ error: "Progress entry not found" }, { status: 404 });
    }

    if (existingEntry.bookId !== bookId) {
      return NextResponse.json(
        { error: "Progress entry does not belong to this book" },
        { status: 403 }
      );
    }

    const success = await progressService.deleteProgress(progressId);

    if (!success) {
      return NextResponse.json({ error: "Failed to delete progress entry" }, { status: 500 });
    }

    // Note: Cache invalidation handled by ProgressService.invalidateCache()

    return NextResponse.json({ success: true, message: "Progress entry deleted" });
  } catch (error) {
    const { getLogger } = require("@/lib/logger");
    getLogger().error({ err: error }, "Error deleting progress");
    return NextResponse.json({ error: "Failed to delete progress" }, { status: 500 });
  }
}
