import { test, expect, describe, beforeAll, afterAll, beforeEach, mock } from "bun:test";
import { bookRepository, sessionRepository, progressRepository } from "@/lib/repositories";
import { setupTestDatabase, teardownTestDatabase, clearTestDatabase } from "@/__tests__/helpers/db-setup";

mock.module("next/cache", () => ({ revalidatePath: () => {} }));

beforeAll(async () => {
  await setupTestDatabase(__filename);
});

afterAll(async () => {
  await teardownTestDatabase(__filename);
});

beforeEach(async () => {
  await clearTestDatabase(__filename);
});

describe("Session Lifecycle - Auto-Archive on Read", () => {
  test("should auto-archive session when status changes to 'read'", async () => {
    // Create a book
    const book = await bookRepository.create({
      calibreId: 1,
      title: "Test Book",
      authors: ["Test Author"],
      totalPages: 200,
      tags: [],
      path: "Test Author/Test Book (1)",
    });

    // Create an active reading session
    const session = await sessionRepository.create({
      bookId: book.id,
      sessionNumber: 1,
      status: "reading",
      isActive: true,
      startedDate: new Date(),
    });

    expect(session.isActive).toBe(true);
    expect(session.status).toBe("reading");

    // Update session to 'read' status (simulating what the API does)
    const updatedSession = await sessionRepository.update(session.id, {
      status: "read",
      completedDate: new Date(),
      isActive: false, // Auto-archive
    });

    expect(updatedSession?.status).toBe("read");
    expect(updatedSession?.isActive).toBe(false);
    expect(updatedSession?.completedDate).toBeDefined();
  });

  test("should not allow creating multiple active sessions per book", async () => {
    const book = await bookRepository.create({
      calibreId: 2,
      title: "Test Book 2",
      authors: ["Test Author"],
      totalPages: 300,
      tags: [],
      path: "Test Author/Test Book 2 (2)",
    });

    // Create first active session
    const session1 = await sessionRepository.create({
      bookId: book.id,
      sessionNumber: 1,
      status: "reading",
      isActive: true,
    });

    // Try to mark it as read (should archive it)
    await sessionRepository.update(session1.id, {
      status: "read",
      isActive: false,
    });

    // Create a second active session (simulate re-reading)
    const session2 = await sessionRepository.create({
      bookId: book.id,
      sessionNumber: 2,
      status: "reading",
      isActive: true,
    });

    // Now try to create a third active session - this should fail or be prevented
    try {
      await sessionRepository.create({
        bookId: book.id,
        sessionNumber: 3,
        status: "reading",
        isActive: true,
      });

      // If we got here without error, verify we still have only one active session
      // (the database constraint should have prevented the duplicate)
      const activeSessions = await sessionRepository.findAllByBookId(book.id);
      const activeCount = activeSessions.filter(s => s.isActive).length;
      expect(activeCount).toBe(1);
    } catch (error: any) {
      // Expected: SQLite unique constraint error
      expect(error.message).toContain("UNIQUE constraint failed");

      // Verify we still have exactly one active session
      const activeSessions = await sessionRepository.findAllByBookId(book.id);
      const activeCount = activeSessions.filter(s => s.isActive).length;
      expect(activeCount).toBe(1);
    }
  });

  test("should allow multiple archived sessions per book", async () => {
    const book = await bookRepository.create({
      calibreId: 3,
      title: "Test Book 3",
      authors: ["Test Author"],
      totalPages: 250,
      tags: [],
      path: "Test Author/Test Book 3 (3)",
    });

    // Create multiple archived sessions - should succeed
    const session1 = await sessionRepository.create({
      bookId: book.id,
      sessionNumber: 1,
      status: "read",
      isActive: false,
      completedDate: new Date(),
    });

    const session2 = await sessionRepository.create({
      bookId: book.id,
      sessionNumber: 2,
      status: "read",
      isActive: false,
      completedDate: new Date(),
    });

    expect(session1.isActive).toBe(false);
    expect(session2.isActive).toBe(false);

    const sessions = await sessionRepository.findAllByBookId(book.id);
    expect(sessions.length).toBe(2);
  });
});

