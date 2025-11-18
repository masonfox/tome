import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db/mongodb";
import Book from "@/models/Book";

export async function GET() {
  try {
    await connectDB();

    const books = await Book.find().limit(5).select("title path calibreId");

    return NextResponse.json({
      books: books.map((book) => ({
        title: book.title,
        calibreId: book.calibreId,
        calibrePath: book.path,
        pathBytes: book.path ? Buffer.from(book.path).toString('hex') : null,
      })),
    });
  } catch (error) {
    console.error("Error:", error);
    return NextResponse.json({ error: "Failed to fetch" }, { status: 500 });
  }
}
