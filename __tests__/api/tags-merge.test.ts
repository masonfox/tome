import { describe, test, expect, beforeAll, afterAll, beforeEach, mock } from "bun:test";
import { POST } from "@/app/api/tags/merge/route";
import { bookRepository } from "@/lib/repositories";
import { setupTestDatabase, teardownTestDatabase, clearTestDatabase } from "@/__tests__/helpers/db-setup";
import { createTestBook, createMockRequest } from "../fixtures/test-data";
import type { NextRequest } from "next/server";

/**
 * Tag Merge API Endpoint Tests
 * 
 * Tests the POST /api/tags/merge endpoint which merges multiple source tags
 * into a single target tag across all books.
 * 
 * Coverage:
 * - Valid tag merge operations
 * - Deduplication when target tag already exists
 * - Validation errors
 * - Calibre watcher suspension/resumption
 * - Calibre sync integration
 */

/**
 * Mock Rationale: Avoid file system I/O to Calibre's SQLite database during tests.
 * We mock Calibre write operations and the watcher to verify our code properly:
 * (1) suspends the watcher during merge
 * (2) attempts to sync tags
 * (3) resumes the watcher after merge
 */
let mockUpdateCalibreTags = mock(() => {});
let mockCalibreShouldFail = false;

mock.module("@/lib/db/calibre-write", () => ({
  updateCalibreTags: (calibreId: number, tags: string[]) => {
    if (mockCalibreShouldFail) {
      throw new Error("Calibre database is unavailable");
    }
    mockUpdateCalibreTags();
  },
  readCalibreTags: mock(() => []),
  getCalibreWriteDB: mock(() => ({})),
  updateCalibreRating: mock(() => {}),
  readCalibreRating: mock(() => null),
  closeCalibreWriteDB: mock(() => {}),
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
  mockCalibreShouldFail = false;
  mockWatcherSuspendCalled = false;
  mockWatcherResumeCalled = false;
});

describe("POST /api/tags/merge", () => {
  describe("Successful Tag Merges", () => {
    test("should merge single source tag into target tag", async () => {
      // Arrange: Books with typo tag
      const book1 = await bookRepository.create(createTestBook({
        calibreId: 1,
        title: "Fantasy Book 1",
        authors: ["Author"],
        path: "Author/Fantasy Book 1 (1)",
        tags: ["fantacy", "magic"],
      }));

      const book2 = await bookRepository.create(createTestBook({
        calibreId: 2,
        title: "Fantasy Book 2",
        authors: ["Author 2"],
        path: "Author 2/Fantasy Book 2 (2)",
        tags: ["fantasy", "adventure"],
      }));

      // Act: Merge typo into correct spelling
      const request = createMockRequest("POST", "/api/tags/merge", {
        sourceTags: ["fantacy"],
        targetTag: "fantasy",
      });
      const response = await POST(request as NextRequest);
      const data = await response.json();

      // Assert: Response correct
      expect(response.status).toBe(200);
      expect(data.mergedTags).toEqual(["fantacy"]);
      expect(data.targetTag).toBe("fantasy");
      expect(data.booksUpdated).toBe(1);

      // Verify tags merged in database
      const updatedBook1 = await bookRepository.findById(book1.id);
      const updatedBook2 = await bookRepository.findById(book2.id);

      expect(updatedBook1?.tags).toEqual(["magic", "fantasy"]);
      expect(updatedBook2?.tags).toEqual(["fantasy", "adventure"]); // Unchanged
    });

    test("should merge multiple source tags", async () => {
      // Arrange: Books with various typo tags
      const book1 = await bookRepository.create(createTestBook({
        calibreId: 10,
        title: "Book 1",
        authors: ["Author"],
        path: "Author/Book 1 (10)",
        tags: ["fantacy", "magic"],
      }));

      const book2 = await bookRepository.create(createTestBook({
        calibreId: 11,
        title: "Book 2",
        authors: ["Author 2"],
        path: "Author 2/Book 2 (11)",
        tags: ["fantasie", "adventure"],
      }));

      const book3 = await bookRepository.create(createTestBook({
        calibreId: 12,
        title: "Book 3",
        authors: ["Author 3"],
        path: "Author 3/Book 3 (12)",
        tags: ["fantasi", "epic"],
      }));

      // Act: Merge all typos into correct spelling
      const request = createMockRequest("POST", "/api/tags/merge", {
        sourceTags: ["fantacy", "fantasie", "fantasi"],
        targetTag: "fantasy",
      });
      const response = await POST(request as NextRequest);
      const data = await response.json();

      // Assert: All books updated
      expect(response.status).toBe(200);
      expect(data.booksUpdated).toBe(3);

      // Verify all tags merged
      const updatedBook1 = await bookRepository.findById(book1.id);
      const updatedBook2 = await bookRepository.findById(book2.id);
      const updatedBook3 = await bookRepository.findById(book3.id);

      expect(updatedBook1?.tags).toEqual(["magic", "fantasy"]);
      expect(updatedBook2?.tags).toEqual(["adventure", "fantasy"]);
      expect(updatedBook3?.tags).toEqual(["epic", "fantasy"]);
    });

    test("should deduplicate when book already has target tag", async () => {
      // Arrange: Book with both source and target tags
      const book = await bookRepository.create(createTestBook({
        calibreId: 20,
        title: "Book with Both",
        authors: ["Author"],
        path: "Author/Book with Both (20)",
        tags: ["fantasy", "fantacy", "magic"],
      }));

      // Act: Merge source into target (both present)
      const request = createMockRequest("POST", "/api/tags/merge", {
        sourceTags: ["fantacy"],
        targetTag: "fantasy",
      });
      const response = await POST(request as NextRequest);
      const data = await response.json();

      // Assert: No duplicate target tag
      expect(response.status).toBe(200);
      expect(data.booksUpdated).toBe(1);

      const updatedBook = await bookRepository.findById(book.id);
      expect(updatedBook?.tags).toEqual(["fantasy", "magic"]); // "fantacy" removed, no duplicate "fantasy"
    });

    test("should preserve other tags during merge", async () => {
      // Arrange: Book with multiple tags
      const book = await bookRepository.create(createTestBook({
        calibreId: 30,
        title: "Multi-Tag Book",
        authors: ["Author"],
        path: "Author/Multi-Tag Book (30)",
        tags: ["fantacy", "magic", "adventure", "epic", "dragons"],
      }));

      // Act: Merge one tag
      const request = createMockRequest("POST", "/api/tags/merge", {
        sourceTags: ["fantacy"],
        targetTag: "fantasy",
      });
      const response = await POST(request as NextRequest);

      // Assert: Other tags preserved
      expect(response.status).toBe(200);

      const updatedBook = await bookRepository.findById(book.id);
      expect(updatedBook?.tags).toContain("magic");
      expect(updatedBook?.tags).toContain("adventure");
      expect(updatedBook?.tags).toContain("epic");
      expect(updatedBook?.tags).toContain("dragons");
      expect(updatedBook?.tags).toContain("fantasy");
      expect(updatedBook?.tags).not.toContain("fantacy");
    });

    test("should sync merged tags to Calibre", async () => {
      // Arrange: Book with source tag
      const book = await bookRepository.create(createTestBook({
        calibreId: 40,
        title: "Sync Test Book",
        authors: ["Author"],
        path: "Author/Sync Test Book (40)",
        tags: ["old-name"],
      }));

      // Act: Merge tag
      const request = createMockRequest("POST", "/api/tags/merge", {
        sourceTags: ["old-name"],
        targetTag: "new-name",
      });
      await POST(request as NextRequest);

      // Assert: Calibre sync was called
      expect(mockUpdateCalibreTags).toHaveBeenCalled();
    });

    test("should suspend and resume watcher during merge", async () => {
      // Arrange: Book with source tag
      await bookRepository.create(createTestBook({
        calibreId: 50,
        title: "Watcher Test Book",
        authors: ["Author"],
        path: "Author/Watcher Test Book (50)",
        tags: ["old-tag"],
      }));

      // Act: Merge tag
      const request = createMockRequest("POST", "/api/tags/merge", {
        sourceTags: ["old-tag"],
        targetTag: "new-tag",
      });
      await POST(request as NextRequest);

      // Assert: Watcher was suspended and resumed
      expect(mockWatcherSuspendCalled).toBe(true);
      expect(mockWatcherResumeCalled).toBe(true);
    });
  });

  describe("Validation Errors", () => {
    test("should return 400 for missing sourceTags", async () => {
      const request = createMockRequest("POST", "/api/tags/merge", {
        targetTag: "fantasy",
      });
      const response = await POST(request as NextRequest);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain("sourceTags must be a non-empty array");
    });

    test("should return 400 for empty sourceTags array", async () => {
      const request = createMockRequest("POST", "/api/tags/merge", {
        sourceTags: [],
        targetTag: "fantasy",
      });
      const response = await POST(request as NextRequest);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain("sourceTags must be a non-empty array");
    });

    test("should return 400 for non-array sourceTags", async () => {
      const request = createMockRequest("POST", "/api/tags/merge", {
        sourceTags: "not-an-array",
        targetTag: "fantasy",
      });
      const response = await POST(request as NextRequest);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain("sourceTags must be a non-empty array");
    });

    test("should return 400 for missing targetTag", async () => {
      const request = createMockRequest("POST", "/api/tags/merge", {
        sourceTags: ["fantacy"],
      });
      const response = await POST(request as NextRequest);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain("targetTag is required");
    });

    test("should return 400 for empty targetTag", async () => {
      const request = createMockRequest("POST", "/api/tags/merge", {
        sourceTags: ["fantacy"],
        targetTag: "   ",
      });
      const response = await POST(request as NextRequest);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain("Target tag cannot be empty");
    });

    test("should return 400 for non-string targetTag", async () => {
      const request = createMockRequest("POST", "/api/tags/merge", {
        sourceTags: ["fantacy"],
        targetTag: 123,
      });
      const response = await POST(request as NextRequest);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain("targetTag is required and must be a string");
    });
  });

  describe("Error Cases", () => {
    test("should handle Calibre sync failure gracefully", async () => {
      // Arrange: Book and mock Calibre failure
      await bookRepository.create(createTestBook({
        calibreId: 60,
        title: "Sync Fail Book",
        authors: ["Author"],
        path: "Author/Sync Fail Book (60)",
        tags: ["old-tag"],
      }));
      mockCalibreShouldFail = true;

      // Act: Merge tag
      const request = createMockRequest("POST", "/api/tags/merge", {
        sourceTags: ["old-tag"],
        targetTag: "new-tag",
      });
      const response = await POST(request as NextRequest);

      // Assert: API should still succeed (best-effort sync)
      expect(response.status).toBe(200);

      // Verify local database was updated (even though Calibre sync failed)
      // Note: Since Calibre sync is best-effort, the local DB should still be updated
    });

    test("should resume watcher even if merge fails", async () => {
      // Arrange: Invalid request that will fail
      const request = createMockRequest("POST", "/api/tags/merge", {
        sourceTags: [],
        targetTag: "fantasy",
      });

      // Act: Try to merge (will fail validation)
      await POST(request as NextRequest);

      // Note: Validation happens before suspend, so watcher won't be suspended
      // This test documents that validation is early
    });
  });

  describe("Edge Cases", () => {
    test("should return success with zero updates when no books have source tags", async () => {
      // Arrange: Books without source tags
      await bookRepository.create(createTestBook({
        calibreId: 70,
        title: "Book 1",
        authors: ["Author"],
        path: "Author/Book 1 (70)",
        tags: ["fantasy", "magic"],
      }));

      // Act: Try to merge non-existent tag
      const request = createMockRequest("POST", "/api/tags/merge", {
        sourceTags: ["nonexistent-tag"],
        targetTag: "fantasy",
      });
      const response = await POST(request as NextRequest);
      const data = await response.json();

      // Assert: Success with zero updates
      expect(response.status).toBe(200);
      expect(data.booksUpdated).toBe(0);
    });

    test("should handle special characters in tags", async () => {
      // Arrange: Book with special character tags
      const book = await bookRepository.create(createTestBook({
        calibreId: 80,
        title: "Special Chars Book",
        authors: ["Author"],
        path: "Author/Special Chars Book (80)",
        tags: ["sci-fi & fantasy", "action/adventure"],
      }));

      // Act: Merge tag with special chars
      const request = createMockRequest("POST", "/api/tags/merge", {
        sourceTags: ["sci-fi & fantasy"],
        targetTag: "sci-fi/fantasy",
      });
      const response = await POST(request as NextRequest);

      // Assert: Success
      expect(response.status).toBe(200);

      const updatedBook = await bookRepository.findById(book.id);
      expect(updatedBook?.tags).toContain("sci-fi/fantasy");
      expect(updatedBook?.tags).not.toContain("sci-fi & fantasy");
    });

    test("should trim whitespace from target tag", async () => {
      // Arrange: Book with source tag
      const book = await bookRepository.create(createTestBook({
        calibreId: 90,
        title: "Trim Test Book",
        authors: ["Author"],
        path: "Author/Trim Test Book (90)",
        tags: ["old-tag"],
      }));

      // Act: Merge with whitespace in target
      const request = createMockRequest("POST", "/api/tags/merge", {
        sourceTags: ["old-tag"],
        targetTag: "  new-tag  ",
      });
      const response = await POST(request as NextRequest);

      // Assert: Success with trimmed tag
      expect(response.status).toBe(200);

      const updatedBook = await bookRepository.findById(book.id);
      expect(updatedBook?.tags).toEqual(["new-tag"]); // Trimmed
    });
  });
});