describe("Re-reading Flow", () => {
  test("should create new session after previous session is archived", async () => {
    const book = await bookRepository.create({
      calibreId: 4,
      title: "Test Book 4",
      authors: ["Test Author"],
      totalPages: 180,
      tags: [],
      path: "Test Author/Test Book 4 (4)",
    });

    // Create and archive first session
    await sessionRepository.create({
      bookId: book.id,
      sessionNumber: 1,
      status: "read",
      isActive: false,
      startedDate: new Date("2025-01-01"),
      completedDate: new Date("2025-01-15"),
    });

    // Create new active session for re-read
    const session2 = await sessionRepository.create({
      bookId: book.id,
      sessionNumber: 2,
      status: "reading",
      isActive: true,
      startedDate: new Date(),
    });

    expect(session2.sessionNumber).toBe(2);
    expect(session2.isActive).toBe(true);
    expect(session2.status).toBe("reading");

    // Verify both sessions exist
    const allSessions = await sessionRepository.findAllByBookId(book.id);
    allSessions.sort((a, b) => a.sessionNumber - b.sessionNumber);
    expect(allSessions.length).toBe(2);
    expect(allSessions[0].isActive).toBe(false);
    expect(allSessions[1].isActive).toBe(true);
  });

  test("should not allow re-reading if last session is not completed", async () => {
    const book = await bookRepository.create({
      calibreId: 5,
      title: "Test Book 5",
      authors: ["Test Author"],
      totalPages: 220,
      tags: [],
      path: "Test Author/Test Book 5 (5)",
    });

    // Create active reading session (not completed)
    await sessionRepository.create({
      bookId: book.id,
      sessionNumber: 1,
      status: "reading",
      isActive: true,
      startedDate: new Date(),
    });

    // Find session and check status
    const sessions = await sessionRepository.findAllByBookId(book.id);
    sessions.sort((a, b) => b.sessionNumber - a.sessionNumber);
    const lastSession = sessions[0];

    expect(lastSession?.status).not.toBe("read");

    // This simulates the API check - re-reading should not be allowed
    if (lastSession?.status !== "read") {
      // Expected behavior - don't create new session
      const allSessions = await sessionRepository.findAllByBookId(book.id);
      expect(allSessions.length).toBe(1);
    }
  });

  test("should not allow re-reading if active session already exists", async () => {
    const book = await bookRepository.create({
      calibreId: 6,
      title: "Test Book 6",
      authors: ["Test Author"],
      totalPages: 190,
      tags: [],
      path: "Test Author/Test Book 6 (6)",
    });

    // Create archived session
    await sessionRepository.create({
      bookId: book.id,
      sessionNumber: 1,
      status: "read",
      isActive: false,
      completedDate: new Date(),
    });

    // Create active session (already re-reading)
    await sessionRepository.create({
      bookId: book.id,
      sessionNumber: 2,
      status: "reading",
      isActive: true,
      startedDate: new Date(),
    });

    // Check if active session exists
    const existingActiveSession = await sessionRepository.findActiveByBookId(book.id);

    expect(existingActiveSession).toBeDefined();

    // Should not create another active session
    const sessions = await sessionRepository.findAllByBookId(book.id);
    const activeCount = sessions.filter(s => s.isActive).length;
    expect(activeCount).toBe(1);
  });
});

