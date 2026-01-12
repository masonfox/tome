import { describe, test, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { bookRepository, sessionRepository, progressRepository } from "@/lib/repositories";
import { POST } from "@/app/api/books/[id]/reread/route";
import {
  mockBook1,
  mockSessionReading,
  mockSessionRead,
  mockProgressLog1,
  mockProgressLog2,
  createMockRequest,
} from "../fixtures/test-data";
import { setupTestDatabase, teardownTestDatabase, clearTestDatabase } from "@/__tests__/helpers/db-setup";
import type { NextRequest } from "next/server";

/**
 * Mock Rationale: Prevent Next.js cache revalidation side effects during tests.
 * The reread API calls revalidatePath to update cached pages, but we don't need
 * to test Next.js's caching behavior - just our business logic.
 */
vi.mock("next/cache", () => ({
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

describe("POST /api/books/[id]/reread", () => {
  // ============================================================================
  // SUCCESS CASES
  // ============================================================================

  test("should archive current session and create new one for re-reading", async () => {
    // Create a book
    const book = await bookRepository.create(mockBook1);

    // Create an ARCHIVED reading session (auto-archived when marked as "read")
    const session = await sessionRepository.create({
      ...mockSessionRead,
      bookId: book.id,
      isActive: false, // Already archived
    });

    // Call the endpoint
    const request = createMockRequest("POST", `/api/books/${book.id}/reread`) as NextRequest;
    const response = await POST(request, { params: { id: book.id.toString() } });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.message).toBe("Re-reading session started successfully");
    expect(data.session).toBeDefined();
    expect(data.session.sessionNumber).toBe(2);
    expect(data.session.status).toBe("reading");
    expect(data.session.isActive).toBe(true);
    expect(data.session.startedDate).toBeDefined();
    expect(data.previousSession).toBeDefined();
    expect(data.previousSession.sessionNumber).toBe(1);

    // Verify old session is still archived
    const oldSession = await sessionRepository.findById(session.id);
    expect(oldSession?.isActive).toBe(false);

    // Verify new session exists
    const newSession = await sessionRepository.findById(data.session.id);
    expect(newSession?.isActive).toBe(true);
    expect(newSession?.sessionNumber).toBe(2);
  });

  test("should increment session number correctly for third read", async () => {
    const book = await bookRepository.create(mockBook1);

    // Create two archived sessions (both auto-archived when marked as read)
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
      isActive: false, // Also archived
    });

    const request = createMockRequest("POST", `/api/books/${book.id}/reread`) as NextRequest;
    const response = await POST(request, { params: { id: book.id.toString() } });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.session.sessionNumber).toBe(3);
  });

   test("should set status to 'reading' and startedDate on new session", async () => {
     const book = await bookRepository.create(mockBook1);
     await sessionRepository.create({
       ...mockSessionRead,
       bookId: book.id,
       isActive: false, // Archived
     });

      const request = createMockRequest("POST", `/api/books/${book.id}/reread`) as NextRequest;
      const response = await POST(request, { params: { id: book.id.toString() } });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.session.status).toBe("reading");
      expect(data.session.startedDate).toBeDefined();

      // startedDate is returned as a date string (YYYY-MM-DD format)
      expect(typeof data.session.startedDate).toBe("string");
      
      // Check it's today's date in UTC (test environment is TZ=UTC)
      const today = new Date();
      const todayStr = today.toISOString().split('T')[0]; // Get YYYY-MM-DD
      expect(data.session.startedDate).toBe(todayStr);
    });

  test("should preserve userId from previous session", async () => {
    const book = await bookRepository.create(mockBook1);
    const testUserId = 999999;

    await sessionRepository.create({
      ...mockSessionRead,
      bookId: book.id,
      userId: testUserId,
      isActive: false, // Archived
    });

    const request = createMockRequest("POST", `/api/books/${book.id}/reread`) as NextRequest;
    const response = await POST(request, { params: { id: book.id.toString() } });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.session.userId).toBe(testUserId);
  });

  test("should not copy review to new session", async () => {
    const book = await bookRepository.create(mockBook1);

    await sessionRepository.create({
      ...mockSessionRead,
      bookId: book.id,
      review: "Great book!",
      isActive: false, // Archived
    });

    const request = createMockRequest("POST", `/api/books/${book.id}/reread`) as NextRequest;
    const response = await POST(request, { params: { id: book.id.toString() } });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.session.review).toBeNull();
  });

  test("should rebuild streak after creating new session", async () => {
    const book = await bookRepository.create(mockBook1);
    const session = await sessionRepository.create({
      ...mockSessionRead,
      bookId: book.id,
      isActive: false, // Archived
    });

    // Create some progress logs to affect streak
    await progressRepository.create({
      ...mockProgressLog1,
      bookId: book.id,
      sessionId: session.id,
      progressDate: "2025-11-17",
    });

    const request = createMockRequest("POST", `/api/books/${book.id}/reread`) as NextRequest;
    const response = await POST(request, { params: { id: book.id.toString() } });

    expect(response.status).toBe(200);

    // Note: Streak rebuilding verification would require streak repository access
    // This test verifies the endpoint succeeds, which includes calling rebuildStreak
  });

  // ============================================================================
  // ERROR CASES
  // ============================================================================

  test("should return 400 if no completed reads exist", async () => {
    const fakeId = 999999;
    const request = createMockRequest("POST", `/api/books/${fakeId}/reread`) as NextRequest;
    const response = await POST(request, { params: { id: fakeId.toString() } });
    const data = await response.json();

    // Service layer returns 400 for no completed reads (doesn't check if book exists first)
    expect(response.status).toBe(400);
    expect(data.error).toContain("no completed reads found");
  });

  test("should return 400 if no sessions exist", async () => {
    const book = await bookRepository.create(mockBook1);

    const request = createMockRequest("POST", `/api/books/${book.id}/reread`) as NextRequest;
    const response = await POST(request, { params: { id: book.id.toString() } });
    const data = await response.json();

    // Service layer checks for completed reads, returns 400 if none found
    expect(response.status).toBe(400);
    expect(data.error).toContain("no completed reads found");
  });

  test("should return 400 if no completed reads (only active session)", async () => {
    const book = await bookRepository.create(mockBook1);

    await sessionRepository.create({
      ...mockSessionReading,
      bookId: book.id,
      status: "reading",
      isActive: true, // Still actively reading, not completed
    });

    const request = createMockRequest("POST", `/api/books/${book.id}/reread`) as NextRequest;
    const response = await POST(request, { params: { id: book.id.toString() } });
    const data = await response.json();

    // Service layer checks for completed reads (read status), returns 400 if none found
    expect(response.status).toBe(400);
    expect(data.error).toContain("no completed reads found");
  });

  test("should return 400 if active session is 'to-read' status", async () => {
    const book = await bookRepository.create(mockBook1);

    await sessionRepository.create({
      ...mockSessionReading,
      bookId: book.id,
      status: "to-read",
      isActive: true,
    });

    const request = createMockRequest("POST", `/api/books/${book.id}/reread`) as NextRequest;
    const response = await POST(request, { params: { id: book.id.toString() } });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain("Can only re-read");
  });

  test("should return 400 if active session is 'read-next' status", async () => {
    const book = await bookRepository.create(mockBook1);

    await sessionRepository.create({
      ...mockSessionReading,
      bookId: book.id,
      status: "read-next",
      isActive: true,
    });

    const request = createMockRequest("POST", `/api/books/${book.id}/reread`) as NextRequest;
    const response = await POST(request, { params: { id: book.id.toString() } });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain("Can only re-read");
  });

  test("should return 400 with invalid book ID format", async () => {
    const request = createMockRequest("POST", "/api/books/invalid-id/reread") as NextRequest;
    const response = await POST(request, { params: { id: "invalid-id" } });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBeDefined();
  });

  // ============================================================================
  // EDGE CASES
  // ============================================================================

  test("should handle multiple archived sessions correctly", async () => {
    const book = await bookRepository.create(mockBook1);

    // Create 5 archived sessions (all marked as read)
    for (let i = 1; i <= 5; i++) {
      await sessionRepository.create({
        ...mockSessionRead,
        bookId: book.id,
        sessionNumber: i,
        isActive: false, // All archived
      });
    }

    const request = createMockRequest("POST", `/api/books/${book.id}/reread`) as NextRequest;
    const response = await POST(request, { params: { id: book.id.toString() } });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.session.sessionNumber).toBe(6);

    // Verify all old sessions are archived
    const activeSessions = await sessionRepository.findAllByBookId(book.id);
    const activeSessionsFiltered = activeSessions.filter(s => s.isActive);
    expect(activeSessionsFiltered.length).toBe(1);
    expect(activeSessionsFiltered[0].sessionNumber).toBe(6);
  });

  test("should handle session with progress logs", async () => {
    const book = await bookRepository.create(mockBook1);
    const session = await sessionRepository.create({
      ...mockSessionRead,
      bookId: book.id,
      isActive: false, // Archived
    });

    // Add progress logs to the session
    await progressRepository.create({
      ...mockProgressLog1,
      bookId: book.id,
      sessionId: session.id,
    });
    await progressRepository.create({
      ...mockProgressLog2,
      bookId: book.id,
      sessionId: session.id,
    });

    const request = createMockRequest("POST", `/api/books/${book.id}/reread`) as NextRequest;
    const response = await POST(request, { params: { id: book.id.toString() } });
    const data = await response.json();

    expect(response.status).toBe(200);

    // Progress logs should still be linked to old session
    const progressLogs = await progressRepository.findBySessionId(session.id);
    expect(progressLogs.length).toBe(2);
  });

  test("should maintain referential integrity after re-read", async () => {
    const book = await bookRepository.create(mockBook1);
    const session = await sessionRepository.create({
      ...mockSessionRead,
      bookId: book.id,
      isActive: false, // Archived
    });

    const request = createMockRequest("POST", `/api/books/${book.id}/reread`) as NextRequest;
    const response = await POST(request, { params: { id: book.id.toString() } });
    const data = await response.json();

    expect(response.status).toBe(200);

    // Verify only one active session
    const activeSessions = await sessionRepository.findAllByBookId(book.id);
    const activeSessionsFiltered = activeSessions.filter(s => s.isActive);
    expect(activeSessionsFiltered.length).toBe(1);

    // Verify total session count
    const allSessions = await sessionRepository.findAllByBookId(book.id);
    expect(allSessions.length).toBe(2);

    // Verify book still exists
    const bookExists = await bookRepository.findById(book.id);
    expect(bookExists).toBeDefined();
  });

  test("should handle concurrent re-read attempts gracefully", async () => {
    const book = await bookRepository.create(mockBook1);
    await sessionRepository.create({
      ...mockSessionRead,
      bookId: book.id,
      isActive: false, // Archived
    });

    // Make two concurrent requests to test race condition protection
    // Expected: One succeeds, one fails with duplicate key error (E11000)
    // This error is EXPECTED and proves database constraint is working
    const request1 = createMockRequest("POST", `/api/books/${book.id}/reread`) as NextRequest;
    const request2 = createMockRequest("POST", `/api/books/${book.id}/reread`) as NextRequest;

    const [response1, response2] = await Promise.all([
      POST(request1, { params: { id: book.id.toString() } }),
      POST(request2, { params: { id: book.id.toString() } }),
    ]);

    // One should succeed, one should fail (race condition)
    const results = [response1.status, response2.status];

    // At least one should succeed
    expect(results).toContain(200);
    // One should fail with either 400 (active session check) or 500 (duplicate key error from race condition)
    const hasError = results.includes(400) || results.includes(500);
    expect(hasError).toBe(true);

    // Verify we don't have duplicate active sessions (database constraints protect us)
    const activeSessions = await sessionRepository.findAllByBookId(book.id);
    const activeSessionsFiltered = activeSessions.filter(s => s.isActive);
    expect(activeSessionsFiltered.length).toBe(1);
  });
});
