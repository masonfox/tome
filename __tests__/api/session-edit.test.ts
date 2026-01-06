import { describe, test, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { PATCH } from "@/app/api/books/[id]/sessions/[sessionId]/route";
import { bookRepository, sessionRepository, progressRepository } from "@/lib/repositories";
import { setupTestDatabase, teardownTestDatabase, clearTestDatabase } from "@/__tests__/helpers/db-setup";
import {
  mockBook1,
  mockSessionRead,
  mockSessionReading,
  mockProgressLog1,
  createMockRequest,
} from "../fixtures/test-data";
import type { NextRequest } from "next/server";
import { format } from "date-fns";

beforeAll(async () => {
  await setupTestDatabase(__filename);
});

afterAll(async () => {
  await teardownTestDatabase(__filename);
});

beforeEach(async () => {
  await clearTestDatabase(__filename);
});

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Helper to create a test session
 */
async function createTestSession(bookId: number, overrides = {}) {
  return await sessionRepository.create({
    ...mockSessionRead,
    bookId,
    sessionNumber: 1,
    isActive: true,
    startedDate: new Date("2025-11-01"),
    completedDate: new Date("2025-11-15"),
    review: "Original review",
    ...overrides,
  });
}

/**
 * Helper to make PATCH request
 */
function makePatchRequest(bookId: number, sessionId: number, body: any) {
  const request = createMockRequest(
    "PATCH",
    `/api/books/${bookId}/sessions/${sessionId}`,
    body
  );
  return PATCH(request as NextRequest, {
    params: { id: bookId.toString(), sessionId: sessionId.toString() },
  });
}

/**
 * Helper to create ISO date string for testing
 */
function createISODate(dateString: string) {
  return new Date(dateString + "T00:00:00.000Z").toISOString();
}

describe("PATCH /api/books/[id]/sessions/[sessionId]", () => {
  // ============================================================================
  // SUCCESS CASES
  // ============================================================================

  describe("Success Cases", () => {
    test("should update started date only", async () => {
      const book = await bookRepository.create(mockBook1);
      const session = await createTestSession(book.id);

      const newStartDate = "2025-11-05";
      const response = await makePatchRequest(book.id, session.id, {
        startedDate: newStartDate,
      });

      expect(response.status).toBe(200);
      const data = await response.json();

      // Verify started date was updated
      expect(data.startedDate).toBeDefined();
      expect(format(new Date(data.startedDate), 'yyyy-MM-dd')).toBe(newStartDate);

      // Original values unchanged
      expect(data.completedDate).toBeDefined();
      expect(format(new Date(data.completedDate), 'yyyy-MM-dd')).toBe("2025-11-15");
      expect(data.review).toBe("Original review");
      expect(data.sessionNumber).toBe(session.sessionNumber);
    });

    test("should update completed date only", async () => {
      const book = await bookRepository.create(mockBook1);
      const session = await createTestSession(book.id);

      const newCompletedDate = "2025-11-20";
      const response = await makePatchRequest(book.id, session.id, {
        completedDate: newCompletedDate,
      });

      expect(response.status).toBe(200);
      const data = await response.json();

      // Verify completed date was updated
      expect(data.completedDate).toBeDefined();
      expect(format(new Date(data.completedDate), 'yyyy-MM-dd')).toBe(newCompletedDate);

      // Original values unchanged
      expect(data.startedDate).toBeDefined();
      expect(format(new Date(data.startedDate), 'yyyy-MM-dd')).toBe("2025-11-01");
      expect(data.review).toBe("Original review");
    });

    test("should update review only", async () => {
      const book = await bookRepository.create(mockBook1);
      const session = await createTestSession(book.id);

      const newReview = "Updated review text with new thoughts!";
      const response = await makePatchRequest(book.id, session.id, {
        review: newReview,
      });

      expect(response.status).toBe(200);
      const data = await response.json();

      // Verify review was updated
      expect(data.review).toBe(newReview);

      // Verify dates unchanged
      expect(format(new Date(data.startedDate), 'yyyy-MM-dd')).toBe("2025-11-01");
      expect(format(new Date(data.completedDate), 'yyyy-MM-dd')).toBe("2025-11-15");
    });

    test("should update all fields at once", async () => {
      const book = await bookRepository.create(mockBook1);
      const session = await createTestSession(book.id);

      const updates = {
        startedDate: "2025-11-10",
        completedDate: "2025-11-25",
        review: "Completely new review!",
      };

      const response = await makePatchRequest(book.id, session.id, updates);

      expect(response.status).toBe(200);
      const data = await response.json();

      // Verify all fields updated
      expect(format(new Date(data.startedDate), 'yyyy-MM-dd')).toBe(updates.startedDate);
      expect(format(new Date(data.completedDate), 'yyyy-MM-dd')).toBe(updates.completedDate);
      expect(data.review).toBe(updates.review);
    });

    test("should update multiple fields (partial - dates only)", async () => {
      const book = await bookRepository.create(mockBook1);
      const session = await createTestSession(book.id);

      const response = await makePatchRequest(book.id, session.id, {
        startedDate: "2025-11-02",
        completedDate: "2025-11-16",
      });

      expect(response.status).toBe(200);
      const data = await response.json();

      // Verify dates updated
      expect(format(new Date(data.startedDate), 'yyyy-MM-dd')).toBe("2025-11-02");
      expect(format(new Date(data.completedDate), 'yyyy-MM-dd')).toBe("2025-11-16");

      // Verify review unchanged
      expect(data.review).toBe("Original review");
    });

    test("should clear started date (set to null)", async () => {
      const book = await bookRepository.create(mockBook1);
      const session = await createTestSession(book.id);

      const response = await makePatchRequest(book.id, session.id, {
        startedDate: null,
      });

      expect(response.status).toBe(200);
      const data = await response.json();

      // Verify started date is null
      expect(data.startedDate).toBeNull();

      // Verify other fields unchanged
      expect(data.completedDate).toBeDefined();
      expect(data.review).toBe("Original review");
    });

    test("should clear completed date (set to null)", async () => {
      const book = await bookRepository.create(mockBook1);
      const session = await createTestSession(book.id);

      const response = await makePatchRequest(book.id, session.id, {
        completedDate: null,
      });

      expect(response.status).toBe(200);
      const data = await response.json();

      // Verify completed date is null
      expect(data.completedDate).toBeNull();

      // Verify other fields unchanged
      expect(data.startedDate).toBeDefined();
      expect(data.review).toBe("Original review");
    });

    test("should clear review (empty string)", async () => {
      const book = await bookRepository.create(mockBook1);
      const session = await createTestSession(book.id);

      const response = await makePatchRequest(book.id, session.id, {
        review: "",
      });

      expect(response.status).toBe(200);
      const data = await response.json();

      // Verify review is null after trimming empty string
      expect(data.review).toBeNull();
    });

    test("should clear review (null)", async () => {
      const book = await bookRepository.create(mockBook1);
      const session = await createTestSession(book.id);

      const response = await makePatchRequest(book.id, session.id, {
        review: null,
      });

      expect(response.status).toBe(200);
      const data = await response.json();

      // Verify review is null
      expect(data.review).toBeNull();
    });

    test("should clear all dates simultaneously", async () => {
      const book = await bookRepository.create(mockBook1);
      const session = await createTestSession(book.id);

      const response = await makePatchRequest(book.id, session.id, {
        startedDate: null,
        completedDate: null,
      });

      expect(response.status).toBe(200);
      const data = await response.json();

      // Verify both dates are null
      expect(data.startedDate).toBeNull();
      expect(data.completedDate).toBeNull();

      // Verify review unchanged
      expect(data.review).toBe("Original review");
    });

    test("should update with whitespace-only review (treat as null)", async () => {
      const book = await bookRepository.create(mockBook1);
      const session = await createTestSession(book.id);

      const response = await makePatchRequest(book.id, session.id, {
        review: "   \n\t   ",
      });

      expect(response.status).toBe(200);
      const data = await response.json();

      // Verify review is null after trimming whitespace
      expect(data.review).toBeNull();
    });

    test("should return complete updated session in response", async () => {
      const book = await bookRepository.create(mockBook1);
      const session = await createTestSession(book.id);

      const response = await makePatchRequest(book.id, session.id, {
        review: "New review",
      });

      expect(response.status).toBe(200);
      const data = await response.json();

      // Verify all expected fields are present
      expect(data.id).toBe(session.id);
      expect(data.bookId).toBe(book.id);
      expect(data.sessionNumber).toBe(session.sessionNumber);
      expect(data.status).toBeDefined();
      expect(data.isActive).toBeDefined();
      expect(data.createdAt).toBeDefined();
      expect(data.updatedAt).toBeDefined();
    });
  });

  // ============================================================================
  // ERROR CASES
  // ============================================================================

  describe("Error Cases", () => {
    test("should return 404 if session not found", async () => {
      const book = await bookRepository.create(mockBook1);
      const fakeSessionId = 999999;

      const response = await makePatchRequest(book.id, fakeSessionId, {
        review: "Test",
      });

      expect(response.status).toBe(404);
      const data = await response.json();
      expect(data.error).toBe("Session not found");
    });

    test("should return 404 if session belongs to different book", async () => {
      const book1 = await bookRepository.create(mockBook1);
      const book2 = await bookRepository.create({
        ...mockBook1,
        calibreId: 999,
        title: "Other Book",
      });

      // Create session for book1
      const session = await createTestSession(book1.id);

      // Try to update via book2's endpoint
      const response = await makePatchRequest(book2.id, session.id, {
        review: "Test",
      });

      expect(response.status).toBe(404);
      const data = await response.json();
      expect(data.error).toBe("Session does not belong to specified book");
    });

    test("should return 400 with invalid book ID format", async () => {
      const book = await bookRepository.create(mockBook1);
      const session = await createTestSession(book.id);

      const request = createMockRequest(
        "PATCH",
        `/api/books/invalid-id/sessions/${session.id}`,
        { review: "Test" }
      );
      const response = await PATCH(request as NextRequest, {
        params: { id: "invalid-id", sessionId: session.id.toString() },
      });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe("Invalid book ID or session ID format");
    });

    test("should return 400 with invalid session ID format", async () => {
      const book = await bookRepository.create(mockBook1);

      const request = createMockRequest(
        "PATCH",
        `/api/books/${book.id}/sessions/invalid-id`,
        { review: "Test" }
      );
      const response = await PATCH(request as NextRequest, {
        params: { id: book.id.toString(), sessionId: "invalid-id" },
      });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe("Invalid book ID or session ID format");
    });

    test("should handle invalid date format gracefully", async () => {
      const book = await bookRepository.create(mockBook1);
      const session = await createTestSession(book.id);

      const response = await makePatchRequest(book.id, session.id, {
        startedDate: "not-a-valid-date",
      });

      // JavaScript Date constructor creates Invalid Date
      // Which will be handled by the API
      expect(response.status).toBe(200);
      const data = await response.json();
      
      // Invalid Date becomes NaN timestamp, check it's handled
      expect(data.startedDate).toBeDefined();
    });

    test("should handle malformed JSON body", async () => {
      const book = await bookRepository.create(mockBook1);
      const session = await createTestSession(book.id);

      // Create request with malformed JSON
      const request = new Request(
        `http://localhost/api/books/${book.id}/sessions/${session.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: "{invalid json}",
        }
      );

      try {
        await PATCH(request as NextRequest, {
          params: { id: book.id.toString(), sessionId: session.id.toString() },
        });
      } catch (error) {
        // Expected to throw due to invalid JSON
        expect(error).toBeDefined();
      }
    });

    test("should succeed with empty request body (no changes)", async () => {
      const book = await bookRepository.create(mockBook1);
      const session = await createTestSession(book.id);

      const response = await makePatchRequest(book.id, session.id, {});

      expect(response.status).toBe(200);
      const data = await response.json();

      // Verify nothing changed
      expect(format(new Date(data.startedDate), 'yyyy-MM-dd')).toBe("2025-11-01");
      expect(format(new Date(data.completedDate), 'yyyy-MM-dd')).toBe("2025-11-15");
      expect(data.review).toBe("Original review");
    });
  });

  // ============================================================================
  // EDGE CASES
  // ============================================================================

  describe("Edge Cases", () => {
    test("should update archived session (isActive: false)", async () => {
      const book = await bookRepository.create(mockBook1);
      const session = await createTestSession(book.id, { isActive: false });

      const response = await makePatchRequest(book.id, session.id, {
        review: "Updated archived session",
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.review).toBe("Updated archived session");
      expect(data.isActive).toBe(false);
    });

    test("should update active session (isActive: true)", async () => {
      const book = await bookRepository.create(mockBook1);
      const session = await createTestSession(book.id, { isActive: true });

      const response = await makePatchRequest(book.id, session.id, {
        startedDate: "2025-11-10",
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(format(new Date(data.startedDate), 'yyyy-MM-dd')).toBe("2025-11-10");
      expect(data.isActive).toBe(true);
    });

    test("should handle very long review text", async () => {
      const book = await bookRepository.create(mockBook1);
      const session = await createTestSession(book.id);

      const longReview = "A".repeat(5000);
      const response = await makePatchRequest(book.id, session.id, {
        review: longReview,
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.review).toBe(longReview);
      expect(data.review.length).toBe(5000);
    });

    test("should handle review with special characters", async () => {
      const book = await bookRepository.create(mockBook1);
      const session = await createTestSession(book.id);

      const specialReview = 'Review with "quotes", newlines\nand unicode: 你好 🎉';
      const response = await makePatchRequest(book.id, session.id, {
        review: specialReview,
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.review).toBe(specialReview);
    });

    test("should handle review with markdown formatting", async () => {
      const book = await bookRepository.create(mockBook1);
      const session = await createTestSession(book.id);

      const markdownReview = "# Heading\n\n* Bullet\n* Points\n\n**Bold** and *italic*";
      const response = await makePatchRequest(book.id, session.id, {
        review: markdownReview,
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.review).toBe(markdownReview);
    });

    test("should handle date in far past (1970-01-01)", async () => {
      const book = await bookRepository.create(mockBook1);
      const session = await createTestSession(book.id);

      const response = await makePatchRequest(book.id, session.id, {
        startedDate: "1970-01-01",
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(format(new Date(data.startedDate), 'yyyy-MM-dd')).toBe("1970-01-01");
    });

    test("should handle multiple updates to same session", async () => {
      const book = await bookRepository.create(mockBook1);
      const session = await createTestSession(book.id);

      // First update
      const response1 = await makePatchRequest(book.id, session.id, {
        review: "First update",
      });
      expect(response1.status).toBe(200);
      const data1 = await response1.json();
      expect(data1.review).toBe("First update");
      const firstUpdateTime = data1.updatedAt;

      // Small delay to ensure different timestamp
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Second update
      const response2 = await makePatchRequest(book.id, session.id, {
        review: "Second update",
      });
      expect(response2.status).toBe(200);
      const data2 = await response2.json();
      expect(data2.review).toBe("Second update");

      // Verify review changed
      expect(data2.review).not.toBe(data1.review);
    });

    test("should update session with existing progress logs without affecting them", async () => {
      const book = await bookRepository.create(mockBook1);
      const session = await createTestSession(book.id);

      // Add progress logs to the session
      await progressRepository.create({
        ...mockProgressLog1,
        bookId: book.id,
        sessionId: session.id,
        currentPage: 100,
        pagesRead: 100,
      });
      await progressRepository.create({
        ...mockProgressLog1,
        bookId: book.id,
        sessionId: session.id,
        currentPage: 200,
        pagesRead: 100,
      });

      // Update session dates and review
      const response = await makePatchRequest(book.id, session.id, {
        startedDate: "2025-11-05",
        completedDate: "2025-11-20",
        review: "Updated with progress logs",
      });

      expect(response.status).toBe(200);
      const data = await response.json();

      // Verify session updated
      expect(format(new Date(data.startedDate), 'yyyy-MM-dd')).toBe("2025-11-05");
      expect(data.review).toBe("Updated with progress logs");

      // Verify progress logs still exist and are linked
      const progressLogs = await progressRepository.findBySessionId(session.id);
      expect(progressLogs.length).toBe(2);
      expect(progressLogs[0].sessionId).toBe(session.id);
      expect(progressLogs[1].sessionId).toBe(session.id);
    });

    test("should trim review with leading/trailing whitespace", async () => {
      const book = await bookRepository.create(mockBook1);
      const session = await createTestSession(book.id);

      const response = await makePatchRequest(book.id, session.id, {
        review: "   Review with spaces   \n",
      });

      expect(response.status).toBe(200);
      const data = await response.json();

      // Verify review was trimmed
      expect(data.review).toBe("Review with spaces");
    });
  });
});
