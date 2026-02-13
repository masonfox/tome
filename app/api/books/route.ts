import { getLogger } from "@/lib/logger";
import { NextRequest, NextResponse } from "next/server";
import { bookRepository } from "@/lib/repositories";
import { bookService } from "@/lib/services/book.service";
import { ZodError } from "zod";

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get("status") || undefined;
    const search = searchParams.get("search")?.trim() || undefined;
    const tagsParam = searchParams.get("tags");
    const sourcesParam = searchParams.get("sources"); // T048: Add source filtering
    const rating = searchParams.get("rating") || undefined;
    const shelfParam = searchParams.get("shelf");
    const excludeShelfParam = searchParams.get("excludeShelfId");
    const limit = parseInt(searchParams.get("limit") || "50");
    const skip = parseInt(searchParams.get("skip") || "0");
    const showOrphaned = searchParams.get("showOrphaned") === "true";
    const sortBy = searchParams.get("sortBy") || undefined;
    const noTags = searchParams.get("noTags") === "true";

    // Parse tags
    const tags = tagsParam ? tagsParam.split(",").map((t) => t.trim()) : undefined;
    
    // Parse sources (T048: Multi-source filtering)
    const source = sourcesParam 
      ? sourcesParam.split(",").map((s) => s.trim()) as Array<"calibre" | "manual">
      : undefined;

    // Parse shelf ID
    const shelfIds = shelfParam ? [parseInt(shelfParam)] : undefined;
    
    // Parse exclude shelf ID
    const excludeShelfId = excludeShelfParam ? parseInt(excludeShelfParam) : undefined;

    // Determine orphaned filter
    const orphanedOnly = showOrphaned;

    // Get books with filters, sessions, and progress in a single optimized query
    // This replaces the N+1 query pattern (1 + N session queries + N progress queries)
    // with a single JOIN query for massive performance improvement
    const { books: booksWithStatus, total } = await bookRepository.findWithFiltersAndRelations(
      {
        status,
        search,
        tags,
        source, // T048: Pass source filter to repository
        rating,
        shelfIds,
        excludeShelfId,
        showOrphaned,
        orphanedOnly,
        noTags,
      },
      limit,
      skip,
      sortBy
    );

    return NextResponse.json({
      books: booksWithStatus,
      total,
      limit,
      skip,
    });
  } catch (error) {
    getLogger().error({ err: error }, "Error fetching books");
    return NextResponse.json({ error: "Failed to fetch books" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Check if this is a manual book creation (has title field)
    if (body.title && body.authors) {
      // Manual book creation
      try {
        const result = await bookService.createManualBook(body);
        
        return NextResponse.json({
          book: result.book,
          duplicates: result.duplicates,
        }, { status: 201 });
      } catch (error) {
        if (error instanceof ZodError) {
          return NextResponse.json(
            {
              error: "Validation failed",
              details: error.issues,
            },
            { status: 400 }
          );
        }
        
        getLogger().error({ err: error }, "Error creating manual book");
        return NextResponse.json(
          { error: "Failed to create manual book" },
          { status: 500 }
        );
      }
    }

    // Legacy: Update book by calibreId
    const { calibreId, totalPages } = body;

    if (!calibreId) {
      return NextResponse.json(
        { error: "Either (title + authors) or calibreId is required" },
        { status: 400 }
      );
    }

    const book = await bookRepository.findByCalibreId(calibreId);

    if (!book) {
      return NextResponse.json({ error: "Book not found" }, { status: 404 });
    }

    if (totalPages !== undefined) {
      const updated = await bookRepository.update(book.id, { totalPages });
      return NextResponse.json(updated);
    }

    return NextResponse.json(book);
  } catch (error) {
    getLogger().error({ err: error }, "Error in POST /api/books");
    return NextResponse.json(
      { error: "Failed to process request" },
      { status: 500 }
    );
  }
}
