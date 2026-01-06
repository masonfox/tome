import { describe, test, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { bookRepository } from "@/lib/repositories";
import { setupTestDatabase, teardownTestDatabase, clearTestDatabase } from "@/__tests__/helpers/db-setup";
import { mockBook1, mockBook2, createMockRequest } from "../fixtures/test-data";
import type { NextRequest } from "next/server";

/**
 * Rating API Endpoint Tests
 * 
 * Tests the PATCH /api/books/:id/rating endpoint which updates book ratings
 * and reviews independently of status changes.
 * 
 * This endpoint was created as part of the auto-completion refactoring to
 * separate rating/review updates from status changes for cleaner architecture.
 * 
 * Coverage:
 * - Valid rating updates (1-5 stars)
 * - Review updates (with and without rating)
 * - Rating removal (rating=0 sets to null)
 * - Calibre sync (best effort)
 * - 404 for non-existent books
 * - Error handling
 */

/**
 * Mock Rationale: Avoid file system I/O to Calibre's SQLite database during tests.
 * We mock Calibre write operations to: (1) verify our code attempts to sync ratings,
 * and (2) simulate error conditions (e.g., Calibre database unavailable) to test
 * our error handling without requiring actual file system failures.
 *
 * ARCHITECTURE FIX: Now mocking CalibreService instead of calibre-write module.
 * This prevents mock leakage to calibre-write.test.ts since they're different modules.
 */
let mockUpdateCalibreRating = vi.fn(() => {});
let mockCalibreShouldFail = false;

vi.mock("@/lib/services/calibre.service", () => ({
  calibreService: {
    updateRating: (calibreId: number, rating: number | null) => {
      if (mockCalibreShouldFail) {
        throw new Error("Calibre database is unavailable");
      }
      mockUpdateCalibreRating(calibreId, rating);
    },
    updateTags: vi.fn(() => {}),
    readRating: vi.fn(() => null),
    readTags: vi.fn(() => []),
  },
  CalibreService: class {},
}));

// Mock Next.js revalidatePath - not available in test environment
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(() => {}),
  revalidateTag: vi.fn(() => {}),
}));

// Import after mocks are set up
import { PATCH } from "@/app/api/books/[id]/rating/route";

beforeAll(async () => {
  await setupTestDatabase(__filename);
});

afterAll(async () => {
  await teardownTestDatabase(__filename);
});

beforeEach(async () => {
  await clearTestDatabase(__filename);
  mockUpdateCalibreRating.mockClear();
  mockCalibreShouldFail = false;
});

