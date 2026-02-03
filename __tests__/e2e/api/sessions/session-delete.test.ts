import { describe, test, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { DELETE } from "@/app/api/books/[id]/sessions/[sessionId]/route";
import { bookRepository, sessionRepository, progressRepository } from "@/lib/repositories";
import { setupTestDatabase, teardownTestDatabase, clearTestDatabase } from "@/__tests__/helpers/db-setup";
import { createMockRequest } from "@/__tests__/fixtures/test-data";
import type { NextRequest } from "next/server";

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
 * Helper to create a test book
 */
async function createTestBook(calibreId: number, title: string) {
  return await bookRepository.create({
    calibreId,
    title,
    authors: ["Test Author"],
    path: `/test/path/${calibreId}`,
    totalPages: 300,
  });
}

/**
 * Helper to create a test session
 */
async function createTestSession(bookId: number, overrides = {}) {
  return await sessionRepository.create({
    bookId,
    sessionNumber: 1,
    status: "to-read",
    isActive: true,
    ...overrides,
  });
}

/**
 * Helper to create a progress log
 */
async function createTestProgress(bookId: number, sessionId: number, overrides = {}) {
  return await progressRepository.create({
    bookId,
    sessionId,
    currentPage: 100,
    currentPercentage: 33,
    progressDate: "2025-01-15",
    pagesRead: 100,
    ...overrides,
  });
}

/**
 * Helper to make DELETE request
 */
function makeDeleteRequest(bookId: number, sessionId: number) {
  const request = createMockRequest("DELETE", `http://localhost:3000/api/books/${bookId}/sessions/${sessionId}`);
  return DELETE(request as NextRequest, {
    params: Promise.resolve({ id: String(bookId), sessionId: String(sessionId) }),
  });
}

// ============================================================================
// TESTS: DELETE /api/books/[id]/sessions/[sessionId]
// ============================================================================

describe("DELETE /api/books/[id]/sessions/[sessionId]", () => {
  describe("Success Cases", () => {
    test("should delete archived session and return metadata", async () => {
      // Create book and archived session
      const book = await createTestBook(1, "Test Book");
      const session = await createTestSession(book.id, {
        sessionNumber: 1,
        status: "read",
        isActive: false,
        startedDate: "2025-01-01",
        completedDate: "2025-01-15",
      });

      // Add progress logs
      await createTestProgress(book.id, session.id, {
        currentPage: 100,
        currentPercentage: 33,
        progressDate: "2025-01-05",
      });
      await createTestProgress(book.id, session.id, {
        currentPage: 300,
        currentPercentage: 100,
        progressDate: "2025-01-15",
      });

      // Delete session
      const response = await makeDeleteRequest(book.id, session.id);
      const data = await response.json();

      // Verify response
      expect(response.status).toBe(200);
      expect(data).toEqual({
        deletedSessionNumber: 1,
        wasActive: false,
        newSessionCreated: false,
      });

      // Verify session is deleted
      const deletedSession = await sessionRepository.findById(session.id);
      expect(deletedSession).toBeUndefined();

      // Verify progress logs are deleted (cascade)
      const progressLogs = await progressRepository.findBySessionId(session.id);
      expect(progressLogs.length).toBe(0);

      // Verify no new session was created
      const allSessions = await sessionRepository.findAllByBookId(book.id);
      expect(allSessions.length).toBe(0);
    });

    test("should delete active session, create new to-read session, and return metadata", async () => {
      // Create book and active session
      const book = await createTestBook(2, "Active Book");
      const session = await createTestSession(book.id, {
        sessionNumber: 1,
        status: "reading",
        isActive: true,
        startedDate: "2025-02-01",
      });

      // Add progress log
      await createTestProgress(book.id, session.id, {
        currentPage: 150,
        currentPercentage: 50,
        progressDate: "2025-02-01",
      });

      // Delete session
      const response = await makeDeleteRequest(book.id, session.id);
      const data = await response.json();

      // Verify response
      expect(response.status).toBe(200);
      expect(data).toEqual({
        deletedSessionNumber: 1,
        wasActive: true,
        newSessionCreated: true,
      });

      // Verify original session is deleted
      const deletedSession = await sessionRepository.findById(session.id);
      expect(deletedSession).toBeUndefined();

      // Verify progress logs are deleted (cascade)
      const progressLogs = await progressRepository.findBySessionId(session.id);
      expect(progressLogs.length).toBe(0);

      // Verify new to-read session was created
      const newSession = await sessionRepository.findActiveByBookId(book.id);
      expect(newSession).toBeDefined();
      expect(newSession!.status).toBe("to-read");
      expect(newSession!.sessionNumber).toBe(1);
      expect(newSession!.isActive).toBe(true);
    });

    test("should preserve other sessions when deleting middle session", async () => {
      // Create book with 3 sessions
      const book = await createTestBook(3, "Multi-Session Book");
      
      const session1 = await createTestSession(book.id, {
        sessionNumber: 1,
        status: "read",
        isActive: false,
        completedDate: "2024-01-01",
      });

      const session2 = await createTestSession(book.id, {
        sessionNumber: 2,
        status: "read",
        isActive: false,
        completedDate: "2024-06-01",
      });

      const session3 = await createTestSession(book.id, {
        sessionNumber: 3,
        status: "reading",
        isActive: true,
        startedDate: "2025-01-01",
      });

      // Delete middle session
      const response = await makeDeleteRequest(book.id, session2.id);
      const data = await response.json();

      // Verify response
      expect(response.status).toBe(200);
      expect(data.deletedSessionNumber).toBe(2);

      // Verify session2 is deleted
      const deletedSession = await sessionRepository.findById(session2.id);
      expect(deletedSession).toBeUndefined();

      // Verify other sessions remain
      const remainingSessions = await sessionRepository.findAllByBookId(book.id);
      expect(remainingSessions.length).toBe(2);

      const sessionNumbers = remainingSessions.map(s => s.sessionNumber).sort();
      expect(sessionNumbers).toEqual([1, 3]); // Session 2 deleted, 1 and 3 remain
    });
  });

  describe("Error Cases", () => {
    test("should return 404 when session not found", async () => {
      const book = await createTestBook(4, "Test Book");

      const response = await makeDeleteRequest(book.id, 999);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toContain("Session not found");
    });

    test("should return 404 when session belongs to different book", async () => {
      // Create two books
      const book1 = await createTestBook(5, "Book 1");
      const book2 = await createTestBook(6, "Book 2");

      // Create session for book1
      const session = await createTestSession(book1.id, {
        sessionNumber: 1,
        status: "to-read",
        isActive: true,
      });

      // Try to delete using book2's ID
      const response = await makeDeleteRequest(book2.id, session.id);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain("Session does not belong to specified book");
    });

    test("should return 400 when bookId is invalid", async () => {
      const response = await makeDeleteRequest(NaN, 1);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain("Invalid book ID or session ID");
    });

    test("should return 400 when sessionId is invalid", async () => {
      const book = await createTestBook(7, "Test Book");
      const response = await makeDeleteRequest(book.id, NaN);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain("Invalid book ID or session ID");
    });
  });

  describe("Cascade Delete", () => {
    test("should cascade delete progress logs when session is deleted", async () => {
      // Create book and session with multiple progress logs
      const book = await createTestBook(8, "Book with Progress");
      const session = await createTestSession(book.id, {
        sessionNumber: 1,
        status: "reading",
        isActive: true,
        startedDate: "2025-01-01",
      });

      // Create 5 progress logs
      for (let i = 1; i <= 5; i++) {
        await createTestProgress(book.id, session.id, {
          currentPage: i * 50,
          currentPercentage: (i * 50 / 300) * 100,
          progressDate: `2025-01-${String(i).padStart(2, '0')}`,
        });
      }

      // Verify progress logs exist
      const progressBeforeDelete = await progressRepository.findBySessionId(session.id);
      expect(progressBeforeDelete.length).toBe(5);

      // Delete session
      const response = await makeDeleteRequest(book.id, session.id);
      expect(response.status).toBe(200);

      // Verify all progress logs are deleted
      const progressAfterDelete = await progressRepository.findBySessionId(session.id);
      expect(progressAfterDelete.length).toBe(0);
    });

    test("should only delete progress logs for the deleted session", async () => {
      // Create book with 2 sessions
      const book = await createTestBook(9, "Book with Multiple Sessions");
      
      const session1 = await createTestSession(book.id, {
        sessionNumber: 1,
        status: "read",
        isActive: false,
        completedDate: "2024-12-31",
      });

      const session2 = await createTestSession(book.id, {
        sessionNumber: 2,
        status: "reading",
        isActive: true,
        startedDate: "2025-01-01",
      });

      // Add progress to both sessions
      await createTestProgress(book.id, session1.id, {
        currentPage: 300,
        currentPercentage: 100,
        progressDate: "2024-12-31",
      });

      await createTestProgress(book.id, session2.id, {
        currentPage: 150,
        currentPercentage: 50,
        progressDate: "2025-01-15",
      });

      // Delete session1
      const response = await makeDeleteRequest(book.id, session1.id);
      expect(response.status).toBe(200);

      // Verify session1 progress is deleted
      const session1Progress = await progressRepository.findBySessionId(session1.id);
      expect(session1Progress.length).toBe(0);

      // Verify session2 progress still exists
      const session2Progress = await progressRepository.findBySessionId(session2.id);
      expect(session2Progress.length).toBe(1);
    });
  });
});
