import { getLogger } from "@/lib/logger";
import { NextResponse } from "next/server";
import { bookRepository } from "@/lib/repositories";

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // Get all unique tags from all books
    const tags = await bookRepository.getAllTags();

    return NextResponse.json({ tags });
  } catch (error) {
    getLogger().error({ err: error }, "Error fetching tags");
    return NextResponse.json({ error: "Failed to fetch tags" }, { status: 500 });
  }
}
