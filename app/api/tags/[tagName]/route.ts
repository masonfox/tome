import { NextRequest, NextResponse } from "next/server";
import { tagService } from "@/lib/services";

export const dynamic = 'force-dynamic';

/**
 * GET /api/tags/:tagName
 * Get all books with a specific tag
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { tagName: string } }
) {
  try {
    const tagName = decodeURIComponent(params.tagName);
    
    // Parse pagination params
    const searchParams = request.nextUrl.searchParams;
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const skip = parseInt(searchParams.get('skip') || '0', 10);

    const { books, total } = await tagService.getBooksByTag(tagName, limit, skip);

    return NextResponse.json({ tag: tagName, books, total });
  } catch (error) {
    const { getLogger } = require("@/lib/logger");
    getLogger().error({ err: error, tagName: params.tagName }, "Error fetching books by tag");
    return NextResponse.json({ error: "Failed to fetch books" }, { status: 500 });
  }
}

/**
 * PATCH /api/tags/:tagName
 * Rename a tag across all books
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { tagName: string } }
) {
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
      oldName: tagName,
      newName,
      booksUpdated: result.booksUpdated,
    });
  } catch (error) {
    const { getLogger } = require("@/lib/logger");
    getLogger().error({ err: error, tagName: params.tagName }, "Error renaming tag");
    return NextResponse.json({ error: "Failed to rename tag" }, { status: 500 });
  }
}

/**
 * DELETE /api/tags/:tagName
 * Delete a tag from all books
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { tagName: string } }
) {
  try {
    const tagName = decodeURIComponent(params.tagName);

    const result = await tagService.deleteTag(tagName);

    return NextResponse.json({
      deletedTag: tagName,
      booksUpdated: result.booksUpdated,
    });
  } catch (error) {
    const { getLogger } = require("@/lib/logger");
    getLogger().error({ err: error, tagName: params.tagName }, "Error deleting tag");
    return NextResponse.json({ error: "Failed to delete tag" }, { status: 500 });
  }
}
