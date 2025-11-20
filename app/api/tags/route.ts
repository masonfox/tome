import { NextResponse } from "next/server";
import { bookRepository } from "@/lib/repositories";

export async function GET() {
  try {
    // Get all unique tags from all books
    const tags = await bookRepository.getAllTags();

    return NextResponse.json({ tags });
  } catch (error) {
    console.error("Error fetching tags:", error);
    return NextResponse.json({ error: "Failed to fetch tags" }, { status: 500 });
  }
}
