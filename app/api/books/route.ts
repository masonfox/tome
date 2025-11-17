import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db/mongodb";
import Book from "@/models/Book";
import ReadingStatus from "@/models/ReadingStatus";
import ProgressLog from "@/models/ProgressLog";

export async function GET(request: NextRequest) {
  try {
    await connectDB();

    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get("status");
    const search = searchParams.get("search");
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

    // If filtering by status, we need to join with ReadingStatus
    if (status) {
      const statusRecords = await ReadingStatus.find({ status }).select(
        "bookId"
      );
      const bookIds = statusRecords.map((s) => s.bookId);
      query._id = { $in: bookIds };
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

    // Get status for each book
    const booksWithStatus = await Promise.all(
      books.map(async (book) => {
        const status = await ReadingStatus.findOne({ bookId: book._id });
        const latestProgress = await ProgressLog.findOne({
          bookId: book._id,
        }).sort({ progressDate: -1 });
        return {
          ...book.toObject(),
          status: status ? status.status : null,
          rating: status?.rating,
          latestProgress: latestProgress ? latestProgress.toObject() : null,
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

    return NextResponse.json(book);
  } catch (error) {
    console.error("Error updating book:", error);
    return NextResponse.json(
      { error: "Failed to update book" },
      { status: 500 }
    );
  }
}
