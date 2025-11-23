import { NextRequest, NextResponse } from "next/server";
import { readFileSync, existsSync } from "fs";
import path from "path";
import { getBookById } from "@/lib/db/calibre";

export const dynamic = 'force-dynamic';

// Helper function to serve the placeholder "no cover" image
function servePlaceholderImage() {
  const placeholderPath = path.join(process.cwd(), "public", "cover-fallback.png");
  const imageBuffer = readFileSync(placeholderPath);

  return new NextResponse(imageBuffer, {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}

export async function GET(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  try {
    const CALIBRE_DB_PATH = process.env.CALIBRE_DB_PATH;

    if (!CALIBRE_DB_PATH) {
      const { getLogger } = require("@/lib/logger");
      getLogger().error({ envVar: "CALIBRE_DB_PATH" }, "CALIBRE_DB_PATH not configured");
      return servePlaceholderImage();
    }

    // Extract library path from database path (metadata.db is in the library root)
    const libraryPath = path.dirname(CALIBRE_DB_PATH);

    // Extract book ID from the first path parameter
    const bookIdStr = params.path[0];
    const bookId = parseInt(bookIdStr, 10);

    if (isNaN(bookId)) {
      const { getLogger } = require("@/lib/logger");
      getLogger().error({ bookIdStr }, "Invalid book ID");
      return servePlaceholderImage();
    }

    // Look up the book in Calibre to get its path
    const calibreBook = getBookById(bookId);

    if (!calibreBook) {
      const { getLogger } = require("@/lib/logger");
      getLogger().error({ bookId }, "Book not found in Calibre");
      return servePlaceholderImage();
    }

    if (!calibreBook.has_cover) {
      const { getLogger } = require("@/lib/logger");
      getLogger().warn({ bookId }, "Book has no cover");
      return servePlaceholderImage();
    }

    // Construct the file path
    const filePath = path.join(libraryPath, calibreBook.path, "cover.jpg");

    const { getLogger } = require("@/lib/logger");
    getLogger().info({
      bookId,
      libraryPath,
      bookPath: calibreBook.path,
      filePath,
    }, "Cover request");

    // Security check: ensure the resolved path is still within the library
    const resolvedPath = path.resolve(filePath);
    const resolvedLibrary = path.resolve(libraryPath);

    if (!resolvedPath.startsWith(resolvedLibrary)) {
      getLogger().error({
        resolvedPath,
        resolvedLibrary,
      }, "Invalid path - security check failed");
      return NextResponse.json(
        { error: "Invalid path" },
        { status: 403 }
      );
    }

    // Check if file exists
    if (!existsSync(resolvedPath)) {
      const { getLogger } = require("@/lib/logger");
      getLogger().error({ resolvedPath }, "Image not found");
      return servePlaceholderImage();
    }

    // Read the file
    const imageBuffer = readFileSync(resolvedPath);

    // Determine content type based on file extension
    const ext = path.extname(resolvedPath).toLowerCase();
    let contentType = "image/jpeg";

    if (ext === ".png") {
      contentType = "image/png";
    } else if (ext === ".gif") {
      contentType = "image/gif";
    } else if (ext === ".webp") {
      contentType = "image/webp";
    }

    // Return the image
    return new NextResponse(imageBuffer, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch (error) {
    const { getLogger } = require("@/lib/logger");
    getLogger().error({ err: error }, "Error serving cover image");
    return servePlaceholderImage();
  }
}
