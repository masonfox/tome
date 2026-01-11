import { toProgressDate, toSessionDate } from '../test-utils';
import { test, expect, describe, beforeAll, afterAll, beforeEach } from 'vitest';
import { progressRepository, bookRepository, sessionRepository } from "@/lib/repositories";
import { setupTestDatabase, teardownTestDatabase, clearTestDatabase } from "@/__tests__/helpers/db-setup";

/**
 * Test suite for ProgressRepository
 * 
 * Focus area: Testing the getEarliestProgressDate() method added for chart trimming
 */

beforeAll(async () => {
  await setupTestDatabase(__filename);
});

afterAll(async () => {
  await teardownTestDatabase(__filename);
});

beforeEach(async () => {
  await clearTestDatabase(__filename);
});

describe("ProgressRepository.getEarliestProgressDate()", () => {
  test("should return null when no progress logs exist", async () => {
    const earliest = await progressRepository.getEarliestProgressDate();
    expect(earliest).toBeNull();
  });

  test("should return earliest date when single progress log exists", async () => {
    // Create book and session
    const book = await bookRepository.create({
      calibreId: 1,
      title: "Test Book",
      authors: ["Author One"],
      totalPages: 300,
      tags: [],
      path: "Author One/Test Book (1)",
    });

    const session = await sessionRepository.create({
      bookId: book.id,
      sessionNumber: 1,
      status: "reading",
      isActive: true,
    });

    // Create single progress log
    const targetDate = new Date("2024-11-27T12:00:00Z");
    await progressRepository.create({
      bookId: book.id,
      sessionId: session.id,
      currentPage: 50,
      currentPercentage: 16.67,
      progressDate: toProgressDate(targetDate),
      pagesRead: 50,
    });

    const earliest = await progressRepository.getEarliestProgressDate();
    expect(earliest).not.toBeNull();
    // progressDate is stored as calendar day (YYYY-MM-DD), so getEarliestProgressDate returns midnight UTC
    const expectedMidnight = new Date("2024-11-27T00:00:00Z");
    expect(earliest?.toISOString()).toBe(expectedMidnight.toISOString());
  });

  test("should return earliest date from multiple progress logs", async () => {
    // Create book and session
    const book = await bookRepository.create({
      calibreId: 2,
      title: "Multiple Progress Book",
      authors: ["Author Two"],
      totalPages: 400,
      tags: [],
      path: "Author Two/Multiple Progress Book (2)",
    });

    const session = await sessionRepository.create({
      bookId: book.id,
      sessionNumber: 1,
      status: "reading",
      isActive: true,
    });

    // Create progress logs in non-chronological order
    const nov29 = new Date("2024-11-29T12:00:00Z");
    const nov27 = new Date("2024-11-27T12:00:00Z"); // Earliest
    const nov28 = new Date("2024-11-28T12:00:00Z");

    await progressRepository.create({
      bookId: book.id,
      sessionId: session.id,
      currentPage: 150,
      currentPercentage: 37.5,
      progressDate: toProgressDate(nov29),
      pagesRead: 50,
    });

    await progressRepository.create({
      bookId: book.id,
      sessionId: session.id,
      currentPage: 50,
      currentPercentage: 12.5,
      progressDate: toProgressDate(nov27),
      pagesRead: 50,
    });

    await progressRepository.create({
      bookId: book.id,
      sessionId: session.id,
      currentPage: 100,
      currentPercentage: 25.0,
      progressDate: toProgressDate(nov28),
      pagesRead: 50,
    });

    const earliest = await progressRepository.getEarliestProgressDate();
    expect(earliest).not.toBeNull();
    // nov27 is stored as calendar day (2024-11-27), so earliest is midnight UTC
    const expectedMidnight = new Date("2024-11-27T00:00:00Z");
    expect(earliest?.toISOString()).toBe(expectedMidnight.toISOString());
  });

  test("should return earliest date across multiple books", async () => {
    // Create two books
    const book1 = await bookRepository.create({
      calibreId: 3,
      title: "Book One",
      authors: ["Author Three"],
      totalPages: 300,
      tags: [],
      path: "Author Three/Book One (3)",
    });

    const book2 = await bookRepository.create({
      calibreId: 4,
      title: "Book Two",
      authors: ["Author Four"],
      totalPages: 400,
      tags: [],
      path: "Author Four/Book Two (4)",
    });

    // Create sessions
    const session1 = await sessionRepository.create({
      bookId: book1.id,
      sessionNumber: 1,
      status: "reading",
      isActive: true,
    });

    const session2 = await sessionRepository.create({
      bookId: book2.id,
      sessionNumber: 1,
      status: "reading",
      isActive: true,
    });

    // Book 1 started Nov 28
    const nov28 = new Date("2024-11-28T12:00:00Z");
    await progressRepository.create({
      bookId: book1.id,
      sessionId: session1.id,
      currentPage: 50,
      currentPercentage: 16.67,
      progressDate: toProgressDate(nov28),
      pagesRead: 50,
    });

    // Book 2 started Nov 25 (earlier)
    const nov25 = new Date("2024-11-25T12:00:00Z");
    await progressRepository.create({
      bookId: book2.id,
      sessionId: session2.id,
      currentPage: 50,
      currentPercentage: 12.5,
      progressDate: toProgressDate(nov25),
      pagesRead: 50,
    });

    const earliest = await progressRepository.getEarliestProgressDate();
    expect(earliest).not.toBeNull();
    // nov25 is stored as calendar day (2024-11-25), so earliest is midnight UTC
    const expectedMidnight = new Date("2024-11-25T00:00:00Z");
    expect(earliest?.toISOString()).toBe(expectedMidnight.toISOString());
  });

  test("should handle progress logs on the same day", async () => {
    // Create book and session
    const book = await bookRepository.create({
      calibreId: 5,
      title: "Same Day Book",
      authors: ["Author Five"],
      totalPages: 300,
      tags: [],
      path: "Author Five/Same Day Book (5)",
    });

    const session = await sessionRepository.create({
      bookId: book.id,
      sessionNumber: 1,
      status: "reading",
      isActive: true,
    });

    // Create multiple progress logs on the same day at different times
    const morning = new Date("2024-11-30T08:00:00Z");
    const afternoon = new Date("2024-11-30T14:00:00Z");
    const evening = new Date("2024-11-30T20:00:00Z");

    await progressRepository.create({
      bookId: book.id,
      sessionId: session.id,
      currentPage: 100,
      currentPercentage: 33.33,
      progressDate: toProgressDate(afternoon),
      pagesRead: 50,
    });

    await progressRepository.create({
      bookId: book.id,
      sessionId: session.id,
      currentPage: 150,
      currentPercentage: 50.0,
      progressDate: toProgressDate(evening),
      pagesRead: 50,
    });

    await progressRepository.create({
      bookId: book.id,
      sessionId: session.id,
      currentPage: 50,
      currentPercentage: 16.67,
      progressDate: toProgressDate(morning),
      pagesRead: 50,
    });

    const earliest = await progressRepository.getEarliestProgressDate();
    expect(earliest).not.toBeNull();
    // All three progress entries are on the same day (2024-11-30), so earliest is midnight UTC
    const expectedMidnight = new Date("2024-11-30T00:00:00Z");
    expect(earliest?.toISOString()).toBe(expectedMidnight.toISOString());
  });

  test("should return earliest across multiple sessions of same book", async () => {
    // Create book
    const book = await bookRepository.create({
      calibreId: 6,
      title: "Re-read Book",
      authors: ["Author Six"],
      totalPages: 350,
      tags: [],
      path: "Author Six/Re-read Book (6)",
    });

    // Create two sessions (first read and re-read)
    const session1 = await sessionRepository.create({
      bookId: book.id,
      sessionNumber: 1,
      status: "read",
      isActive: false,
      completedDate: "2024-10-15",
    });

    const session2 = await sessionRepository.create({
      bookId: book.id,
      sessionNumber: 2,
      status: "reading",
      isActive: true,
    });

    // Session 1 progress (October)
    const oct10 = new Date("2024-10-10T12:00:00Z"); // Earliest
    await progressRepository.create({
      bookId: book.id,
      sessionId: session1.id,
      currentPage: 100,
      currentPercentage: 28.57,
      progressDate: toProgressDate(oct10),
      pagesRead: 100,
    });

    // Session 2 progress (November)
    const nov27 = new Date("2024-11-27T12:00:00Z");
    await progressRepository.create({
      bookId: book.id,
      sessionId: session2.id,
      currentPage: 50,
      currentPercentage: 14.29,
      progressDate: toProgressDate(nov27),
      pagesRead: 50,
    });

    const earliest = await progressRepository.getEarliestProgressDate();
    expect(earliest).not.toBeNull();
    // oct10 is stored as calendar day (2024-10-10), so earliest is midnight UTC
    const expectedMidnight = new Date("2024-10-10T00:00:00Z");
    expect(earliest?.toISOString()).toBe(expectedMidnight.toISOString());
  });
});

