import { describe, test, expect, beforeAll, afterAll, beforeEach, mock } from "bun:test";
import { bookRepository } from "@/lib/repositories";
import { setupTestDatabase, teardownTestDatabase, clearTestDatabase } from "@/__tests__/helpers/db-setup";
import { mockBook1, mockBook2, createMockRequest } from "../fixtures/test-data";
import type { NextRequest } from "next/server";

/**
 * Tags API Endpoint Tests
 * 
 * Tests the PATCH /api/books/:id/tags endpoint which updates book tags
 * in both the local database and Calibre database.
 * 
 * Coverage:
 * - Valid tag updates
 * - Tag removal (empty array)
 * - Validation errors
 * - 404 for non-existent books
 * - Calibre write failure handling
 */

/**
 * Mock Rationale: Avoid file system I/O to Calibre's SQLite database during tests.
 * We mock Calibre write operations to: (1) verify our code attempts to sync tags,
 * and (2) simulate error conditions (e.g., Calibre database unavailable) to test
 * our error handling without requiring actual file system failures.
 * 
 * ARCHITECTURE FIX: Now mocking CalibreService instead of calibre-write module.
 * This prevents mock leakage to calibre-write.test.ts since they're different modules.
 */
let mockUpdateCalibreTags = mock(() => {});
let mockBatchUpdateCalibreTags = mock((updates: Array<{ calibreId: number; tags: string[] }>) => ({
  totalAttempted: updates.length,
  successCount: updates.length,
  failures: []
}));
let mockCalibreShouldFail = false;

