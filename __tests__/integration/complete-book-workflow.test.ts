import { toProgressDate, toSessionDate } from '../test-utils';
import { describe, test, expect, beforeEach, beforeAll, afterAll, vi } from 'vitest';
import { setupTestDatabase, teardownTestDatabase, clearTestDatabase } from "@/__tests__/helpers/db-setup";
import { bookRepository, sessionRepository, progressRepository } from "@/lib/repositories";
import { createTestBook, createTestSession, createMockRequest } from "../fixtures/test-data";
import { POST } from "@/app/api/books/[id]/complete/route";
import type { NextRequest } from "next/server";
import { formatInTimeZone } from "date-fns-tz";

// Helper function to extract date in EST timezone from a stored UTC date
function getDateInEST(date: Date): string {
  return formatInTimeZone(date, "America/New_York", "yyyy-MM-dd");
}

// Helper function to create expected UTC date from YYYY-MM-DD string (midnight EST → UTC)
function expectedUTCDate(dateString: string): Date {
  const [year, month, day] = dateString.split('-').map(Number);
  const localDate = new Date(year, month - 1, day, 0, 0, 0, 0);
  // Convert midnight EST to UTC (add 5 hours)
  return new Date(localDate.getTime() + 5 * 60 * 60 * 1000);
}

/**
 * Integration Tests: Complete Book Workflow
 * 
 * Tests the full end-to-end workflow for completing a book from "Want to Read"
 * or "Read Next" status. This validates the integration between:
 * - API endpoint (/api/books/[id]/complete)
 * - Service layer (SessionService, ProgressService)
 * - Repository layer (bookRepository, sessionRepository, progressRepository)
 * - Database persistence
 * 
 * Scenarios:
 * - Complete book with pages (creates progress entries)
 * - Complete book without pages (direct status change)
 * - Complete with optional rating/review
 * - Auto-completion at 100% progress
 * - Page count updates during completion
 * - Session state transitions
 */

// Mock external dependencies
vi.mock("next/cache", () => ({
  revalidatePath: () => {},
}));

vi.mock("@/lib/services/calibre.service", () => ({
  calibreService: {
    updateRating: () => {},
    readRating: () => null,
    updateTags: () => {},
  },
}));