describe("ProgressRepository.getHighestCurrentPageForActiveSessions()", () => {
  test("should return 0 when no active sessions exist", async () => {
    const book = await bookRepository.create({
      calibreId: 100,
      title: "Book Without Active Sessions",
      authors: ["Author"],
      totalPages: 300,
      tags: [],
      path: "Author/Book (100)",
    });

    const highest = await progressRepository.getHighestCurrentPageForActiveSessions(book.id);
    expect(highest).toBe(0);
  });

  test("should return 0 when book has no sessions at all", async () => {
    const book = await bookRepository.create({
      calibreId: 101,
      title: "Lonely Book",
      authors: ["Author"],
      totalPages: 300,
      tags: [],
      path: "Author/Book (101)",
    });

    const highest = await progressRepository.getHighestCurrentPageForActiveSessions(book.id);
    expect(highest).toBe(0);
  });

  test("should return highest page from active session with single progress log", async () => {
    const book = await bookRepository.create({
      calibreId: 102,
      title: "Single Progress Book",
      authors: ["Author"],
      totalPages: 400,
      tags: [],
      path: "Author/Book (102)",
    });

    const session = await sessionRepository.create({
      bookId: book.id,
      sessionNumber: 1,
      status: "reading",
      isActive: true,
    });

    await progressRepository.create({
      bookId: book.id,
      sessionId: session.id,
      currentPage: 250,
      currentPercentage: 62,
      pagesRead: 250,
      progressDate: toProgressDate(new Date()),
    });

    const highest = await progressRepository.getHighestCurrentPageForActiveSessions(book.id);
    expect(highest).toBe(250);
  });

  test("should return highest page from multiple progress logs in active session", async () => {
    const book = await bookRepository.create({
      calibreId: 103,
      title: "Multi Progress Book",
      authors: ["Author"],
      totalPages: 500,
      tags: [],
      path: "Author/Book (103)",
    });

    const session = await sessionRepository.create({
      bookId: book.id,
      sessionNumber: 1,
      status: "reading",
      isActive: true,
    });

    // Create progress logs with different page counts
    await progressRepository.create({
      bookId: book.id,
      sessionId: session.id,
      currentPage: 100,
      currentPercentage: 20,
      pagesRead: 100,
      progressDate: "2024-01-01",
    });

    await progressRepository.create({
      bookId: book.id,
      sessionId: session.id,
      currentPage: 350, // Highest
      currentPercentage: 70,
      pagesRead: 250,
      progressDate: "2024-01-03",
    });

    await progressRepository.create({
      bookId: book.id,
      sessionId: session.id,
      currentPage: 200,
      currentPercentage: 40,
      pagesRead: 100,
      progressDate: "2024-01-02",
    });

    const highest = await progressRepository.getHighestCurrentPageForActiveSessions(book.id);
    expect(highest).toBe(350);
  });

  test("should ignore completed sessions when finding highest page", async () => {
    const book = await bookRepository.create({
      calibreId: 104,
      title: "Book With Completed Session",
      authors: ["Author"],
      totalPages: 400,
      tags: [],
      path: "Author/Book (104)",
    });

    // Create completed session with high page count
    const completedSession = await sessionRepository.create({
      bookId: book.id,
      sessionNumber: 1,
      status: "read",
      isActive: false,
      completedDate: "2024-01-01",
    });

    await progressRepository.create({
      bookId: book.id,
      sessionId: completedSession.id,
      currentPage: 400, // Should be ignored
      currentPercentage: 100,
      pagesRead: 400,
      progressDate: toProgressDate(new Date()),
    });

    // Create active session with lower page count
    const activeSession = await sessionRepository.create({
      bookId: book.id,
      sessionNumber: 2,
      status: "reading",
      isActive: true,
    });

    await progressRepository.create({
      bookId: book.id,
      sessionId: activeSession.id,
      currentPage: 150, // Should be returned
      currentPercentage: 37,
      pagesRead: 150,
      progressDate: toProgressDate(new Date()),
    });

    const highest = await progressRepository.getHighestCurrentPageForActiveSessions(book.id);
    expect(highest).toBe(150); // Not 400 from completed session
  });

  test("should ignore non-reading status sessions (paused/abandoned)", async () => {
    const book = await bookRepository.create({
      calibreId: 105,
      title: "Book With Paused Session",
      authors: ["Author"],
      totalPages: 400,
      tags: [],
      path: "Author/Book (105)",
    });

    // Create session that's active but not in 'reading' status
    const pausedSession = await sessionRepository.create({
      bookId: book.id,
      sessionNumber: 1,
      status: "to-read", // Not 'reading'
      isActive: true, // But still marked active
    });

    await progressRepository.create({
      bookId: book.id,
      sessionId: pausedSession.id,
      currentPage: 300, // Should be ignored
      currentPercentage: 75,
      pagesRead: 300,
      progressDate: toProgressDate(new Date()),
    });

    const highest = await progressRepository.getHighestCurrentPageForActiveSessions(book.id);
    expect(highest).toBe(0); // Paused session should be ignored
  });

  test("should handle books with only non-active reading sessions", async () => {
    const book = await bookRepository.create({
      calibreId: 106,
      title: "Abandoned Book",
      authors: ["Author"],
      totalPages: 300,
      tags: [],
      path: "Author/Book (106)",
    });

    // Create session that's reading but not active (abandoned)
    const abandonedSession = await sessionRepository.create({
      bookId: book.id,
      sessionNumber: 1,
      status: "reading", // Status is reading
      isActive: false, // But not active
    });

    await progressRepository.create({
      bookId: book.id,
      sessionId: abandonedSession.id,
      currentPage: 200,
      currentPercentage: 66,
      pagesRead: 200,
      progressDate: toProgressDate(new Date()),
    });

    const highest = await progressRepository.getHighestCurrentPageForActiveSessions(book.id);
    expect(highest).toBe(0); // Abandoned session should be ignored
  });

  test("should handle NULL currentPage values gracefully", async () => {
    const book = await bookRepository.create({
      calibreId: 107,
      title: "Book With Null Pages",
      authors: ["Author"],
      totalPages: 300,
      tags: [],
      path: "Author/Book (107)",
    });

    const session = await sessionRepository.create({
      bookId: book.id,
      sessionNumber: 1,
      status: "reading",
      isActive: true,
    });

    // Create progress with explicit 0 page (valid)
    await progressRepository.create({
      bookId: book.id,
      sessionId: session.id,
      currentPage: 0,
      currentPercentage: 0,
      pagesRead: 0,
      progressDate: toProgressDate(new Date()),
    });

    await progressRepository.create({
      bookId: book.id,
      sessionId: session.id,
      currentPage: 50,
      currentPercentage: 16,
      pagesRead: 50,
      progressDate: toProgressDate(new Date()),
    });

    const highest = await progressRepository.getHighestCurrentPageForActiveSessions(book.id);
    expect(highest).toBe(50); // Should handle 0 correctly
  });

  test("should find highest page even when logs are out of chronological order", async () => {
    const book = await bookRepository.create({
      calibreId: 108,
      title: "Book With Varied Progress",
      authors: ["Author"],
      totalPages: 500,
      tags: [],
      path: "Author/Book (108)",
    });

    // Create single active session with multiple progress logs
    const session = await sessionRepository.create({
      bookId: book.id,
      sessionNumber: 1,
      status: "reading",
      isActive: true,
    });

    // Create progress logs where highest isn't the most recent
    await progressRepository.create({
      bookId: book.id,
      sessionId: session.id,
      currentPage: 350, // Highest - created first
      currentPercentage: 70,
      pagesRead: 350,
      progressDate: "2024-01-03",
    });

    await progressRepository.create({
      bookId: book.id,
      sessionId: session.id,
      currentPage: 200, // Lower page - created later
      currentPercentage: 40,
      pagesRead: 200,
      progressDate: "2024-01-04",
    });

    const highest = await progressRepository.getHighestCurrentPageForActiveSessions(book.id);
    expect(highest).toBe(350); // Should return the maximum currentPage, not the most recent
  });

  test("should return 0 for non-existent book", async () => {
    const highest = await progressRepository.getHighestCurrentPageForActiveSessions(99999);
    expect(highest).toBe(0);
  });

  test("should only check progress for the specified book", async () => {
    // Create two books
    const book1 = await bookRepository.create({
      calibreId: 109,
      title: "Book One",
      authors: ["Author"],
      totalPages: 300,
      tags: [],
      path: "Author/Book One (109)",
    });

    const book2 = await bookRepository.create({
      calibreId: 110,
      title: "Book Two",
      authors: ["Author"],
      totalPages: 400,
      tags: [],
      path: "Author/Book Two (110)",
    });

    // Create active session for book1
    const session1 = await sessionRepository.create({
      bookId: book1.id,
      sessionNumber: 1,
      status: "reading",
      isActive: true,
    });

    await progressRepository.create({
      bookId: book1.id,
      sessionId: session1.id,
      currentPage: 150,
      currentPercentage: 50,
      pagesRead: 150,
      progressDate: toProgressDate(new Date()),
    });

    // Create active session for book2 with higher page count
    const session2 = await sessionRepository.create({
      bookId: book2.id,
      sessionNumber: 1,
      status: "reading",
      isActive: true,
    });

    await progressRepository.create({
      bookId: book2.id,
      sessionId: session2.id,
      currentPage: 350,
      currentPercentage: 87,
      pagesRead: 350,
      progressDate: toProgressDate(new Date()),
    });

    // Query for book1 should only return book1's progress
    const highest1 = await progressRepository.getHighestCurrentPageForActiveSessions(book1.id);
    expect(highest1).toBe(150);

    // Query for book2 should only return book2's progress
    const highest2 = await progressRepository.getHighestCurrentPageForActiveSessions(book2.id);
    expect(highest2).toBe(350);
  });
});

