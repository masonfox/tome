import { describe, test, expect, beforeAll, afterAll, beforeEach, mock } from "bun:test";
import { bookRepository, sessionRepository, progressRepository } from "@/lib/repositories";
import { createMockRequest, createTestBook, createTestSession, createTestProgress } from "../fixtures/test-data";
import { setupTestDatabase, teardownTestDatabase, clearTestDatabase } from "@/__tests__/helpers/db-setup";
import type { NextRequest } from "next/server";

/**
 * Integration Tests: Page Count Update + Status Change Flow
 * 
 * Tests the E2E flow where users:
 * 1. Update a book's page count (PATCH /api/books/:id)
 * 2. Immediately change status (POST /api/books/:id/status)
 * 
 * This is a critical user journey because:
 * - Users often discover incorrect page counts when marking a book complete
 * - The flow is explicitly handled in PageCountEditModal.tsx:68-87
 * - Progress recalculation must happen before status change to ensure correct percentages
 * - Calibre sync must receive updated rating on status change
 * 
 * References:
 * - PageCountEditModal.tsx:68-87 (sequential API calls)
 * - ADR-008: Page Count Update Strategy
 */

// Mock Next.js cache revalidation
mock.module("next/cache", () => ({
  revalidatePath: () => {},
}));

// Track Calibre rating sync calls
let calibreRatingCalls: Array<{ calibreId: number; rating: number | null }> = [];

/**
 * Mock Rationale: Avoid file system I/O to Calibre's SQLite database during tests.
 * We use a spy pattern (capturing calls to calibreRatingCalls) to verify that
 * our code correctly attempts to sync ratings, without actually writing to disk.
 * 
 * ARCHITECTURE FIX: Now mocking CalibreService instead of calibre-write module.
 * This prevents mock leakage to calibre-write.test.ts since they're different modules.
 */
mock.module("@/lib/services/calibre.service", () => ({
  calibreService: {
    updateRating: (calibreId: number, rating: number | null) => {
      calibreRatingCalls.push({ calibreId, rating });
    },
    readRating: () => null,
    updateTags: () => {},
    readTags: () => [],
  },
  CalibreService: class {},
}));

// IMPORTANT: Import route handlers AFTER mocks are set up
import { PATCH as PATCH_BOOK } from "@/app/api/books/[id]/route";
import { POST as UPDATE_STATUS } from "@/app/api/books/[id]/status/route";

beforeAll(async () => {
  await setupTestDatabase(__filename);
});

afterAll(async () => {
  await teardownTestDatabase(__filename);
});

beforeEach(async () => {
  await clearTestDatabase(__filename);
  calibreRatingCalls = [];
});

