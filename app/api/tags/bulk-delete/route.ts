import { NextRequest, NextResponse } from "next/server";
import { tagService } from "@/lib/services";

export const dynamic = 'force-dynamic';

/**
 * POST /api/tags/bulk-delete
 * Delete multiple tags from all books
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validate request body
    if (!body.tagNames || !Array.isArray(body.tagNames)) {
      return NextResponse.json(
        { error: "tagNames is required and must be an array" },
        { status: 400 }
      );
    }

    if (body.tagNames.length === 0) {
      return NextResponse.json(
        { error: "tagNames array cannot be empty" },
        { status: 400 }
      );
    }

    // Validate each tag name
    for (const tagName of body.tagNames) {
      if (typeof tagName !== 'string' || !tagName.trim()) {
        return NextResponse.json(
          { error: "All tag names must be non-empty strings" },
          { status: 400 }
        );
      }
    }

    const result = await tagService.bulkDeleteTags(body.tagNames);

    return NextResponse.json({
      deletedTags: body.tagNames,
      tagsDeleted: result.tagsDeleted,
      booksUpdated: result.booksUpdated,
    });
  } catch (error) {
    const { getLogger } = require("@/lib/logger");
    getLogger().error({ err: error }, "Error bulk deleting tags");
    return NextResponse.json({ error: "Failed to delete tags" }, { status: 500 });
  }
}
