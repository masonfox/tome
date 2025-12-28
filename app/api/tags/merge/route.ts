import { NextRequest, NextResponse } from "next/server";
import { bookService } from "@/lib/services";

export const dynamic = 'force-dynamic';

/**
 * POST /api/tags/merge
 * Merge multiple source tags into a target tag
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validate request body
    if (!Array.isArray(body.sourceTags) || body.sourceTags.length === 0) {
      return NextResponse.json(
        { error: "sourceTags must be a non-empty array" },
        { status: 400 }
      );
    }

    if (!body.targetTag || typeof body.targetTag !== 'string') {
      return NextResponse.json(
        { error: "targetTag is required and must be a string" },
        { status: 400 }
      );
    }

    const targetTag = body.targetTag.trim();
    
    if (!targetTag) {
      return NextResponse.json(
        { error: "Target tag cannot be empty" },
        { status: 400 }
      );
    }

    const result = await bookService.mergeTags(body.sourceTags, targetTag);

    return NextResponse.json({
      mergedTags: body.sourceTags,
      targetTag,
      booksUpdated: result.booksUpdated,
    });
  } catch (error) {
    const { getLogger } = require("@/lib/logger");
    getLogger().error({ err: error }, "Error merging tags");
    return NextResponse.json({ error: "Failed to merge tags" }, { status: 500 });
  }
}