describe("Integration: Page Count Update + Status Change", () => {
  describe("Success Flows", () => {
    test("should update page count and mark as 'read' with rating sync", async () => {
      // ========================================================================
      // SCENARIO: User discovers book has 350 pages (not 300) when finishing
      // ========================================================================
      
      // Setup: Book with incorrect page count, active reading session at page 300
      const book = await bookRepository.create(createTestBook({
        calibreId: 1,
        title: "Test Book",
        authors: ["Test Author"],
        totalPages: 300, // Incorrect page count
        path: "Test/Book",
        rating: null,
      }));

      const session = await sessionRepository.create(createTestSession({
        bookId: book.id,
        sessionNumber: 1,
        status: "reading",
        isActive: true,
        startedDate: new Date("2025-12-01"),
      }));

      // User has logged progress up to page 300 (100% of 300-page book)
      await progressRepository.create(createTestProgress({
        bookId: book.id,
        sessionId: session.id,
        currentPage: 300,
        currentPercentage: 100,
        pagesRead: 300,
        progressDate: new Date("2025-12-08"),
      }));

      // ========================================================================
      // STEP 1: User updates page count to correct value (350 pages)
      // ========================================================================
      
      const patchRequest = createMockRequest("PATCH", `/api/books/${book.id}`, {
        totalPages: 350,
      }) as NextRequest;
      
      const patchResponse = await PATCH_BOOK(patchRequest, { params: { id: book.id.toString() } });
      const patchData = await patchResponse.json();

      // Assert: Page count update succeeded
      expect(patchResponse.status).toBe(200);
      expect(patchData.totalPages).toBe(350);

      // Assert: Progress percentage recalculated (300/350 = 85%)
      const updatedProgress = await progressRepository.findBySessionId(session.id);
      expect(updatedProgress).toHaveLength(1);
      expect(updatedProgress[0].currentPage).toBe(300); // Page unchanged
      expect(updatedProgress[0].currentPercentage).toBe(85); // 300/350 = 85.71% → 85%

      // ========================================================================
      // STEP 2: User marks book as 'read' with 5-star rating
      // ========================================================================
      
      const statusRequest = createMockRequest("POST", `/api/books/${book.id}/status`, {
        status: "read",
        rating: 5,
        completedDate: new Date("2025-12-08").toISOString(),
      }) as NextRequest;
      
      const statusResponse = await UPDATE_STATUS(statusRequest, { params: { id: book.id.toString() } });
      const statusData = await statusResponse.json();

      // Assert: Status change succeeded
      expect(statusResponse.status).toBe(200);
      expect(statusData.status).toBe("read");

      // Assert: Session marked complete
      const completedSession = await sessionRepository.findById(session.id);
      expect(completedSession?.status).toBe("read");
      expect(completedSession?.completedDate).toBeTruthy();
      expect(completedSession?.isActive).toBe(false); // Marked inactive when completed

      // Assert: Rating synced to Tome DB
      const updatedBook = await bookRepository.findById(book.id);
      expect(updatedBook?.rating).toBe(5);

      // Assert: Rating synced to Calibre DB
      expect(calibreRatingCalls).toHaveLength(1);
      expect(calibreRatingCalls[0].calibreId).toBe(book.calibreId);
      expect(calibreRatingCalls[0].rating).toBe(5);
    });

    test("should handle multiple progress logs with page count update then status change", async () => {
      // ========================================================================
      // SCENARIO: User has multiple progress logs, updates page count, completes book
      // ========================================================================
      
      const book = await bookRepository.create(createTestBook({
        calibreId: 2,
        title: "Multi Progress Book",
        authors: ["Author"],
        totalPages: 300,
        path: "Author/Book",
      }));

      const session = await sessionRepository.create(createTestSession({
        bookId: book.id,
        sessionNumber: 1,
        status: "reading",
        isActive: true,
      }));

      // Three progress logs over time
      await progressRepository.create(createTestProgress({
        bookId: book.id,
        sessionId: session.id,
        currentPage: 100,
        currentPercentage: 33, // 100/300
        pagesRead: 100,
        progressDate: new Date("2025-12-01"),
      }));

      await progressRepository.create(createTestProgress({
        bookId: book.id,
        sessionId: session.id,
        currentPage: 200,
        currentPercentage: 66, // 200/300
        pagesRead: 100,
        progressDate: new Date("2025-12-04"),
      }));

      await progressRepository.create(createTestProgress({
        bookId: book.id,
        sessionId: session.id,
        currentPage: 300,
        currentPercentage: 100, // 300/300
        pagesRead: 100,
        progressDate: new Date("2025-12-08"),
      }));

      // ========================================================================
      // STEP 1: Update to 350 pages
      // ========================================================================
      
      const patchRequest = createMockRequest("PATCH", `/api/books/${book.id}`, {
        totalPages: 350,
      }) as NextRequest;
      
      await PATCH_BOOK(patchRequest, { params: { id: book.id.toString() } });

      // Assert: All progress logs recalculated
      const updatedProgress = await progressRepository.findBySessionId(session.id);
      expect(updatedProgress).toHaveLength(3);

      const sorted = updatedProgress.sort((a, b) => a.currentPage - b.currentPage);
      expect(sorted[0].currentPercentage).toBe(28); // 100/350 = 28.57% → 28%
      expect(sorted[1].currentPercentage).toBe(57); // 200/350 = 57.14% → 57%
      expect(sorted[2].currentPercentage).toBe(85); // 300/350 = 85.71% → 85%

      // ========================================================================
      // STEP 2: Mark as read
      // ========================================================================
      
      const statusRequest = createMockRequest("POST", `/api/books/${book.id}/status`, {
        status: "read",
        completedDate: new Date("2025-12-08").toISOString(),
      }) as NextRequest;
      
      const statusResponse = await UPDATE_STATUS(statusRequest, { params: { id: book.id.toString() } });
      
      expect(statusResponse.status).toBe(200);
      
      const completedSession = await sessionRepository.findById(session.id);
      expect(completedSession?.status).toBe("read");

      // Assert: Progress percentages remain at recalculated values (not reset to 100%)
      const finalProgress = await progressRepository.findBySessionId(session.id);
      const finalSorted = finalProgress.sort((a, b) => a.currentPage - b.currentPage);
      expect(finalSorted[2].currentPercentage).toBe(85); // Still 85%, not changed to 100%
    });

    test("should handle page count update + status change with review and rating", async () => {
      // ========================================================================
      // SCENARIO: User finishes book, updates page count, marks complete with review
      // ========================================================================
      
      const book = await bookRepository.create(createTestBook({
        calibreId: 3,
        title: "Review Book",
        authors: ["Reviewer"],
        totalPages: 250,
        path: "Reviewer/Book",
      }));

      const session = await sessionRepository.create(createTestSession({
        bookId: book.id,
        sessionNumber: 1,
        status: "reading",
        isActive: true,
      }));

      await progressRepository.create(createTestProgress({
        bookId: book.id,
        sessionId: session.id,
        currentPage: 250,
        currentPercentage: 100,
        pagesRead: 250,
      }));

      // STEP 1: Correct page count to 275
      const patchRequest = createMockRequest("PATCH", `/api/books/${book.id}`, {
        totalPages: 275,
      }) as NextRequest;
      
      await PATCH_BOOK(patchRequest, { params: { id: book.id.toString() } });

      // STEP 2: Mark complete with review and rating
      const statusRequest = createMockRequest("POST", `/api/books/${book.id}/status`, {
        status: "read",
        rating: 4,
        review: "Great book! Really enjoyed the ending.",
        completedDate: new Date("2025-12-08").toISOString(),
      }) as NextRequest;
      
      const statusResponse = await UPDATE_STATUS(statusRequest, { params: { id: book.id.toString() } });
      const statusData = await statusResponse.json();

      // Assert: All data saved correctly
      expect(statusResponse.status).toBe(200);
      expect(statusData.status).toBe("read");
      
      const completedSession = await sessionRepository.findById(session.id);
      expect(completedSession?.status).toBe("read");
      expect(completedSession?.review).toBe("Great book! Really enjoyed the ending.");
      
      const updatedBook = await bookRepository.findById(book.id);
      expect(updatedBook?.rating).toBe(4);

      // Assert: Calibre sync with rating
      expect(calibreRatingCalls).toHaveLength(1);
      expect(calibreRatingCalls[0].rating).toBe(4);
    });
  });

  describe("Error Handling", () => {
    test("should prevent page count reduction below current progress, but allow status change", async () => {
      // ========================================================================
      // SCENARIO: User tries to reduce page count below current progress
      // ========================================================================
      
      const book = await bookRepository.create(createTestBook({
        calibreId: 4,
        title: "Error Book",
        authors: ["Author"],
        totalPages: 400,
        path: "Author/Book",
      }));

      const session = await sessionRepository.create(createTestSession({
        bookId: book.id,
        sessionNumber: 1,
        status: "reading",
        isActive: true,
      }));

      // User at page 350
      await progressRepository.create(createTestProgress({
        bookId: book.id,
        sessionId: session.id,
        currentPage: 350,
        currentPercentage: 87, // 350/400
        pagesRead: 350,
      }));

      // STEP 1: Try to update to 300 pages (below current progress)
      const patchRequest = createMockRequest("PATCH", `/api/books/${book.id}`, {
        totalPages: 300, // Invalid: user already at page 350
      }) as NextRequest;
      
      const patchResponse = await PATCH_BOOK(patchRequest, { params: { id: book.id.toString() } });
      const patchData = await patchResponse.json();

      // Assert: Page count update failed with helpful error
      expect(patchResponse.status).toBe(400);
      expect(patchData.error).toContain("Cannot reduce page count to 300");
      expect(patchData.error).toContain("already logged progress up to page 350");

      // Assert: Book still has original page count
      const unchangedBook = await bookRepository.findById(book.id);
      expect(unchangedBook?.totalPages).toBe(400);

      // STEP 2: Status change can still proceed with original data
      const statusRequest = createMockRequest("POST", `/api/books/${book.id}/status`, {
        status: "read",
      }) as NextRequest;
      
      const statusResponse = await UPDATE_STATUS(statusRequest, { params: { id: book.id.toString() } });
      
      expect(statusResponse.status).toBe(200);
      
      // Progress percentages remain based on 400-page book
      const progress = await progressRepository.findBySessionId(session.id);
      expect(progress[0].currentPercentage).toBe(87); // Still 350/400
    });

    test("should handle page count update success but status change failure", async () => {
      // ========================================================================
      // SCENARIO: Page count updates, but status change fails (e.g., invalid status)
      // ========================================================================
      
      const book = await bookRepository.create(createTestBook({
        calibreId: 5,
        title: "Partial Success Book",
        authors: ["Author"],
        totalPages: 300,
        path: "Author/Book",
      }));

      const session = await sessionRepository.create(createTestSession({
        bookId: book.id,
        sessionNumber: 1,
        status: "reading",
        isActive: true,
      }));

      await progressRepository.create(createTestProgress({
        bookId: book.id,
        sessionId: session.id,
        currentPage: 150,
        currentPercentage: 50,
        pagesRead: 150,
      }));

      // STEP 1: Page count update succeeds
      const patchRequest = createMockRequest("PATCH", `/api/books/${book.id}`, {
        totalPages: 400,
      }) as NextRequest;
      
      const patchResponse = await PATCH_BOOK(patchRequest, { params: { id: book.id.toString() } });
      
      expect(patchResponse.status).toBe(200);

      // STEP 2: Status change with invalid status
      const statusRequest = createMockRequest("POST", `/api/books/${book.id}/status`, {
        status: "invalid-status" as any, // Not a valid status
      }) as NextRequest;
      
      const statusResponse = await UPDATE_STATUS(statusRequest, { params: { id: book.id.toString() } });
      
      // Assert: Status change fails
      expect(statusResponse.status).toBe(400);

      // Assert: Page count update persists (no rollback)
      const updatedBook = await bookRepository.findById(book.id);
      expect(updatedBook?.totalPages).toBe(400);

      // Assert: Progress recalculation persists
      const updatedProgress = await progressRepository.findBySessionId(session.id);
      expect(updatedProgress[0].currentPercentage).toBe(37); // 150/400

      // Assert: Session status unchanged
      const unchangedSession = await sessionRepository.findById(session.id);
      expect(unchangedSession?.status).toBe("reading"); // Still original status
    });
  });

  describe("Real-World Scenario", () => {
    test("Most common flow: Finish book, realize page count wrong, correct it, mark complete", async () => {
      // ========================================================================
      // MOST COMMON USER JOURNEY (from PageCountEditModal.tsx:68-87)
      // ========================================================================
      
      // Setup: User reading a book with metadata error
      const book = await bookRepository.create(createTestBook({
        calibreId: 6,
        title: "The Great Gatsby",
        authors: ["F. Scott Fitzgerald"],
        totalPages: 180, // Calibre metadata shows 180
        path: "F. Scott Fitzgerald/The Great Gatsby (6)",
        rating: null,
      }));

      const session = await sessionRepository.create(createTestSession({
        bookId: book.id,
        sessionNumber: 1,
        status: "reading",
        isActive: true,
        startedDate: new Date("2025-11-15"),
      }));

      // User has been reading, logged several progress points
      await progressRepository.create(createTestProgress({
        bookId: book.id,
        sessionId: session.id,
        currentPage: 50,
        currentPercentage: 27, // 50/180 = 27.77% → 27%
        pagesRead: 50,
        progressDate: new Date("2025-11-20"),
      }));

      await progressRepository.create(createTestProgress({
        bookId: book.id,
        sessionId: session.id,
        currentPage: 100,
        currentPercentage: 55, // 100/180 = 55.55% → 55%
        pagesRead: 50,
        progressDate: new Date("2025-11-25"),
      }));

      await progressRepository.create(createTestProgress({
        bookId: book.id,
        sessionId: session.id,
        currentPage: 180,
        currentPercentage: 100, // 180/180 = 100%
        pagesRead: 80,
        progressDate: new Date("2025-12-08"),
      }));

      // User finishes, checks physical book: "Wait, this is 218 pages, not 180!"
      // User clicks "Edit" next to "180 pages" on book detail page

      // ========================================================================
      // STEP 1: Update page count to correct value
      // ========================================================================
      
      const patchRequest = createMockRequest("PATCH", `/api/books/${book.id}`, {
        totalPages: 218, // Actual page count
      }) as NextRequest;
      
      const patchResponse = await PATCH_BOOK(patchRequest, { params: { id: book.id.toString() } });
      const patchData = await patchResponse.json();

      expect(patchResponse.status).toBe(200);
      expect(patchData.totalPages).toBe(218);

      // Verify progress recalculated
      const recalculatedProgress = await progressRepository.findBySessionId(session.id);
      const sorted = recalculatedProgress.sort((a, b) => a.currentPage - b.currentPage);
      
      expect(sorted[0].currentPercentage).toBe(22); // 50/218 = 22.93% → 22%
      expect(sorted[1].currentPercentage).toBe(45); // 100/218 = 45.87% → 45%
      expect(sorted[2].currentPercentage).toBe(82); // 180/218 = 82.56% → 82%

      // ========================================================================
      // STEP 2: User marks book as complete with rating
      // ========================================================================
      
      const statusRequest = createMockRequest("POST", `/api/books/${book.id}/status`, {
        status: "read",
        rating: 5,
        review: "A masterpiece of American literature!",
        completedDate: new Date("2025-12-08").toISOString(),
      }) as NextRequest;
      
      const statusResponse = await UPDATE_STATUS(statusRequest, { params: { id: book.id.toString() } });
      const statusData = await statusResponse.json();

      // ========================================================================
      // FINAL ASSERTIONS: Everything updated correctly
      // ========================================================================
      
      expect(statusResponse.status).toBe(200);
      expect(statusData.status).toBe("read");

      // Book metadata updated
      const finalBook = await bookRepository.findById(book.id);
      expect(finalBook?.totalPages).toBe(218); // Corrected
      expect(finalBook?.rating).toBe(5); // Saved

      // Session completed
      const finalSession = await sessionRepository.findById(session.id);
      expect(finalSession?.status).toBe("read");
      expect(finalSession?.review).toBe("A masterpiece of American literature!");
      expect(finalSession?.completedDate).toBeTruthy();

      // Progress percentages reflect corrected page count
      const finalProgress = await progressRepository.findBySessionId(session.id);
      expect(finalProgress).toHaveLength(3);
      expect(finalProgress.every(p => p.currentPage <= 218)).toBe(true);

      // Calibre database synced with rating
      expect(calibreRatingCalls).toHaveLength(1);
      expect(calibreRatingCalls[0].calibreId).toBe(book.calibreId);
      expect(calibreRatingCalls[0].rating).toBe(5);
    });
  });
});
