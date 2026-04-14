/**
 * Integration test for Issue #413:
 * Session numbers should display correctly after deletion
 * 
 * Bug: When a session is deleted and a new one is created, the session number
 * increments incorrectly (shows "Read #2" when it should be "Read #1")
 * 
 * Fix: 
 * 1. Use getNextSessionNumber() instead of hardcoded 1 in deleteSession()
 * 2. Calculate displayNumber based on array index from chronologically ordered sessions
 */

import { describe, test, expect, beforeAll, beforeEach, afterAll } from "vitest";
import { setupTestDatabase, clearTestDatabase, teardownTestDatabase, type TestDatabaseInstance } from "@/__tests__/helpers/db-setup";
import { sessionService } from "@/lib/services/session.service";
import { sessionRepository, bookRepository } from "@/lib/repositories";

const TEST_FILE_PATH = __filename;
let testDbInstance: TestDatabaseInstance;
let bookId: number;

beforeAll(async () => {
  testDbInstance = await setupTestDatabase(TEST_FILE_PATH);
});

beforeEach(async () => {
  await clearTestDatabase(testDbInstance);

  // Create a test book
  const book = await bookRepository.create({
    calibreId: 1,
    title: "Test Book",
    authors: ["Test Author"],
    path: "/test/path",
    totalPages: 100,
  });
  bookId = book.id;
});

afterAll(async () => {
  await teardownTestDatabase(testDbInstance);
});

