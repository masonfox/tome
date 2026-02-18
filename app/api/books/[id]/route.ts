import { getLogger } from "@/lib/logger";
import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { bookService } from "@/lib/services/book.service";
import { bookSourceRepository } from "@/lib/repositories/book-source.repository";
import { bookRepository } from "@/lib/repositories/book.repository";
import { localBookUpdateSchema } from "@/lib/validation/local-book.schema";
import { ZodError } from "zod";

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const bookId = parseInt(params.id);

    if (isNaN(bookId)) {
      return NextResponse.json({ error: "Invalid book ID format" }, { status: 400 });
    }

    const book = await bookService.getBookById(bookId);

    if (!book) {
      return NextResponse.json({ error: "Book not found" }, { status: 404 });
    }

    return NextResponse.json(book);
  } catch (error) {
    getLogger().error({ err: error }, "Error fetching book");
    return NextResponse.json({ error: "Failed to fetch book" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const logger = getLogger();
  
  try {
    const bookId = parseInt(params.id);

    if (isNaN(bookId)) {
      return NextResponse.json({ error: "Invalid book ID format" }, { status: 400 });
    }

    // Check if book exists
    const existingBook = await bookRepository.findById(bookId);
    if (!existingBook) {
      return NextResponse.json({ error: "Book not found" }, { status: 404 });
    }

    const body = await request.json();

    // Handle legacy totalPages-only update
    if (body.totalPages !== undefined && Object.keys(body).length === 1) {
      const book = await bookService.updateTotalPages(bookId, body.totalPages);
      return NextResponse.json(book);
    }

    // If body is empty or only has totalPages=undefined, return error
    if (Object.keys(body).length === 0 || (Object.keys(body).length === 1 && body.totalPages === undefined)) {
      return NextResponse.json(
        { error: "Total pages must be a positive number" },
        { status: 400 }
      );
    }

    // Handle full book metadata update
    // Check if book has any sources (Calibre, Audiobookshelf, etc.)
    const hasSources = await bookSourceRepository.hasAnySources(bookId);
    
    if (hasSources) {
      return NextResponse.json(
        { 
          error: "Cannot edit books synced from external sources. Edit in the source application instead." 
        }, 
        { status: 403 }
      );
    }

    // Validate update data
    const validatedData = localBookUpdateSchema.parse(body);

    // Update book
    const updatedBook = await bookRepository.update(bookId, validatedData);

    logger.info({ bookId, fields: Object.keys(validatedData) }, "Updated local book");

    return NextResponse.json(updatedBook);
  } catch (error) {
    if (error instanceof ZodError) {
      logger.warn({ err: error, bookId: params.id }, "Validation error updating book");
      return NextResponse.json(
        { 
          error: "Validation error", 
          details: error.issues 
        }, 
        { status: 400 }
      );
    }

    logger.error({ err: error }, "Error updating book");
    
    // Handle specific errors
    if (error instanceof Error) {
      if (error.message.includes("not found")) {
        return NextResponse.json({ error: error.message }, { status: 404 });
      }
      if (error.message.includes("must be") || error.message.includes("Cannot reduce")) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
    }

    return NextResponse.json({ error: "Failed to update book" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const logger = getLogger();
  
  try {
    const bookId = parseInt(params.id);

    if (isNaN(bookId)) {
      return NextResponse.json({ error: "Invalid book ID format" }, { status: 400 });
    }

    // Check if book exists
    const existingBook = await bookRepository.findById(bookId);
    if (!existingBook) {
      return NextResponse.json({ error: "Book not found" }, { status: 404 });
    }

    // Check if book has any sources (Calibre, Audiobookshelf, etc.)
    const hasSources = await bookSourceRepository.hasAnySources(bookId);
    
    if (hasSources) {
      return NextResponse.json(
        { 
          error: "Cannot delete books synced from external sources. Remove from the source application instead." 
        }, 
        { status: 403 }
      );
    }

    // Delete book (cascade deletes sessions, progress, notes, shelves, and cleans up cover)
    const deleted = await bookRepository.delete(bookId);

    if (!deleted) {
      return NextResponse.json({ error: "Failed to delete book" }, { status: 500 });
    }

    logger.info({ bookId, title: existingBook.title }, "Deleted local book");

    // Invalidate Next.js cache for library page
    revalidatePath('/library');

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    logger.error({ err: error }, "Error deleting book");
    return NextResponse.json({ error: "Failed to delete book" }, { status: 500 });
  }
}
