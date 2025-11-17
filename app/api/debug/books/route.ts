import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db/mongodb";
import Book from "@/models/Book";

export async function GET() {
  try {
    await connectDB();

    const books = await Book.find().limit(5).select("title coverPath path");

    return NextResponse.json({
      books: books.map((book) => ({
        title: book.title,
        coverPath: book.coverPath,
        calibrePath: book.path,
        pathBytes: book.path ? Buffer.from(book.path).toString('hex') : null,
        coverPathBytes: book.coverPath ? Buffer.from(book.coverPath).toString('hex') : null,
      })),
    });
  } catch (error) {
    console.error("Error:", error);
    return NextResponse.json({ error: "Failed to fetch" }, { status: 500 });
  }
}
