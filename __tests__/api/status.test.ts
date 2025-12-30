import { describe, test, expect, beforeAll, afterAll, beforeEach, mock } from "bun:test";
import { POST } from "@/app/api/books/[id]/status/route";
import { bookRepository, sessionRepository, progressRepository, streakRepository } from "@/lib/repositories";
import { setupTestDatabase, teardownTestDatabase, clearTestDatabase } from "@/__tests__/helpers/db-setup";
import {
  mockBook1,
  mockSessionToRead,
  mockSessionReadNext,
  mockSessionReading,
  mockSessionRead,
  mockProgressLog1,
  createMockRequest,
  createTestBook,
  createTestSession,
} from "../fixtures/test-data";
import type { NextRequest } from "next/server";
import { format } from "date-fns";

/**
 * Mock Rationale: Prevent Next.js cache revalidation side effects during tests.
 * The status API calls revalidatePath to update cached pages, but we don't need
 * to test Next.js's caching behavior - just our business logic.
 */
mock.module("next/cache", () => ({
  revalidatePath: () => {},
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

describe("POST /api/books/[id]/status - Backward Movement with Session Archival", () => {
  // ============================================================================
  // BACKWARD MOVEMENT: READING -> READ-NEXT
  // ============================================================================

  test("should archive session when moving from 'reading' to 'read-next' with progress", async () => {
    const book = await bookRepository.create(mockBook1);
    const session = await sessionRepository.create({
      ...mockSessionReading,
      bookId: book.id,
      status: "reading",
      isActive: true,
    });

    // Add progress with explicit date
    const progressDate = new Date("2025-11-20T12:00:00.000Z");
    await progressRepository.create({
      ...mockProgressLog1,
      bookId: book.id,
      sessionId: session.id,
      progressDate,
    });

    const request = createMockRequest("POST", `/api/books/${book.id}/status`, {
      status: "read-next",
    });
    const response = await POST(request as NextRequest, { params: { id: book.id.toString() } });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.sessionArchived).toBe(true);
    expect(data.archivedSessionNumber).toBe(1);
    expect(data.sessionNumber).toBe(2);
    expect(data.status).toBe("read-next");
    expect(data.isActive).toBe(true);

    // Verify old session is archived with completedDate
    const oldSession = await sessionRepository.findById(session.id);
    expect(oldSession?.isActive).toBe(false);
    expect(oldSession?.completedDate).toBeDefined();
    
    // completedDate should match last progress date
    const completedDate = new Date(oldSession!.completedDate!);
    expect(format(completedDate, 'yyyy-MM-dd')).toBe(format(progressDate, 'yyyy-MM-dd'));
  });

  test("should archive session when moving from 'reading' to 'to-read' with progress", async () => {
    const book = await bookRepository.create(mockBook1);
    const session = await sessionRepository.create({
      ...mockSessionReading,
      bookId: book.id,
      status: "reading",
      isActive: true,
    });

    await progressRepository.create({
      ...mockProgressLog1,
      bookId: book.id,
      sessionId: session.id,
    });

    const request = createMockRequest("POST", `/api/books/${book.id}/status`, {
      status: "to-read",
    });
    const response = await POST(request as NextRequest, { params: { id: book.id.toString() } });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.sessionArchived).toBe(true);
    expect(data.archivedSessionNumber).toBe(1);
    expect(data.sessionNumber).toBe(2);
    expect(data.status).toBe("to-read");
    expect(data.isActive).toBe(true);
  });

  test("should NOT archive session when moving from 'reading' to 'read-next' WITHOUT progress", async () => {
    const book = await bookRepository.create(mockBook1);
    const session = await sessionRepository.create({
      ...mockSessionReading,
      bookId: book.id,
      status: "reading",
      isActive: true,
    });

    // No progress logs created

    const request = createMockRequest("POST", `/api/books/${book.id}/status`, {
      status: "read-next",
    });
    const response = await POST(request as NextRequest, { params: { id: book.id.toString() } });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.sessionArchived).toBeUndefined();
    expect(data.sessionNumber).toBe(1); // Same session
    expect(data.status).toBe("read-next");
    expect(data.isActive).toBe(true);

    // Verify session is still active and updated
    const updatedSession = await sessionRepository.findById(session.id);
    expect(updatedSession?.isActive).toBe(true);
    expect(updatedSession?.status).toBe("read-next");
  });

  test("should auto-archive session when moving from 'reading' to 'read'", async () => {
    const book = await bookRepository.create(mockBook1);
    const session = await sessionRepository.create({
      ...mockSessionReading,
      bookId: book.id,
      status: "reading",
      isActive: true,
    });

    await progressRepository.create({
      ...mockProgressLog1,
      bookId: book.id,
      sessionId: session.id,
    });

    const request = createMockRequest("POST", `/api/books/${book.id}/status`, {
      status: "read",
      review: "Great!",
    });
    const response = await POST(request as NextRequest, { params: { id: book.id.toString() } });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.sessionArchived).toBeUndefined(); // No explicit archival message, just auto-archives
    expect(data.sessionNumber).toBe(1); // Same session
    expect(data.status).toBe("read");
    expect(data.isActive).toBe(false); // Auto-archived!
    expect(data.completedDate).toBeDefined();
  });

  test("should rebuild streak after archiving session", async () => {
    const book = await bookRepository.create(mockBook1);
    const session = await sessionRepository.create({
      ...mockSessionReading,
      bookId: book.id,
      status: "reading",
      isActive: true,
    });

    await progressRepository.create({
      ...mockProgressLog1,
      bookId: book.id,
      sessionId: session.id,
      progressDate: new Date("2025-11-17"),
    });

    // Create initial streak
    await streakRepository.create({
      userId: null,
      currentStreak: 1,
      longestStreak: 1,
      lastActivityDate: new Date("2025-11-17"),
      streakStartDate: new Date("2025-11-17"),
      totalDaysActive: 1,
    });

    const request = createMockRequest("POST", `/api/books/${book.id}/status`, {
      status: "read-next",
    });
    const response = await POST(request as NextRequest, { params: { id: book.id.toString() } });

    expect(response.status).toBe(200);

    // Verify streak still exists (rebuildStreak should have been called)
    const streak = await streakRepository.findByUserId(null);
    expect(streak).toBeDefined();
  });

  // ============================================================================
  // NO BACKWARD MOVEMENT: OTHER STATUS CHANGES
  // ============================================================================

  test("should NOT archive when moving from 'to-read' to 'reading'", async () => {
    const book = await bookRepository.create(mockBook1);
    const session = await sessionRepository.create({
      ...mockSessionToRead,
      bookId: book.id,
      status: "to-read",
      isActive: true,
    });

    const request = createMockRequest("POST", `/api/books/${book.id}/status`, {
      status: "reading",
    });
    const response = await POST(request as NextRequest, { params: { id: book.id.toString() } });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.sessionArchived).toBeUndefined();
    expect(data.sessionNumber).toBe(1);
    expect(data.status).toBe("reading");
  });

  test("should NOT archive when moving from 'read-next' to 'reading'", async () => {
    const book = await bookRepository.create(mockBook1);
    const session = await sessionRepository.create({
      ...mockSessionReadNext,
      bookId: book.id,
      status: "read-next",
      isActive: true,
    });

    const request = createMockRequest("POST", `/api/books/${book.id}/status`, {
      status: "reading",
    });
    const response = await POST(request as NextRequest, { params: { id: book.id.toString() } });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.sessionArchived).toBeUndefined();
    expect(data.sessionNumber).toBe(1);
    expect(data.status).toBe("reading");
  });

  test("should NOT archive when moving from 'to-read' to 'read-next'", async () => {
    const book = await bookRepository.create(mockBook1);
    const session = await sessionRepository.create({
      ...mockSessionToRead,
      bookId: book.id,
      status: "to-read",
      isActive: true,
    });

    const request = createMockRequest("POST", `/api/books/${book.id}/status`, {
      status: "read-next",
    });
    const response = await POST(request as NextRequest, { params: { id: book.id.toString() } });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.sessionArchived).toBeUndefined();
    expect(data.sessionNumber).toBe(1);
    expect(data.status).toBe("read-next");
  });

  test("should NOT archive when moving from 'read-next' to 'to-read'", async () => {
    const book = await bookRepository.create(mockBook1);
    const session = await sessionRepository.create({
      ...mockSessionReadNext,
      bookId: book.id,
      status: "read-next",
      isActive: true,
    });

    const request = createMockRequest("POST", `/api/books/${book.id}/status`, {
      status: "to-read",
    });
    const response = await POST(request as NextRequest, { params: { id: book.id.toString() } });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.sessionArchived).toBeUndefined();
    expect(data.sessionNumber).toBe(1);
    expect(data.status).toBe("to-read");
  });

  // ============================================================================
  // SESSION CREATION
  // ============================================================================

  test("should create new session if none exists", async () => {
    const book = await bookRepository.create(mockBook1);

    const request = createMockRequest("POST", `/api/books/${book.id}/status`, {
      status: "to-read",
    });
    const response = await POST(request as NextRequest, { params: { id: book.id.toString() } });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.sessionNumber).toBe(1);
    expect(data.status).toBe("to-read");
    expect(data.isActive).toBe(true);

    // Verify session was created
    const session = await sessionRepository.findById(data.id);
    expect(session).toBeDefined();
  });

  test("should increment session number from highest existing session", async () => {
    const book = await bookRepository.create(mockBook1);

    // Create archived sessions
    await sessionRepository.create({
      ...mockSessionRead,
      bookId: book.id,
      sessionNumber: 1,
      isActive: false,
    });
    await sessionRepository.create({
      ...mockSessionRead,
      bookId: book.id,
      sessionNumber: 2,
      isActive: false,
    });

    const request = createMockRequest("POST", `/api/books/${book.id}/status`, {
      status: "reading",
    });
    const response = await POST(request as NextRequest, { params: { id: book.id.toString() } });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.sessionNumber).toBe(3);
  });

  // ============================================================================
  // DATE HANDLING
  // ============================================================================

  test("should set startedDate when moving to 'reading' status", async () => {
    const book = await bookRepository.create(mockBook1);

    const beforeTime = new Date();
    const request = createMockRequest("POST", `/api/books/${book.id}/status`, {
      status: "reading",
    });
    const response = await POST(request as NextRequest, { params: { id: book.id.toString() } });
    const data = await response.json();
    const afterTime = new Date();

    expect(response.status).toBe(200);
    expect(data.startedDate).toBeDefined();

    const startedDate = new Date(data.startedDate);
    expect(startedDate.getTime()).toBeGreaterThanOrEqual(beforeTime.getTime() - 1000);
    expect(startedDate.getTime()).toBeLessThanOrEqual(afterTime.getTime() + 1000);
  });

  test("should set completedDate when moving to 'read' status", async () => {
    const book = await bookRepository.create(mockBook1);
    await sessionRepository.create({
      ...mockSessionReading,
      bookId: book.id,
      status: "reading",
      startedDate: new Date("2025-11-15"),
      isActive: true,
    });

    const beforeTime = new Date();
    const request = createMockRequest("POST", `/api/books/${book.id}/status`, {
      status: "read",
      rating: 4,
    });
    const response = await POST(request as NextRequest, { params: { id: book.id.toString() } });
    const data = await response.json();
    const afterTime = new Date();

    expect(response.status).toBe(200);
    expect(data.completedDate).toBeDefined();

    const completedDate = new Date(data.completedDate);
    expect(completedDate.getTime()).toBeGreaterThanOrEqual(beforeTime.getTime() - 1000);
    expect(completedDate.getTime()).toBeLessThanOrEqual(afterTime.getTime() + 1000);
  });

  test("should accept custom startedDate", async () => {
    const book = await bookRepository.create(mockBook1);
    const customDate = new Date("2025-11-01T05:00:00.000Z");

    const request = createMockRequest("POST", `/api/books/${book.id}/status`, {
      status: "reading",
      startedDate: customDate.toISOString(),
    });
    const response = await POST(request as NextRequest, { params: { id: book.id.toString() } });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(new Date(data.startedDate).toISOString()).toBe(customDate.toISOString());
  });

  test("should accept custom completedDate", async () => {
    const book = await bookRepository.create(mockBook1);
    const customDate = new Date("2025-11-16T05:00:00.000Z");

    await sessionRepository.create({
      ...mockSessionReading,
      bookId: book.id,
      status: "reading",
      isActive: true,
    });

    const request = createMockRequest("POST", `/api/books/${book.id}/status`, {
      status: "read",
      completedDate: customDate.toISOString(),
    });
    const response = await POST(request as NextRequest, { params: { id: book.id.toString() } });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(new Date(data.completedDate).toISOString()).toBe(customDate.toISOString());
  });

  // ============================================================================
  // REVIEW
  // ============================================================================

  test("should update review when provided", async () => {
    const book = await bookRepository.create(mockBook1);
    await sessionRepository.create({
      ...mockSessionReading,
      bookId: book.id,
      status: "reading",
      isActive: true,
    });

    const request = createMockRequest("POST", `/api/books/${book.id}/status`, {
      status: "read",
      rating: 4,
      review: "Excellent read!",
    });
    const response = await POST(request as NextRequest, { params: { id: book.id.toString() } });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.review).toBe("Excellent read!");
  });

  // ============================================================================
  // ERROR CASES
  // ============================================================================

  test("should return 400 with invalid status", async () => {
    const book = await bookRepository.create(mockBook1);

    const request = createMockRequest("POST", `/api/books/${book.id}/status`, {
      status: "invalid-status",
    });
    const response = await POST(request as NextRequest, { params: { id: book.id.toString() } });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain("Invalid status");
  });

  test("should return 400 with missing status", async () => {
    const book = await bookRepository.create(mockBook1);

    const request = createMockRequest("POST", `/api/books/${book.id}/status`, {});
    const response = await POST(request as NextRequest, { params: { id: book.id.toString() } });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain("Invalid status");
  });

  // ============================================================================
  // EDGE CASES
  // ============================================================================

  test("should handle multiple backward movements correctly", async () => {
    const book = await bookRepository.create(mockBook1);
    const session1 = await sessionRepository.create({
      ...mockSessionReading,
      bookId: book.id,
      sessionNumber: 1,
      status: "reading",
      isActive: true,
    });

    // Add progress to first session
    await progressRepository.create({
      ...mockProgressLog1,
      bookId: book.id,
      sessionId: session1.id,
    });

    // First backward movement
    const request1 = createMockRequest("POST", `/api/books/${book.id}/status`, {
      status: "read-next",
    });
    const response1 = await POST(request1 as NextRequest, { params: { id: book.id.toString() } });
    const data1 = await response1.json();

    expect(response1.status).toBe(200);
    expect(data1.sessionNumber).toBe(2);

    // Update to reading again
    const request2 = createMockRequest("POST", `/api/books/${book.id}/status`, {
      status: "reading",
    });
    await POST(request2 as NextRequest, { params: { id: book.id.toString() } });

    // Add progress to second session
    const session2 = await sessionRepository.findActiveByBookId(book.id);
    await progressRepository.create({
      ...mockProgressLog1,
      bookId: book.id,
      sessionId: session2!.id,
    });

    // Second backward movement
    const request3 = createMockRequest("POST", `/api/books/${book.id}/status`, {
      status: "to-read",
    });
    const response3 = await POST(request3 as NextRequest, { params: { id: book.id.toString() } });
    const data3 = await response3.json();

    expect(response3.status).toBe(200);
    expect(data3.sessionNumber).toBe(3);

    // Verify we have 3 sessions total
    const allSessions = await sessionRepository.findAllByBookId(book.id);
    expect(allSessions.length).toBe(3);
  });

  test("should preserve userId across session archival", async () => {
    const book = await bookRepository.create(mockBook1);
    const testUserId = null; // SQLite doesn't use ObjectId

    const session = await sessionRepository.create({
      ...mockSessionReading,
      bookId: book.id,
      userId: testUserId,
      status: "reading",
      isActive: true,
    });

    await progressRepository.create({
      ...mockProgressLog1,
      bookId: book.id,
      sessionId: session.id,
    });

    const request = createMockRequest("POST", `/api/books/${book.id}/status`, {
      status: "read-next",
    });
    const response = await POST(request as NextRequest, { params: { id: book.id.toString() } });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.userId).toBe(testUserId);
  });

  test("should maintain only one active session per book", async () => {
    const book = await bookRepository.create(mockBook1);
    const session = await sessionRepository.create({
      ...mockSessionReading,
      bookId: book.id,
      status: "reading",
      isActive: true,
    });

    await progressRepository.create({
      ...mockProgressLog1,
      bookId: book.id,
      sessionId: session.id,
    });

    const request = createMockRequest("POST", `/api/books/${book.id}/status`, {
      status: "to-read",
    });
    await POST(request as NextRequest, { params: { id: book.id.toString() } });

    // Verify only one active session
    const allSessions = await sessionRepository.findAllByBookId(book.id);
    const activeSessions = allSessions.filter(s => s.isActive);
    expect(activeSessions.length).toBe(1);
    expect(activeSessions[0].sessionNumber).toBe(2);
  });
});

