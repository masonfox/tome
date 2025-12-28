import { describe, test, expect, beforeAll, afterAll, beforeEach, mock } from "bun:test";
import { DELETE } from "@/app/api/tags/[tagName]/route";
import { bookRepository } from "@/lib/repositories";
import { setupTestDatabase, teardownTestDatabase, clearTestDatabase } from "@/__tests__/helpers/db-setup";
import { createTestBook, createMockRequest } from "../fixtures/test-data";
import type { NextRequest } from "next/server";

/**
 * Tag Delete API Endpoint Tests
 * 
 * Tests the DELETE /api/tags/:tagName endpoint which deletes a single tag
 * from all books.
 * 
 * Coverage:
 * - Valid tag deletion
 * - URL encoding/decoding
 * - Calibre sync integration
 * - Error handling
 */

/**
 * Mock Rationale: Avoid file system I/O to Calibre's SQLite database during tests.
 */
let mockUpdateCalibreTags = mock(() => {});
let mockBatchUpdateCalibreTags = mock((updates: Array<{ calibreId: number; tags: string[] }>) => updates.length);
let mockCalibreShouldFail = false;

mock.module("@/lib/db/calibre-write", () => ({
  updateCalibreTags: (calibreId: number, tags: string[]) => {
    if (mockCalibreShouldFail) {
      throw new Error("Calibre database is unavailable");
    }
    mockUpdateCalibreTags();
  },
  batchUpdateCalibreTags: (updates: Array<{ calibreId: number; tags: string[] }>) => {
    if (mockCalibreShouldFail) {
      throw new Error("Calibre database is unavailable");
    }
    return mockBatchUpdateCalibreTags(updates);
  },
  readCalibreTags: mock(() => []),
  getCalibreWriteDB: mock(() => ({})),
  updateCalibreRating: mock(() => {}),
  readCalibreRating: mock(() => null),
  closeCalibreWriteDB: mock(() => {}),
}));

beforeAll(async () => {
  await setupTestDatabase(__filename);
});

afterAll(async () => {
  await teardownTestDatabase(__filename);
});

beforeEach(async () => {
  await clearTestDatabase(__filename);
  mockUpdateCalibreTags.mockClear();
  mockBatchUpdateCalibreTags.mockClear();
  mockCalibreShouldFail = false;
});

