/**
 * Cover Storage Utility
 * 
 * Manages local filesystem storage for book cover images.
 * Covers are stored at ./data/covers/{bookId}.{ext}
 * 
 * See: specs/003-non-calibre-books/data-model.md (Cover Storage section)
 */

import { existsSync, mkdirSync, readFileSync, readdirSync, unlinkSync, writeFileSync } from "fs";
import path from "path";
import { getLogger } from "@/lib/logger";

const DATABASE_PATH = process.env.DATABASE_PATH || "./data/tome.db";
const DATA_DIR = path.dirname(DATABASE_PATH);
const COVERS_DIR = path.join(DATA_DIR, "covers");

/** Maximum file size for cover images (5MB) */
export const MAX_COVER_SIZE_BYTES = 5 * 1024 * 1024;

/** Allowed MIME types for cover images */
export const ALLOWED_COVER_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
] as const;

export type CoverMimeType = typeof ALLOWED_COVER_MIME_TYPES[number];

/** Map MIME types to file extensions */
const MIME_TO_EXT: Record<CoverMimeType, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

/** Map file extensions to MIME types */
const EXT_TO_MIME: Record<string, CoverMimeType> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
};

/**
 * Get the covers directory path.
 * Exported for testing and preflight checks.
 */
export function getCoversDir(): string {
  return COVERS_DIR;
}

/**
 * Ensure the covers directory exists. Creates it if missing.
 * Called during startup preflight checks.
 */
export function ensureCoverDirectory(): void {
  if (!existsSync(COVERS_DIR)) {
    mkdirSync(COVERS_DIR, { recursive: true });
    getLogger().info({ dir: COVERS_DIR }, "[CoverStorage] Created covers directory");
  }
}

/**
 * Save a cover image to the filesystem.
 * Replaces any existing cover for this book.
 * 
 * @param bookId - Tome book ID
 * @param buffer - Image data
 * @param mimeType - MIME type of the image
 * @returns The saved file path
 * @throws Error if MIME type is not allowed or buffer exceeds size limit
 */
export function saveCover(bookId: number, buffer: Buffer, mimeType: CoverMimeType): string {
  // Validate MIME type
  if (!ALLOWED_COVER_MIME_TYPES.includes(mimeType)) {
    throw new Error(`Unsupported cover image type: ${mimeType}. Allowed: ${ALLOWED_COVER_MIME_TYPES.join(", ")}`);
  }

  // Validate size
  if (buffer.length > MAX_COVER_SIZE_BYTES) {
    throw new Error(
      `Cover image too large: ${(buffer.length / 1024 / 1024).toFixed(1)}MB. Maximum: ${MAX_COVER_SIZE_BYTES / 1024 / 1024}MB`
    );
  }

  // Delete any existing cover (may have different extension)
  deleteExistingCover(bookId);

  // Ensure directory exists
  ensureCoverDirectory();

  const ext = MIME_TO_EXT[mimeType];
  const filePath = path.join(COVERS_DIR, `${bookId}.${ext}`);
  
  writeFileSync(filePath, buffer);
  
  getLogger().info({ bookId, filePath, size: buffer.length }, "[CoverStorage] Saved cover");

  return filePath;
}

/**
 * Get the filesystem path for a book's cover image, or null if none exists.
 * Checks all supported extensions since we don't track which format was saved.
 * 
 * @param bookId - Tome book ID
 * @returns Object with path and content type, or null if no cover exists
 */
export function getCoverPath(bookId: number): { filePath: string; contentType: CoverMimeType } | null {
  for (const [ext, mime] of Object.entries(EXT_TO_MIME)) {
    const filePath = path.join(COVERS_DIR, `${bookId}${ext}`);
    if (existsSync(filePath)) {
      return { filePath, contentType: mime };
    }
  }
  return null;
}

/**
 * Check if a cover image exists for a book.
 * 
 * @param bookId - Tome book ID
 * @returns true if a cover file exists
 */
export function hasCover(bookId: number): boolean {
  return getCoverPath(bookId) !== null;
}

/**
 * Delete the cover image for a book.
 * No-op if no cover exists.
 * 
 * @param bookId - Tome book ID
 */
export function deleteCover(bookId: number): void {
  deleteExistingCover(bookId);
  getLogger().debug({ bookId }, "[CoverStorage] Deleted cover (if existed)");
}

/**
 * Read a cover image from the filesystem.
 * 
 * @param bookId - Tome book ID
 * @returns Object with buffer and content type, or null if no cover exists
 */
export function readCover(bookId: number): { buffer: Buffer; contentType: CoverMimeType } | null {
  const coverInfo = getCoverPath(bookId);
  if (!coverInfo) {
    return null;
  }

  try {
    const buffer = readFileSync(coverInfo.filePath);
    return { buffer, contentType: coverInfo.contentType };
  } catch (error) {
    getLogger().error({ err: error, bookId, filePath: coverInfo.filePath }, "[CoverStorage] Failed to read cover");
    return null;
  }
}

/**
 * Internal helper: delete any existing cover file for a bookId
 * (searches all supported extensions)
 */
function deleteExistingCover(bookId: number): void {
  for (const ext of Object.keys(EXT_TO_MIME)) {
    const filePath = path.join(COVERS_DIR, `${bookId}${ext}`);
    if (existsSync(filePath)) {
      try {
        unlinkSync(filePath);
      } catch (error) {
        getLogger().error({ err: error, filePath }, "[CoverStorage] Failed to delete existing cover");
      }
    }
  }
}

/**
 * Determine MIME type from a Content-Type header value.
 * Strips charset and parameters.
 * 
 * @param contentType - Content-Type header value (e.g. "image/jpeg; charset=utf-8")
 * @returns Validated CoverMimeType, or null if not a valid cover type
 */
export function parseCoverMimeType(contentType: string): CoverMimeType | null {
  const mimeType = contentType.split(";")[0].trim().toLowerCase();
  if (ALLOWED_COVER_MIME_TYPES.includes(mimeType as CoverMimeType)) {
    return mimeType as CoverMimeType;
  }
  return null;
}

/**
 * Determine MIME type from a file extension.
 * 
 * @param ext - File extension with or without leading dot (e.g. "jpg" or ".jpg")
 * @returns CoverMimeType, or null if not a supported format
 */
export function mimeTypeFromExtension(ext: string): CoverMimeType | null {
  const normalizedExt = ext.startsWith(".") ? ext.toLowerCase() : `.${ext.toLowerCase()}`;
  return EXT_TO_MIME[normalizedExt] ?? null;
}
