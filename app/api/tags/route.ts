import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db/mongodb";
import Book from "@/models/Book";

export async function GET() {
  try {
    await connectDB();

    // Get all unique tags from all books
    const tags = await Book.distinct("tags", { orphaned: { $ne: true } });

    // Sort tags alphabetically
    const sortedTags = tags.sort((a, b) => a.localeCompare(b));

    return NextResponse.json({ tags: sortedTags });
  } catch (error) {
    console.error("Error fetching tags:", error);
    return NextResponse.json(
      { error: "Failed to fetch tags" },
      { status: 500 }
    );
  }
}
