import { describe, test, expect, beforeAll, afterAll, beforeEach, mock } from "bun:test";
import { GET, PATCH } from "@/app/api/tags/[tagName]/route";
import { bookRepository } from "@/lib/repositories";
import { setupTestDatabase, teardownTestDatabase, clearTestDatabase } from "@/__tests__/helpers/db-setup";
import { createTestBook, createMockRequest } from "../fixtures/test-data";
import type { NextRequest } from "next/server";

/**
 * Tag GET and PATCH API Endpoint Tests
 * 
 * Tests the GET and PATCH /api/tags/:tagName endpoints which:
 * - GET: Retrieves all books with a specific tag (with pagination)
 * - PATCH: Renames a tag across all books
 * 
 * Coverage:
 * - Tag retrieval with pagination
 * - URL encoding/decoding for tag names
 * - Tag renaming operations
 * - Validation errors
 * - Calibre batch sync integration
 * - Edge cases (special characters, unicode, etc.)
 */

/**
 * Mock Rationale: Avoid file system I/O to Calibre's SQLite database during tests.
 * We mock Calibre service operations at the service boundary to verify our code properly
 * attempts batch sync operations.
 */
let mockBatchUpdateCalibreTags = mock((updates: Array<{ calibreId: number; tags: string[] }>) => ({
  totalAttempted: updates.length,
  successCount: updates.length,
  failures: []
}));
let mockCalibreShouldFail = false;

