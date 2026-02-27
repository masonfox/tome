import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { existsSync, mkdirSync, writeFileSync, readFileSync, unlinkSync, readdirSync, rmSync } from "fs";
import path from "path";
import {
  saveCover,
  getCoverPath,
  hasCover,
  deleteCover,
  readCover,
  ensureCoverDirectory,
  getCoversDir,
  parseCoverMimeType,
  mimeTypeFromExtension,
  MAX_COVER_SIZE_BYTES,
  ALLOWED_COVER_MIME_TYPES,
  type CoverMimeType,
} from "@/lib/utils/cover-storage";

// Use a temporary directory for tests to avoid polluting real data
const TEST_COVERS_DIR = path.join(__dirname, "__test-covers__");

// Mock the covers directory to use our test location
vi.mock("@/lib/utils/cover-storage", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/utils/cover-storage")>();

  // We can't easily override the internal COVERS_DIR constant,
  // so we test the pure utility functions directly and test
  // filesystem operations via integration-style tests with real paths.
  return {
    ...original,
  };
});

describe("cover-storage", () => {
  describe("parseCoverMimeType", () => {
    it("should parse valid JPEG content type", () => {
      expect(parseCoverMimeType("image/jpeg")).toBe("image/jpeg");
    });

    it("should parse valid PNG content type", () => {
      expect(parseCoverMimeType("image/png")).toBe("image/png");
    });

    it("should parse valid WebP content type", () => {
      expect(parseCoverMimeType("image/webp")).toBe("image/webp");
    });

    it("should parse valid GIF content type", () => {
      expect(parseCoverMimeType("image/gif")).toBe("image/gif");
    });

    it("should strip charset parameter from content type", () => {
      expect(parseCoverMimeType("image/jpeg; charset=utf-8")).toBe("image/jpeg");
    });

    it("should strip multiple parameters", () => {
      expect(parseCoverMimeType("image/png; charset=utf-8; boundary=something")).toBe("image/png");
    });

    it("should handle uppercase content type", () => {
      expect(parseCoverMimeType("IMAGE/JPEG")).toBe("image/jpeg");
    });

    it("should handle mixed case content type", () => {
      expect(parseCoverMimeType("Image/Jpeg")).toBe("image/jpeg");
    });

    it("should return null for unsupported types", () => {
      expect(parseCoverMimeType("image/svg+xml")).toBeNull();
      expect(parseCoverMimeType("image/tiff")).toBeNull();
      expect(parseCoverMimeType("image/bmp")).toBeNull();
      expect(parseCoverMimeType("application/json")).toBeNull();
      expect(parseCoverMimeType("text/html")).toBeNull();
    });

    it("should return null for empty string", () => {
      expect(parseCoverMimeType("")).toBeNull();
    });

    it("should handle whitespace in content type", () => {
      expect(parseCoverMimeType("  image/jpeg  ")).toBe("image/jpeg");
    });
  });

  describe("mimeTypeFromExtension", () => {
    it("should resolve .jpg extension", () => {
      expect(mimeTypeFromExtension(".jpg")).toBe("image/jpeg");
    });

    it("should resolve .jpeg extension", () => {
      expect(mimeTypeFromExtension(".jpeg")).toBe("image/jpeg");
    });

    it("should resolve .png extension", () => {
      expect(mimeTypeFromExtension(".png")).toBe("image/png");
    });

    it("should resolve .webp extension", () => {
      expect(mimeTypeFromExtension(".webp")).toBe("image/webp");
    });

    it("should resolve .gif extension", () => {
      expect(mimeTypeFromExtension(".gif")).toBe("image/gif");
    });

    it("should handle extensions without leading dot", () => {
      expect(mimeTypeFromExtension("jpg")).toBe("image/jpeg");
      expect(mimeTypeFromExtension("png")).toBe("image/png");
      expect(mimeTypeFromExtension("webp")).toBe("image/webp");
      expect(mimeTypeFromExtension("gif")).toBe("image/gif");
    });

    it("should handle uppercase extensions", () => {
      expect(mimeTypeFromExtension(".JPG")).toBe("image/jpeg");
      expect(mimeTypeFromExtension("PNG")).toBe("image/png");
    });

    it("should return null for unsupported extensions", () => {
      expect(mimeTypeFromExtension(".svg")).toBeNull();
      expect(mimeTypeFromExtension(".bmp")).toBeNull();
      expect(mimeTypeFromExtension(".tiff")).toBeNull();
      expect(mimeTypeFromExtension("txt")).toBeNull();
    });
  });

  describe("constants", () => {
    it("should have MAX_COVER_SIZE_BYTES set to 5MB", () => {
      expect(MAX_COVER_SIZE_BYTES).toBe(5 * 1024 * 1024);
    });

    it("should have all four allowed MIME types", () => {
      expect(ALLOWED_COVER_MIME_TYPES).toContain("image/jpeg");
      expect(ALLOWED_COVER_MIME_TYPES).toContain("image/png");
      expect(ALLOWED_COVER_MIME_TYPES).toContain("image/webp");
      expect(ALLOWED_COVER_MIME_TYPES).toContain("image/gif");
      expect(ALLOWED_COVER_MIME_TYPES).toHaveLength(4);
    });
  });

  describe("saveCover", () => {
    it("should reject oversized buffers", () => {
      const oversizedBuffer = Buffer.alloc(MAX_COVER_SIZE_BYTES + 1);
      expect(() => saveCover(1, oversizedBuffer, "image/jpeg")).toThrow("Cover image too large");
    });

    it("should accept buffer at exact size limit", () => {
      // This will attempt to write to the real covers dir, but validates the size check passes
      const exactBuffer = Buffer.alloc(MAX_COVER_SIZE_BYTES);
      // We expect this to NOT throw a size error (it may throw a filesystem error depending on environment)
      expect(() => {
        try {
          saveCover(99999, exactBuffer, "image/jpeg");
        } catch (e: any) {
          if (e.message.includes("too large")) throw e;
          // Ignore filesystem errors in unit test
        }
      }).not.toThrow();
    });
  });

  describe("getCoversDir", () => {
    it("should return a string path", () => {
      const dir = getCoversDir();
      expect(typeof dir).toBe("string");
      expect(dir.length).toBeGreaterThan(0);
    });

    it("should end with 'covers'", () => {
      const dir = getCoversDir();
      expect(path.basename(dir)).toBe("covers");
    });
  });
});