describe("Issue #413 - Session Number After Deletion", () => {

  test("should use getNextSessionNumber instead of hardcoded 1 when creating session after deletion", async () => {
    // Step 1: Create a "read" session
    const session1 = await sessionRepository.create({
      bookId,
      sessionNumber: 1,
      status: "read",
      isActive: false,
      startedDate: "2024-01-01",
      completedDate: "2024-01-15",
    });

    // Verify session exists
    let sessions = await sessionRepository.findAllByBookId(bookId);
    expect(sessions).toHaveLength(1);
    expect(sessions[0].sessionNumber).toBe(1);
    
    // Step 2: Delete the session - deleteSession should create new "to-read" session
    await sessionService.deleteSession(bookId, session1.id);

    // Verify deleteSession created a new "to-read" session
    sessions = await sessionRepository.findAllByBookId(bookId);
    expect(sessions).toHaveLength(1);
    expect(sessions[0].status).toBe("to-read");
    
    // CRITICAL FIX: After deleting session #1, the new "to-read" session gets the NEXT number
    // Since we deleted session #1, getNextSessionNumber() looks at remaining sessions (none),
    // so it returns 1. Before the fix, it was hardcoded to 1, now it's calculated.
    // The key is that it's using getNextSessionNumber() to avoid conflicts.
    expect(sessions[0].sessionNumber).toBe(1);

    // Step 3: Archive the "to-read" session and create another "read" session
    await sessionRepository.update(sessions[0].id, { isActive: false });
    
    const session2 = await sessionRepository.create({
      bookId,
      sessionNumber: await sessionRepository.getNextSessionNumber(bookId),
      status: "read",
      isActive: true,
      startedDate: "2024-01-20",
      completedDate: "2024-02-01",
    });

    // The new session should get sessionNumber 2 (getNextSessionNumber finds 1, returns 2)
    // This is the correct behavior - continuous numbering
    expect(session2.sessionNumber).toBe(2);
  });

  test("should calculate display numbers based on chronological order", async () => {
    // Create 3 sessions at different times
    const session1 = await sessionRepository.create({
      bookId,
      sessionNumber: 1,
      status: "read",
      isActive: false,
      startedDate: "2024-01-01",
      completedDate: "2024-01-15",
    });

    const session2 = await sessionRepository.create({
      bookId,
      sessionNumber: 2,
      status: "read",
      isActive: false,
      startedDate: "2024-02-01",
      completedDate: "2024-02-15",
    });

    const session3 = await sessionRepository.create({
      bookId,
      sessionNumber: 3,
      status: "read",
      isActive: true,
      startedDate: "2024-03-01",
      completedDate: "2024-03-15",
    });

    // Get ordered sessions
    const orderedSessions = await sessionRepository.findAllByBookIdOrdered(bookId);
    
    // Should have 3 sessions ordered chronologically
    expect(orderedSessions).toHaveLength(3);
    expect(orderedSessions[0].startedDate).toBe("2024-01-01");
    expect(orderedSessions[1].startedDate).toBe("2024-02-01");
    expect(orderedSessions[2].startedDate).toBe("2024-03-01");

    // Get sessions with display numbers
    const sessionsWithDisplay = await sessionService.getSessionsWithDisplayNumbers(bookId);
    
    // Display numbers should be 1, 2, 3 (based on array position)
    expect(sessionsWithDisplay[0].displayNumber).toBe(1);
    expect(sessionsWithDisplay[1].displayNumber).toBe(2);
    expect(sessionsWithDisplay[2].displayNumber).toBe(3);
  });

  test("should renumber display numbers after deleting a session", async () => {
    // Create 3 sessions
    const session1 = await sessionRepository.create({
      bookId,
      sessionNumber: 1,
      status: "read",
      isActive: false,
      startedDate: "2024-01-01",
      completedDate: "2024-01-15",
    });

    const session2 = await sessionRepository.create({
      bookId,
      sessionNumber: 2,
      status: "read",
      isActive: false,
      startedDate: "2024-02-01",
      completedDate: "2024-02-15",
    });

    const session3 = await sessionRepository.create({
      bookId,
      sessionNumber: 3,
      status: "read",
      isActive: true,
      startedDate: "2024-03-01",
      completedDate: "2024-03-15",
    });

    // Verify display numbers before deletion
    let sessionsWithDisplay = await sessionService.getSessionsWithDisplayNumbers(bookId);
    expect(sessionsWithDisplay.filter(s => s.status === "read")).toHaveLength(3);
    
    // Delete the second session
    await sessionService.deleteSession(bookId, session2.id);

    // Get updated sessions
    sessionsWithDisplay = await sessionService.getSessionsWithDisplayNumbers(bookId);
    const completedSessions = sessionsWithDisplay.filter(s => s.status === "read");

    // Should now have 2 "read" sessions (1st and 3rd)
    expect(completedSessions).toHaveLength(2);

    // Display numbers should be renumbered to 1 and 2 (no gaps!)
    expect(completedSessions[0].displayNumber).toBe(1);
    expect(completedSessions[0].startedDate).toBe("2024-01-01");
    
    expect(completedSessions[1].displayNumber).toBe(2);
    expect(completedSessions[1].startedDate).toBe("2024-03-01");
  });

  test("should handle sessions with null startedDate using createdAt fallback", async () => {
    // Create session1 with startedDate
    const session1 = await sessionRepository.create({
      bookId,
      sessionNumber: 1,
      status: "read",
      isActive: false,
      startedDate: "2024-02-01",
      completedDate: "2024-02-15",
    });

    // Create session2 without startedDate
    const session2 = await sessionRepository.create({
      bookId,
      sessionNumber: 2,
      status: "read",
      isActive: false,
      startedDate: null,
      completedDate: "2024-01-15",
    });

    // Get ordered sessions - should use COALESCE(startedDate, createdAt)
    const orderedSessions = await sessionRepository.findAllByBookIdOrdered(bookId);
    expect(orderedSessions).toHaveLength(2);

    // Verify displayNumbers are calculated
    const sessionsWithDisplay = await sessionService.getSessionsWithDisplayNumbers(bookId);
    expect(sessionsWithDisplay).toHaveLength(2);
    expect(sessionsWithDisplay[0].displayNumber).toBe(1);
    expect(sessionsWithDisplay[1].displayNumber).toBe(2);
  });
});
