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

  test("should assign next session number correctly when other sessions exist after deletion", async () => {
    // Create multiple sessions
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

    // Verify both exist
    let sessions = await sessionRepository.findAllByBookId(bookId);
    expect(sessions).toHaveLength(2);

    // Delete session #1
    await sessionService.deleteSession(bookId, session1.id);

    // Verify to-read session was created with sessionNumber=3 (not 1!)
    // This proves getNextSessionNumber() is being used, not hardcoded 1
    sessions = await sessionRepository.findAllByBookId(bookId);
    const toReadSession = sessions.find(s => s.status === "to-read");
    expect(toReadSession).toBeDefined();
    expect(toReadSession!.sessionNumber).toBe(3); // CRITICAL: Must be 3, not 1

    // Should still have session2 with sessionNumber=2
    const readSession = sessions.find(s => s.sessionNumber === 2);
    expect(readSession).toBeDefined();
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

    // Verify displayNumbers are calculated AND ordering is correct
    // Session2 (null startedDate) was created second, so createdAt is later
    // Therefore session1 should be first chronologically
    const sessionsWithDisplay = await sessionService.getSessionsWithDisplayNumbers(bookId);
    expect(sessionsWithDisplay).toHaveLength(2);
    expect(sessionsWithDisplay[0].sessionNumber).toBe(1); // session1 comes first
    expect(sessionsWithDisplay[0].displayNumber).toBe(1);
    expect(sessionsWithDisplay[1].sessionNumber).toBe(2); // session2 comes second
    expect(sessionsWithDisplay[1].displayNumber).toBe(2);
  });

  test("should only assign displayNumber to sessions that match display filter", async () => {
    // Create an archived "to-read" session without startedDate (will use createdAt ~ today)
    const toReadSession = await sessionRepository.create({
      bookId,
      sessionNumber: 1,
      status: "to-read",
      isActive: false, // Archived immediately
    });
    
    // Create an archived "reading" session with startedDate in 2024
    const readingSession = await sessionRepository.create({
      bookId,
      sessionNumber: 2,
      status: "reading",
      isActive: false, // Archived immediately
      startedDate: "2024-02-01",
    });
    
    // Create a completed "read" session
    const readSession1 = await sessionRepository.create({
      bookId,
      sessionNumber: 3,
      status: "read",
      isActive: false,
      startedDate: "2024-03-01",
      completedDate: "2024-03-15",
    });

    // Create a "dnf" session
    const dnfSession = await sessionRepository.create({
      bookId,
      sessionNumber: 4,
      status: "dnf",
      isActive: false,
      startedDate: "2024-04-01",
      completedDate: "2024-04-10",
    });

    // Create another completed "read" session that's active
    const readSession2 = await sessionRepository.create({
      bookId,
      sessionNumber: 5,
      status: "read",
      isActive: true,
      startedDate: "2024-05-01",
      completedDate: "2024-05-15",
    });

    // Get sessions with display numbers
    const sessionsWithDisplay = await sessionService.getSessionsWithDisplayNumbers(bookId);
    
    // Should have 5 total sessions
    expect(sessionsWithDisplay).toHaveLength(5);

    // Find each session by sessionNumber
    const toRead = sessionsWithDisplay.find(s => s.sessionNumber === 1);
    const reading = sessionsWithDisplay.find(s => s.sessionNumber === 2);
    const read1 = sessionsWithDisplay.find(s => s.sessionNumber === 3);
    const dnf = sessionsWithDisplay.find(s => s.sessionNumber === 4);
    const read2 = sessionsWithDisplay.find(s => s.sessionNumber === 5);

    // Expected chronological order based on startedDate (or createdAt fallback):
    // 1. reading: 2024-02-01
    // 2. read1: 2024-03-01  
    // 3. dnf: 2024-04-01
    // 4. read2: 2024-05-01
    // 5. toRead: ~2026-04-14 (createdAt converted to YYYY-MM-DD, created today)
    
    // All sessions match the display filter (!isActive || status=='read' || status=='dnf')
    expect(reading?.displayNumber).toBe(1);
    expect(read1?.displayNumber).toBe(2);
    expect(dnf?.displayNumber).toBe(3);
    expect(read2?.displayNumber).toBe(4);
    expect(toRead?.displayNumber).toBe(5);
  });
});
