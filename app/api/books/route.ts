import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db/mongodb";
import Book from "@/models/Book";
import ReadingSession from "@/models/ReadingSession";
import ProgressLog from "@/models/ProgressLog";

export async function GET(request: NextRequest) {
  try {
    await connectDB();

    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get("status");
    const search = searchParams.get("search");
    const tags = searchParams.get("tags");
    const limit = parseInt(searchParams.get("limit") || "50");
    const skip = parseInt(searchParams.get("skip") || "0");
    const showOrphaned = searchParams.get("showOrphaned") === "true";

    let query: any = {};

    // Exclude orphaned books by default
    if (!showOrphaned) {
      query.orphaned = { $ne: true };
    } else {
      // Show only orphaned books if requested
      query.orphaned = true;
    }

    // If filtering by status, we need to join with ReadingSession
    // For 'read' status, include archived sessions (isActive: false)
    // For other statuses, only include active sessions (isActive: true)
    if (status) {
      const sessionQuery: any = { status };
      
      if (status === "read") {
        // Include archived sessions for 'read' status
        sessionQuery.isActive = false;
      } else {
        // Only active sessions for other statuses
        sessionQuery.isActive = true;
      }
      
      const sessionRecords = await ReadingSession.find(sessionQuery).select("bookId");
      const bookIds = sessionRecords.map((s) => s.bookId);
      query._id = { $in: bookIds };
    }

    // Tag filtering
    if (tags) {
      const tagList = tags.split(",").map((t) => t.trim());
      query.tags = { $in: tagList };
    }

    // Text search
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: "i" } },
        { authors: { $regex: search, $options: "i" } },
      ];
    }

    const books = await Book.find(query)
      .sort({ title: 1 })
      .limit(limit)
      .skip(skip);

    const total = await Book.countDocuments(query);

    // Get session and latest progress for each book
    const booksWithStatus = await Promise.all(
      books.map(async (book) => {
        let session;
        
        // When filtering by 'read', use archived session
        // (even if there's an active session for re-reading)
        if (status === "read") {
          session = await ReadingSession.findOne({
            bookId: book._id,
            status: "read",
            isActive: false,
          }).sort({ completedDate: -1 }); // Get most recent read
        } else {
          // For all other cases (including no filter), prefer active session
          session = await ReadingSession.findOne({
            bookId: book._id,
            isActive: true,
          });
          
          // If no active session and no status filter, also check for archived "read" session
          // This ensures library view shows books that have been read but aren't currently being re-read
          if (!session && !status) {
            session = await ReadingSession.findOne({
              bookId: book._id,
              status: "read",
              isActive: false,
            }).sort({ completedDate: -1 });
          }
        }

        let latestProgress = null;
        if (session) {
          latestProgress = await ProgressLog.findOne({
            bookId: book._id,
            sessionId: session._id,
          }).sort({ progressDate: -1 });
        }

        return {
          ...JSON.parse(JSON.stringify(book)),
          status: session ? session.status : null,
          rating: session?.rating,
          latestProgress: latestProgress ? JSON.parse(JSON.stringify(latestProgress)) : null,
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
    return NextResponse.json(
      { error: "Failed to fetch books" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    await connectDB();

    const body = await request.json();
    const { calibreId, totalPages } = body;

    if (!calibreId) {
      return NextResponse.json(
        { error: "calibreId is required" },
        { status: 400 }
      );
    }

    const book = await Book.findOne({ calibreId });

    if (!book) {
      return NextResponse.json({ error: "Book not found" }, { status: 404 });
    }

    if (totalPages !== undefined) {
      book.totalPages = totalPages;
      await book.save();
    }

    return NextResponse.json(JSON.parse(JSON.stringify(book)));
  } catch (error) {
    console.error("Error updating book:", error);
    return NextResponse.json(
      { error: "Failed to update book" },
      { status: 500 }
    );
  }
}
