import { getLogger } from "@/lib/logger";
import { NextRequest, NextResponse } from "next/server";
import { tagService } from "@/lib/services";

export const dynamic = 'force-dynamic';

/**
 * POST /api/tags/bulk
 * Bulk update tags for multiple books
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validate request body
    if (!Array.isArray(body.bookIds) || body.bookIds.length === 0) {
      return NextResponse.json(
        { error: "bookIds must be a non-empty array" },
        { status: 400 }
      );
    }

    if (!Array.isArray(body.tags) || body.tags.length === 0) {
      return NextResponse.json(
        { error: "tags must be a non-empty array" },
        { status: 400 }
      );
    }

    if (body.action !== 'add' && body.action !== 'remove') {
      return NextResponse.json(
        { error: "action must be 'add' or 'remove'" },
        { status: 400 }
      );
    }

    const result = await tagService.bulkUpdateTags(
      body.bookIds,
      body.action,
      body.tags
    );

    return NextResponse.json({
      booksUpdated: result.booksUpdated,
    });
  } catch (error) {
    getLogger().error({ err: error }, "Error bulk updating tags");
    return NextResponse.json({ error: "Failed to bulk update tags" }, { status: 500 });
  }
}