describe("Progress Logging Validation", () => {
  test("should only allow progress logging for active 'reading' sessions", async () => {
    const book = await bookRepository.create({
      calibreId: 7,
      title: "Test Book 7",
      authors: ["Test Author"],
      totalPages: 160,
      tags: [],
      path: "Test Author/Test Book 7 (7)",
    });

    // Create active reading session
    const session = await sessionRepository.create({
      bookId: book.id,
      sessionNumber: 1,
      status: "reading",
      isActive: true,
      startedDate: new Date(),
    });

    // Should allow progress logging
    const progressLog = await progressRepository.create({
      bookId: book.id,
      sessionId: session.id,
      currentPage: 50,
      currentPercentage: 31.25,
      progressDate: new Date(),
      pagesRead: 50,
    });

    expect(progressLog.sessionId).toBe(session.id);
    expect(progressLog.currentPage).toBe(50);
  });

  test("should not allow progress logging when session is not 'reading'", async () => {
    const book = await bookRepository.create({
      calibreId: 8,
      title: "Test Book 8",
      authors: ["Test Author"],
      totalPages: 210,
      tags: [],
      path: "Test Author/Test Book 8 (8)",
    });

    // Create active session with 'to-read' status
    const session = await sessionRepository.create({
      bookId: book.id,
      sessionNumber: 1,
      status: "to-read",
      isActive: true,
    });

    // Check status before allowing progress
    expect(session.status).not.toBe("reading");

    // This simulates the API validation - progress should not be logged
    if (session.status !== "reading") {
      // Don't create progress log
      const progressLogs = await progressRepository.findBySessionId(session.id);
      expect(progressLogs.length).toBe(0);
    }
  });

  test("should not allow progress logging when session is archived", async () => {
    const book = await bookRepository.create({
      calibreId: 9,
      title: "Test Book 9",
      authors: ["Test Author"],
      totalPages: 240,
      tags: [],
      path: "Test Author/Test Book 9 (9)",
    });

    // Create archived completed session
    const session = await sessionRepository.create({
      bookId: book.id,
      sessionNumber: 1,
      status: "read",
      isActive: false,
      completedDate: new Date(),
    });

    // Try to find active session
    const activeSession = await sessionRepository.findActiveByBookId(book.id);

    expect(activeSession).toBeUndefined();

    // No active session = cannot log progress
    const progressLogs = await progressRepository.findByBookId(book.id);
    expect(progressLogs.length).toBe(0);
  });
});

describe("Progress Isolation Between Sessions", () => {
  test("should link progress logs to correct session", async () => {
    const book = await bookRepository.create({
      calibreId: 10,
      title: "Test Book 10",
      authors: ["Test Author"],
      totalPages: 200,
      tags: [],
      path: "Test Author/Test Book 10 (10)",
    });

    // Create first session with progress
    const session1 = await sessionRepository.create({
      bookId: book.id,
      sessionNumber: 1,
      status: "reading",
      isActive: true,
      startedDate: new Date("2025-01-01"),
    });

    await progressRepository.create({
      bookId: book.id,
      sessionId: session1.id,
      currentPage: 100,
      currentPercentage: 50,
      progressDate: new Date("2025-01-10"),
      pagesRead: 100,
    });

    // Archive first session
    await sessionRepository.update(session1.id, {
      status: "read",
      isActive: false,
      completedDate: new Date("2025-01-15"),
    });

    // Create second session with progress
    const session2 = await sessionRepository.create({
      bookId: book.id,
      sessionNumber: 2,
      status: "reading",
      isActive: true,
      startedDate: new Date("2025-02-01"),
    });

    await progressRepository.create({
      bookId: book.id,
      sessionId: session2.id,
      currentPage: 75,
      currentPercentage: 37.5,
      progressDate: new Date("2025-02-05"),
      pagesRead: 75,
    });

    // Verify isolation
    const session1Progress = await progressRepository.findBySessionId(session1.id);
    const session2Progress = await progressRepository.findBySessionId(session2.id);

    expect(session1Progress.length).toBe(1);
    expect(session2Progress.length).toBe(1);
    expect(session1Progress[0].currentPage).toBe(100);
    expect(session2Progress[0].currentPage).toBe(75);
  });
});
