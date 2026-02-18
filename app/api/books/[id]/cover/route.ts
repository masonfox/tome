import { getLogger } from "@/lib/logger";
import { NextRequest, NextResponse } from "next/server";
import { readFileSync, existsSync } from "fs";
import path from "path";
import { getBookById as getCalibreBookById } from "@/lib/db/calibre";
import { bookRepository, bookSourceRepository } from "@/lib/repositories";
import {
  readCover,
  saveCover,
  parseCoverMimeType,
  MAX_COVER_SIZE_BYTES,
  ALLOWED_COVER_MIME_TYPES,
  type CoverMimeType,
} from "@/lib/utils/cover-storage";
import {
  coverCache,
  bookPathCache,
  clearCoverCache,
  clearBookPathCache,
  getCoverCacheStats,
  getBookPathCacheStats,
  type CacheStats,
} from "@/lib/cache/cover-cache";
import { downloadCover } from "@/lib/utils/cover-download";

export const dynamic = 'force-dynamic';

// Re-export cache functions for backward compatibility
export { clearCoverCache, clearBookPathCache, getCoverCacheStats, getBookPathCacheStats, type CacheStats };

// Helper function to serve the placeholder "no cover" image
function servePlaceholderImage() {
  const placeholderPath = path.join(process.cwd(), "public", "cover-fallback.png");
  const imageBuffer = readFileSync(placeholderPath);

  return new NextResponse(new Uint8Array(imageBuffer), {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=604800", // 1 week
    },
  });
}

/**
 * Serve a cover image for a book.
 * 
 * Unified route: accepts Tome book ID, routes to:
 * - Local books: local filesystem at ./data/covers/{bookId}.{ext}
 * - Calibre books: Calibre library path via calibreId lookup
 * 
 * Cache busting: Clients append ?t=<timestamp> which is ignored server-side.
 * Server-side caching uses bookId as key.
 */
export async function GET(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    // Extract book ID from params
    const bookId = parseInt(params.id, 10);

    if (isNaN(bookId)) {
      getLogger().error({ bookId: params.id }, "Invalid book ID");
      return servePlaceholderImage();
    }

    // Check cover cache first (PERFORMANCE OPTIMIZATION)
    const cachedCover = coverCache.get(bookId);
    if (cachedCover) {
      return new NextResponse(new Uint8Array(cachedCover.buffer), {
        headers: {
          "Content-Type": cachedCover.contentType,
          "Cache-Control": "public, max-age=604800", // 1 week
          "X-Cache": "HIT",
        },
      });
    }

    // Look up book in Tome DB to determine source
    const book = await bookRepository.findById(bookId);

    if (!book) {
      getLogger().debug({ bookId }, "Book not found in Tome DB");
      return servePlaceholderImage();
    }

    // Route based on book source
    // Local books have no entries in book_sources table
    const hasAnySources = await bookSourceRepository.hasAnySources(bookId);
    
    if (!hasAnySources) {
      return serveLocalBookCover(bookId);
    } else {
      return serveCalibreBookCover(bookId, book.calibreId);
    }
  } catch (error) {
    getLogger().error({ err: error }, "Error serving cover image");
    return servePlaceholderImage();
  }
}

/**
 * Serve a cover from local filesystem storage (local books).
 */
function serveLocalBookCover(bookId: number): NextResponse {
  const cover = readCover(bookId);

  if (!cover) {
    return servePlaceholderImage();
  }

  // Cache the cover image for future requests
  coverCache.set(bookId, cover.buffer, cover.contentType);

  return new NextResponse(new Uint8Array(cover.buffer), {
    headers: {
      "Content-Type": cover.contentType,
      "Cache-Control": "public, max-age=604800", // 1 week
      "X-Cache": "MISS",
    },
  });
}

/**
 * Serve a cover from Calibre library path (calibre books).
 */