mock.module("@/lib/services/calibre.service", () => ({
  calibreService: {
    updateTags: (calibreId: number, tags: string[]) => {
      if (mockCalibreShouldFail) {
        throw new Error("Calibre database is unavailable");
      }
      mockUpdateCalibreTags(calibreId, tags);
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

// Import after mock is set up
import { PATCH } from "@/app/api/books/[id]/tags/route";

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
  mockWatcherResumeIgnorePeriod = 0;
});

describe("PATCH /api/books/[id]/tags", () => {
  describe("Successful Tag Updates", () => {
    test("should update tags for book", async () => {
      const book = await bookRepository.create(mockBook1);

      const request = createMockRequest("PATCH", `/api/books/${book.id}/tags`, {
        tags: ["Fiction", "Fantasy", "Classic"],
      });
      const response = await PATCH(request as NextRequest, { params: { id: book.id.toString() } });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.tags).toEqual(["Fiction", "Fantasy", "Classic"]);
      expect(mockBatchUpdateCalibreTags).toHaveBeenCalledTimes(1);
      const syncCall = mockBatchUpdateCalibreTags.mock.calls[0][0];
      expect(syncCall).toHaveLength(1);
      expect(syncCall[0].calibreId).toBe(book.calibreId);
      expect(syncCall[0].tags).toEqual(["Fiction", "Fantasy", "Classic"]);

      // Verify in database
      const updatedBook = await bookRepository.findById(book.id);
      expect(updatedBook?.tags).toEqual(["Fiction", "Fantasy", "Classic"]);
      
      // Verify watcher suspend/resume was called
      expect(mockWatcherSuspendCalled).toBe(true);
      expect(mockWatcherResumeCalled).toBe(true);
      expect(mockWatcherResumeIgnorePeriod).toBe(3000);
    });

    test("should update with single tag", async () => {
      const book = await bookRepository.create(mockBook1);

      const request = createMockRequest("PATCH", `/api/books/${book.id}/tags`, {
        tags: ["Fiction"],
      });
      const response = await PATCH(request as NextRequest, { params: { id: book.id.toString() } });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.tags).toEqual(["Fiction"]);
    });

    test("should clear all tags with empty array", async () => {
      const book = await bookRepository.create(mockBook1);
      // Update to add tags first
      await bookRepository.update(book.id, { tags: ["Fiction", "Classic"] });

      const request = createMockRequest("PATCH", `/api/books/${book.id}/tags`, {
        tags: [],
      });
      const response = await PATCH(request as NextRequest, { params: { id: book.id.toString() } });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.tags).toEqual([]);

      // Verify in database
      const updatedBook = await bookRepository.findById(book.id);
      expect(updatedBook?.tags).toEqual([]);
    });

    test("should replace existing tags", async () => {
      const book = await bookRepository.create(mockBook1);
      // Update to add tags first
      await bookRepository.update(book.id, { tags: ["Old Tag 1", "Old Tag 2"] });

      const request = createMockRequest("PATCH", `/api/books/${book.id}/tags`, {
        tags: ["New Tag 1", "New Tag 2", "New Tag 3"],
      });
      const response = await PATCH(request as NextRequest, { params: { id: book.id.toString() } });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.tags).toEqual(["New Tag 1", "New Tag 2", "New Tag 3"]);

      // Verify old tags were replaced
      const updatedBook = await bookRepository.findById(book.id);
      expect(updatedBook?.tags).not.toContain("Old Tag 1");
      expect(updatedBook?.tags).not.toContain("Old Tag 2");
    });

    test("should return complete book object", async () => {
      const book = await bookRepository.create(mockBook1);

      const request = createMockRequest("PATCH", `/api/books/${book.id}/tags`, {
        tags: ["Fiction"],
      });
      const response = await PATCH(request as NextRequest, { params: { id: book.id.toString() } });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toMatchObject({
        id: book.id,
        title: book.title,
        authors: book.authors,
        tags: ["Fiction"],
      });
    });

    test("should call Calibre sync before database update", async () => {
      const book = await bookRepository.create(mockBook1);

      const request = createMockRequest("PATCH", `/api/books/${book.id}/tags`, {
        tags: ["Fiction"],
      });
      await PATCH(request as NextRequest, { params: { id: book.id.toString() } });

      // Verify Calibre batch update was called
      expect(mockBatchUpdateCalibreTags).toHaveBeenCalledTimes(1);
      const syncCall = mockBatchUpdateCalibreTags.mock.calls[0][0];
      expect(syncCall).toHaveLength(1);
      expect(syncCall[0].calibreId).toBe(book.calibreId);
      expect(syncCall[0].tags).toEqual(["Fiction"]);
    });

    test("should handle tags with special characters", async () => {
      const book = await bookRepository.create(mockBook1);

      const request = createMockRequest("PATCH", `/api/books/${book.id}/tags`, {
        tags: ["Science-Fiction", "Action & Adventure", "Editor's Choice"],
      });
      const response = await PATCH(request as NextRequest, { params: { id: book.id.toString() } });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.tags).toEqual(["Science-Fiction", "Action & Adventure", "Editor's Choice"]);
    });

    test("should handle unicode tags", async () => {
      const book = await bookRepository.create(mockBook1);

      const request = createMockRequest("PATCH", `/api/books/${book.id}/tags`, {
        tags: ["科幻小说", "ファンタジー", "🔮 Magic"],
      });
      const response = await PATCH(request as NextRequest, { params: { id: book.id.toString() } });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.tags).toEqual(["科幻小说", "ファンタジー", "🔮 Magic"]);
    });
  });

  describe("Validation Errors", () => {
    test("should return 400 for non-array tags", async () => {
      const book = await bookRepository.create(mockBook1);

      const request = createMockRequest("PATCH", `/api/books/${book.id}/tags`, {
        tags: "Fiction",
      });
      const response = await PATCH(request as NextRequest, { params: { id: book.id.toString() } });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain("must be an array");
    });

    test("should return 400 for tags with non-string values", async () => {
      const book = await bookRepository.create(mockBook1);

      const request = createMockRequest("PATCH", `/api/books/${book.id}/tags`, {
        tags: ["Fiction", 123, "Fantasy"],
      });
      const response = await PATCH(request as NextRequest, { params: { id: book.id.toString() } });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain("must be a string");
    });

    test("should return 400 for invalid book ID format", async () => {
      const request = createMockRequest("PATCH", "/api/books/invalid/tags", {
        tags: ["Fiction"],
      });
      const response = await PATCH(request as NextRequest, { params: { id: "invalid" } });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain("Invalid book ID");
    });

    test("should return 400 for null tags", async () => {
      const book = await bookRepository.create(mockBook1);

      const request = createMockRequest("PATCH", `/api/books/${book.id}/tags`, {
        tags: null,
      });
      const response = await PATCH(request as NextRequest, { params: { id: book.id.toString() } });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain("must be an array");
    });

    test("should return 400 for undefined tags", async () => {
      const book = await bookRepository.create(mockBook1);

      const request = createMockRequest("PATCH", `/api/books/${book.id}/tags`, {
        // tags field missing
      });
      const response = await PATCH(request as NextRequest, { params: { id: book.id.toString() } });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain("must be an array");
    });
  });

  describe("Error Cases", () => {
    test("should return 404 for non-existent book", async () => {
      const request = createMockRequest("PATCH", "/api/books/99999/tags", {
        tags: ["Fiction"],
      });
      const response = await PATCH(request as NextRequest, { params: { id: "99999" } });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toContain("not found");
    });

    test("should fail when Calibre sync fails (fail fast)", async () => {
      const book = await bookRepository.create(mockBook1);
      mockCalibreShouldFail = true;

      const request = createMockRequest("PATCH", `/api/books/${book.id}/tags`, {
        tags: ["Fiction"],
      });
      const response = await PATCH(request as NextRequest, { params: { id: book.id.toString() } });
      const data = await response.json();

      // Should fail with 500 error (fail fast - not best effort)
      expect(response.status).toBe(500);
      expect(data.error).toContain("Failed to update tags");

      // Tags should NOT be updated in local DB (transaction rolled back)
      const unchangedBook = await bookRepository.findById(book.id);
      expect(unchangedBook?.tags).toEqual(mockBook1.tags);
      
      // Verify watcher was still resumed with ignore period
      expect(mockWatcherResumeCalled).toBe(true);
      expect(mockWatcherResumeIgnorePeriod).toBe(3000);
    });
  });

  describe("Edge Cases", () => {
    test("should handle large number of tags", async () => {
      const book = await bookRepository.create(mockBook1);
      const manyTags = Array.from({ length: 50 }, (_, i) => `Tag ${i + 1}`);

      const request = createMockRequest("PATCH", `/api/books/${book.id}/tags`, {
        tags: manyTags,
      });
      const response = await PATCH(request as NextRequest, { params: { id: book.id.toString() } });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.tags).toHaveLength(50);
    });

    test("should handle very long tag names", async () => {
      const book = await bookRepository.create(mockBook1);
      const longTag = "A".repeat(200);

      const request = createMockRequest("PATCH", `/api/books/${book.id}/tags`, {
        tags: [longTag, "Short"],
      });
      const response = await PATCH(request as NextRequest, { params: { id: book.id.toString() } });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.tags).toContain(longTag);
      expect(data.tags).toContain("Short");
    });

    test("should not affect other books' tags", async () => {
      const book1 = await bookRepository.create({ ...mockBook1, tags: ["Book1 Tag"] });
      const book2 = await bookRepository.create({ ...mockBook2, tags: ["Book2 Tag"] });

      const request = createMockRequest("PATCH", `/api/books/${book1.id}/tags`, {
        tags: ["New Tag"],
      });
      await PATCH(request as NextRequest, { params: { id: book1.id.toString() } });

      // Verify book2's tags unchanged
      const unchangedBook = await bookRepository.findById(book2.id);
      expect(unchangedBook?.tags).toEqual(["Book2 Tag"]);
    });
  });
});
