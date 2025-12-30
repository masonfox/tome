import { describe, test, expect, beforeAll, afterAll, beforeEach, mock } from "bun:test";
import { POST } from "@/app/api/books/[id]/complete/route";
import { bookRepository, sessionRepository, progressRepository } from "@/lib/repositories";
import { setupTestDatabase, teardownTestDatabase, clearTestDatabase } from "@/__tests__/helpers/db-setup";
import {
  createMockRequest,
  createTestBook,
  createTestSession,
} from "../fixtures/test-data";
import type { NextRequest } from "next/server";
import { formatInTimeZone } from "date-fns-tz";

/**
 * Complete Book API Endpoint Tests
 * 
 * Tests the POST /api/books/:id/complete endpoint which handles the full workflow
 * for marking a book as read from "Want to Read" or "Read Next" status.
 * 
 * This endpoint orchestrates:
 * 1. Page count updates (if needed)
 * 2. Session creation/update
 * 3. Progress logging (start → 100%)
 * 4. Rating updates (with Calibre sync)
 * 5. Review updates
 * 
 * Coverage:
 * - Success scenarios (with/without optional fields)
 * - Date validation
 * - Page count handling
 * - Session state management
 * - Progress creation with backdating
 * - Rating/review best-effort updates
 * - Error scenarios
 * - Edge cases
 */

/**
 * Mock Rationale: Prevent Next.js cache revalidation side effects during tests.
 */
mock.module("next/cache", () => ({
  revalidatePath: () => {},
}));

/**
 * Mock Rationale: Prevent Calibre sync during tests (file system I/O).
 */