describe("ProgressRepository.recalculatePercentagesForBook()", () => {
  test("should return 0 when no active sessions exist", async () => {
    // Create book with no sessions
    const book = await bookRepository.create({
      calibreId: 1,
      title: "Test Book",
      authors: ["Author"],
      path: "/test/path",
      totalPages: 300,
    });

    // Recalculate with new page count
    const updated = await progressRepository.recalculatePercentagesForBook(book.id, 400);

    expect(updated).toBe(0);
  });

  test("should recalculate percentages for active reading sessions", async () => {
    // Create book with original totalPages
    const book = await bookRepository.create({
      calibreId: 1,
      title: "Test Book",
      authors: ["Author"],
      path: "/test/path",
      totalPages: 300,
    });

    // Create active reading session
    const session = await sessionRepository.create({
      bookId: book.id,
      sessionNumber: 1,
      status: "reading",
      isActive: true,
    });

    // Create progress logs with percentages based on 300 pages
    await progressRepository.create({
      bookId: book.id,
      sessionId: session.id,
      currentPage: 150,
      currentPercentage: 50, // 150/300 = 50%
      pagesRead: 150,
      progressDate: toProgressDate(new Date("2025-01-01")),
    });

    await progressRepository.create({
      bookId: book.id,
      sessionId: session.id,
      currentPage: 225,
      currentPercentage: 75, // 225/300 = 75%
      pagesRead: 75,
      progressDate: toProgressDate(new Date("2025-01-02")),
    });

    // Recalculate with new page count (400 pages)
    const updated = await progressRepository.recalculatePercentagesForBook(book.id, 400);

    expect(updated).toBe(2); // 2 logs updated

    // Verify percentages were recalculated
    const logs = await progressRepository.findBySessionId(session.id);
    expect(logs).toHaveLength(2);
    
    const log1 = logs.find(l => l.currentPage === 150);
    const log2 = logs.find(l => l.currentPage === 225);
    
    expect(log1?.currentPercentage).toBe(37); // floor(150/400 * 100) = 37
    expect(log2?.currentPercentage).toBe(56); // floor(225/400 * 100) = 56
  });

  test("should not recalculate percentages for completed sessions", async () => {
    // Create book
    const book = await bookRepository.create({
      calibreId: 1,
      title: "Test Book",
      authors: ["Author"],
      path: "/test/path",
      totalPages: 300,
    });

    // Create completed (inactive) session
    const completedSession = await sessionRepository.create({
      bookId: book.id,
      sessionNumber: 1,
      status: "read",
      isActive: false,
    });

    // Create progress log for completed session
    await progressRepository.create({
      bookId: book.id,
      sessionId: completedSession.id,
      currentPage: 300,
      currentPercentage: 100,
      pagesRead: 300,
      progressDate: toProgressDate(new Date("2025-01-01")),
    });

    // Recalculate - should skip completed session
    const updated = await progressRepository.recalculatePercentagesForBook(book.id, 400);

    expect(updated).toBe(0); // No logs updated

    // Verify percentage unchanged
    const logs = await progressRepository.findBySessionId(completedSession.id);
    expect(logs[0].currentPercentage).toBe(100); // Still 100%
  });

  test("should only recalculate for specified book", async () => {
    // Create two books
    const book1 = await bookRepository.create({
      calibreId: 1,
      title: "Book 1",
      authors: ["Author"],
      path: "/test/path1",
      totalPages: 300,
    });

    const book2 = await bookRepository.create({
      calibreId: 2,
      title: "Book 2",
      authors: ["Author"],
      path: "/test/path2",
      totalPages: 300,
    });

    // Create active sessions for both
    const session1 = await sessionRepository.create({
      bookId: book1.id,
      sessionNumber: 1,
      status: "reading",
      isActive: true,
    });

    const session2 = await sessionRepository.create({
      bookId: book2.id,
      sessionNumber: 1,
      status: "reading",
      isActive: true,
    });

    // Create progress for both
    await progressRepository.create({
      bookId: book1.id,
      sessionId: session1.id,
      currentPage: 150,
      currentPercentage: 50,
      pagesRead: 150,
      progressDate: toProgressDate(new Date("2025-01-01")),
    });

    await progressRepository.create({
      bookId: book2.id,
      sessionId: session2.id,
      currentPage: 150,
      currentPercentage: 50,
      pagesRead: 150,
      progressDate: toProgressDate(new Date("2025-01-01")),
    });

    // Recalculate only for book1
    const updated = await progressRepository.recalculatePercentagesForBook(book1.id, 600);

    expect(updated).toBe(1); // Only 1 log updated (book1's)

    // Verify book1's percentage changed but book2's didn't
    const logs1 = await progressRepository.findBySessionId(session1.id);
    const logs2 = await progressRepository.findBySessionId(session2.id);

    expect(logs1[0].currentPercentage).toBe(25); // floor(150/600 * 100) = 25
    expect(logs2[0].currentPercentage).toBe(50); // Unchanged
  });
});
