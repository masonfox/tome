import { NextRequest, NextResponse } from "next/server";
import { tagService } from "@/lib/services";

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

    const result = await tagService.mergeTags(body.sourceTags, targetTag);

    return NextResponse.json({
      success: result.failureCount === 0,
      partialSuccess: result.successCount > 0 && result.failureCount > 0,
      mergedTags: body.sourceTags,
      targetTag,
      totalBooks: result.totalBooks,
      successCount: result.successCount,
      failureCount: result.failureCount,
      calibreFailures: result.calibreFailures,
      tomeFailures: result.tomeFailures,
    });
  } catch (error) {
    const { getLogger } = require("@/lib/logger");
    getLogger().error({ err: error }, "Error merging tags");
    
    // Return detailed error message
    const errorMessage = error instanceof Error ? error.message : "Failed to merge tags";
    return NextResponse.json({ 
      error: errorMessage,
      success: false,
      partialSuccess: false,
      totalBooks: 0,
      successCount: 0,
      failureCount: 0,
    }, { status: 500 });
  }
}
