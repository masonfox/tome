/**
 * Image URL Fetching Utility
 * 
 * Fetches images from URLs for use in manual book cover uploads.
 * Validates content type and size before returning blob.
 */

/** Max cover file size in bytes (5MB) */
export const MAX_COVER_SIZE_BYTES = 5 * 1024 * 1024;

/** Accepted cover MIME types */
export const ACCEPTED_COVER_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
];

/** Fetch timeout in milliseconds (10 seconds) */
const FETCH_TIMEOUT_MS = 10000;

/**
 * Custom error class for image fetch failures
 */
export class ImageFetchError extends Error {
  constructor(
    message: string,
    public readonly code:
      | "INVALID_URL"
      | "NETWORK_ERROR"
      | "HTTP_ERROR"
      | "INVALID_CONTENT_TYPE"
      | "FILE_TOO_LARGE"
      | "TIMEOUT"
      | "CORS_ERROR"
  ) {
    super(message);
    this.name = "ImageFetchError";
  }
}

/**
 * Validate URL format
 */
function isValidUrl(urlString: string): boolean {
  try {
    const url = new URL(urlString);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * Fetch image from URL with timeout
 */
async function fetchWithTimeout(
  url: string,
  timeoutMs: number
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      // Add common headers to avoid basic bot detection
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; Tome Book Tracker)",
      },
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    if ((error as Error).name === "AbortError") {
      throw new ImageFetchError(
        `Request timed out after ${timeoutMs / 1000} seconds`,
        "TIMEOUT"
      );
    }
    throw error;
  }
}

/**
 * Fetch an image from a URL and return it as a Blob
 * 
 * @param url - The URL of the image to fetch
 * @returns Promise<Blob> - The image as a Blob with proper MIME type
 * @throws ImageFetchError - If fetch fails for any reason
 * 
 * @example
 * ```ts
 * try {
 *   const blob = await fetchImageFromUrl("https://example.com/cover.jpg");
 *   const file = new File([blob], "cover.jpg", { type: blob.type });
 *   // Use file for upload...
 * } catch (error) {
 *   if (error instanceof ImageFetchError) {
 *     console.error(`Failed to fetch image: ${error.message} (${error.code})`);
 *   }
 * }
 * ```
 */
export async function fetchImageFromUrl(url: string): Promise<Blob> {
  // Validate URL format
  if (!url.trim()) {
    throw new ImageFetchError("URL is empty", "INVALID_URL");
  }

  if (!isValidUrl(url)) {
    throw new ImageFetchError(
      "Invalid URL format (must start with http:// or https://)",
      "INVALID_URL"
    );
  }

  let response: Response;

  try {
    // Fetch with timeout
    response = await fetchWithTimeout(url, FETCH_TIMEOUT_MS);
  } catch (error) {
    // Already an ImageFetchError (timeout)
    if (error instanceof ImageFetchError) {
      throw error;
    }

    // Network error or CORS
    const errorMessage = (error as Error).message.toLowerCase();
    if (
      errorMessage.includes("cors") ||
      errorMessage.includes("cross-origin")
    ) {
      throw new ImageFetchError(
        "Cannot load image due to CORS restrictions. Try downloading the image and uploading the file instead.",
        "CORS_ERROR"
      );
    }

    throw new ImageFetchError(
      `Network error: ${(error as Error).message}`,
      "NETWORK_ERROR"
    );
  }

  // Check HTTP status
  if (!response.ok) {
    throw new ImageFetchError(
      `HTTP error ${response.status}: ${response.statusText}`,
      "HTTP_ERROR"
    );
  }

  // Validate Content-Type
  const contentType = response.headers.get("Content-Type");
  if (!contentType || !ACCEPTED_COVER_TYPES.some((type) => contentType.startsWith(type))) {
    throw new ImageFetchError(
      `Invalid content type: ${contentType || "unknown"}. Expected image (JPEG, PNG, WebP, or GIF).`,
      "INVALID_CONTENT_TYPE"
    );
  }

  // Check Content-Length if available (some servers don't send it)
  const contentLength = response.headers.get("Content-Length");
  if (contentLength) {
    const size = parseInt(contentLength, 10);
    if (size > MAX_COVER_SIZE_BYTES) {
      throw new ImageFetchError(
        `Image too large: ${(size / 1024 / 1024).toFixed(1)}MB. Maximum: ${MAX_COVER_SIZE_BYTES / 1024 / 1024}MB`,
        "FILE_TOO_LARGE"
      );
    }
  }

  // Download the blob
  let blob: Blob;
  try {
    blob = await response.blob();
  } catch (error) {
    throw new ImageFetchError(
      `Failed to download image: ${(error as Error).message}`,
      "NETWORK_ERROR"
    );
  }

  // Validate actual blob size (in case Content-Length was missing)
  if (blob.size > MAX_COVER_SIZE_BYTES) {
    throw new ImageFetchError(
      `Image too large: ${(blob.size / 1024 / 1024).toFixed(1)}MB. Maximum: ${MAX_COVER_SIZE_BYTES / 1024 / 1024}MB`,
      "FILE_TOO_LARGE"
    );
  }

  if (blob.size === 0) {
    throw new ImageFetchError("Image is empty (0 bytes)", "INVALID_CONTENT_TYPE");
  }

  return blob;
}

/**
 * Convert blob to File object with appropriate filename
 * 
 * @param blob - The blob to convert
 * @param url - Original URL (used to infer filename)
 * @returns File object ready for FormData upload
 */
export function blobToFile(blob: Blob, url: string): File {
  // Try to extract filename from URL
  let filename = "cover";
  try {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname;
    const lastSegment = pathname.split("/").filter(Boolean).pop();
    if (lastSegment && lastSegment.length > 0) {
      filename = lastSegment;
    }
  } catch {
    // If URL parsing fails, use default
  }

  // Ensure filename has proper extension based on blob type
  const ext = blob.type.split("/")[1] || "jpg";
  if (!filename.includes(".")) {
    filename = `${filename}.${ext}`;
  }

  return new File([blob], filename, { type: blob.type });
}
