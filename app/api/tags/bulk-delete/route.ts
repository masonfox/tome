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
      success: result.failureCount === 0,
      partialSuccess: result.successCount > 0 && result.failureCount > 0,
      deletedTags: body.tagNames,
      tagsDeleted: result.tagsDeleted,
      totalBooks: result.totalBooks,
      successCount: result.successCount,
      failureCount: result.failureCount,
      calibreFailures: result.calibreFailures,
      tomeFailures: result.tomeFailures,
    });
  } catch (error) {
    const { getLogger } = require("@/lib/logger");
    getLogger().error({ err: error }, "Error bulk deleting tags");
    
    const errorMessage = error instanceof Error ? error.message : "Failed to delete tags";
    return NextResponse.json({ 
      error: errorMessage,
      success: false,
      partialSuccess: false,
      totalBooks: 0,
      successCount: 0,
      failureCount: 0,
      tagsDeleted: 0,
    }, { status: 500 });
  }
}
