import { getLogger } from "@/lib/logger";
import { NextRequest, NextResponse } from "next/server";
import { tagService } from "@/lib/services";

export const dynamic = 'force-dynamic';

/**
 * GET /api/tags/:tagName
 * Get all books with a specific tag
 */
export async function GET(request: NextRequest, props: { params: Promise<{ tagName: string }> }) {
  const params = await props.params;
  try {
    const tagName = decodeURIComponent(params.tagName);
    
    // Parse pagination params
    const searchParams = request.nextUrl.searchParams;
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const skip = parseInt(searchParams.get('skip') || '0', 10);

    const { books, total } = await tagService.getBooksByTag(tagName, limit, skip);

    return NextResponse.json({ tag: tagName, books, total });
  } catch (error) {
    getLogger().error({ err: error, tagName: params.tagName }, "Error fetching books by tag");
    return NextResponse.json({ error: "Failed to fetch books" }, { status: 500 });
  }
}

/**
 * PATCH /api/tags/:tagName
 * Rename a tag across all books
 */
export async function PATCH(request: NextRequest, props: { params: Promise<{ tagName: string }> }) {
  const params = await props.params;
  try {
    const tagName = decodeURIComponent(params.tagName);
    const body = await request.json();
    
    // Validate request body
    if (!body.newName || typeof body.newName !== 'string') {
      return NextResponse.json(
        { error: "newName is required and must be a string" },
        { status: 400 }
      );
    }

    const newName = body.newName.trim();
    
    if (!newName) {
      return NextResponse.json(
        { error: "New tag name cannot be empty" },
        { status: 400 }
      );
    }

    if (tagName === newName) {
      return NextResponse.json(
        { error: "Old and new tag names must be different" },
        { status: 400 }
      );
    }

    const result = await tagService.renameTag(tagName, newName);

    return NextResponse.json({
      success: result.failureCount === 0,
      partialSuccess: result.successCount > 0 && result.failureCount > 0,
      oldName: tagName,
      newName,
      totalBooks: result.totalBooks,
      successCount: result.successCount,
      failureCount: result.failureCount,
      calibreFailures: result.calibreFailures,
      tomeFailures: result.tomeFailures,
    });
  } catch (error) {
    getLogger().error({ err: error, tagName: params.tagName }, "Error renaming tag");
    
    const errorMessage = error instanceof Error ? error.message : "Failed to rename tag";
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

/**
 * DELETE /api/tags/:tagName
 * Delete a tag from all books
 */
export async function DELETE(request: NextRequest, props: { params: Promise<{ tagName: string }> }) {
  const params = await props.params;
  try {
    const tagName = decodeURIComponent(params.tagName);

    const result = await tagService.deleteTag(tagName);

    return NextResponse.json({
      success: result.failureCount === 0,
      partialSuccess: result.successCount > 0 && result.failureCount > 0,
      deletedTag: tagName,
      totalBooks: result.totalBooks,
      successCount: result.successCount,
      failureCount: result.failureCount,
      calibreFailures: result.calibreFailures,
      tomeFailures: result.tomeFailures,
    });
  } catch (error) {
    getLogger().error({ err: error, tagName: params.tagName }, "Error deleting tag");
    
    const errorMessage = error instanceof Error ? error.message : "Failed to delete tag";
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
