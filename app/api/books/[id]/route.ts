import { NextRequest, NextResponse } from "next/server";
import { BookService } from "@/lib/services/book.service";

export const dynamic = 'force-dynamic';

const bookService = new BookService();

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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
    const { getLogger } = require("@/lib/logger");
    getLogger().error({ err: error }, "Error fetching book");
    return NextResponse.json({ error: "Failed to fetch book" }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const bookId = parseInt(params.id);

    if (isNaN(bookId)) {
      return NextResponse.json({ error: "Invalid book ID format" }, { status: 400 });
    }

    const body = await request.json();
    const { totalPages } = body;

    const book = await bookService.updateTotalPages(bookId, totalPages);

    return NextResponse.json(book);
  } catch (error) {
    const { getLogger } = require("@/lib/logger");
    getLogger().error({ err: error }, "Error updating book");
    
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
