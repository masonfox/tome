import { toProgressDate } from '@/__tests__/test-utils';
import { describe, test, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { POST } from "@/app/api/books/[id]/mark-as-read/route";
import { bookRepository, sessionRepository, progressRepository } from "@/lib/repositories";
import { setupTestDatabase, teardownTestDatabase, clearTestDatabase } from "@/__tests__/helpers/db-setup";
import {
  createMockRequest,
  createTestBook,
  createTestSession,
} from "@/__tests__/fixtures/test-data";
import type { NextRequest } from "next/server";

/**
 * Mock Rationale: Prevent Next.js cache revalidation side effects during tests.
 */
vi.mock("next/cache", () => ({
  revalidatePath: () => {},
}));

/**
 * Mock Rationale: Prevent Calibre sync during tests (file system I/O).
 */
vi.mock("@/lib/services/calibre.service", () => ({
  calibreService: {
    updateRating: () => {},
    readRating: () => null,
    updateTags: () => {},
    readTags: () => [],
  },
  CalibreService: class {},
}));

/**
 * Mock Rationale: Prevent streak rebuilding side effects during tests.
 */
vi.mock("@/lib/streaks", () => ({
  rebuildStreak: vi.fn(() => Promise.resolve()),
}));

beforeAll(async () => {
  await setupTestDatabase(__filename);
});

afterAll(async () => {
  await teardownTestDatabase(__filename);
});

beforeEach(async () => {
  await clearTestDatabase(__filename);
});

describe("POST /api/books/[id]/mark-as-read", () => {
  // ============================================================================
  // Basic Scenarios
  // ============================================================================

  test("should mark book as read with no progress (direct status change)", async () => {
    const book = await bookRepository.create(createTestBook({ totalPages: 300 }));
    await sessionRepository.create(createTestSession({
      bookId: book.id,
      status: "to-read",
      isActive: true,
      sessionNumber: 1,
    }));

    const request = createMockRequest("POST", `/api/books/${book.id}/mark-as-read`, {});
    const response = await POST(request as NextRequest, { params: { id: book.id.toString() } });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.session.status).toBe("read");
    expect(data.session.isActive).toBe(false);
    expect(data.progressCreated).toBe(true); // Creates 100% progress
    expect(data.ratingUpdated).toBe(false);
    expect(data.reviewUpdated).toBe(false);
  });

  test("should mark book as read with rating", async () => {
    const book = await bookRepository.create(createTestBook({ totalPages: 300 }));
    await sessionRepository.create(createTestSession({
      bookId: book.id,
      status: "to-read",
      isActive: true,
      sessionNumber: 1,
    }));

    const request = createMockRequest("POST", `/api/books/${book.id}/mark-as-read`, {
      rating: 5,
    });
    const response = await POST(request as NextRequest, { params: { id: book.id.toString() } });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.session.status).toBe("read");
    expect(data.ratingUpdated).toBe(true);

    // Verify rating was updated in database
    const updatedBook = await bookRepository.findById(book.id);
    expect(updatedBook?.rating).toBe(5);
  });

  test("should mark book as read with review", async () => {
    const book = await bookRepository.create(createTestBook({ totalPages: 300 }));
    await sessionRepository.create(createTestSession({
      bookId: book.id,
      status: "to-read",
      isActive: true,
      sessionNumber: 1,
    }));

    const request = createMockRequest("POST", `/api/books/${book.id}/mark-as-read`, {
      review: "Excellent book!",
    });
    const response = await POST(request as NextRequest, { params: { id: book.id.toString() } });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.session.status).toBe("read");
    expect(data.reviewUpdated).toBe(true);

    // Verify review was saved
    expect(data.session.review).toBe("Excellent book!");
  });

  test("should mark book as read with both rating and review", async () => {
    const book = await bookRepository.create(createTestBook({ totalPages: 300 }));
    await sessionRepository.create(createTestSession({
      bookId: book.id,
      status: "reading",
      isActive: true,
      sessionNumber: 1,
    }));

    const request = createMockRequest("POST", `/api/books/${book.id}/mark-as-read`, {
      rating: 4,
      review: "Great read, highly recommend!",
    });
    const response = await POST(request as NextRequest, { params: { id: book.id.toString() } });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.session.status).toBe("read");
    expect(data.ratingUpdated).toBe(true);
    expect(data.reviewUpdated).toBe(true);

    // Verify both were saved
    const updatedBook = await bookRepository.findById(book.id);
    expect(updatedBook?.rating).toBe(4);
    expect(data.session.review).toBe("Great read, highly recommend!");
  });

  test("should mark book without totalPages as read", async () => {
    const book = await bookRepository.create(createTestBook({ totalPages: null }));
    await sessionRepository.create(createTestSession({
      bookId: book.id,
      status: "to-read",
      isActive: true,
      sessionNumber: 1,
    }));

    const request = createMockRequest("POST", `/api/books/${book.id}/mark-as-read`, {
      rating: 3,
    });
    const response = await POST(request as NextRequest, { params: { id: book.id.toString() } });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.session.status).toBe("read");
    expect(data.progressCreated).toBe(false); // No progress for books without pages
    expect(data.ratingUpdated).toBe(true);
  });

  test("should mark book with existing 100% progress as read", async () => {
    const book = await bookRepository.create(createTestBook({ totalPages: 300 }));
    const session = await sessionRepository.create(createTestSession({
      bookId: book.id,
      status: "reading",
      isActive: true,
      sessionNumber: 1,
    }));

    // Create 100% progress entry
    await progressRepository.create({
      bookId: book.id,
      sessionId: session.id,
      currentPage: 300,
      currentPercentage: 100,
      progressDate: toProgressDate(new Date()),
      pagesRead: 300,
    });

    const request = createMockRequest("POST", `/api/books/${book.id}/mark-as-read`, {});
    const response = await POST(request as NextRequest, { params: { id: book.id.toString() } });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.session.status).toBe("read");
    expect(data.progressCreated).toBe(false); // Already had 100% progress
  });

  // ============================================================================
  // Already-Read Books
  // ============================================================================

  test("should update rating on already-read book", async () => {
    const book = await bookRepository.create(createTestBook({ totalPages: 300, rating: null }));
    const archivedSession = await sessionRepository.create(createTestSession({
      bookId: book.id,
      status: "read",
      isActive: false,
      sessionNumber: 1,
      completedDate: "2024-01-01",
    }));

    const request = createMockRequest("POST", `/api/books/${book.id}/mark-as-read`, {
      rating: 5,
    });
    const response = await POST(request as NextRequest, { params: { id: book.id.toString() } });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.session.id).toBe(archivedSession.id); // Uses most recent session
    expect(data.ratingUpdated).toBe(true);
    expect(data.progressCreated).toBe(false);

    const updatedBook = await bookRepository.findById(book.id);
    expect(updatedBook?.rating).toBe(5);
  });

  test("should add review to already-read book", async () => {
    const book = await bookRepository.create(createTestBook({ totalPages: 300 }));
    const archivedSession = await sessionRepository.create(createTestSession({
      bookId: book.id,
      status: "read",
      isActive: false,
      sessionNumber: 1,
      completedDate: "2024-01-01",
    }));

    const request = createMockRequest("POST", `/api/books/${book.id}/mark-as-read`, {
      review: "Added review later",
    });
    const response = await POST(request as NextRequest, { params: { id: book.id.toString() } });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.session.id).toBe(archivedSession.id);
    expect(data.reviewUpdated).toBe(true);
    expect(data.session.review).toBe("Added review later");
  });

  test("should update existing review on already-read book", async () => {
    const book = await bookRepository.create(createTestBook({ totalPages: 300 }));
    const archivedSession = await sessionRepository.create(createTestSession({
      bookId: book.id,
      status: "read",
      isActive: false,
      sessionNumber: 1,
      completedDate: "2024-01-01",
      review: "Original review",
    }));

    const request = createMockRequest("POST", `/api/books/${book.id}/mark-as-read`, {
      review: "Updated review",
    });
    const response = await POST(request as NextRequest, { params: { id: book.id.toString() } });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.session.id).toBe(archivedSession.id);
    expect(data.reviewUpdated).toBe(true);
    expect(data.session.review).toBe("Updated review");
  });

  // ============================================================================
  // Custom Completion Date
  // ============================================================================

  test("should accept custom completedDate", async () => {
    const book = await bookRepository.create(createTestBook({ totalPages: 300 }));
    await sessionRepository.create(createTestSession({
      bookId: book.id,
      status: "reading",
      isActive: true,
      sessionNumber: 1,
    }));

    const customDate = "2024-06-15";
    const request = createMockRequest("POST", `/api/books/${book.id}/mark-as-read`, {
      completedDate: customDate,
    });
    const response = await POST(request as NextRequest, { params: { id: book.id.toString() } });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.session.status).toBe("read");
    // Compare date strings directly (completedDate is now stored as YYYY-MM-DD string)
    expect(data.session.completedDate).toBe(customDate);
  });

  // ============================================================================
  // Validation and Error Cases
  // ============================================================================

  test("should return 400 with invalid book ID format", async () => {
    const request = createMockRequest("POST", "/api/books/invalid/mark-as-read", {});
    const response = await POST(request as NextRequest, { params: { id: "invalid" } });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain("Invalid book ID format");
  });

  test("should return 400 with invalid rating (too high)", async () => {
    const book = await bookRepository.create(createTestBook({ totalPages: 300 }));

    const request = createMockRequest("POST", `/api/books/${book.id}/mark-as-read`, {
      rating: 6,
    });
    const response = await POST(request as NextRequest, { params: { id: book.id.toString() } });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain("between 1 and 5");
  });

  test("should return 400 with invalid rating (too low)", async () => {
    const book = await bookRepository.create(createTestBook({ totalPages: 300 }));

    const request = createMockRequest("POST", `/api/books/${book.id}/mark-as-read`, {
      rating: 0,
    });
    const response = await POST(request as NextRequest, { params: { id: book.id.toString() } });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain("between 1 and 5");
  });

  test("should return 400 with non-integer rating", async () => {
    const book = await bookRepository.create(createTestBook({ totalPages: 300 }));

    const request = createMockRequest("POST", `/api/books/${book.id}/mark-as-read`, {
      rating: 3.5,
    });
    const response = await POST(request as NextRequest, { params: { id: book.id.toString() } });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain("whole number");
  });

  test("should return 404 when book not found", async () => {
    const request = createMockRequest("POST", "/api/books/99999/mark-as-read", {
      rating: 5,
    });
    const response = await POST(request as NextRequest, { params: { id: "99999" } });
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toContain("not found");
  });

  // ============================================================================
  // Edge Cases
  // ============================================================================

  test("should handle marking as read multiple times (idempotent)", async () => {
    const book = await bookRepository.create(createTestBook({ totalPages: 300 }));
    await sessionRepository.create(createTestSession({
      bookId: book.id,
      status: "to-read",
      isActive: true,
      sessionNumber: 1,
    }));

    // First mark as read
    const request1 = createMockRequest("POST", `/api/books/${book.id}/mark-as-read`, {
      rating: 4,
    });
    const response1 = await POST(request1 as NextRequest, { params: { id: book.id.toString() } });
    expect(response1.status).toBe(200);

    // Second mark as read (should update the existing completed session)
    const request2 = createMockRequest("POST", `/api/books/${book.id}/mark-as-read`, {
      rating: 5,
      review: "Changed my mind, it's 5 stars!",
    });
    const response2 = await POST(request2 as NextRequest, { params: { id: book.id.toString() } });
    const data2 = await response2.json();

    expect(response2.status).toBe(200);
    expect(data2.ratingUpdated).toBe(true);
    expect(data2.reviewUpdated).toBe(true);

    const updatedBook = await bookRepository.findById(book.id);
    expect(updatedBook?.rating).toBe(5);
  });

  test("should handle book with multiple archived sessions", async () => {
    const book = await bookRepository.create(createTestBook({ totalPages: 300 }));

    // Create multiple archived sessions
    await sessionRepository.create(createTestSession({
      bookId: book.id,
      status: "read",
      isActive: false,
      sessionNumber: 1,
      completedDate: "2023-01-01",
    }));
    await sessionRepository.create(createTestSession({
      bookId: book.id,
      status: "read",
      isActive: false,
      sessionNumber: 2,
      completedDate: "2024-01-01", // Most recent
    }));

    const request = createMockRequest("POST", `/api/books/${book.id}/mark-as-read`, {
      rating: 5,
    });
    const response = await POST(request as NextRequest, { params: { id: book.id.toString() } });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.session.sessionNumber).toBe(2); // Should use most recent session
    expect(data.ratingUpdated).toBe(true);
  });

  test("should handle empty request body", async () => {
    const book = await bookRepository.create(createTestBook({ totalPages: 300 }));
    await sessionRepository.create(createTestSession({
      bookId: book.id,
      status: "reading",
      isActive: true,
      sessionNumber: 1,
    }));

    const request = createMockRequest("POST", `/api/books/${book.id}/mark-as-read`, {});
    const response = await POST(request as NextRequest, { params: { id: book.id.toString() } });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.session.status).toBe("read");
    expect(data.ratingUpdated).toBe(false);
    expect(data.reviewUpdated).toBe(false);
  });

  // ============================================================================
  // Invalid Date Handling
  // ============================================================================

  describe("Invalid Date Handling", () => {
    test("should return 400 for invalid date format (not YYYY-MM-DD)", async () => {
      const book = await bookRepository.create(createTestBook({ totalPages: 300 }));
      await sessionRepository.create(createTestSession({
        bookId: book.id,
        status: "reading",
        isActive: true,
        sessionNumber: 1,
      }));

      const request = createMockRequest("POST", `/api/books/${book.id}/mark-as-read`, {
        completedDate: "01-15-2025", // Wrong format
      });
      const response = await POST(request as NextRequest, { params: { id: book.id.toString() } });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain("Invalid completed date format");
    });

    test("should return 400 for date with invalid month (13)", async () => {
      const book = await bookRepository.create(createTestBook({ totalPages: 300 }));
      await sessionRepository.create(createTestSession({
        bookId: book.id,
        status: "reading",
        isActive: true,
        sessionNumber: 1,
      }));

      const request = createMockRequest("POST", `/api/books/${book.id}/mark-as-read`, {
        completedDate: "2025-13-15", // Invalid month
      });
      const response = await POST(request as NextRequest, { params: { id: book.id.toString() } });
      const data = await response.json();

      // Now we validate actual date validity, not just format
      expect(response.status).toBe(400);
      expect(data.error).toContain("Invalid completed date format");
    });

    test("should return 400 for date with invalid day (32)", async () => {
      const book = await bookRepository.create(createTestBook({ totalPages: 300 }));
      await sessionRepository.create(createTestSession({
        bookId: book.id,
        status: "reading",
        isActive: true,
        sessionNumber: 1,
      }));

      const request = createMockRequest("POST", `/api/books/${book.id}/mark-as-read`, {
        completedDate: "2025-01-32", // Invalid day
      });
      const response = await POST(request as NextRequest, { params: { id: book.id.toString() } });
      const data = await response.json();

      // Now we validate actual date validity, not just format
      expect(response.status).toBe(400);
      expect(data.error).toContain("Invalid completed date format");
    });

    test("should return 400 for non-string date", async () => {
      const book = await bookRepository.create(createTestBook({ totalPages: 300 }));
      await sessionRepository.create(createTestSession({
        bookId: book.id,
        status: "reading",
        isActive: true,
        sessionNumber: 1,
      }));

      const request = createMockRequest("POST", `/api/books/${book.id}/mark-as-read`, {
        completedDate: 20250115, // Number instead of string
      });
      const response = await POST(request as NextRequest, { params: { id: book.id.toString() } });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain("Invalid completed date format");
    });
  });

  // ============================================================================
  // Status-specific Handling
  // ============================================================================

  describe("Status-specific Handling", () => {
    test("should mark book in 'read-next' status as read", async () => {
      const book = await bookRepository.create(createTestBook({ totalPages: 300 }));
      await sessionRepository.create(createTestSession({
        bookId: book.id,
        status: "read-next",
        isActive: true,
        sessionNumber: 1,
      }));

      const request = createMockRequest("POST", `/api/books/${book.id}/mark-as-read`, {
        rating: 4,
      });
      const response = await POST(request as NextRequest, { params: { id: book.id.toString() } });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.session.status).toBe("read");
      expect(data.ratingUpdated).toBe(true);
    });

    test("should mark book in 'to-read' status as read", async () => {
      const book = await bookRepository.create(createTestBook({ totalPages: 300 }));
      await sessionRepository.create(createTestSession({
        bookId: book.id,
        status: "to-read",
        isActive: true,
        sessionNumber: 1,
      }));

      const request = createMockRequest("POST", `/api/books/${book.id}/mark-as-read`, {});
      const response = await POST(request as NextRequest, { params: { id: book.id.toString() } });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.session.status).toBe("read");
    });
  });

  // ============================================================================
  // Null Rating and Review
  // ============================================================================

  describe("Null Rating and Review", () => {
    test("should handle both rating and review as null", async () => {
      const book = await bookRepository.create(createTestBook({ totalPages: 300 }));
      await sessionRepository.create(createTestSession({
        bookId: book.id,
        status: "reading",
        isActive: true,
        sessionNumber: 1,
      }));

      const request = createMockRequest("POST", `/api/books/${book.id}/mark-as-read`, {
        rating: null,
        review: null,
      });
      const response = await POST(request as NextRequest, { params: { id: book.id.toString() } });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.session.status).toBe("read");
      expect(data.ratingUpdated).toBe(false);
      expect(data.reviewUpdated).toBe(false);
    });

    test("should handle explicit undefined rating and review", async () => {
      const book = await bookRepository.create(createTestBook({ totalPages: 300 }));
      await sessionRepository.create(createTestSession({
        bookId: book.id,
        status: "reading",
        isActive: true,
        sessionNumber: 1,
      }));

      const request = createMockRequest("POST", `/api/books/${book.id}/mark-as-read`, {
        rating: undefined,
        review: undefined,
      });
      const response = await POST(request as NextRequest, { params: { id: book.id.toString() } });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.session.status).toBe("read");
    });
  });

  // ============================================================================
  // Future Dates
  // ============================================================================

  describe("Future Dates", () => {
    test("should accept future completion date", async () => {
      const book = await bookRepository.create(createTestBook({ totalPages: 300 }));
      await sessionRepository.create(createTestSession({
        bookId: book.id,
        status: "reading",
        isActive: true,
        sessionNumber: 1,
      }));

      // Set completion date to next year
      const futureDate = "2099-12-31";
      const request = createMockRequest("POST", `/api/books/${book.id}/mark-as-read`, {
        completedDate: futureDate,
      });
      const response = await POST(request as NextRequest, { params: { id: book.id.toString() } });
      const data = await response.json();

      // API accepts future dates (no validation against current date)
      expect(response.status).toBe(200);
      expect(data.session.completedDate).toBe(futureDate);
    });
  });
});
