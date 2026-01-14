import { getLogger } from "@/lib/logger";
import { NextRequest, NextResponse } from "next/server";
import { readFileSync, existsSync } from "fs";
import path from "path";
import { getBookById } from "@/lib/db/calibre";
import { CACHE_CONFIG } from "@/lib/constants";

export const dynamic = 'force-dynamic';

// LRU Cache for cover images
interface CoverCacheEntry {
  buffer: Buffer;
  contentType: string;
  timestamp: number;
}

class CoverCache {
  private cache = new Map<number, CoverCacheEntry>();
  private maxSize = CACHE_CONFIG.COVER_CACHE.MAX_SIZE;
  private maxAge = CACHE_CONFIG.COVER_CACHE.MAX_AGE_MS;

  get(bookId: number): CoverCacheEntry | null {
    const entry = this.cache.get(bookId);
    if (!entry) return null;

    // Check if expired
    if (Date.now() - entry.timestamp > this.maxAge) {
      this.cache.delete(bookId);
      return null;
    }

    return entry;
  }

  set(bookId: number, buffer: Buffer, contentType: string): void {
    // Implement LRU by deleting oldest entries when at capacity
    if (this.cache.size >= this.maxSize) {
      // Delete oldest entry (first entry in Map)
      const firstKey = this.cache.keys().next().value;
      if (firstKey !== undefined) {
        this.cache.delete(firstKey);
      }
    }

    this.cache.set(bookId, {
      buffer,
      contentType,
      timestamp: Date.now(),
    });
  }

  clear(): void {
    this.cache.clear();
  }

  getSize(): number {
    return this.cache.size;
  }
}

// Global cache instance
const coverCache = new CoverCache();

// Cache for book path lookups (avoid repeated Calibre DB queries)
interface BookPathCacheEntry {
  path: string;
  hasCover: boolean;
  timestamp: number;
}

class BookPathCache {
  private cache = new Map<number, BookPathCacheEntry>();
  private maxSize = CACHE_CONFIG.BOOK_PATH_CACHE.MAX_SIZE;
  private maxAge = CACHE_CONFIG.BOOK_PATH_CACHE.MAX_AGE_MS;

  get(bookId: number): BookPathCacheEntry | null {
    const entry = this.cache.get(bookId);
    if (!entry) return null;

    if (Date.now() - entry.timestamp > this.maxAge) {
      this.cache.delete(bookId);
      return null;
    }

    return entry;
  }

  set(bookId: number, path: string, hasCover: boolean): void {
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey !== undefined) {
        this.cache.delete(firstKey);
      }
    }

    this.cache.set(bookId, {
      path,
      hasCover,
      timestamp: Date.now(),
    });
  }

  clear(): void {
    this.cache.clear();
  }
}

const bookPathCache = new BookPathCache();

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

export async function GET(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  // NOTE: Query params like ?t=<timestamp> are used for cache busting on the client
  // but are intentionally ignored by the server. The server caches by bookId only.
  const params = await props.params;
  try {
    const CALIBRE_DB_PATH = process.env.CALIBRE_DB_PATH;

    if (!CALIBRE_DB_PATH) {
      getLogger().error({ envVar: "CALIBRE_DB_PATH" }, "CALIBRE_DB_PATH not configured");
      return servePlaceholderImage();
    }

    // Extract library path from database path (metadata.db is in the library root)
    const libraryPath = path.dirname(CALIBRE_DB_PATH);

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

    // Check book path cache to avoid Calibre DB query
    let bookPath: string;
    let hasCover: boolean;
    
    const cachedBookPath = bookPathCache.get(bookId);
    if (cachedBookPath) {
      bookPath = cachedBookPath.path;
      hasCover = cachedBookPath.hasCover;
      
      if (!hasCover) {
        return servePlaceholderImage();
      }
    } else {
      // Look up the book in Calibre to get its path
      const calibreBook = getBookById(bookId);

      if (!calibreBook) {
        getLogger().error({ bookId }, "Book not found in Calibre");
        return servePlaceholderImage();
      }

      bookPath = calibreBook.path;
      hasCover = Boolean(calibreBook.has_cover);

      // Cache the book path lookup
      bookPathCache.set(bookId, bookPath, hasCover);

      if (!hasCover) {
        getLogger().warn({ bookId }, "Book has no cover");
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

    // Cache the cover image for future requests
    coverCache.set(bookId, imageBuffer, contentType);

    // Return the image
    return new NextResponse(new Uint8Array(imageBuffer), {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=604800", // 1 week
        "X-Cache": "MISS",
      },
    });
  } catch (error) {
    getLogger().error({ err: error }, "Error serving cover image");
    return servePlaceholderImage();
  }
}

// Exported cache management functions for use during Calibre sync
export function clearCoverCache(): void {
  coverCache.clear();
}

export function clearBookPathCache(): void {
  bookPathCache.clear();
}