describe("DELETE /api/tags/:tagName", () => {
  describe("Successful Deletions", () => {
    test("should delete tag from all books", async () => {
      // Arrange: Books with tag
      const book1 = await bookRepository.create(createTestBook({
        calibreId: 1,
        title: "Book 1",
        authors: ["Author"],
        path: "Author/Book 1 (1)",
        tags: ["delete-me", "keep-this"],
      }));

      const book2 = await bookRepository.create(createTestBook({
        calibreId: 2,
        title: "Book 2",
        authors: ["Author 2"],
        path: "Author 2/Book 2 (2)",
        tags: ["delete-me", "keep-that"],
      }));

      const book3 = await bookRepository.create(createTestBook({
        calibreId: 3,
        title: "Book 3",
        authors: ["Author 3"],
        path: "Author 3/Book 3 (3)",
        tags: ["other-tag"],
      }));

      // Act: Delete tag
      const request = createMockRequest("DELETE", "/api/tags/delete-me");
      const response = await DELETE(request as NextRequest, { params: { tagName: "delete-me" } });
      const data = await response.json();

      // Assert: Response correct
      expect(response.status).toBe(200);
      expect(data.deletedTag).toBe("delete-me");
      expect(data.booksUpdated).toBe(2);

      // Verify tags removed from database
      const updatedBook1 = await bookRepository.findById(book1.id);
      const updatedBook2 = await bookRepository.findById(book2.id);
      const updatedBook3 = await bookRepository.findById(book3.id);

      expect(updatedBook1?.tags).toEqual(["keep-this"]);
      expect(updatedBook2?.tags).toEqual(["keep-that"]);
      expect(updatedBook3?.tags).toEqual(["other-tag"]); // Unchanged
    });

    test("should handle URL-encoded tag names", async () => {
      // Arrange: Book with tag containing spaces
      const book = await bookRepository.create(createTestBook({
        calibreId: 10,
        title: "Book",
        authors: ["Author"],
        path: "Author/Book (10)",
        tags: ["sci-fi & fantasy", "keep-this"],
      }));

      // Act: Delete tag with URL encoding
      const request = createMockRequest("DELETE", "/api/tags/sci-fi%20%26%20fantasy");
      const response = await DELETE(request as NextRequest, { params: { tagName: "sci-fi%20%26%20fantasy" } });
      const data = await response.json();

      // Assert: Success
      expect(response.status).toBe(200);
      expect(data.deletedTag).toBe("sci-fi & fantasy"); // Decoded

      const updatedBook = await bookRepository.findById(book.id);
      expect(updatedBook?.tags).toEqual(["keep-this"]);
    });

    test("should remove only tag leaving empty array", async () => {
      // Arrange: Book with only one tag
      const book = await bookRepository.create(createTestBook({
        calibreId: 20,
        title: "Single Tag Book",
        authors: ["Author"],
        path: "Author/Single Tag Book (20)",
        tags: ["only-tag"],
      }));

      // Act: Delete the only tag
      const request = createMockRequest("DELETE", "/api/tags/only-tag");
      const response = await DELETE(request as NextRequest, { params: { tagName: "only-tag" } });

      // Assert: Success
      expect(response.status).toBe(200);

      const updatedBook = await bookRepository.findById(book.id);
      expect(updatedBook?.tags).toEqual([]);
    });

    test("should sync changes to Calibre", async () => {
      // Arrange: Book with tag
      await bookRepository.create(createTestBook({
        calibreId: 30,
        title: "Sync Test",
        authors: ["Author"],
        path: "Author/Sync Test (30)",
        tags: ["delete-me"],
      }));

      // Act: Delete tag
      const request = createMockRequest("DELETE", "/api/tags/delete-me");
      await DELETE(request as NextRequest, { params: { tagName: "delete-me" } });

      // Assert: Batch Calibre sync was called with correct data
      expect(mockBatchUpdateCalibreTags).toHaveBeenCalledTimes(1);
      expect(mockBatchUpdateCalibreTags).toHaveBeenCalledWith([
        { calibreId: 30, tags: [] }
      ]);
    });
  });

  describe("Edge Cases", () => {
    test("should succeed with zero updates when tag not found", async () => {
      // Arrange: Books without target tag
      await bookRepository.create(createTestBook({
        calibreId: 40,
        title: "Book",
        authors: ["Author"],
        path: "Author/Book (40)",
        tags: ["other-tag"],
      }));

      // Act: Try to delete non-existent tag
      const request = createMockRequest("DELETE", "/api/tags/nonexistent");
      const response = await DELETE(request as NextRequest, { params: { tagName: "nonexistent" } });
      const data = await response.json();

      // Assert: Success with zero updates
      expect(response.status).toBe(200);
      expect(data.booksUpdated).toBe(0);
    });

    test("should handle special characters in tag name", async () => {
      // Arrange: Book with special character tag
      const book = await bookRepository.create(createTestBook({
        calibreId: 50,
        title: "Special Char Book",
        authors: ["Author"],
        path: "Author/Special Char Book (50)",
        tags: ["tag-with/slash", "keep-this"],
      }));

      // Act: Delete tag with special char
      const request = createMockRequest("DELETE", "/api/tags/tag-with/slash");
      const response = await DELETE(request as NextRequest, { params: { tagName: "tag-with/slash" } });

      // Assert: Success
      expect(response.status).toBe(200);

      const updatedBook = await bookRepository.findById(book.id);
      expect(updatedBook?.tags).toEqual(["keep-this"]);
    });

    test("should handle unicode tag names", async () => {
      // Arrange: Book with unicode tag
      const book = await bookRepository.create(createTestBook({
        calibreId: 60,
        title: "Unicode Book",
        authors: ["Author"],
        path: "Author/Unicode Book (60)",
        tags: ["科幻小说", "keep-this"],
      }));

      // Act: Delete unicode tag
      const request = createMockRequest("DELETE", "/api/tags/科幻小说");
      const response = await DELETE(request as NextRequest, { params: { tagName: "科幻小说" } });

      // Assert: Success
      expect(response.status).toBe(200);

      const updatedBook = await bookRepository.findById(book.id);
      expect(updatedBook?.tags).toEqual(["keep-this"]);
    });
  });

  describe("Error Cases", () => {
    test("should handle Calibre sync failure gracefully", async () => {
      // Arrange: Book and mock Calibre failure
      const book = await bookRepository.create(createTestBook({
        calibreId: 70,
        title: "Sync Fail Book",
        authors: ["Author"],
        path: "Author/Sync Fail Book (70)",
        tags: ["delete-me"],
      }));
      mockCalibreShouldFail = true;

      // Act: Delete tag
      const request = createMockRequest("DELETE", "/api/tags/delete-me");
      const response = await DELETE(request as NextRequest, { params: { tagName: "delete-me" } });

      // Assert: API should still succeed (best-effort sync)
      expect(response.status).toBe(200);

      // Verify local database was updated
      const updatedBook = await bookRepository.findById(book.id);
      expect(updatedBook?.tags).toEqual([]);
    });
  });
});
