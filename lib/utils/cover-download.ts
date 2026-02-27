/**
 * Cover Download Utility
 * 
 * Downloads cover images from external URLs (provider search results).
 * Validates MIME type and file size before returning the buffer.
 * 
 * See: specs/003-non-calibre-books/data-model.md (Cover Ingestion Flows)
 */

import { getLogger } from "@/lib/logger";
import {
  MAX_COVER_SIZE_BYTES,
  ALLOWED_COVER_MIME_TYPES,
  parseCoverMimeType,
  type CoverMimeType,
} from "@/lib/utils/cover-storage";

/** Download timeout in milliseconds */
const DOWNLOAD_TIMEOUT_MS = 10_000;

export interface DownloadedCover {
  buffer: Buffer;
  mimeType: CoverMimeType;
}

/**
 * Download a cover image from a URL.
 * 
 * Features:
 * - 10-second timeout via AbortSignal
 * - MIME type validation (JPEG, PNG, WebP, GIF)
 * - Size validation (5MB max)
 * - Content-Type header sniffing with magic-byte fallback
 * 
 * @param url - The URL to download from
 * @returns Downloaded cover data, or null if download fails for any reason
 */
export async function downloadCover(url: string): Promise<DownloadedCover | null> {
  const logger = getLogger();

  try {
    // Validate URL
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
    } catch {
      logger.warn({ url }, "[CoverDownload] Invalid URL");
      return null;
    }

    // Only allow http/https
    if (!["http:", "https:"].includes(parsedUrl.protocol)) {
      logger.warn({ url, protocol: parsedUrl.protocol }, "[CoverDownload] Unsupported protocol");
      return null;
    }

    // Fetch with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), DOWNLOAD_TIMEOUT_MS);

    let response: Response;
    try {
      response = await fetch(url, {
        signal: controller.signal,
        headers: {
          "User-Agent": "Tome/1.0 (Book Tracker)",
          "Accept": "image/*",
        },
      });
    } catch (error: unknown) {
      if (error instanceof Error && error.name === "AbortError") {
        logger.warn({ url, timeoutMs: DOWNLOAD_TIMEOUT_MS }, "[CoverDownload] Request timed out");
      } else {
        logger.warn({ url, err: error }, "[CoverDownload] Fetch failed");
      }
      return null;
    } finally {
      clearTimeout(timeoutId);
    }

    if (!response.ok) {
      logger.warn({ url, status: response.status }, "[CoverDownload] Non-OK response");
      return null;
    }

    // Check Content-Length header if available (early rejection)
    const contentLength = response.headers.get("content-length");
    if (contentLength && parseInt(contentLength, 10) > MAX_COVER_SIZE_BYTES) {
      logger.warn(
        { url, contentLength, maxBytes: MAX_COVER_SIZE_BYTES },
        "[CoverDownload] Content-Length exceeds maximum"
      );
      return null;
    }

    // Read response body
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Validate actual size
    if (buffer.length > MAX_COVER_SIZE_BYTES) {
      logger.warn(
        { url, size: buffer.length, maxBytes: MAX_COVER_SIZE_BYTES },
        "[CoverDownload] Downloaded file exceeds maximum size"
      );
      return null;
    }

    if (buffer.length === 0) {
      logger.warn({ url }, "[CoverDownload] Empty response body");
      return null;
    }

    // Determine MIME type from Content-Type header, then fall back to magic bytes
    const contentType = response.headers.get("content-type");
    let mimeType: CoverMimeType | null = null;

    if (contentType) {
      mimeType = parseCoverMimeType(contentType);
    }

    // If Content-Type didn't give us a valid type, try magic bytes
    if (!mimeType) {
      mimeType = detectMimeTypeFromBytes(buffer);
    }

    if (!mimeType) {
      logger.warn(
        { url, contentType },
        "[CoverDownload] Unsupported image format (not JPEG/PNG/WebP/GIF)"
      );
      return null;
    }

    logger.info(
      { url, size: buffer.length, mimeType },
      "[CoverDownload] Successfully downloaded cover"
    );

    return { buffer, mimeType };
  } catch (error) {
    logger.error({ err: error, url }, "[CoverDownload] Unexpected error");
    return null;
  }
}

/**
 * Detect image MIME type from magic bytes (file signature).
 * 
 * @param buffer - Image data buffer
 * @returns Detected CoverMimeType, or null if unrecognized
 */
function detectMimeTypeFromBytes(buffer: Buffer): CoverMimeType | null {
  if (buffer.length < 4) return null;

  // JPEG: FF D8 FF
  if (buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) {
    return "image/jpeg";
  }

  // PNG: 89 50 4E 47
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) {
    return "image/png";
  }

  // GIF: 47 49 46 38
  if (buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x38) {
    return "image/gif";
  }

  // WebP: 52 49 46 46 ... 57 45 42 50
  if (
    buffer.length >= 12 &&
    buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46 &&
    buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50
  ) {
    return "image/webp";
  }

  return null;
}
