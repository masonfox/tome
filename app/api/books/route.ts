import { NextRequest, NextResponse } from "next/server";
import { bookRepository, sessionRepository, progressRepository } from "@/lib/repositories";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get("status") || undefined;
    const search = searchParams.get("search") || undefined;
    const tagsParam = searchParams.get("tags");
    const rating = searchParams.get("rating") || undefined;
    const limit = parseInt(searchParams.get("limit") || "50");
    const skip = parseInt(searchParams.get("skip") || "0");
    const showOrphaned = searchParams.get("showOrphaned") === "true";
    const sortBy = searchParams.get("sortBy") || undefined;

    // Parse tags
    const tags = tagsParam ? tagsParam.split(",").map((t) => t.trim()) : undefined;

    // Determine orphaned filter
    const orphanedOnly = showOrphaned;

    // Get books with filters
    const { books, total } = await bookRepository.findWithFilters(
      {
        status,
        search,
        tags,
        rating,
        showOrphaned,
        orphanedOnly,
      },
      limit,
      skip,
      sortBy
    );

    // Get session and latest progress for each book
    const booksWithStatus = await Promise.all(
      books.map(async (book) => {
        let session;

        // When filtering by 'read', use archived session
        if (status === "read") {
          session = await sessionRepository.findMostRecentCompletedByBookId(book.id);
        } else {
          // For all other cases, prefer active session
          session = await sessionRepository.findActiveByBookId(book.id);

          // If no active session and no status filter, also check for archived "read" session
          if (!session && !status) {
            session = await sessionRepository.findMostRecentCompletedByBookId(book.id);
          }
        }

        let latestProgress = null;
        if (session) {
          latestProgress = await progressRepository.findLatestByBookIdAndSessionId(
            book.id,
            session.id
          );
        }

        return {
          ...book,
          status: session ? session.status : null,
          rating: book.rating, // Rating now comes from books table (synced from Calibre)
          latestProgress,
        };
      })
    );

    return NextResponse.json({
      books: booksWithStatus,
      total,
      limit,
      skip,
    });
  } catch (error) {
    console.error("Error fetching books:", error);
    return NextResponse.json({ error: "Failed to fetch books" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { calibreId, totalPages } = body;

    if (!calibreId) {
      return NextResponse.json({ error: "calibreId is required" }, { status: 400 });
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
    console.error("Error updating book:", error);
    return NextResponse.json({ error: "Failed to update book" }, { status: 500 });
  }
}
