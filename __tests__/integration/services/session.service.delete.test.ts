import { describe, test, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { setupTestDatabase, clearTestDatabase, teardownTestDatabase, type TestDatabaseInstance } from "@/__tests__/helpers/db-setup";
import { bookRepository, sessionRepository, progressRepository } from "@/lib/repositories";
import { sessionService } from "@/lib/services/session.service";

const TEST_FILE_PATH = __filename;
let testDbInstance: TestDatabaseInstance;

beforeAll(async () => {
  testDbInstance = await setupTestDatabase(TEST_FILE_PATH);
});

beforeEach(async () => {
  await clearTestDatabase(testDbInstance);
});

afterAll(async () => {
  await teardownTestDatabase(testDbInstance);
});

test("deleteSession - should delete archived session without creating new session", async () => {
  // Create book
  const book = await bookRepository.create({
    calibreId: 1,
    title: "Test Book",
    authors: ["Test Author"],
    path: "/test/path",
    totalPages: 300,
  });

  // Create archived session with progress
  const session = await sessionRepository.create({
    bookId: book.id,
    sessionNumber: 1,
    status: "read",
    isActive: false,
    startedDate: "2025-01-01",
    completedDate: "2025-01-15",
  });

  // Add progress logs
  await progressRepository.create({
    bookId: book.id,
    sessionId: session.id,
    currentPage: 100,
    currentPercentage: 33,
    progressDate: "2025-01-05",
    pagesRead: 100,
  });

  await progressRepository.create({
    bookId: book.id,
    sessionId: session.id,
    currentPage: 300,
    currentPercentage: 100,
    progressDate: "2025-01-15",
    pagesRead: 200,
  });

  // Delete session
  const result = await sessionService.deleteSession(book.id, session.id);

  // Verify result
  expect(result.deletedSessionNumber).toBe(1);
  expect(result.wasActive).toBe(false);
  expect(result.newSessionCreated).toBe(false);

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

test("deleteSession - should delete active session and create new to-read session", async () => {
  // Create book
  const book = await bookRepository.create({
    calibreId: 2,
    title: "Active Book",
    authors: ["Test Author"],
    path: "/test/path2",
    totalPages: 400,
  });

  // Create active session with progress
  const session = await sessionRepository.create({
    bookId: book.id,
    sessionNumber: 1,
    status: "reading",
    isActive: true,
    startedDate: "2025-02-01",
  });

  // Add progress log
  await progressRepository.create({
    bookId: book.id,
    sessionId: session.id,
    currentPage: 150,
    currentPercentage: 37.5,
    progressDate: "2025-02-01",
    pagesRead: 150,
  });

  // Delete session
  const result = await sessionService.deleteSession(book.id, session.id);

  // Verify result
  expect(result.deletedSessionNumber).toBe(1);
  expect(result.wasActive).toBe(true);
  expect(result.newSessionCreated).toBe(true);

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

test("deleteSession - should throw error if session not found", async () => {
  const book = await bookRepository.create({
    calibreId: 3,
    title: "Test Book",
    authors: ["Test Author"],
    path: "/test/path3",
  });

  await expect(
    sessionService.deleteSession(book.id, 999)
  ).rejects.toThrow("Session not found");
});

test("deleteSession - should throw error if bookId mismatch", async () => {
  // Create two books
  const book1 = await bookRepository.create({
    calibreId: 4,
    title: "Book 1",
    authors: ["Author 1"],
    path: "/path1",
  });

  const book2 = await bookRepository.create({
    calibreId: 5,
    title: "Book 2",
    authors: ["Author 2"],
    path: "/path2",
  });

  // Create session for book1
  const session = await sessionRepository.create({
    bookId: book1.id,
    sessionNumber: 1,
    status: "to-read",
    isActive: true,
  });

  // Try to delete using book2's ID
  await expect(
    sessionService.deleteSession(book2.id, session.id)
  ).rejects.toThrow("Session does not belong to specified book");
});

test("deleteSession - should handle multiple sessions correctly", async () => {
  // Create book
  const book = await bookRepository.create({
    calibreId: 6,
    title: "Multi-Session Book",
    authors: ["Test Author"],
    path: "/test/path6",
    totalPages: 500,
  });

  // Create multiple sessions
  const session1 = await sessionRepository.create({
    bookId: book.id,
    sessionNumber: 1,
    status: "read",
    isActive: false,
    completedDate: "2024-01-01",
  });

  const session2 = await sessionRepository.create({
    bookId: book.id,
    sessionNumber: 2,
    status: "read",
    isActive: false,
    completedDate: "2024-06-01",
  });

  const session3 = await sessionRepository.create({
    bookId: book.id,
    sessionNumber: 3,
    status: "reading",
    isActive: true,
    startedDate: "2025-01-01",
  });

  // Delete middle session
  await sessionService.deleteSession(book.id, session2.id);

  // Verify session2 is deleted
  const deletedSession = await sessionRepository.findById(session2.id);
  expect(deletedSession).toBeUndefined();

  // Verify other sessions remain
  const remainingSessions = await sessionRepository.findAllByBookId(book.id);
  expect(remainingSessions.length).toBe(2);
  
  const sessionNumbers = remainingSessions.map(s => s.sessionNumber).sort();
  expect(sessionNumbers).toEqual([1, 3]); // Session 2 deleted, 1 and 3 remain
});
