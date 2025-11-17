import { NextRequest, NextResponse } from "next/server";
import { readFileSync, existsSync } from "fs";
import path from "path";
import { getBookById } from "@/lib/db/calibre";

export async function GET(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  try {
    const CALIBRE_LIBRARY_PATH = process.env.CALIBRE_LIBRARY_PATH;

    if (!CALIBRE_LIBRARY_PATH) {
      console.error("CALIBRE_LIBRARY_PATH not configured");
      return NextResponse.json(
        { error: "CALIBRE_LIBRARY_PATH not configured" },
        { status: 500 }
      );
    }

    // Extract book ID from the first path parameter
    const bookIdStr = params.path[0];
    const bookId = parseInt(bookIdStr, 10);

    if (isNaN(bookId)) {
      console.error("Invalid book ID:", bookIdStr);
      return NextResponse.json(
        { error: "Invalid book ID" },
        { status: 400 }
      );
    }

    // Look up the book in Calibre to get its path
    const calibreBook = getBookById(bookId);

    if (!calibreBook) {
      console.error("Book not found in Calibre:", bookId);
      return NextResponse.json(
        { error: "Book not found" },
        { status: 404 }
      );
    }

    if (!calibreBook.has_cover) {
      console.error("Book has no cover:", bookId);
      return NextResponse.json(
        { error: "Book has no cover" },
        { status: 404 }
      );
    }

    // Construct the file path
    const libraryPath = CALIBRE_LIBRARY_PATH;
    const filePath = path.join(libraryPath, calibreBook.path, "cover.jpg");

    console.log("Cover request:", {
      bookId,
      libraryPath,
      bookPath: calibreBook.path,
      filePath,
    });

    // Security check: ensure the resolved path is still within the library
    const resolvedPath = path.resolve(filePath);
    const resolvedLibrary = path.resolve(libraryPath);

    if (!resolvedPath.startsWith(resolvedLibrary)) {
      console.error("Invalid path - security check failed:", {
        resolvedPath,
        resolvedLibrary,
      });
      return NextResponse.json(
        { error: "Invalid path" },
        { status: 403 }
      );
    }

    // Check if file exists
    if (!existsSync(resolvedPath)) {
      console.error("Image not found:", resolvedPath);
      return NextResponse.json(
        { error: "Image not found", path: resolvedPath },
        { status: 404 }
      );
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
    console.error("Error serving cover image:", error);
    return NextResponse.json(
      { error: "Failed to serve image" },
      { status: 500 }
    );
  }
}