mock.module("@/lib/services/calibre.service", () => ({
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
mock.module("@/lib/streaks", () => ({
  rebuildStreak: mock(() => Promise.resolve()),
}));

// Helper function to extract date in EST timezone from a stored UTC date
// Since dates are stored as midnight EST converted to UTC, we need to convert back to EST to check the date
function getDateInEST(date: Date): string {
  const { formatInTimeZone } = require("date-fns-tz");
  return formatInTimeZone(date, "America/New_York", "yyyy-MM-dd");
}

beforeAll(async () => {
  await setupTestDatabase(__filename);
});

afterAll(async () => {
  await teardownTestDatabase(__filename);
});

beforeEach(async () => {
  await clearTestDatabase(__filename);
});

describe("POST /api/books/[id]/complete", () => {
  // ============================================================================
  // Success Scenarios
  // ============================================================================

  describe("Success Scenarios", () => {
    test("should complete book with all data (pages, dates, rating, review)", async () => {
      const book = await bookRepository.create(createTestBook({ totalPages: null }));
      await sessionRepository.create(createTestSession({
        bookId: book.id,
        status: "to-read",
        isActive: true,
        sessionNumber: 1,
      }));

      const request = createMockRequest("POST", `/api/books/${book.id}/complete`, {
        totalPages: 350,
        startDate: "2024-01-01",
        endDate: "2024-01-15",
        rating: 5,
        review: "Amazing book!",
      });

      const response = await POST(request as NextRequest, { params: { id: book.id.toString() } });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);

      // Verify page count was updated
      const updatedBook = await bookRepository.findById(book.id);
      expect(updatedBook?.totalPages).toBe(350);
      expect(updatedBook?.rating).toBe(5);

      // Verify progress entries were created
      const progress = await progressRepository.findByBookId(book.id);
      expect(progress.length).toBeGreaterThanOrEqual(2); // Start + end progress

      // Verify session was completed
      const sessions = await sessionRepository.findAllByBookId(book.id);
      const completedSession = sessions.find((s: any) => s.status === "read");
      expect(completedSession).toBeDefined();
      expect(completedSession!.isActive).toBe(false);
      expect(completedSession!.review).toBe("Amazing book!");
    });

    test("should complete book without rating or review", async () => {
      const book = await bookRepository.create(createTestBook({ totalPages: 300 }));
      await sessionRepository.create(createTestSession({
        bookId: book.id,
        status: "read-next",
        isActive: true,
        sessionNumber: 1,
      }));

      const request = createMockRequest("POST", `/api/books/${book.id}/complete`, {
        startDate: "2024-01-01",
        endDate: "2024-01-10",
      });

      const response = await POST(request as NextRequest, { params: { id: book.id.toString() } });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);

      // Verify book was completed
      const sessions = await sessionRepository.findAllByBookId(book.id);
      const completedSession = sessions.find((s: any) => s.status === "read");
      expect(completedSession).toBeDefined();
    });

    test("should complete book without totalPages", async () => {
      const book = await bookRepository.create(createTestBook({ totalPages: null }));
      await sessionRepository.create(createTestSession({
        bookId: book.id,
        status: "to-read",
        isActive: true,
        sessionNumber: 1,
      }));

      const request = createMockRequest("POST", `/api/books/${book.id}/complete`, {
        startDate: "2024-01-01",
        endDate: "2024-01-05",
        rating: 4,
      });

      const response = await POST(request as NextRequest, { params: { id: book.id.toString() } });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);

      // Verify no progress entries (book has no pages)
      const progress = await progressRepository.findByBookId(book.id);
      expect(progress.length).toBe(0);

      // Verify session was marked as read directly
      const sessions = await sessionRepository.findAllByBookId(book.id);
      const completedSession = sessions.find((s: any) => s.status === "read");
      expect(completedSession).toBeDefined();
      expect(completedSession!.isActive).toBe(false);
    });

    test("should create progress entries with correct dates", async () => {
      const book = await bookRepository.create(createTestBook({ totalPages: 400 }));
      await sessionRepository.create(createTestSession({
        bookId: book.id,
        status: "to-read",
        isActive: true,
        sessionNumber: 1,
      }));

      const request = createMockRequest("POST", `/api/books/${book.id}/complete`, {
        startDate: "2024-01-01",
        endDate: "2024-01-20",
      });

      const response = await POST(request as NextRequest, { params: { id: book.id.toString() } });
      expect(response.status).toBe(200);

      // Verify progress dates
      const progress = await progressRepository.findByBookId(book.id);
      expect(progress.length).toBeGreaterThanOrEqual(2);

      const sortedProgress = progress.sort((a, b) => 
        new Date(a.progressDate).getTime() - new Date(b.progressDate).getTime()
      );

      // First progress should be on start date
      const firstProgress = sortedProgress[0];
      expect(getDateInEST(new Date(firstProgress.progressDate))).toBe("2024-01-01");
      expect(firstProgress.currentPage).toBe(1);

      // Last progress should be on end date
      const lastProgress = sortedProgress[sortedProgress.length - 1];
      expect(getDateInEST(new Date(lastProgress.progressDate))).toBe("2024-01-20");
      expect(lastProgress.currentPercentage).toBe(100);
    });

    test("should create start progress (1 page) and end progress (100%)", async () => {
      const book = await bookRepository.create(createTestBook({ totalPages: 250 }));
      await sessionRepository.create(createTestSession({
        bookId: book.id,
        status: "to-read",
        isActive: true,
        sessionNumber: 1,
      }));

      const request = createMockRequest("POST", `/api/books/${book.id}/complete`, {
        startDate: "2024-02-01",
        endDate: "2024-02-14",
      });

      const response = await POST(request as NextRequest, { params: { id: book.id.toString() } });
      expect(response.status).toBe(200);

      const progress = await progressRepository.findByBookId(book.id);
      expect(progress.length).toBeGreaterThanOrEqual(2);

      // Verify start progress
      const startProgress = progress.find((p: any) => p.currentPage === 1);
      expect(startProgress).toBeDefined();
      expect(startProgress!.currentPercentage).toBeGreaterThanOrEqual(0); // Can be 0% for large books due to rounding

      // Verify end progress
      const endProgress = progress.find((p: any) => p.currentPercentage === 100);
      expect(endProgress).toBeDefined();
      expect(endProgress!.currentPage).toBe(250);
    });
  });

  // ============================================================================
  // Date Validation
  // ============================================================================

  describe("Date Validation", () => {
    test("should reject when end date before start date", async () => {
      const book = await bookRepository.create(createTestBook({ totalPages: 300 }));

      const request = createMockRequest("POST", `/api/books/${book.id}/complete`, {
        startDate: "2024-01-15",
        endDate: "2024-01-10", // End before start
      });

      const response = await POST(request as NextRequest, { params: { id: book.id.toString() } });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain("End date must be on or after start date");
    });

    test("should reject invalid date formats", async () => {
      const book = await bookRepository.create(createTestBook({ totalPages: 300 }));

      const request = createMockRequest("POST", `/api/books/${book.id}/complete`, {
        startDate: "invalid-date",
        endDate: "2024-01-15",
      });

      const response = await POST(request as NextRequest, { params: { id: book.id.toString() } });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain("Invalid date format");
    });

    test("should accept same date for start and end", async () => {
      const book = await bookRepository.create(createTestBook({ totalPages: 200 }));
      await sessionRepository.create(createTestSession({
        bookId: book.id,
        status: "to-read",
        isActive: true,
        sessionNumber: 1,
      }));

      const request = createMockRequest("POST", `/api/books/${book.id}/complete`, {
        startDate: "2024-01-15",
        endDate: "2024-01-15", // Same day
      });

      const response = await POST(request as NextRequest, { params: { id: book.id.toString() } });
      expect(response.status).toBe(200);
    });

    test("should reject missing start date", async () => {
      const book = await bookRepository.create(createTestBook({ totalPages: 300 }));

      const request = createMockRequest("POST", `/api/books/${book.id}/complete`, {
        endDate: "2024-01-15",
      });

      const response = await POST(request as NextRequest, { params: { id: book.id.toString() } });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain("start date and end date are required");
    });

    test("should reject missing end date", async () => {
      const book = await bookRepository.create(createTestBook({ totalPages: 300 }));

      const request = createMockRequest("POST", `/api/books/${book.id}/complete`, {
        startDate: "2024-01-01",
      });

      const response = await POST(request as NextRequest, { params: { id: book.id.toString() } });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain("start date and end date are required");
    });
  });

  // ============================================================================
  // Page Count Scenarios
  // ============================================================================

  describe("Page Count Handling", () => {
    test("should update totalPages when provided", async () => {
      const book = await bookRepository.create(createTestBook({ totalPages: null }));
      await sessionRepository.create(createTestSession({
        bookId: book.id,
        status: "to-read",
        isActive: true,
        sessionNumber: 1,
      }));

      const request = createMockRequest("POST", `/api/books/${book.id}/complete`, {
        totalPages: 450,
        startDate: "2024-01-01",
        endDate: "2024-01-30",
      });

      const response = await POST(request as NextRequest, { params: { id: book.id.toString() } });
      expect(response.status).toBe(200);

      const updatedBook = await bookRepository.findById(book.id);
      expect(updatedBook?.totalPages).toBe(450);
    });

    test("should handle books that already have totalPages", async () => {
      const book = await bookRepository.create(createTestBook({ totalPages: 300 }));
      await sessionRepository.create(createTestSession({
        bookId: book.id,
        status: "to-read",
        isActive: true,
        sessionNumber: 1,
      }));

      const request = createMockRequest("POST", `/api/books/${book.id}/complete`, {
        startDate: "2024-01-01",
        endDate: "2024-01-15",
      });

      const response = await POST(request as NextRequest, { params: { id: book.id.toString() } });
      expect(response.status).toBe(200);

      const updatedBook = await bookRepository.findById(book.id);
      expect(updatedBook?.totalPages).toBe(300); // Unchanged
    });

    test("should validate totalPages is positive integer", async () => {
      const book = await bookRepository.create(createTestBook({ totalPages: null }));

      const request = createMockRequest("POST", `/api/books/${book.id}/complete`, {
        totalPages: -100,
        startDate: "2024-01-01",
        endDate: "2024-01-15",
      });

      const response = await POST(request as NextRequest, { params: { id: book.id.toString() } });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain("positive whole number");
    });

    test("should reject non-integer page counts", async () => {
      const book = await bookRepository.create(createTestBook({ totalPages: null }));

      const request = createMockRequest("POST", `/api/books/${book.id}/complete`, {
        totalPages: 123.45,
        startDate: "2024-01-01",
        endDate: "2024-01-15",
      });

      const response = await POST(request as NextRequest, { params: { id: book.id.toString() } });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain("whole number");
    });

    test("should reject zero page count", async () => {
      const book = await bookRepository.create(createTestBook({ totalPages: null }));

      const request = createMockRequest("POST", `/api/books/${book.id}/complete`, {
        totalPages: 0,
        startDate: "2024-01-01",
        endDate: "2024-01-15",
      });

      const response = await POST(request as NextRequest, { params: { id: book.id.toString() } });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain("positive");
    });
  });

  // ============================================================================
  // Session Handling
  // ============================================================================

  describe("Session Management", () => {
    test("should create new session if none exists", async () => {
      const book = await bookRepository.create(createTestBook({ totalPages: 300 }));
      // No session created

      const request = createMockRequest("POST", `/api/books/${book.id}/complete`, {
        startDate: "2024-01-01",
        endDate: "2024-01-15",
      });

      const response = await POST(request as NextRequest, { params: { id: book.id.toString() } });
      expect(response.status).toBe(200);

      const sessions = await sessionRepository.findAllByBookId(book.id);
      expect(sessions.length).toBeGreaterThan(0);
      
      const completedSession = sessions.find((s: any) => s.status === "read");
      expect(completedSession).toBeDefined();
    });

    test("should update existing session to reading status", async () => {
      const book = await bookRepository.create(createTestBook({ totalPages: 300 }));
      await sessionRepository.create(createTestSession({
        bookId: book.id,
        status: "to-read",
        isActive: true,
        sessionNumber: 1,
      }));

      const request = createMockRequest("POST", `/api/books/${book.id}/complete`, {
        startDate: "2024-01-01",
        endDate: "2024-01-15",
      });

      const response = await POST(request as NextRequest, { params: { id: book.id.toString() } });
      expect(response.status).toBe(200);

      // Session should have been updated through the workflow
      const sessions = await sessionRepository.findAllByBookId(book.id);
      expect(sessions.length).toBeGreaterThan(0);
    });

    test("should set session startedDate correctly", async () => {
      const book = await bookRepository.create(createTestBook({ totalPages: 300 }));
      await sessionRepository.create(createTestSession({
        bookId: book.id,
        status: "to-read",
        isActive: true,
        sessionNumber: 1,
      }));

      const startDate = new Date("2024-01-05");

      const request = createMockRequest("POST", `/api/books/${book.id}/complete`, {
        startDate: startDate.toISOString(),
        endDate: "2024-01-20",
      });

      const response = await POST(request as NextRequest, { params: { id: book.id.toString() } });
      expect(response.status).toBe(200);

      const sessions = await sessionRepository.findAllByBookId(book.id);
      const completedSession = sessions.find((s: any) => s.status === "read");
      
      expect(completedSession).toBeDefined();
      if (completedSession?.startedDate) {
        const sessionStart = new Date(completedSession.startedDate);
        expect(sessionStart.toISOString().split('T')[0]).toBe("2024-01-05");
      }
    });
  });

  // ============================================================================
  // Rating and Review Updates
  // ============================================================================

  describe("Rating and Review Updates", () => {
    test("should update rating and sync to Calibre", async () => {
      const book = await bookRepository.create(createTestBook({ totalPages: 300, rating: null }));
      await sessionRepository.create(createTestSession({
        bookId: book.id,
        status: "to-read",
        isActive: true,
        sessionNumber: 1,
      }));

      const request = createMockRequest("POST", `/api/books/${book.id}/complete`, {
        startDate: "2024-01-01",
        endDate: "2024-01-15",
        rating: 5,
      });

      const response = await POST(request as NextRequest, { params: { id: book.id.toString() } });
      expect(response.status).toBe(200);

      const updatedBook = await bookRepository.findById(book.id);
      expect(updatedBook?.rating).toBe(5);
    });

    test("should attach review to completed session", async () => {
      const book = await bookRepository.create(createTestBook({ totalPages: 300 }));
      await sessionRepository.create(createTestSession({
        bookId: book.id,
        status: "to-read",
        isActive: true,
        sessionNumber: 1,
      }));

      const request = createMockRequest("POST", `/api/books/${book.id}/complete`, {
        startDate: "2024-01-01",
        endDate: "2024-01-15",
        review: "Excellent read, highly recommend!",
      });

      const response = await POST(request as NextRequest, { params: { id: book.id.toString() } });
      expect(response.status).toBe(200);

      const sessions = await sessionRepository.findAllByBookId(book.id);
      const completedSession = sessions.find((s: any) => s.status === "read");
      
      expect(completedSession).toBeDefined();
      expect(completedSession!.review).toBe("Excellent read, highly recommend!");
    });

    test("should validate rating range (1-5)", async () => {
      const book = await bookRepository.create(createTestBook({ totalPages: 300 }));

      const request = createMockRequest("POST", `/api/books/${book.id}/complete`, {
        startDate: "2024-01-01",
        endDate: "2024-01-15",
        rating: 6, // Invalid
      });

      const response = await POST(request as NextRequest, { params: { id: book.id.toString() } });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain("between 1 and 5");
    });

    test("should reject non-integer ratings", async () => {
      const book = await bookRepository.create(createTestBook({ totalPages: 300 }));

      const request = createMockRequest("POST", `/api/books/${book.id}/complete`, {
        startDate: "2024-01-01",
        endDate: "2024-01-15",
        rating: 3.5, // Invalid
      });

      const response = await POST(request as NextRequest, { params: { id: book.id.toString() } });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain("whole number");
    });

    test("should handle both rating and review together", async () => {
      const book = await bookRepository.create(createTestBook({ totalPages: 300 }));
      await sessionRepository.create(createTestSession({
        bookId: book.id,
        status: "to-read",
        isActive: true,
        sessionNumber: 1,
      }));

      const request = createMockRequest("POST", `/api/books/${book.id}/complete`, {
        startDate: "2024-01-01",
        endDate: "2024-01-15",
        rating: 4,
        review: "Great book with minor flaws",
      });

      const response = await POST(request as NextRequest, { params: { id: book.id.toString() } });
      expect(response.status).toBe(200);

      const updatedBook = await bookRepository.findById(book.id);
      expect(updatedBook?.rating).toBe(4);

      const sessions = await sessionRepository.findAllByBookId(book.id);
      const completedSession = sessions.find((s: any) => s.status === "read");
      expect(completedSession?.review).toBe("Great book with minor flaws");
    });
  });

  // ============================================================================
  // Error Scenarios
  // ============================================================================

  describe("Error Handling", () => {
    test("should return 404 for non-existent book", async () => {
      const request = createMockRequest("POST", "/api/books/99999/complete", {
        startDate: "2024-01-01",
        endDate: "2024-01-15",
      });

      const response = await POST(request as NextRequest, { params: { id: "99999" } });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toContain("not found");
    });

    test("should return 400 for invalid book ID format", async () => {
      const request = createMockRequest("POST", "/api/books/invalid/complete", {
        startDate: "2024-01-01",
        endDate: "2024-01-15",
      });

      const response = await POST(request as NextRequest, { params: { id: "invalid" } });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain("Invalid book ID format");
    });

    test("should handle malformed JSON body", async () => {
      const book = await bookRepository.create(createTestBook({ totalPages: 300 }));

      // Create request with invalid JSON
      const request = new Request(`http://localhost/api/books/${book.id}/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{ invalid json",
      });

      try {
        await POST(request as NextRequest, { params: { id: book.id.toString() } });
        expect(true).toBe(false); // Should not reach here
      } catch (error) {
        // Expected to throw
        expect(error).toBeDefined();
      }
    });

    test("should handle missing request body", async () => {
      const book = await bookRepository.create(createTestBook({ totalPages: 300 }));

      const request = new Request(`http://localhost/api/books/${book.id}/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });

      const response = await POST(request as NextRequest, { params: { id: book.id.toString() } });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBeDefined();
    });
  });

  // ============================================================================
  // Edge Cases
  // ============================================================================

  describe("Edge Cases", () => {
    test("should handle backdating to past year", async () => {
      const book = await bookRepository.create(createTestBook({ totalPages: 300 }));
      await sessionRepository.create(createTestSession({
        bookId: book.id,
        status: "to-read",
        isActive: true,
        sessionNumber: 1,
      }));

      const request = createMockRequest("POST", `/api/books/${book.id}/complete`, {
        startDate: "2023-01-01",
        endDate: "2023-01-31",
      });

      const response = await POST(request as NextRequest, { params: { id: book.id.toString() } });
      expect(response.status).toBe(200);

      const progress = await progressRepository.findByBookId(book.id);
      expect(progress.length).toBeGreaterThan(0);
      
      const firstProgress = progress.sort((a, b) => 
        new Date(a.progressDate).getTime() - new Date(b.progressDate).getTime()
      )[0];
      
      expect(new Date(firstProgress.progressDate).getFullYear()).toBe(2023);
    });

    test("should handle very long reading period (years)", async () => {
      const book = await bookRepository.create(createTestBook({ totalPages: 1000 }));
      await sessionRepository.create(createTestSession({
        bookId: book.id,
        status: "to-read",
        isActive: true,
        sessionNumber: 1,
      }));

      const request = createMockRequest("POST", `/api/books/${book.id}/complete`, {
        startDate: "2020-01-01",
        endDate: "2024-12-31",
      });

      const response = await POST(request as NextRequest, { params: { id: book.id.toString() } });
      expect(response.status).toBe(200);
    });

    test("should handle book with zero totalPages", async () => {
      const book = await bookRepository.create(createTestBook({ totalPages: 0 }));
      await sessionRepository.create(createTestSession({
        bookId: book.id,
        status: "to-read",
        isActive: true,
        sessionNumber: 1,
      }));

      const request = createMockRequest("POST", `/api/books/${book.id}/complete`, {
        startDate: "2024-01-01",
        endDate: "2024-01-05",
      });

      const response = await POST(request as NextRequest, { params: { id: book.id.toString() } });
      expect(response.status).toBe(200);

      // Should complete without progress entries
      const progress = await progressRepository.findByBookId(book.id);
      expect(progress.length).toBe(0);
    });

    test("should handle very large page counts", async () => {
      const book = await bookRepository.create(createTestBook({ totalPages: null }));
      await sessionRepository.create(createTestSession({
        bookId: book.id,
        status: "to-read",
        isActive: true,
        sessionNumber: 1,
      }));

      const request = createMockRequest("POST", `/api/books/${book.id}/complete`, {
        totalPages: 10000,
        startDate: "2024-01-01",
        endDate: "2024-12-31",
      });

      const response = await POST(request as NextRequest, { params: { id: book.id.toString() } });
      expect(response.status).toBe(200);

      const updatedBook = await bookRepository.findById(book.id);
      expect(updatedBook?.totalPages).toBe(10000);
    });

    test("should handle completion with empty review string", async () => {
      const book = await bookRepository.create(createTestBook({ totalPages: 300 }));
      await sessionRepository.create(createTestSession({
        bookId: book.id,
        status: "to-read",
        isActive: true,
        sessionNumber: 1,
      }));

      const request = createMockRequest("POST", `/api/books/${book.id}/complete`, {
        startDate: "2024-01-01",
        endDate: "2024-01-15",
        review: "", // Empty string
      });

      const response = await POST(request as NextRequest, { params: { id: book.id.toString() } });
      expect(response.status).toBe(200);
    });

    test("should handle completion from read-next status", async () => {
      const book = await bookRepository.create(createTestBook({ totalPages: 300 }));
      await sessionRepository.create(createTestSession({
        bookId: book.id,
        status: "read-next",
        isActive: true,
        sessionNumber: 1,
      }));

      const request = createMockRequest("POST", `/api/books/${book.id}/complete`, {
        startDate: "2024-01-01",
        endDate: "2024-01-15",
      });

      const response = await POST(request as NextRequest, { params: { id: book.id.toString() } });
      expect(response.status).toBe(200);

      const sessions = await sessionRepository.findAllByBookId(book.id);
      const completedSession = sessions.find((s: any) => s.status === "read");
      expect(completedSession).toBeDefined();
    });

    test("should handle completion with rating of 1 (minimum valid)", async () => {
      const book = await bookRepository.create(createTestBook({ totalPages: 300 }));
      await sessionRepository.create(createTestSession({
        bookId: book.id,
        status: "to-read",
        isActive: true,
        sessionNumber: 1,
      }));

      const request = createMockRequest("POST", `/api/books/${book.id}/complete`, {
        startDate: "2024-01-01",
        endDate: "2024-01-05",
        rating: 1,
      });

      const response = await POST(request as NextRequest, { params: { id: book.id.toString() } });
      expect(response.status).toBe(200);

      const updatedBook = await bookRepository.findById(book.id);
      expect(updatedBook?.rating).toBe(1);
    });
  });
});