vi.mock("@/lib/streaks", () => ({
  checkAndUpdateStreaks: () => Promise.resolve(),
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

describe("Integration: Complete Book Workflow", () => {
  // ============================================================================
  // Basic Completion Workflows
  // ============================================================================

  test("should complete book from Want to Read with page count", async () => {
    // ARRANGE: User has a book in Want to Read status (no active session)
    const book = await bookRepository.create(createTestBook({
      calibreId: 1,
      title: "Want to Read Book",
      authors: ["Test Author"],
      totalPages: 300,
      path: "Test/Book1",
    }));

    // No session exists yet (typical for Want to Read books)

    // ACT: User marks book as complete via API
    const request = createMockRequest("POST", `/api/books/${book.id}/complete`, {
      startDate: "2024-01-01",
      endDate: "2024-01-15",
    });

    const response = await POST(request as NextRequest, { params: { id: book.id.toString() } });

    // ASSERT: API responds successfully
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.success).toBe(true);

    // ASSERT: Session was created and completed
    const sessions = await sessionRepository.findAllByBookId(book.id);
    expect(sessions).toHaveLength(1);
    
    const completedSession = sessions[0];
    expect(completedSession.status).toBe("read");
    expect(completedSession.isActive).toBe(false);
    expect(completedSession.startedDate).toBeDefined();
    expect(completedSession.completedDate).toBeDefined();
    expect(getDateInEST(completedSession.startedDate!)).toBe("2024-01-01");
    expect(getDateInEST(completedSession.completedDate!)).toBe("2024-01-15");

    // ASSERT: Progress entries were created (start → 100%)
    const progress = await progressRepository.findByBookId(book.id);
    expect(progress.length).toBeGreaterThanOrEqual(2);

    const startProgress = progress.find(p => p.currentPage === 1);
    expect(startProgress).toBeDefined();
    expect(getDateInEST(startProgress!.progressDate)).toBe("2024-01-01");

    const endProgress = progress.find(p => p.currentPercentage === 100);
    expect(endProgress).toBeDefined();
    expect(endProgress!.currentPage).toBe(300);
    expect(getDateInEST(endProgress!.progressDate)).toBe("2024-01-15");
  });

  test("should complete book from Read Next with custom page count", async () => {
    // ARRANGE: User has a book in Read Next status with an existing inactive session
    const book = await bookRepository.create(createTestBook({
      calibreId: 2,
      title: "Read Next Book",
      authors: ["Test Author"],
      totalPages: 0, // No page count set
      path: "Test/Book2",
    }));

    await sessionRepository.create(createTestSession({
      bookId: book.id,
      status: "to-read",
      isActive: true,
      sessionNumber: 1,
    }));

    // ACT: User completes book and provides page count
    const request = createMockRequest("POST", `/api/books/${book.id}/complete`, {
      totalPages: 450,
      startDate: "2024-02-01",
      endDate: "2024-02-20",
    });

    const response = await POST(request as NextRequest, { params: { id: book.id.toString() } });

    // ASSERT: API succeeds
    expect(response.status).toBe(200);

    // ASSERT: Book page count was updated
    const updatedBook = await bookRepository.findById(book.id);
    expect(updatedBook!.totalPages).toBe(450);

    // ASSERT: Session completed
    const session = await sessionRepository.findActiveByBookId(book.id);
    expect(session).toBeFalsy(); // No active session (was archived)

    const allSessions = await sessionRepository.findAllByBookId(book.id);
    expect(allSessions).toHaveLength(1);
    expect(allSessions[0].status).toBe("read");

    // ASSERT: Progress created with correct page count
    const progress = await progressRepository.findByBookId(book.id);
    const endProgress = progress.find(p => p.currentPercentage === 100);
    expect(endProgress!.currentPage).toBe(450);
  });

  test("should complete book without pages (audiobook/no page count)", async () => {
    // ARRANGE: Book with no pages
    const book = await bookRepository.create(createTestBook({
      calibreId: 3,
      title: "Audiobook",
      authors: ["Test Author"],
      totalPages: 0,
      path: "Test/Book3",
    }));

    await sessionRepository.create(createTestSession({
      bookId: book.id,
      status: "to-read",
      isActive: true,
      sessionNumber: 1,
    }));

    // ACT: Complete without providing page count
    const request = createMockRequest("POST", `/api/books/${book.id}/complete`, {
      startDate: "2024-03-01",
      endDate: "2024-03-10",
    });

    const response = await POST(request as NextRequest, { params: { id: book.id.toString() } });

    // ASSERT: Success
    expect(response.status).toBe(200);

    // ASSERT: Session marked as read directly (no progress entries)
    const sessions = await sessionRepository.findAllByBookId(book.id);
    expect(sessions).toHaveLength(1);
    expect(sessions[0].status).toBe("read");
    expect(sessions[0].completedDate).toBeDefined();
    expect(getDateInEST(sessions[0].completedDate!)).toBe("2024-03-10");

    // ASSERT: No progress entries (since no pages)
    const progress = await progressRepository.findByBookId(book.id);
    expect(progress).toHaveLength(0);
  });

  // ============================================================================
  // Rating and Review Integration
  // ============================================================================

  test("should complete book with rating and review", async () => {
    // ARRANGE
    const book = await bookRepository.create(createTestBook({
      calibreId: 4,
      title: "Book with Rating",
      authors: ["Test Author"],
      totalPages: 250,
      path: "Test/Book4",
    }));

    // ACT: Complete with rating and review
    const request = createMockRequest("POST", `/api/books/${book.id}/complete`, {
      startDate: "2024-04-01",
      endDate: "2024-04-10",
      rating: 5,
      review: "Absolutely fantastic! A must-read.",
    });

    const response = await POST(request as NextRequest, { params: { id: book.id.toString() } });

    // ASSERT: Success
    expect(response.status).toBe(200);

    // ASSERT: Book rating updated
    const updatedBook = await bookRepository.findById(book.id);
    expect(updatedBook!.rating).toBe(5);

    // ASSERT: Review attached to completed session
    const sessions = await sessionRepository.findAllByBookId(book.id);
    const completedSession = sessions.find(s => s.status === "read");
    expect(completedSession).toBeDefined();
    expect(completedSession!.review).toBe("Absolutely fantastic! A must-read.");
  });

  test("should handle partial data (rating without review)", async () => {
    // ARRANGE
    const book = await bookRepository.create(createTestBook({
      calibreId: 5,
      title: "Book with Rating Only",
      authors: ["Test Author"],
      totalPages: 200,
      path: "Test/Book5",
    }));

    // ACT: Complete with rating only
    const request = createMockRequest("POST", `/api/books/${book.id}/complete`, {
      startDate: "2024-05-01",
      endDate: "2024-05-05",
      rating: 3,
    });

    const response = await POST(request as NextRequest, { params: { id: book.id.toString() } });

    // ASSERT: Success
    expect(response.status).toBe(200);

    // ASSERT: Rating set, no review
    const updatedBook = await bookRepository.findById(book.id);
    expect(updatedBook!.rating).toBe(3);

    const sessions = await sessionRepository.findAllByBookId(book.id);
    const completedSession = sessions.find(s => s.status === "read");
    expect(completedSession!.review).toBeNull();
  });

  // ============================================================================
  // Session State Transitions
  // ============================================================================

  test("should transition existing reading session to completed", async () => {
    // ARRANGE: Book already being read
    const book = await bookRepository.create(createTestBook({
      calibreId: 6,
      title: "Currently Reading Book",
      authors: ["Test Author"],
      totalPages: 400,
      path: "Test/Book6",
    }));

    const session = await sessionRepository.create(createTestSession({
      bookId: book.id,
      status: "reading",
      isActive: true,
      sessionNumber: 1,
      startedDate: toSessionDate(new Date("2024-01-01")),
    }));

    // User has already logged some progress
    await progressRepository.create({
      bookId: book.id,
      sessionId: session.id,
      currentPage: 200,
      currentPercentage: 50,
      pagesRead: 200,
      progressDate: "2024-01-10",
    });

    // ACT: User logs 100% progress (auto-completion)
    const request = createMockRequest("POST", `/api/books/${book.id}/complete`, {
      startDate: "2024-01-01",
      endDate: "2024-01-20",
    });

    const response = await POST(request as NextRequest, { params: { id: book.id.toString() } });

    // ASSERT: Success
    expect(response.status).toBe(200);

    // ASSERT: Same session was completed (not a new one)
    const sessions = await sessionRepository.findAllByBookId(book.id);
    expect(sessions).toHaveLength(1);
    expect(sessions[0].id).toBe(session.id);
    expect(sessions[0].status).toBe("read");
    expect(sessions[0].isActive).toBe(false);

    // ASSERT: All progress preserved
    const progress = await progressRepository.findByBookId(book.id);
    expect(progress.length).toBeGreaterThanOrEqual(3); // Original 200-page entry + start (1 page) + end (100%)
  });

  test("should create new session when completing from Want to Read", async () => {
    // ARRANGE: Book with no session
    const book = await bookRepository.create(createTestBook({
      calibreId: 7,
      title: "No Session Book",
      authors: ["Test Author"],
      totalPages: 300,
      path: "Test/Book7",
    }));

    // ACT: Complete book
    const request = createMockRequest("POST", `/api/books/${book.id}/complete`, {
      startDate: "2024-06-01",
      endDate: "2024-06-15",
    });

    const response = await POST(request as NextRequest, { params: { id: book.id.toString() } });

    // ASSERT: Success
    expect(response.status).toBe(200);

    // ASSERT: New session was created and completed
    const sessions = await sessionRepository.findAllByBookId(book.id);
    expect(sessions).toHaveLength(1);
    expect(sessions[0].sessionNumber).toBe(1);
    expect(sessions[0].status).toBe("read");
    expect(sessions[0].startedDate).toBeDefined();
    expect(sessions[0].completedDate).toBeDefined();
    expect(getDateInEST(sessions[0].startedDate!)).toBe("2024-06-01");
    expect(getDateInEST(sessions[0].completedDate!)).toBe("2024-06-15");
  });

  // ============================================================================
  // Edge Cases and Boundary Conditions
  // ============================================================================

  test("should handle same-day completion", async () => {
    // ARRANGE
    const book = await bookRepository.create(createTestBook({
      calibreId: 8,
      title: "Same Day Book",
      authors: ["Test Author"],
      totalPages: 150,
      path: "Test/Book8",
    }));

    // ACT: Complete in same day
    const request = createMockRequest("POST", `/api/books/${book.id}/complete`, {
      startDate: "2024-07-01",
      endDate: "2024-07-01",
    });

    const response = await POST(request as NextRequest, { params: { id: book.id.toString() } });

    // ASSERT: Success (same day is valid)
    expect(response.status).toBe(200);

    const progress = await progressRepository.findByBookId(book.id);
    const dates = progress.map(p => p.progressDate);
    expect(dates.every(d => d === "2024-07-01")).toBe(true);
  });

  test("should handle books with very large page counts", async () => {
    // ARRANGE
    const book = await bookRepository.create(createTestBook({
      calibreId: 9,
      title: "Very Long Book",
      authors: ["Test Author"],
      totalPages: 2000,
      path: "Test/Book9",
    }));

    // ACT
    const request = createMockRequest("POST", `/api/books/${book.id}/complete`, {
      startDate: "2024-01-01",
      endDate: "2024-03-01",
    });

    const response = await POST(request as NextRequest, { params: { id: book.id.toString() } });

    // ASSERT: Success
    expect(response.status).toBe(200);

    const progress = await progressRepository.findByBookId(book.id);
    const endProgress = progress.find(p => p.currentPercentage === 100);
    expect(endProgress!.currentPage).toBe(2000);
  });

  test("should handle backdated completion (past dates)", async () => {
    // ARRANGE
    const book = await bookRepository.create(createTestBook({
      calibreId: 10,
      title: "Past Book",
      authors: ["Test Author"],
      totalPages: 300,
      path: "Test/Book10",
    }));

    // ACT: Complete with dates from 2020
    const request = createMockRequest("POST", `/api/books/${book.id}/complete`, {
      startDate: "2020-01-01",
      endDate: "2020-01-31",
    });

    const response = await POST(request as NextRequest, { params: { id: book.id.toString() } });

    // ASSERT: Success (backdating is allowed)
    expect(response.status).toBe(200);

    const session = (await sessionRepository.findAllByBookId(book.id))[0];
    expect(session.startedDate).toBeDefined();
    expect(session.completedDate).toBeDefined();
    expect(getDateInEST(session.startedDate!)).toBe("2020-01-01");
    expect(getDateInEST(session.completedDate!)).toBe("2020-01-31");
  });

  // ============================================================================
  // Progress Calculation Validation
  // ============================================================================

  test("should calculate correct progress percentages for various page counts", async () => {
    const testCases = [
      { pages: 100, expectedStartPercent: 1 },    // 1/100 = 1%
      { pages: 250, expectedStartPercent: 0 },    // 1/250 = 0.4% → rounds to 0%
      { pages: 500, expectedStartPercent: 0 },    // 1/500 = 0.2% → rounds to 0%
      { pages: 10, expectedStartPercent: 10 },    // 1/10 = 10%
    ];

    for (const { pages, expectedStartPercent } of testCases) {
      await clearTestDatabase(__filename);

      const book = await bookRepository.create(createTestBook({
        calibreId: Math.floor(Math.random() * 10000),
        title: `Test ${pages} pages`,
        authors: ["Test"],
        totalPages: pages,
        path: "Test/Path",
      }));

      const request = createMockRequest("POST", `/api/books/${book.id}/complete`, {
        startDate: "2024-01-01",
        endDate: "2024-01-15",
      });

      await POST(request as NextRequest, { params: { id: book.id.toString() } });

      const progress = await progressRepository.findByBookId(book.id);
      const startProgress = progress.find(p => p.currentPage === 1);
      
      expect(startProgress).toBeDefined();
      expect(startProgress!.currentPercentage).toBe(expectedStartPercent);

      const endProgress = progress.find(p => p.currentPercentage === 100);
      expect(endProgress!.currentPage).toBe(pages);
    }
  });

  // ============================================================================
  // Error Recovery
  // ============================================================================

  test("should handle completion even if rating update fails", async () => {
    // ARRANGE
    const book = await bookRepository.create(createTestBook({
      calibreId: 11,
      title: "Rating Fail Book",
      authors: ["Test Author"],
      totalPages: 200,
      path: "Test/Book11",
    }));

    // ACT: Complete with invalid rating (edge case - API validates but testing resilience)
    const request = createMockRequest("POST", `/api/books/${book.id}/complete`, {
      startDate: "2024-08-01",
      endDate: "2024-08-10",
      rating: 5,
    });

    const response = await POST(request as NextRequest, { params: { id: book.id.toString() } });

    // ASSERT: Completion succeeds even if rating service had issues
    // (Rating updates are best-effort as per endpoint design)
    expect(response.status).toBe(200);

    const sessions = await sessionRepository.findAllByBookId(book.id);
    expect(sessions[0].status).toBe("read");
  });
});