function serveCalibreBookCover(bookId: number, calibreId: number | null): NextResponse {
  const CALIBRE_DB_PATH = process.env.CALIBRE_DB_PATH;

  if (!CALIBRE_DB_PATH) {
    getLogger().error({ envVar: "CALIBRE_DB_PATH" }, "CALIBRE_DB_PATH not configured");
    return servePlaceholderImage();
  }

  if (calibreId === null) {
    getLogger().error({ bookId }, "Calibre book has no calibreId");
    return servePlaceholderImage();
  }

  // Extract library path from database path (metadata.db is in the library root)
  const libraryPath = path.dirname(CALIBRE_DB_PATH);

  // Check book path cache to avoid Calibre DB query
  let bookPath: string;
  let hasCover: boolean;

  const cachedBookPath = bookPathCache.get(calibreId);
  if (cachedBookPath) {
    bookPath = cachedBookPath.path;
    hasCover = cachedBookPath.hasCover;

    if (!hasCover) {
      return servePlaceholderImage();
    }
  } else {
    // Look up the book in Calibre to get its path
    const calibreBook = getCalibreBookById(calibreId);

    if (!calibreBook) {
      getLogger().error({ bookId, calibreId }, "Book not found in Calibre");
      return servePlaceholderImage();
    }

    bookPath = calibreBook.path;
    hasCover = Boolean(calibreBook.has_cover);

    // Cache the book path lookup (keyed by calibreId for Calibre books)
    bookPathCache.set(calibreId, bookPath, hasCover);

    if (!hasCover) {
      getLogger().warn({ bookId, calibreId }, "Book has no cover in Calibre");
      return servePlaceholderImage();
    }
  }

  // Construct the file path
  const filePath = path.join(libraryPath, bookPath, "cover.jpg");

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

  // Cache the cover image for future requests (keyed by Tome bookId)
  coverCache.set(bookId, imageBuffer, contentType);

  // Return the image
  return new NextResponse(new Uint8Array(imageBuffer), {
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=604800", // 1 week
      "X-Cache": "MISS",
    },
  });
}

/**
 * Upload a cover image for a book.
 * 
 * Accepts multipart form data with either:
 * - A `cover` file field (direct file upload), OR
 * - A `coverUrl` text field (server-side download from URL)
 * 
 * Validates file type (JPEG, PNG, WebP, GIF) and size (max 5MB).
 * Replaces any existing cover for this book.
 * Invalidates the cover cache for this book.
 */
export async function POST(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const logger = getLogger();

  try {
    const bookId = parseInt(params.id, 10);

    if (isNaN(bookId)) {
      return NextResponse.json({ error: "Invalid book ID" }, { status: 400 });
    }

    // Verify book exists
    const book = await bookRepository.findById(bookId);
    if (!book) {
      return NextResponse.json({ error: "Book not found" }, { status: 404 });
    }

    // Parse multipart form data
    const formData = await request.formData();
    const file = formData.get("cover");
    const coverUrl = formData.get("coverUrl");

    let buffer: Buffer;
    let mimeType: CoverMimeType;

    // Option 1: Direct file upload
    if (file && file instanceof File && file.size > 0) {
      // Validate file size
      if (file.size > MAX_COVER_SIZE_BYTES) {
        return NextResponse.json(
          {
            error: `File too large: ${(file.size / 1024 / 1024).toFixed(1)}MB. Maximum: ${MAX_COVER_SIZE_BYTES / 1024 / 1024}MB`,
          },
          { status: 400 }
        );
      }

      // Determine MIME type from file type or Content-Type
      const parsedMimeType = file.type ? parseCoverMimeType(file.type) : null;

      if (!parsedMimeType) {
        return NextResponse.json(
          {
            error: `Unsupported file type: ${file.type || "unknown"}. Allowed: ${ALLOWED_COVER_MIME_TYPES.join(", ")}`,
          },
          { status: 400 }
        );
      }

      // Read file data
      const arrayBuffer = await file.arrayBuffer();
      buffer = Buffer.from(arrayBuffer);
      mimeType = parsedMimeType;
    }
    // Option 2: Server-side download from URL
    else if (coverUrl && typeof coverUrl === "string" && coverUrl.trim()) {
      logger.info({ bookId, coverUrl }, "[CoverUpload] Downloading cover from URL");

      const downloaded = await downloadCover(coverUrl.trim());

      if (!downloaded) {
        return NextResponse.json(
          { error: "Failed to download image from URL. Please check the URL and try again." },
          { status: 400 }
        );
      }

      buffer = downloaded.buffer;
      mimeType = downloaded.mimeType;

      logger.info(
        { bookId, coverUrl, size: buffer.length, mimeType },
        "[CoverUpload] Cover downloaded from URL successfully"
      );
    }
    // Neither file nor URL provided
    else {
      return NextResponse.json(
        { error: "Missing 'cover' file or 'coverUrl' in form data" },
        { status: 400 }
      );
    }

    // Save cover (replaces existing)
    const filePath = saveCover(bookId, buffer, mimeType);

    // Update book's updatedAt timestamp to invalidate cache-busted cover URLs
    await bookRepository.update(bookId, { updatedAt: new Date() } as any);

    // Invalidate cover cache for this book
    coverCache.set(bookId, buffer, mimeType);

    logger.info(
      { bookId, mimeType, size: buffer.length, filePath },
      "[CoverUpload] Cover uploaded successfully"
    );

    return NextResponse.json(
      { success: true, bookId, mimeType, size: buffer.length },
      { status: 200 }
    );
  } catch (error) {
    logger.error({ err: error }, "[CoverUpload] Error uploading cover");
    return NextResponse.json(
      { error: "Failed to upload cover" },
      { status: 500 }
    );
  }
}