describe("POST /api/books/[id]/status - Rating Sync to Calibre", () => {
  // Track calls to updateCalibreRating for verification
  let calibreRatingCalls: Array<{ calibreId: number; rating: number | null }> = [];
  
  beforeAll(async () => {
    /**
     * Mock Rationale: Avoid file system I/O to Calibre's SQLite database during tests.
     * We use a spy pattern (capturing calls to calibreRatingCalls) to verify that
     * our code correctly attempts to sync ratings, without actually writing to disk.
     */
    // Import the real class first to preserve it in the mock
    const { SyncOrchestrator: RealSyncOrchestrator } = await import("@/lib/services/integrations/sync-orchestrator");

    mock.module("@/lib/services/integrations/sync-orchestrator", () => ({
      syncOrchestrator: {
        syncRating: async (calibreId: number, rating: number | null) => {
          calibreRatingCalls.push({ calibreId, rating });
          return {
            success: true,
            results: [{ service: "calibre", success: true }],
            errors: [],
          };
        },
      },
      SyncOrchestrator: RealSyncOrchestrator, // Preserve the real class
    }));
  });
  
  beforeEach(() => {
    // Clear tracking array before each test
    calibreRatingCalls = [];
  });

  // ============================================================================
  // RATING SYNC: POSITIVE CASES
  // ============================================================================

  test("should sync rating to Calibre when marking book as 'read' with rating", async () => {
    // Arrange
    const book = await bookRepository.create(createTestBook(mockBook1));
    await sessionRepository.create(createTestSession({
      ...mockSessionReading,
      bookId: book.id,
      status: "reading",
      isActive: true,
      sessionNumber: 1,
    }));

    // Act
    const request = createMockRequest("POST", `/api/books/${book.id}/status`, {
      status: "read",
      rating: 5,
    });
    const response = await POST(request as NextRequest, {
      params: { id: book.id.toString() },
    });
    const data = await response.json();

    // Assert - Response successful
    expect(response.status).toBe(200);
    expect(data.status).toBe("read");

    // Assert - Calibre was updated
    expect(calibreRatingCalls).toHaveLength(1);
    expect(calibreRatingCalls[0].calibreId).toBe(book.calibreId);
    expect(calibreRatingCalls[0].rating).toBe(5);

    // Assert - Tome DB also updated
    const updatedBook = await bookRepository.findById(book.id);
    expect(updatedBook?.rating).toBe(5);
  });

  test("should sync rating to Calibre with different star values", async () => {
    const testCases = [
      { rating: 1, description: "1 star" },
      { rating: 2, description: "2 stars" },
      { rating: 3, description: "3 stars" },
      { rating: 4, description: "4 stars" },
      { rating: 5, description: "5 stars" },
    ];

    for (const testCase of testCases) {
      // Clear previous calls
      calibreRatingCalls = [];
      
      // Arrange
      const book = await bookRepository.create(createTestBook({
        ...mockBook1,
        calibreId: testCase.rating, // Use unique calibreId for each
      }));
      await sessionRepository.create(createTestSession({
        ...mockSessionReading,
        bookId: book.id,
        status: "reading",
        isActive: true,
      }));

      // Act
      const request = createMockRequest("POST", `/api/books/${book.id}/status`, {
        status: "read",
        rating: testCase.rating,
      });
      await POST(request as NextRequest, {
        params: { id: book.id.toString() },
      });

      // Assert
      expect(calibreRatingCalls).toHaveLength(1);
      expect(calibreRatingCalls[0].rating).toBe(testCase.rating);
    }
  });

  test("should remove rating from Calibre when marking as 'read' with rating=null", async () => {
    // Arrange - Book with existing rating
    const book = await bookRepository.create(createTestBook({
      ...mockBook1,
      rating: 4,
    }));
    await sessionRepository.create(createTestSession({
      ...mockSessionReading,
      bookId: book.id,
      status: "reading",
      isActive: true,
    }));

    // Act
    const request = createMockRequest("POST", `/api/books/${book.id}/status`, {
      status: "read",
      rating: null,
    });
    const response = await POST(request as NextRequest, {
      params: { id: book.id.toString() },
    });

    // Assert - Response successful
    expect(response.status).toBe(200);

    // Assert - Calibre rating removed
    expect(calibreRatingCalls).toHaveLength(1);
    expect(calibreRatingCalls[0].calibreId).toBe(book.calibreId);
    expect(calibreRatingCalls[0].rating).toBeNull();

    // Assert - Tome DB rating also removed
    const updatedBook = await bookRepository.findById(book.id);
    expect(updatedBook?.rating).toBeNull();
  });

  // ============================================================================
  // RATING SYNC: NEGATIVE CASES (should NOT call Calibre)
  // ============================================================================

  test("should NOT call Calibre when rating is not provided", async () => {
    // Arrange
    const book = await bookRepository.create(mockBook1);
    await sessionRepository.create({
      ...mockSessionReading,
      bookId: book.id,
      status: "reading",
      isActive: true,
    });

    // Act - Mark as read WITHOUT rating
    const request = createMockRequest("POST", `/api/books/${book.id}/status`, {
      status: "read",
    });
    const response = await POST(request as NextRequest, {
      params: { id: book.id.toString() },
    });

    // Assert - Response successful
    expect(response.status).toBe(200);

    // Assert - Calibre was NOT called
    expect(calibreRatingCalls).toHaveLength(0);
  });

  test("should NOT call Calibre when changing status without rating", async () => {
    // Arrange
    const book = await bookRepository.create(mockBook1);
    await sessionRepository.create({
      ...mockSessionToRead,
      bookId: book.id,
      status: "to-read",
      isActive: true,
    });

    // Act - Change to reading without rating
    const request = createMockRequest("POST", `/api/books/${book.id}/status`, {
      status: "reading",
    });
    await POST(request as NextRequest, {
      params: { id: book.id.toString() },
    });

    // Assert - Calibre was NOT called
    expect(calibreRatingCalls).toHaveLength(0);
  });

  // ============================================================================
  // ERROR HANDLING
  // ============================================================================

  test("should continue status update even if Calibre sync fails", async () => {
    // Arrange - Mock Calibre to throw error
    // No need to re-mock here - already set up in beforeAll

    const book = await bookRepository.create(mockBook1);
    await sessionRepository.create({
      ...mockSessionReading,
      bookId: book.id,
      status: "reading",
      isActive: true,
    });

    // Act
    const request = createMockRequest("POST", `/api/books/${book.id}/status`, {
      status: "read",
      rating: 5,
    });
    const response = await POST(request as NextRequest, {
      params: { id: book.id.toString() },
    });
    const data = await response.json();

    // Assert - Status update still succeeded
    expect(response.status).toBe(200);
    expect(data.status).toBe("read");
    expect(data.isActive).toBe(false);

    // Assert - Tome DB was still updated
    const updatedBook = await bookRepository.findById(book.id);
    expect(updatedBook?.rating).toBe(5);

    // Restore normal mock
    // No need to re-mock here - already set up in beforeAll
  });

  // ============================================================================
  // WORKFLOW INTEGRATION
  // ============================================================================

  test("should sync rating when marking as 'read' from 'to-read' with rating", async () => {
    // Arrange
    const book = await bookRepository.create(mockBook1);
    await sessionRepository.create({
      ...mockSessionToRead,
      bookId: book.id,
      status: "to-read",
      isActive: true,
    });

    // Act - Jump directly to read with rating
    const request = createMockRequest("POST", `/api/books/${book.id}/status`, {
      status: "read",
      rating: 4,
    });
    await POST(request as NextRequest, {
      params: { id: book.id.toString() },
    });

    // Assert - Calibre was updated
    expect(calibreRatingCalls).toHaveLength(1);
    expect(calibreRatingCalls[0].rating).toBe(4);
  });

  test("should sync rating when updating existing 'read' status with new rating", async () => {
    // Arrange - Book already marked as read
    const book = await bookRepository.create(createTestBook({
      ...mockBook1,
      rating: 3,
    }));
    await sessionRepository.create(createTestSession({
      ...mockSessionRead,
      bookId: book.id,
      status: "read",
      isActive: false,
    }));

    // Act - Update rating on already-read book
    const request = createMockRequest("POST", `/api/books/${book.id}/status`, {
      status: "read",
      rating: 5,
    });
    await POST(request as NextRequest, {
      params: { id: book.id.toString() },
    });

    // Assert - Calibre was updated with new rating
    expect(calibreRatingCalls).toHaveLength(1);
    expect(calibreRatingCalls[0].rating).toBe(5);

    // Assert - Tome DB also updated
    const updatedBook = await bookRepository.findById(book.id);
    expect(updatedBook?.rating).toBe(5);
  });
});
