import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { bookRepository, sessionRepository, progressRepository } from "@/lib/repositories";
import { validateProgressEdit } from "@/lib/services/progress-validation";

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

    // Get the existing progress entry
    const existingEntry = await progressRepository.findById(progressId);

    if (!existingEntry) {
      return NextResponse.json({ error: "Progress entry not found" }, { status: 404 });
    }

    // Verify the progress entry belongs to this book
    if (existingEntry.bookId !== bookId) {
      return NextResponse.json(
        { error: "Progress entry does not belong to this book" },
        { status: 403 }
      );
    }

    // Ensure the progress entry has a session
    if (!existingEntry.sessionId) {
      return NextResponse.json(
        { error: "Progress entry has no associated session" },
        { status: 400 }
      );
    }

    const book = await bookRepository.findById(bookId);

    if (!book) {
      return NextResponse.json({ error: "Book not found" }, { status: 404 });
    }

    // Calculate final values
    let finalCurrentPage = currentPage !== undefined ? currentPage : (existingEntry.currentPage ?? 0);
    let finalCurrentPercentage =
      currentPercentage !== undefined ? currentPercentage : (existingEntry.currentPercentage ?? 0);

    // Recalculate based on what was provided
    if (currentPage !== undefined && book.totalPages) {
      finalCurrentPercentage = (currentPage / book.totalPages) * 100;
    } else if (currentPercentage !== undefined && book.totalPages) {
      finalCurrentPage = Math.floor((currentPercentage / 100) * book.totalPages);
    }

    // Determine validation parameters
    const requestedDate = progressDate
      ? new Date(progressDate)
      : new Date(existingEntry.progressDate);
    const usePercentage = currentPercentage !== undefined;
    const progressValue = usePercentage ? finalCurrentPercentage : finalCurrentPage;

    // Temporal validation for edit
    const validationResult = await validateProgressEdit(
      progressId,
      existingEntry.sessionId,
      requestedDate,
      progressValue,
      usePercentage
    );

    if (!validationResult.valid) {
      return NextResponse.json(
        {
          error: validationResult.error,
          conflictingEntry: validationResult.conflictingEntry,
        },
        { status: 400 }
      );
    }

    // Recalculate pagesRead based on the previous entry
    const allSessionProgress = await progressRepository.findBySessionId(
      existingEntry.sessionId
    );
    const sortedProgress = allSessionProgress
      .filter((p) => p.id !== progressId) // Exclude current entry
      .sort(
        (a, b) =>
          new Date(a.progressDate).getTime() - new Date(b.progressDate).getTime()
      );

    // Find the previous entry before the updated date
    const previousEntry = sortedProgress
      .filter((p) => new Date(p.progressDate) < requestedDate)
      .sort(
        (a, b) =>
          new Date(b.progressDate).getTime() - new Date(a.progressDate).getTime()
      )[0];

    const pagesRead = previousEntry
      ? Math.max(0, finalCurrentPage - (previousEntry.currentPage ?? 0))
      : finalCurrentPage;

    // Update the progress entry
    const updatedEntry = await progressRepository.update(progressId, {
      currentPage: finalCurrentPage,
      currentPercentage: finalCurrentPercentage,
      progressDate: progressDate ? new Date(progressDate) : existingEntry.progressDate,
      notes: notes !== undefined ? notes : existingEntry.notes,
      pagesRead,
    } as any);

    // Revalidate pages
    revalidatePath(`/books/${bookId}`);
    revalidatePath("/");
    revalidatePath("/stats");

    return NextResponse.json(updatedEntry);
  } catch (error) {
    console.error("Error updating progress:", error);
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

    // Get the existing progress entry
    const existingEntry = await progressRepository.findById(progressId);

    if (!existingEntry) {
      return NextResponse.json({ error: "Progress entry not found" }, { status: 404 });
    }

    // Verify the progress entry belongs to this book
    if (existingEntry.bookId !== bookId) {
      return NextResponse.json(
        { error: "Progress entry does not belong to this book" },
        { status: 403 }
      );
    }

    // Delete the progress entry
    const success = await progressRepository.delete(progressId);

    if (!success) {
      return NextResponse.json({ error: "Failed to delete progress entry" }, { status: 500 });
    }

    // Revalidate pages
    revalidatePath(`/books/${bookId}`);
    revalidatePath("/");
    revalidatePath("/stats");

    return NextResponse.json({ success: true, message: "Progress entry deleted" });
  } catch (error) {
    console.error("Error deleting progress:", error);
    return NextResponse.json({ error: "Failed to delete progress" }, { status: 500 });
  }
}