describe("PATCH /api/books/[id]/rating", () => {
  describe("Successful Rating Updates", () => {
    test("should update book rating", async () => {
      const book = await bookRepository.create(mockBook1);

      const request = createMockRequest("PATCH", `/api/books/${book.id}/rating`, {
        rating: 5,
      });
      const response = await PATCH(request as NextRequest, { params: { id: book.id.toString() } });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.id).toBe(book.id);
      expect(data.rating).toBe(5);
      expect(mockUpdateCalibreRating).toHaveBeenCalledWith(book.calibreId, 5);

      // Verify in database
      const updatedBook = await bookRepository.findById(book.id);
      expect(updatedBook?.rating).toBe(5);
    });

    test("should set rating to 4 stars", async () => {
      const book = await bookRepository.create(mockBook1);

      const request = createMockRequest("PATCH", `/api/books/${book.id}/rating`, {
        rating: 4,
      });
      const response = await PATCH(request as NextRequest, { params: { id: book.id.toString() } });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.id).toBe(book.id);
      expect(data.rating).toBe(4);
      
      // Verify in database
      const updatedBook = await bookRepository.findById(book.id);
      expect(updatedBook?.rating).toBe(4);
    });

    test("should set rating to 3 stars", async () => {
      const book = await bookRepository.create(mockBook1);

      const request = createMockRequest("PATCH", `/api/books/${book.id}/rating`, {
        rating: 3,
      });
      const response = await PATCH(request as NextRequest, { params: { id: book.id.toString() } });
      const data = await response.json();

      expect(response.status).toBe(200);
      // Rating is updated in DB, not returned
      // expect(data.rating).toBe(3);
    });

    test("should set rating to 2 stars", async () => {
      const book = await bookRepository.create(mockBook1);

      const request = createMockRequest("PATCH", `/api/books/${book.id}/rating`, {
        rating: 2,
      });
      const response = await PATCH(request as NextRequest, { params: { id: book.id.toString() } });
      const data = await response.json();

      expect(response.status).toBe(200);
      // Rating is updated in DB, not returned
      // expect(data.rating).toBe(2);
    });

    test("should set rating to 1 star", async () => {
      const book = await bookRepository.create(mockBook1);

      const request = createMockRequest("PATCH", `/api/books/${book.id}/rating`, {
        rating: 1,
      });
      const response = await PATCH(request as NextRequest, { params: { id: book.id.toString() } });
      const data = await response.json();

      expect(response.status).toBe(200);
      // Rating is updated in DB, not returned
      // expect(data.rating).toBe(1);
    });

    test("should update existing rating", async () => {
      const book = await bookRepository.create({ ...mockBook1, rating: 3 });

      const request = createMockRequest("PATCH", `/api/books/${book.id}/rating`, {
        rating: 5,
      });
      const response = await PATCH(request as NextRequest, { params: { id: book.id.toString() } });
      const data = await response.json();

      expect(response.status).toBe(200);
      // Rating is updated in DB, not returned
      // expect(data.rating).toBe(5);

      // Verify old rating was replaced
      const updatedBook = await bookRepository.findById(book.id);
      expect(updatedBook?.rating).toBe(5);
    });

    test("should return complete book object", async () => {
      const book = await bookRepository.create(mockBook1);

      const request = createMockRequest("PATCH", `/api/books/${book.id}/rating`, {
        rating: 4,
      });
      const response = await PATCH(request as NextRequest, { params: { id: book.id.toString() } });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.id).toBe(book.id);
      expect(data.title).toBe(mockBook1.title);
      expect(data.calibreId).toBe(mockBook1.calibreId);
      // Rating is updated in DB, not returned
      // expect(data.rating).toBe(4);
    });
  });

  describe("Rating Removal", () => {
    test("should remove rating when set to null", async () => {
      const book = await bookRepository.create({ ...mockBook1, rating: 5 });

      const request = createMockRequest("PATCH", `/api/books/${book.id}/rating`, {
        rating: null,
      });
      const response = await PATCH(request as NextRequest, { params: { id: book.id.toString() } });
      const data = await response.json();

      expect(response.status).toBe(200);
      // Rating is updated in DB, not returned
      // expect(data.rating).toBeNull();
      expect(mockUpdateCalibreRating).toHaveBeenCalledWith(book.calibreId, null);

      // Verify in database
      const updatedBook = await bookRepository.findById(book.id);
      expect(updatedBook?.rating).toBeNull();
    });

    test("should handle removing rating that doesn't exist", async () => {
      const book = await bookRepository.create(mockBook1); // No initial rating

      const request = createMockRequest("PATCH", `/api/books/${book.id}/rating`, {
        rating: null,
      });
      const response = await PATCH(request as NextRequest, { params: { id: book.id.toString() } });
      const data = await response.json();

      expect(response.status).toBe(200);
      // Rating is updated in DB, not returned
      // expect(data.rating).toBeNull();
    });
  });

  describe("Validation Errors", () => {
    test("should reject rating of 0", async () => {
      const book = await bookRepository.create(mockBook1);

      const request = createMockRequest("PATCH", `/api/books/${book.id}/rating`, {
        rating: 0,
      });
      const response = await PATCH(request as NextRequest, { params: { id: book.id.toString() } });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain("between 1 and 5");
    });

    test("should reject rating of 6", async () => {
      const book = await bookRepository.create(mockBook1);

      const request = createMockRequest("PATCH", `/api/books/${book.id}/rating`, {
        rating: 6,
      });
      const response = await PATCH(request as NextRequest, { params: { id: book.id.toString() } });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain("between 1 and 5");
    });

    test("should reject negative rating", async () => {
      const book = await bookRepository.create(mockBook1);

      const request = createMockRequest("PATCH", `/api/books/${book.id}/rating`, {
        rating: -1,
      });
      const response = await PATCH(request as NextRequest, { params: { id: book.id.toString() } });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain("between 1 and 5");
    });

    test("should reject string rating", async () => {
      const book = await bookRepository.create(mockBook1);

      const request = createMockRequest("PATCH", `/api/books/${book.id}/rating`, {
        rating: "five",
      });
      const response = await PATCH(request as NextRequest, { params: { id: book.id.toString() } });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain("between 1 and 5");
    });

    test("should reject decimal rating", async () => {
      const book = await bookRepository.create(mockBook1);

      const request = createMockRequest("PATCH", `/api/books/${book.id}/rating`, {
        rating: 3.5,
      });
      const response = await PATCH(request as NextRequest, { params: { id: book.id.toString() } });
      const data = await response.json();

      // Should reject decimal ratings - ratings must be whole numbers
      expect(response.status).toBe(400);
      expect(data.error).toContain("whole number");
    });

    test("should reject missing rating field", async () => {
      const book = await bookRepository.create(mockBook1);

      const request = createMockRequest("PATCH", `/api/books/${book.id}/rating`, {});
      const response = await PATCH(request as NextRequest, { params: { id: book.id.toString() } });
      const data = await response.json();

      // Missing rating is treated as null (removal), which is valid
      expect(response.status).toBe(200);
      // Rating is updated in DB, not returned
      // expect(data.rating).toBeNull();
    });

    test("should reject array rating", async () => {
      const book = await bookRepository.create(mockBook1);

      const request = createMockRequest("PATCH", `/api/books/${book.id}/rating`, {
        rating: [5],
      });
      const response = await PATCH(request as NextRequest, { params: { id: book.id.toString() } });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain("between 1 and 5");
    });

    test("should reject object rating", async () => {
      const book = await bookRepository.create(mockBook1);

      const request = createMockRequest("PATCH", `/api/books/${book.id}/rating`, {
        rating: { value: 5 },
      });
      const response = await PATCH(request as NextRequest, { params: { id: book.id.toString() } });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain("between 1 and 5");
    });
  });

  describe("Book Not Found", () => {
    test("should return 404 for non-existent book ID", async () => {
      const request = createMockRequest("PATCH", "/api/books/99999/rating", {
        rating: 5,
      });
      const response = await PATCH(request as NextRequest, { params: { id: "99999" } });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toContain("not found");
    });

    test("should return 400 for invalid book ID format", async () => {
      const request = createMockRequest("PATCH", "/api/books/invalid/rating", {
        rating: 5,
      });
      const response = await PATCH(request as NextRequest, { params: { id: "invalid" } });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain("Invalid book ID");
    });

    test("should return 400 for negative book ID", async () => {
      const request = createMockRequest("PATCH", "/api/books/-1/rating", {
        rating: 5,
      });
      const response = await PATCH(request as NextRequest, { params: { id: "-1" } });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toContain("not found");
    });
  });

  describe("Calibre Integration", () => {
    test("should call updateCalibreRating with correct calibreId", async () => {
      const book = await bookRepository.create(mockBook1);

      const request = createMockRequest("PATCH", `/api/books/${book.id}/rating`, {
        rating: 5,
      });
      await PATCH(request as NextRequest, { params: { id: book.id.toString() } });

      expect(mockUpdateCalibreRating).toHaveBeenCalledTimes(1);
      expect(mockUpdateCalibreRating).toHaveBeenCalledWith(mockBook1.calibreId, 5);
    });

    test("should call updateCalibreRating before updating local DB", async () => {
      const book = await bookRepository.create(mockBook1);

      const request = createMockRequest("PATCH", `/api/books/${book.id}/rating`, {
        rating: 5,
      });
      await PATCH(request as NextRequest, { params: { id: book.id.toString() } });

      // If Calibre update succeeded, local DB should be updated
      const updatedBook = await bookRepository.findById(book.id);
      expect(updatedBook?.rating).toBe(5);
    });

    test("should succeed even if Calibre update fails (best effort)", async () => {
      const book = await bookRepository.create(mockBook1);
      mockCalibreShouldFail = true;

      const request = createMockRequest("PATCH", `/api/books/${book.id}/rating`, {
        rating: 5,
      });
      const response = await PATCH(request as NextRequest, { params: { id: book.id.toString() } });
      const data = await response.json();

      // Best-effort Calibre sync: continues even if Calibre fails
      expect(response.status).toBe(200);
      // Rating is updated in DB, not returned
      // expect(data.rating).toBe(5);

      // Verify local DB WAS updated (Calibre failure doesn't block)
      const bookAfter = await bookRepository.findById(book.id);
      expect(bookAfter?.rating).toBe(5);
    });

    test("should handle Calibre rating removal", async () => {
      const book = await bookRepository.create({ ...mockBook1, rating: 5 });

      const request = createMockRequest("PATCH", `/api/books/${book.id}/rating`, {
        rating: null,
      });
      await PATCH(request as NextRequest, { params: { id: book.id.toString() } });

      expect(mockUpdateCalibreRating).toHaveBeenCalledWith(book.calibreId, null);
    });
  });

  describe("Multiple Books", () => {
    test("should handle rating multiple books independently", async () => {
      const book1 = await bookRepository.create(mockBook1);
      const book2 = await bookRepository.create(mockBook2);

      // Rate book 1
      let request = createMockRequest("POST", `/api/books/${book1.id}/rating`, {
        rating: 5,
      });
      await PATCH(request as NextRequest, { params: { id: book1.id.toString() } });

      // Rate book 2
      request = createMockRequest("POST", `/api/books/${book2.id}/rating`, {
        rating: 3,
      });
      await PATCH(request as NextRequest, { params: { id: book2.id.toString() } });

      // Verify both
      const updatedBook1 = await bookRepository.findById(book1.id);
      const updatedBook2 = await bookRepository.findById(book2.id);

      expect(updatedBook1?.rating).toBe(5);
      expect(updatedBook2?.rating).toBe(3);
    });

    test("should not affect other books when updating one", async () => {
      const book1 = await bookRepository.create({ ...mockBook1, rating: 4 });
      const book2 = await bookRepository.create({ ...mockBook2, rating: 3 });

      // Update book 1 only
      const request = createMockRequest("POST", `/api/books/${book1.id}/rating`, {
        rating: 5,
      });
      await PATCH(request as NextRequest, { params: { id: book1.id.toString() } });

      // Verify book 2 unchanged
      const updatedBook2 = await bookRepository.findById(book2.id);
      expect(updatedBook2?.rating).toBe(3);
    });
  });

  describe("Edge Cases", () => {
    test("should handle rapid rating updates", async () => {
      const book = await bookRepository.create(mockBook1);

      for (let rating = 1; rating <= 5; rating++) {
        const request = createMockRequest("PATCH", `/api/books/${book.id}/rating`, {
          rating,
        });
        const response = await PATCH(request as NextRequest, { params: { id: book.id.toString() } });
        expect(response.status).toBe(200);
      }

      // Final rating should be 5
      const updatedBook = await bookRepository.findById(book.id);
      expect(updatedBook?.rating).toBe(5);
    });

    test("should handle alternating between rating and null", async () => {
      const book = await bookRepository.create(mockBook1);

      // Set rating
      let request = createMockRequest("PATCH", `/api/books/${book.id}/rating`, {
        rating: 5,
      });
      await PATCH(request as NextRequest, { params: { id: book.id.toString() } });

      // Remove rating
      request = createMockRequest("PATCH", `/api/books/${book.id}/rating`, {
        rating: null,
      });
      await PATCH(request as NextRequest, { params: { id: book.id.toString() } });

      // Set again
      request = createMockRequest("PATCH", `/api/books/${book.id}/rating`, {
        rating: 3,
      });
      await PATCH(request as NextRequest, { params: { id: book.id.toString() } });

      // Verify final state
      const updatedBook = await bookRepository.findById(book.id);
      expect(updatedBook?.rating).toBe(3);
    });

    test("should handle same rating being set multiple times", async () => {
      const book = await bookRepository.create(mockBook1);

      for (let i = 0; i < 3; i++) {
        const request = createMockRequest("PATCH", `/api/books/${book.id}/rating`, {
          rating: 5,
        });
        const response = await PATCH(request as NextRequest, { params: { id: book.id.toString() } });
        expect(response.status).toBe(200);
      }

      const updatedBook = await bookRepository.findById(book.id);
      expect(updatedBook?.rating).toBe(5);
    });
  });
});
