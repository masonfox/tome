/**
 * Tests for Image URL Fetching Utility
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  fetchImageFromUrl,
  blobToFile,
  ImageFetchError,
  MAX_COVER_SIZE_BYTES,
  ACCEPTED_COVER_TYPES,
} from "@/lib/utils/fetch-image-url";

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch as any;

describe("fetchImageFromUrl", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("URL validation", () => {
    it("should reject empty URL", async () => {
      await expect(fetchImageFromUrl("")).rejects.toThrow(ImageFetchError);
      await expect(fetchImageFromUrl("")).rejects.toThrow("URL is empty");
    });

    it("should reject invalid URL format", async () => {
      await expect(fetchImageFromUrl("not-a-url")).rejects.toThrow(
        ImageFetchError
      );
      await expect(fetchImageFromUrl("not-a-url")).rejects.toThrow(
        "Invalid URL format"
      );
    });

    it("should reject non-http(s) protocols", async () => {
      await expect(fetchImageFromUrl("ftp://example.com/image.jpg")).rejects.toThrow(
        ImageFetchError
      );
      await expect(fetchImageFromUrl("file:///path/to/image.jpg")).rejects.toThrow(
        ImageFetchError
      );
    });

    it("should accept valid http URL", async () => {
      const mockBlob = new Blob(["fake image data"], { type: "image/jpeg" });
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: {
          get: (key: string) => {
            if (key === "Content-Type") return "image/jpeg";
            if (key === "Content-Length") return "1024";
            return null;
          }
        },
        blob: async () => mockBlob,
      });

      const result = await fetchImageFromUrl("http://example.com/image.jpg");
      expect(result).toBeInstanceOf(Blob);
    });

    it("should accept valid https URL", async () => {
      const mockBlob = new Blob(["fake image data"], { type: "image/png" });
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: {
          get: (key: string) => {
            if (key === "Content-Type") return "image/png";
            if (key === "Content-Length") return "2048";
            return null;
          }
        },
        blob: async () => mockBlob,
      });

      const result = await fetchImageFromUrl("https://example.com/image.png");
      expect(result).toBeInstanceOf(Blob);
    });
  });

  describe("Network errors", () => {
    it("should handle network error", async () => {
      mockFetch.mockRejectedValueOnce(new Error("Network failure"));

      try {
        await fetchImageFromUrl("https://example.com/image.jpg");
        expect.fail("Should have thrown an error");
      } catch (error) {
        expect(error).toBeInstanceOf(ImageFetchError);
        expect((error as ImageFetchError).code).toBe("NETWORK_ERROR");
      }
    });

    it("should handle CORS error", async () => {
      mockFetch.mockRejectedValueOnce(
        new Error("CORS policy blocked request")
      );

      try {
        await fetchImageFromUrl("https://example.com/image.jpg");
        expect.fail("Should have thrown an error");
      } catch (error) {
        expect(error).toBeInstanceOf(ImageFetchError);
        expect((error as ImageFetchError).code).toBe("CORS_ERROR");
        expect((error as ImageFetchError).message).toContain("CORS");
      }
    });

    it.skip("should handle timeout", async () => {
      // Mock a fetch that never resolves
      mockFetch.mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            // Never resolve - will be aborted by timeout
          })
      );

      // Note: This test might take up to FETCH_TIMEOUT_MS
      await expect(
        fetchImageFromUrl("https://slow-server.com/image.jpg")
      ).rejects.toThrow(ImageFetchError);
    }, 15000); // Increase test timeout
  });

  describe("HTTP errors", () => {
    it("should handle 404 error", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: "Not Found",
      });

      try {
        await fetchImageFromUrl("https://example.com/missing.jpg");
        expect.fail("Should have thrown an error");
      } catch (error) {
        expect(error).toBeInstanceOf(ImageFetchError);
        expect((error as ImageFetchError).code).toBe("HTTP_ERROR");
        expect((error as ImageFetchError).message).toContain("404");
      }
    });

    it("should handle 500 error", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: "Internal Server Error",
      });

      await expect(
        fetchImageFromUrl("https://example.com/error.jpg")
      ).rejects.toThrow(ImageFetchError);
    });
  });

  describe("Content-Type validation", () => {
    it("should accept image/jpeg", async () => {
      const mockBlob = new Blob(["data"], { type: "image/jpeg" });
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: {
          get: (key: string) => key === "Content-Type" ? "image/jpeg" : null
        },
        blob: async () => mockBlob,
      });

      const result = await fetchImageFromUrl("https://example.com/image.jpg");
      expect(result.type).toBe("image/jpeg");
    });

    it("should accept image/png", async () => {
      const mockBlob = new Blob(["data"], { type: "image/png" });
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: {
          get: (key: string) => key === "Content-Type" ? "image/png" : null
        },
        blob: async () => mockBlob,
      });

      const result = await fetchImageFromUrl("https://example.com/image.png");
      expect(result.type).toBe("image/png");
    });

    it("should accept image/webp", async () => {
      const mockBlob = new Blob(["data"], { type: "image/webp" });
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: {
          get: (key: string) => key === "Content-Type" ? "image/webp" : null
        },
        blob: async () => mockBlob,
      });

      const result = await fetchImageFromUrl("https://example.com/image.webp");
      expect(result.type).toBe("image/webp");
    });

    it("should accept image/gif", async () => {
      const mockBlob = new Blob(["data"], { type: "image/gif" });
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: {
          get: (key: string) => key === "Content-Type" ? "image/gif" : null
        },
        blob: async () => mockBlob,
      });

      const result = await fetchImageFromUrl("https://example.com/image.gif");
      expect(result.type).toBe("image/gif");
    });

    it("should reject non-image content type", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: {
          get: (key: string) => key === "Content-Type" ? "text/html" : null
        },
        blob: async () => new Blob(["<html>"], { type: "text/html" }),
      });
      
      try {
        await fetchImageFromUrl("https://example.com/page.html");
        expect.fail("Should have thrown an error");
      } catch (error) {
        expect(error).toBeInstanceOf(ImageFetchError);
        expect((error as ImageFetchError).code).toBe("INVALID_CONTENT_TYPE");
      }
    });

    it("should reject missing content type", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: {
          get: () => null
        },
        blob: async () => new Blob(["data"]),
      });

      await expect(
        fetchImageFromUrl("https://example.com/unknown")
      ).rejects.toThrow(ImageFetchError);
    });
  });

  describe("Size validation", () => {
    it("should accept file within size limit", async () => {
      const data = "x".repeat(1024 * 1024); // 1MB
      const mockBlob = new Blob([data], { type: "image/jpeg" });
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: {
          get: (key: string) => {
            if (key === "Content-Type") return "image/jpeg";
            if (key === "Content-Length") return String(mockBlob.size);
            return null;
          }
        },
        blob: async () => mockBlob,
      });

      const result = await fetchImageFromUrl("https://example.com/image.jpg");
      expect(result.size).toBe(mockBlob.size);
    });

    it("should reject file exceeding size limit (via Content-Length)", async () => {
      const tooLarge = MAX_COVER_SIZE_BYTES + 1;
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: {
          get: (key: string) => {
            if (key === "Content-Type") return "image/jpeg";
            if (key === "Content-Length") return String(tooLarge);
            return null;
          }
        },
        blob: async () => new Blob(["x".repeat(tooLarge)], { type: "image/jpeg" }),
      });
      
      try {
        await fetchImageFromUrl("https://example.com/huge.jpg");
        expect.fail("Should have thrown an error");
      } catch (error) {
        expect(error).toBeInstanceOf(ImageFetchError);
        expect((error as ImageFetchError).code).toBe("FILE_TOO_LARGE");
      }
    });

    it("should reject file exceeding size limit (via blob size)", async () => {
      const tooLarge = MAX_COVER_SIZE_BYTES + 1;
      const mockBlob = new Blob(["x".repeat(tooLarge)], { type: "image/jpeg" });
      
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: {
          get: (key: string) => {
            if (key === "Content-Type") return "image/jpeg";
            // No Content-Length header
            return null;
          }
        },
        blob: async () => mockBlob,
      });

      await expect(
        fetchImageFromUrl("https://example.com/huge.jpg")
      ).rejects.toThrow(ImageFetchError);
    });

    it("should reject empty blob", async () => {
      const mockBlob = new Blob([], { type: "image/jpeg" });
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: {
          get: (key: string) => key === "Content-Type" ? "image/jpeg" : null
        },
        blob: async () => mockBlob,
      });

      await expect(
        fetchImageFromUrl("https://example.com/empty.jpg")
      ).rejects.toThrow(ImageFetchError);
    });
  });
});

describe("blobToFile", () => {
  it("should convert blob to file with correct type", () => {
    const blob = new Blob(["data"], { type: "image/jpeg" });
    const file = blobToFile(blob, "https://example.com/test.jpg");

    expect(file).toBeInstanceOf(File);
    expect(file.type).toBe("image/jpeg");
    expect(file.size).toBe(blob.size);
  });

  it("should extract filename from URL", () => {
    const blob = new Blob(["data"], { type: "image/png" });
    const file = blobToFile(blob, "https://example.com/path/to/cover.png");

    expect(file.name).toBe("cover.png");
  });

  it("should use default filename if URL has no path", () => {
    const blob = new Blob(["data"], { type: "image/jpeg" });
    const file = blobToFile(blob, "https://example.com/");

    expect(file.name).toContain("cover");
  });

  it("should add extension based on blob type if missing", () => {
    const blob = new Blob(["data"], { type: "image/webp" });
    const file = blobToFile(blob, "https://example.com/noextension");

    expect(file.name).toContain("webp");
  });

  it("should handle complex URLs with query params", () => {
    const blob = new Blob(["data"], { type: "image/gif" });
    const file = blobToFile(
      blob,
      "https://example.com/images/cover.gif?size=large&quality=high"
    );

    expect(file.name).toBe("cover.gif");
  });
});
