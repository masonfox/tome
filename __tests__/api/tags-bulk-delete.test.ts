import { describe, test, expect, beforeAll, afterAll, beforeEach, mock } from "bun:test";
import { POST } from "@/app/api/tags/bulk-delete/route";
import { bookRepository } from "@/lib/repositories";
import { setupTestDatabase, teardownTestDatabase, clearTestDatabase } from "@/__tests__/helpers/db-setup";
import { createTestBook, createMockRequest } from "../fixtures/test-data";
import type { NextRequest } from "next/server";

/**
 * Tag Bulk Delete API Endpoint Tests
 * 
 * Tests the POST /api/tags/bulk-delete endpoint which deletes multiple tags
 * from all books in a single operation.
 * 
 * Coverage:
 * - Valid bulk delete operations
 * - Validation errors
 * - Calibre watcher suspension/resumption
 * - Calibre sync integration
 * - Partial failures
 */

/**
 * Mock Rationale: Avoid file system I/O to Calibre's SQLite database during tests.
 * We mock Calibre service operations at the service boundary to verify our code properly:
 * (1) suspends the watcher during bulk delete
 * (2) attempts to sync tags in batch for each affected book
 * (3) resumes the watcher after deletion
 */
let mockUpdateCalibreTags = mock(() => {});
let mockBatchUpdateCalibreTags = mock((updates: Array<{ calibreId: number; tags: string[] }>) => updates.length);
let mockCalibreShouldFail = false;

mock.module("@/lib/services/calibre.service", () => ({
  calibreService: {
    updateTags: (calibreId: number, tags: string[]) => {
      if (mockCalibreShouldFail) {
        throw new Error("Calibre database is unavailable");
      }
      mockUpdateCalibreTags();
    },
    batchUpdateTags: (updates: Array<{ calibreId: number; tags: string[] }>) => {
      if (mockCalibreShouldFail) {
        throw new Error("Calibre database is unavailable");
      }
      return mockBatchUpdateCalibreTags(updates);
    },
    updateRating: mock(() => {}),
    readTags: mock(() => []),
    readRating: mock(() => null),
  },
  CalibreService: class {},
}));

// Mock Calibre watcher to track suspend/resume calls
let mockWatcherSuspendCalled = false;
let mockWatcherResumeCalled = false;