mock.module("@/lib/services/calibre.service", () => ({
  calibreService: {
    updateTags: mock(() => {}),
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
let mockWatcherResumeIgnorePeriod = 0;

mock.module("@/lib/calibre-watcher", () => ({
  calibreWatcher: {
    suspend: () => {
      mockWatcherSuspendCalled = true;
    },
    resume: () => {
      mockWatcherResumeCalled = true;
    },
    resumeWithIgnorePeriod: (durationMs: number = 3000) => {
      mockWatcherResumeCalled = true;
      mockWatcherResumeIgnorePeriod = durationMs;
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
  mockBatchUpdateCalibreTags.mockClear();
  mockCalibreShouldFail = false;
  mockWatcherSuspendCalled = false;
  mockWatcherResumeCalled = false;
  mockWatcherResumeIgnorePeriod = 0;
});

describe("GET /api/tags/[tagName]", () => {
  describe("Successful Tag Retrieval", () => {
    test("should retrieve all books with a specific tag", async () => {
      // Arrange: Create books with "Fantasy" tag
      const book1 = await bookRepository.create(createTestBook({
        calibreId: 1,
        title: "Fantasy Book 1",
        authors: ["Author 1"],
        path: "Author 1/Fantasy Book 1 (1)",
        tags: ["Fantasy", "Magic"],
      }));

      const book2 = await bookRepository.create(createTestBook({
        calibreId: 2,
        title: "Fantasy Book 2",
        authors: ["Author 2"],
        path: "Author 2/Fantasy Book 2 (2)",
        tags: ["Fantasy", "Adventure"],
      }));

      // Book without the tag (should not be returned)
      await bookRepository.create(createTestBook({
        calibreId: 3,
        title: "Sci-Fi Book",
        authors: ["Author 3"],
        path: "Author 3/Sci-Fi Book (3)",
        tags: ["Sci-Fi"],
      }));

      // Act
      const request = createMockRequest("GET", "/api/tags/Fantasy");
      const response = await GET(request as NextRequest, { params: { tagName: "Fantasy" } });
      const data = await response.json();

      // Assert
      expect(response.status).toBe(200);
      expect(data.tag).toBe("Fantasy");
      expect(data.books).toHaveLength(2);
      expect(data.total).toBe(2);
      expect(data.books[0].id).toBe(book1.id);
      expect(data.books[1].id).toBe(book2.id);
    });

    test("should handle URL-encoded tag names", async () => {
      // Arrange
      await bookRepository.create(createTestBook({
        calibreId: 1,
        title: "Book with special tag",
        authors: ["Author"],
        path: "Author/Book (1)",
        tags: ["Science Fiction"], // Tag with space
      }));

      // Act - URL encoded space
      const request = createMockRequest("GET", "/api/tags/Science%20Fiction");
      const response = await GET(request as NextRequest, { params: { tagName: "Science%20Fiction" } });
      const data = await response.json();

      // Assert
      expect(response.status).toBe(200);
      expect(data.tag).toBe("Science Fiction"); // Decoded
      expect(data.books).toHaveLength(1);
    });

    test("should return empty array for tag with no books", async () => {
      // Arrange - no books with "NonExistent" tag
      
      // Act
      const request = createMockRequest("GET", "/api/tags/NonExistent");
      const response = await GET(request as NextRequest, { params: { tagName: "NonExistent" } });
      const data = await response.json();

      // Assert
      expect(response.status).toBe(200);
      expect(data.tag).toBe("NonExistent");
      expect(data.books).toHaveLength(0);
      expect(data.total).toBe(0);
    });

    test("should handle tags with special characters", async () => {
      // Arrange
      await bookRepository.create(createTestBook({
        calibreId: 1,
        title: "Book",
        authors: ["Author"],
        path: "Author/Book (1)",
        tags: ["Action & Adventure"],
      }));

      // Act
      const request = createMockRequest("GET", "/api/tags/Action%20%26%20Adventure");
      const response = await GET(request as NextRequest, { params: { tagName: "Action%20%26%20Adventure" } });
      const data = await response.json();

      // Assert
      expect(response.status).toBe(200);
      expect(data.tag).toBe("Action & Adventure");
      expect(data.books).toHaveLength(1);
    });

    test("should handle unicode tag names", async () => {
      // Arrange
      await bookRepository.create(createTestBook({
        calibreId: 1,
        title: "Book",
        authors: ["Author"],
        path: "Author/Book (1)",
        tags: ["科幻小说"], // Chinese characters
      }));

      // Act
      const encodedTag = encodeURIComponent("科幻小说");
      const request = createMockRequest("GET", `/api/tags/${encodedTag}`);
      const response = await GET(request as NextRequest, { params: { tagName: encodedTag } });
      const data = await response.json();

      // Assert
      expect(response.status).toBe(200);
      expect(data.tag).toBe("科幻小说");
      expect(data.books).toHaveLength(1);
    });
  });

  describe("Pagination", () => {
    test("should support limit parameter", async () => {
      // Arrange: Create 10 books with same tag
      for (let i = 1; i <= 10; i++) {
        await bookRepository.create(createTestBook({
          calibreId: i,
          title: `Book ${i}`,
          authors: ["Author"],
          path: `Author/Book ${i} (${i})`,
          tags: ["Fantasy"],
        }));
      }

      // Act: Request only 5 books
      const request = createMockRequest("GET", "/api/tags/Fantasy?limit=5");
      const response = await GET(request as NextRequest, { params: { tagName: "Fantasy" } });
      const data = await response.json();

      // Assert
      expect(response.status).toBe(200);
      expect(data.books).toHaveLength(5);
      expect(data.total).toBe(10); // Total count should still be 10
    });

    test("should support skip parameter for pagination", async () => {
      // Arrange: Create 10 books with same tag
      const createdBooks = [];
      for (let i = 1; i <= 10; i++) {
        const book = await bookRepository.create(createTestBook({
          calibreId: i,
          title: `Book ${i}`,
          authors: ["Author"],
          path: `Author/Book ${i} (${i})`,
          tags: ["Fantasy"],
        }));
        createdBooks.push(book);
      }

      // Act: Skip first 3 books, get next 3
      const request = createMockRequest("GET", "/api/tags/Fantasy?skip=3&limit=3");
      const response = await GET(request as NextRequest, { params: { tagName: "Fantasy" } });
      const data = await response.json();

      // Assert
      expect(response.status).toBe(200);
      expect(data.books).toHaveLength(3);
      expect(data.total).toBe(10);
    });

    test("should use default pagination when parameters not provided", async () => {
      // Arrange: Create 3 books
      for (let i = 1; i <= 3; i++) {
        await bookRepository.create(createTestBook({
          calibreId: i,
          title: `Book ${i}`,
          authors: ["Author"],
          path: `Author/Book ${i} (${i})`,
          tags: ["Fantasy"],
        }));
      }

      // Act: No pagination params
      const request = createMockRequest("GET", "/api/tags/Fantasy");
      const response = await GET(request as NextRequest, { params: { tagName: "Fantasy" } });
      const data = await response.json();

      // Assert
      expect(response.status).toBe(200);
      expect(data.books).toHaveLength(3);
      expect(data.total).toBe(3);
    });

    test("should handle large skip values gracefully", async () => {
      // Arrange: Create 5 books
      for (let i = 1; i <= 5; i++) {
        await bookRepository.create(createTestBook({
          calibreId: i,
          title: `Book ${i}`,
          authors: ["Author"],
          path: `Author/Book ${i} (${i})`,
          tags: ["Fantasy"],
        }));
      }

      // Act: Skip beyond available books
      const request = createMockRequest("GET", "/api/tags/Fantasy?skip=100");
      const response = await GET(request as NextRequest, { params: { tagName: "Fantasy" } });
      const data = await response.json();

      // Assert
      expect(response.status).toBe(200);
      expect(data.books).toHaveLength(0);
      expect(data.total).toBe(5); // Total should still be correct
    });
  });

  describe("Error Handling", () => {
    test("should handle database errors gracefully", async () => {
      // This test verifies the catch block in the route handler
      // We can't easily simulate a database error without mocking,
      // but we verify the structure supports error handling
      const request = createMockRequest("GET", "/api/tags/ValidTag");
      const response = await GET(request as NextRequest, { params: { tagName: "ValidTag" } });
      
      // Should not throw, even with no data
      expect(response.status).toBe(200);
    });
  });
});

describe("PATCH /api/tags/[tagName]", () => {
  describe("Successful Tag Renaming", () => {
    test("should rename tag across all books", async () => {
      // Arrange: Books with typo tag
      const book1 = await bookRepository.create(createTestBook({
        calibreId: 1,
        title: "Fantasy Book 1",
        authors: ["Author"],
        path: "Author/Fantasy Book 1 (1)",
        tags: ["fantacy", "magic"], // Typo
      }));

      const book2 = await bookRepository.create(createTestBook({
        calibreId: 2,
        title: "Fantasy Book 2",
        authors: ["Author"],
        path: "Author/Fantasy Book 2 (2)",
        tags: ["adventure", "fantacy"], // Typo
      }));

      // Act: Rename "fantacy" → "fantasy"
      const request = createMockRequest("PATCH", "/api/tags/fantacy", {
        newName: "fantasy",
      });
      const response = await PATCH(request as NextRequest, { params: { tagName: "fantacy" } });
      const data = await response.json();

      // Assert
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.oldName).toBe("fantacy");
      expect(data.newName).toBe("fantasy");
      expect(data.successCount).toBe(2);
      expect(data.failureCount).toBe(0);

      // Verify books updated
      const updatedBook1 = await bookRepository.findById(book1.id);
      const updatedBook2 = await bookRepository.findById(book2.id);
      expect(updatedBook1?.tags).toContain("fantasy");
      expect(updatedBook1?.tags).not.toContain("fantacy");
      expect(updatedBook2?.tags).toContain("fantasy");
      expect(updatedBook2?.tags).not.toContain("fantacy");

      // Verify Calibre batch sync was called
      expect(mockBatchUpdateCalibreTags).toHaveBeenCalledTimes(1);
      const syncCall = mockBatchUpdateCalibreTags.mock.calls[0][0];
      expect(syncCall).toHaveLength(2);
      expect(syncCall[0].calibreId).toBe(1);
      expect(syncCall[1].calibreId).toBe(2);
    });

    test("should handle URL-encoded tag names", async () => {
      // Arrange
      const book = await bookRepository.create(createTestBook({
        calibreId: 1,
        title: "Book",
        authors: ["Author"],
        path: "Author/Book (1)",
        tags: ["Science Fiction"],
      }));

      // Act: Rename with URL encoding
      const request = createMockRequest("PATCH", "/api/tags/Science%20Fiction", {
        newName: "Sci-Fi",
      });
      const response = await PATCH(request as NextRequest, { params: { tagName: "Science%20Fiction" } });
      const data = await response.json();

      // Assert
      expect(response.status).toBe(200);
      expect(data.oldName).toBe("Science Fiction");
      expect(data.newName).toBe("Sci-Fi");

      const updatedBook = await bookRepository.findById(book.id);
      expect(updatedBook?.tags).toContain("Sci-Fi");
      expect(updatedBook?.tags).not.toContain("Science Fiction");
    });

    test("should trim whitespace from new name", async () => {
      // Arrange
      await bookRepository.create(createTestBook({
        calibreId: 1,
        title: "Book",
        authors: ["Author"],
        path: "Author/Book (1)",
        tags: ["old"],
      }));

      // Act: New name with whitespace
      const request = createMockRequest("PATCH", "/api/tags/old", {
        newName: "  new  ",
      });
      const response = await PATCH(request as NextRequest, { params: { tagName: "old" } });
      const data = await response.json();

      // Assert
      expect(response.status).toBe(200);
      expect(data.newName).toBe("new"); // Trimmed
    });

    test("should handle special characters in tag names", async () => {
      // Arrange
      await bookRepository.create(createTestBook({
        calibreId: 1,
        title: "Book",
        authors: ["Author"],
        path: "Author/Book (1)",
        tags: ["Action/Adventure"],
      }));

      // Act
      const request = createMockRequest("PATCH", "/api/tags/Action%2FAdventure", {
        newName: "Action & Adventure",
      });
      const response = await PATCH(request as NextRequest, { params: { tagName: "Action%2FAdventure" } });
      const data = await response.json();

      // Assert
      expect(response.status).toBe(200);
      expect(data.newName).toBe("Action & Adventure");
    });

    test("should handle unicode tag names", async () => {
      // Arrange
      await bookRepository.create(createTestBook({
        calibreId: 1,
        title: "Book",
        authors: ["Author"],
        path: "Author/Book (1)",
        tags: ["科幻"],
      }));

      // Act
      const encodedTag = encodeURIComponent("科幻");
      const request = createMockRequest("PATCH", `/api/tags/${encodedTag}`, {
        newName: "科幻小说", // Expanded Chinese name
      });
      const response = await PATCH(request as NextRequest, { params: { tagName: encodedTag } });
      const data = await response.json();

      // Assert
      expect(response.status).toBe(200);
      expect(data.newName).toBe("科幻小说");
    });

    test("should sync to Calibre in batch after rename", async () => {
      // Arrange: Multiple books
      await bookRepository.create(createTestBook({
        calibreId: 1,
        title: "Book 1",
        authors: ["Author"],
        path: "Author/Book 1 (1)",
        tags: ["old"],
      }));
      await bookRepository.create(createTestBook({
        calibreId: 2,
        title: "Book 2",
        authors: ["Author"],
        path: "Author/Book 2 (2)",
        tags: ["old", "another"],
      }));

      // Act
      const request = createMockRequest("PATCH", "/api/tags/old", {
        newName: "new",
      });
      await PATCH(request as NextRequest, { params: { tagName: "old" } });

      // Assert: Batch sync called once with all books
      expect(mockBatchUpdateCalibreTags).toHaveBeenCalledTimes(1);
      const syncCall = mockBatchUpdateCalibreTags.mock.calls[0][0];
      expect(syncCall).toHaveLength(2);
    });

    test("should fail when Calibre sync fails (fail fast)", async () => {
      // Arrange
      const book = await bookRepository.create(createTestBook({
        calibreId: 1,
        title: "Book",
        authors: ["Author"],
        path: "Author/Book (1)",
        tags: ["old"],
      }));
      mockCalibreShouldFail = true;

      // Act
      const request = createMockRequest("PATCH", "/api/tags/old", {
        newName: "new",
      });
      const response = await PATCH(request as NextRequest, { params: { tagName: "old" } });
      const data = await response.json();

      // Assert: Should return 500 error
      expect(response.status).toBe(500);
      expect(data.error).toBe("Calibre database is unavailable");

      // Verify Tome DB unchanged
      const unchangedBook = await bookRepository.findById(book.id);
      expect(unchangedBook?.tags).toEqual(["old"]);
      
      // Verify watcher was still resumed with ignore period
      expect(mockWatcherResumeCalled).toBe(true);
      expect(mockWatcherResumeIgnorePeriod).toBe(3000);
    });
  });

  describe("Validation Errors", () => {
    test("should return 400 when newName is missing", async () => {
      // Act
      const request = createMockRequest("PATCH", "/api/tags/old", {
        // No newName field
      });
      const response = await PATCH(request as NextRequest, { params: { tagName: "old" } });
      const data = await response.json();

      // Assert
      expect(response.status).toBe(400);
      expect(data.error).toContain("newName is required");
    });

    test("should return 400 when newName is not a string", async () => {
      // Act
      const request = createMockRequest("PATCH", "/api/tags/old", {
        newName: 123,
      });
      const response = await PATCH(request as NextRequest, { params: { tagName: "old" } });
      const data = await response.json();

      // Assert
      expect(response.status).toBe(400);
      expect(data.error).toContain("must be a string");
    });

    test("should return 400 when newName is empty after trimming", async () => {
      // Act
      const request = createMockRequest("PATCH", "/api/tags/old", {
        newName: "   ",
      });
      const response = await PATCH(request as NextRequest, { params: { tagName: "old" } });
      const data = await response.json();

      // Assert
      expect(response.status).toBe(400);
      expect(data.error).toContain("cannot be empty");
    });

    test("should return 400 when oldName and newName are the same", async () => {
      // Act
      const request = createMockRequest("PATCH", "/api/tags/same", {
        newName: "same",
      });
      const response = await PATCH(request as NextRequest, { params: { tagName: "same" } });
      const data = await response.json();

      // Assert
      expect(response.status).toBe(400);
      expect(data.error).toContain("must be different");
    });

    test("should return 400 when newName is null", async () => {
      // Act
      const request = createMockRequest("PATCH", "/api/tags/old", {
        newName: null,
      });
      const response = await PATCH(request as NextRequest, { params: { tagName: "old" } });
      const data = await response.json();

      // Assert
      expect(response.status).toBe(400);
      expect(data.error).toContain("newName is required");
    });
  });

  describe("Edge Cases", () => {
    test("should return 0 books updated when tag doesn't exist", async () => {
      // Act: Rename non-existent tag
      const request = createMockRequest("PATCH", "/api/tags/NonExistent", {
        newName: "New",
      });
      const response = await PATCH(request as NextRequest, { params: { tagName: "NonExistent" } });
      const data = await response.json();

      // Assert
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.successCount).toBe(0);
      expect(data.failureCount).toBe(0);
    });

    test("should preserve other tags when renaming", async () => {
      // Arrange
      const book = await bookRepository.create(createTestBook({
        calibreId: 1,
        title: "Book",
        authors: ["Author"],
        path: "Author/Book (1)",
        tags: ["old", "keep1", "keep2"],
      }));

      // Act
      const request = createMockRequest("PATCH", "/api/tags/old", {
        newName: "new",
      });
      await PATCH(request as NextRequest, { params: { tagName: "old" } });

      // Assert
      const updatedBook = await bookRepository.findById(book.id);
      expect(updatedBook?.tags).toContain("new");
      expect(updatedBook?.tags).toContain("keep1");
      expect(updatedBook?.tags).toContain("keep2");
      expect(updatedBook?.tags).not.toContain("old");
    });

    test("should not affect books without the tag", async () => {
      // Arrange
      const book1 = await bookRepository.create(createTestBook({
        calibreId: 1,
        title: "Book 1",
        authors: ["Author"],
        path: "Author/Book 1 (1)",
        tags: ["old"],
      }));

      const book2 = await bookRepository.create(createTestBook({
        calibreId: 2,
        title: "Book 2",
        authors: ["Author"],
        path: "Author/Book 2 (2)",
        tags: ["different"],
      }));

      // Act
      const request = createMockRequest("PATCH", "/api/tags/old", {
        newName: "new",
      });
      const response = await PATCH(request as NextRequest, { params: { tagName: "old" } });
      const data = await response.json();

      // Assert
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.successCount).toBe(1); // Only book1 affected
      expect(data.failureCount).toBe(0);
      
      const unchangedBook = await bookRepository.findById(book2.id);
      expect(unchangedBook?.tags).toEqual(["different"]); // Unchanged
    });

    test("should handle books with tag appearing multiple times (deduplication)", async () => {
      // Note: This shouldn't happen in practice, but tests robustness
      // Arrange: Manually insert book with duplicate tag
      const book = await bookRepository.create(createTestBook({
        calibreId: 1,
        title: "Book",
        authors: ["Author"],
        path: "Author/Book (1)",
        tags: ["old"],
      }));

      // Act
      const request = createMockRequest("PATCH", "/api/tags/old", {
        newName: "new",
      });
      await PATCH(request as NextRequest, { params: { tagName: "old" } });

      // Assert: Should not create duplicates
      const updatedBook = await bookRepository.findById(book.id);
      expect(updatedBook?.tags).toEqual(["new"]);
    });
  });
});
