import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db/mongodb";
import Book from "@/models/Book";
import ReadingStatus from "@/models/ReadingStatus";
import ProgressLog from "@/models/ProgressLog";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await connectDB();

    const book = await Book.findById(params.id);

    if (!book) {
      return NextResponse.json({ error: "Book not found" }, { status: 404 });
    }

    // Get status
    const status = await ReadingStatus.findOne({ bookId: book._id });

    // Get latest progress
    const latestProgress = await ProgressLog.findOne({ bookId: book._id })
      .sort({ progressDate: -1 })
      .limit(1);

    return NextResponse.json({
      ...book.toObject(),
      status: status ? status.toObject() : null,
      latestProgress: latestProgress ? latestProgress.toObject() : null,
    });
  } catch (error) {
    console.error("Error fetching book:", error);
    return NextResponse.json(
      { error: "Failed to fetch book" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await connectDB();

    const body = await request.json();
    const { totalPages } = body;

    const book = await Book.findByIdAndUpdate(
      params.id,
      { totalPages },
      { new: true }
    );

    if (!book) {
      return NextResponse.json({ error: "Book not found" }, { status: 404 });
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