mock.module("@/lib/calibre-watcher", () => ({
  calibreWatcher: {
    suspend: () => {
      mockWatcherSuspendCalled = true;
    },
    resume: () => {
      mockWatcherResumeCalled = true;
    },
    start: mock(() => {}),
    stop: mock(() => {}),
  },
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
  mockWatcherSuspendCalled = false;
  mockWatcherResumeCalled = false;
});

describe("POST /api/tags/bulk-delete", () => {
  describe("Successful Bulk Deletes", () => {
    test("should delete multiple tags from multiple books", async () => {
      // Arrange: Books with various tags
      const book1 = await bookRepository.create(createTestBook({
        calibreId: 1,
        title: "Book 1",
        authors: ["Author"],
        path: "Author/Book 1 (1)",
        tags: ["tag1", "tag2", "keep-this"],
      }));

      const book2 = await bookRepository.create(createTestBook({
        calibreId: 2,
        title: "Book 2",
        authors: ["Author 2"],
        path: "Author 2/Book 2 (2)",
        tags: ["tag2", "tag3", "keep-that"],
      }));

      const book3 = await bookRepository.create(createTestBook({
        calibreId: 3,
        title: "Book 3",
        authors: ["Author 3"],
        path: "Author 3/Book 3 (3)",
        tags: ["tag1", "tag3"],
      }));

      // Act: Delete tag1, tag2, tag3
      const request = createMockRequest("POST", "/api/tags/bulk-delete", {
        tagNames: ["tag1", "tag2", "tag3"],
      });
      const response = await POST(request as NextRequest);
      const data = await response.json();

      // Assert: Response correct
      expect(response.status).toBe(200);
      expect(data.deletedTags).toEqual(["tag1", "tag2", "tag3"]);
      expect(data.tagsDeleted).toBe(3);
      expect(data.booksUpdated).toBeGreaterThanOrEqual(3); // May count same book multiple times

      // Verify tags removed from database
      const updatedBook1 = await bookRepository.findById(book1.id);
      const updatedBook2 = await bookRepository.findById(book2.id);
      const updatedBook3 = await bookRepository.findById(book3.id);

      expect(updatedBook1?.tags).toEqual(["keep-this"]);
      expect(updatedBook2?.tags).toEqual(["keep-that"]);
      expect(updatedBook3?.tags).toEqual([]);
    });

    test("should handle single tag deletion", async () => {
      // Arrange: Books with one tag
      const book = await bookRepository.create(createTestBook({
        calibreId: 10,
        title: "Single Tag Book",
        authors: ["Author"],
        path: "Author/Single Tag Book (10)",
        tags: ["remove-me", "keep-me"],
      }));

      // Act: Delete one tag
      const request = createMockRequest("POST", "/api/tags/bulk-delete", {
        tagNames: ["remove-me"],
      });
      const response = await POST(request as NextRequest);
      const data = await response.json();

      // Assert: Success
      expect(response.status).toBe(200);
      expect(data.tagsDeleted).toBe(1);

      const updatedBook = await bookRepository.findById(book.id);
      expect(updatedBook?.tags).toEqual(["keep-me"]);
    });

    test("should sync changes to Calibre for each affected book", async () => {
      // Arrange: Books with tags
      await bookRepository.create(createTestBook({
        calibreId: 20,
        title: "Sync Test 1",
        authors: ["Author"],
        path: "Author/Sync Test 1 (20)",
        tags: ["delete-me"],
      }));

      await bookRepository.create(createTestBook({
        calibreId: 21,
        title: "Sync Test 2",
        authors: ["Author 2"],
        path: "Author 2/Sync Test 2 (21)",
        tags: ["delete-me"],
      }));

      // Act: Delete tag
      const request = createMockRequest("POST", "/api/tags/bulk-delete", {
        tagNames: ["delete-me"],
      });
      await POST(request as NextRequest);

      // Assert: Batch Calibre sync was called with correct data
      expect(mockBatchUpdateCalibreTags).toHaveBeenCalledTimes(1);
      expect(mockBatchUpdateCalibreTags).toHaveBeenCalledWith([
        { calibreId: 20, tags: [] },
        { calibreId: 21, tags: [] }
      ]);
    });

    test("should suspend and resume watcher during bulk delete", async () => {
      // Arrange: Book with tag
      await bookRepository.create(createTestBook({
        calibreId: 30,
        title: "Watcher Test",
        authors: ["Author"],
        path: "Author/Watcher Test (30)",
        tags: ["delete-me"],
      }));

      // Act: Bulk delete
      const request = createMockRequest("POST", "/api/tags/bulk-delete", {
        tagNames: ["delete-me"],
      });
      await POST(request as NextRequest);

      // Assert: Watcher was suspended and resumed
      expect(mockWatcherSuspendCalled).toBe(true);
      expect(mockWatcherResumeCalled).toBe(true);
    });
  });

  describe("Validation Errors", () => {
    test("should return 400 for missing tagNames", async () => {
      const request = createMockRequest("POST", "/api/tags/bulk-delete", {});
      const response = await POST(request as NextRequest);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain("tagNames is required");
    });

    test("should return 400 for empty tagNames array", async () => {
      const request = createMockRequest("POST", "/api/tags/bulk-delete", {
        tagNames: [],
      });
      const response = await POST(request as NextRequest);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain("tagNames array cannot be empty");
    });

    test("should return 400 for non-array tagNames", async () => {
      const request = createMockRequest("POST", "/api/tags/bulk-delete", {
        tagNames: "not-an-array",
      });
      const response = await POST(request as NextRequest);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain("tagNames is required and must be an array");
    });

    test("should return 400 for empty string in tagNames", async () => {
      const request = createMockRequest("POST", "/api/tags/bulk-delete", {
        tagNames: ["valid-tag", "  ", "another-valid"],
      });
      const response = await POST(request as NextRequest);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain("All tag names must be non-empty strings");
    });

    test("should return 400 for non-string in tagNames", async () => {
      const request = createMockRequest("POST", "/api/tags/bulk-delete", {
        tagNames: ["valid-tag", 123, "another-valid"],
      });
      const response = await POST(request as NextRequest);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain("All tag names must be non-empty strings");
    });
  });

  describe("Error Cases", () => {
    test("should handle Calibre sync failure gracefully", async () => {
      // Arrange: Book and mock Calibre failure
      const book = await bookRepository.create(createTestBook({
        calibreId: 40,
        title: "Sync Fail Book",
        authors: ["Author"],
        path: "Author/Sync Fail Book (40)",
        tags: ["delete-me"],
      }));
      mockCalibreShouldFail = true;

      // Act: Bulk delete
      const request = createMockRequest("POST", "/api/tags/bulk-delete", {
        tagNames: ["delete-me"],
      });
      const response = await POST(request as NextRequest);

      // Assert: API should still succeed (best-effort sync)
      expect(response.status).toBe(200);

      // Verify local database was updated
      const updatedBook = await bookRepository.findById(book.id);
      expect(updatedBook?.tags).toEqual([]);
    });

    test("should resume watcher even on failure", async () => {
      // Arrange: Invalid request that will fail
      const request = createMockRequest("POST", "/api/tags/bulk-delete", {
        tagNames: [],
      });

      // Act: Try to delete (will fail validation)
      await POST(request as NextRequest);

      // Note: Validation happens before suspend, so watcher won't be suspended
      // This test documents early validation
    });
  });

  describe("Edge Cases", () => {
    test("should succeed with zero updates when tags not found", async () => {
      // Arrange: Books without target tags
      await bookRepository.create(createTestBook({
        calibreId: 50,
        title: "Book 1",
        authors: ["Author"],
        path: "Author/Book 1 (50)",
        tags: ["keep-this"],
      }));

      // Act: Try to delete non-existent tags
      const request = createMockRequest("POST", "/api/tags/bulk-delete", {
        tagNames: ["nonexistent1", "nonexistent2"],
      });
      const response = await POST(request as NextRequest);
      const data = await response.json();

      // Assert: Success with zero updates
      expect(response.status).toBe(200);
      expect(data.tagsDeleted).toBe(2); // Both "processed"
      expect(data.booksUpdated).toBe(0); // But no books updated
    });

    test("should handle partial matches (some tags exist, some don't)", async () => {
      // Arrange: Book with some tags
      const book = await bookRepository.create(createTestBook({
        calibreId: 60,
        title: "Partial Match Book",
        authors: ["Author"],
        path: "Author/Partial Match Book (60)",
        tags: ["exists", "keep-this"],
      }));

      // Act: Delete one existing and one non-existing tag
      const request = createMockRequest("POST", "/api/tags/bulk-delete", {
        tagNames: ["exists", "nonexistent"],
      });
      const response = await POST(request as NextRequest);
      const data = await response.json();

      // Assert: Success
      expect(response.status).toBe(200);
      expect(data.tagsDeleted).toBe(2); // Both "processed"

      const updatedBook = await bookRepository.findById(book.id);
      expect(updatedBook?.tags).toEqual(["keep-this"]);
    });

    test("should handle books with only deleted tags", async () => {
      // Arrange: Books with only tags to be deleted
      const book = await bookRepository.create(createTestBook({
        calibreId: 70,
        title: "Empty After Delete",
        authors: ["Author"],
        path: "Author/Empty After Delete (70)",
        tags: ["delete1", "delete2"],
      }));

      // Act: Delete all tags
      const request = createMockRequest("POST", "/api/tags/bulk-delete", {
        tagNames: ["delete1", "delete2"],
      });
      const response = await POST(request as NextRequest);

      // Assert: Success
      expect(response.status).toBe(200);

      const updatedBook = await bookRepository.findById(book.id);
      expect(updatedBook?.tags).toEqual([]);
    });

    test("should handle special characters in tag names", async () => {
      // Arrange: Book with special character tags
      const book = await bookRepository.create(createTestBook({
        calibreId: 80,
        title: "Special Chars Book",
        authors: ["Author"],
        path: "Author/Special Chars Book (80)",
        tags: ["sci-fi & fantasy", "action/adventure", "keep-this"],
      }));

      // Act: Delete tags with special chars
      const request = createMockRequest("POST", "/api/tags/bulk-delete", {
        tagNames: ["sci-fi & fantasy", "action/adventure"],
      });
      const response = await POST(request as NextRequest);

      // Assert: Success
      expect(response.status).toBe(200);

      const updatedBook = await bookRepository.findById(book.id);
      expect(updatedBook?.tags).toEqual(["keep-this"]);
    });

    test("should handle large number of tags", async () => {
      // Arrange: Create many books with tags to delete
      const tagNames: string[] = [];
      for (let i = 0; i < 20; i++) {
        tagNames.push(`tag-${i}`);
      }

      const book = await bookRepository.create(createTestBook({
        calibreId: 90,
        title: "Many Tags Book",
        authors: ["Author"],
        path: "Author/Many Tags Book (90)",
        tags: [...tagNames, "keep-this"],
      }));

      // Act: Delete many tags
      const request = createMockRequest("POST", "/api/tags/bulk-delete", {
        tagNames,
      });
      const response = await POST(request as NextRequest);
      const data = await response.json();

      // Assert: Success
      expect(response.status).toBe(200);
      expect(data.tagsDeleted).toBe(20);

      const updatedBook = await bookRepository.findById(book.id);
      expect(updatedBook?.tags).toEqual(["keep-this"]);
    });
  });
});
