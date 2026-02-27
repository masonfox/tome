/**
 * Session Repository Edge Cases and Coverage Tests
 * 
 * This test suite focuses on edge cases and uncovered paths in session.repository.ts:
 * - findAllByBookIdWithProgress aggregation logic
 * - Orphaned book filtering
 * - Transaction handling
 * - Count operations
 * - Edge cases with null/empty data
 */

import { describe, test, expect, beforeAll, beforeEach, afterAll } from "vitest";
import { sessionRepository, bookRepository, progressRepository } from "@/lib/repositories";
import {
  setupTestDatabase,
  clearTestDatabase,
  teardownTestDatabase,
  getTestSqlite,
} from "@/__tests__/helpers/db-setup";

describe("SessionRepository - Edge Cases", () => {
  beforeAll(async () => {
    await setupTestDatabase(__filename);
  });

  beforeEach(async () => {
    await clearTestDatabase(__filename);
  });

  afterAll(async () => {
    await teardownTestDatabase(__filename);
  });

  describe("findAllByBookIdWithProgress", () => {
    test("should return sessions with null latestProgress when no progress logs exist", async () => {
      const book = await bookRepository.create({
        title: "Test Book",
        calibreId: 1,
      });

      const session = await sessionRepository.create({
        bookId: book.id,
        sessionNumber: 1,
        status: "reading",
        isActive: true,
      });

      const sessions = await sessionRepository.findAllByBookIdWithProgress(book.id);

      expect(sessions).toHaveLength(1);
      expect(sessions[0].id).toBe(session.id);
      expect(sessions[0].progressSummary).toEqual({
        totalEntries: 0,
        totalPagesRead: 0,
        latestProgress: null,
        firstProgressDate: null,
        lastProgressDate: null,
      });
    });

    test("should return sessions with progress summary when progress logs exist", async () => {
      const book = await bookRepository.create({
        title: "Test Book",
        calibreId: 1,
      });

      const session = await sessionRepository.create({
        bookId: book.id,
        sessionNumber: 1,
        status: "reading",
        isActive: true,
      });

      // Add progress entries
      await progressRepository.create({
        sessionId: session.id,
        bookId: book.id,
        progressDate: "2024-01-01",
        currentPage: 50,
        currentPercentage: 25,
        pagesRead: 50,
      });

      await progressRepository.create({
        sessionId: session.id,
        bookId: book.id,
        progressDate: "2024-01-02",
        currentPage: 100,
        currentPercentage: 50,
        pagesRead: 50,
        notes: "Great progress!",
      });

      const sessions = await sessionRepository.findAllByBookIdWithProgress(book.id);

      expect(sessions).toHaveLength(1);
      expect(sessions[0].progressSummary).toEqual({
        totalEntries: 2,
        totalPagesRead: 100,
        latestProgress: {
          currentPage: 100,
          currentPercentage: 50,
          progressDate: "2024-01-02",
          notes: "Great progress!",
        },
        firstProgressDate: "2024-01-01",
        lastProgressDate: "2024-01-02",
      });
    });

    test("should handle multiple sessions with mixed progress states", async () => {
      const book = await bookRepository.create({
        title: "Test Book",
        calibreId: 1,
      });

      // First session with progress
      const session1 = await sessionRepository.create({
        bookId: book.id,
        sessionNumber: 1,
        status: "read",
        isActive: false,
        completedDate: "2024-01-15",
      });

      await progressRepository.create({
        sessionId: session1.id,
        bookId: book.id,
        progressDate: "2024-01-10",
        currentPage: 200,
        currentPercentage: 100,
        pagesRead: 200,
      });

      // Second session without progress (DNF)
      const session2 = await sessionRepository.create({
        bookId: book.id,
        sessionNumber: 2,
        status: "dnf",
        isActive: false,
        completedDate: "2024-02-01",
      });

      // Third session with progress (active)
      const session3 = await sessionRepository.create({
        bookId: book.id,
        sessionNumber: 3,
        status: "reading",
        isActive: true,
      });

      await progressRepository.create({
        sessionId: session3.id,
        bookId: book.id,
        progressDate: "2024-03-01",
        currentPage: 50,
        currentPercentage: 25,
        pagesRead: 50,
      });

      const sessions = await sessionRepository.findAllByBookIdWithProgress(book.id);

      expect(sessions).toHaveLength(3);
      // Ordered by session number descending
      expect(sessions[0].sessionNumber).toBe(3);
      expect(sessions[0].progressSummary.totalEntries).toBe(1);
      expect(sessions[0].progressSummary.latestProgress?.currentPage).toBe(50);

      expect(sessions[1].sessionNumber).toBe(2);
      expect(sessions[1].progressSummary.totalEntries).toBe(0);
      expect(sessions[1].progressSummary.latestProgress).toBeNull();

      expect(sessions[2].sessionNumber).toBe(1);
      expect(sessions[2].progressSummary.totalEntries).toBe(1);
      expect(sessions[2].progressSummary.latestProgress?.currentPage).toBe(200);
    });

    test("should return empty array when book has no sessions", async () => {
      const book = await bookRepository.create({
        title: "Test Book",
        calibreId: 1,
      });

      const sessions = await sessionRepository.findAllByBookIdWithProgress(book.id);

      expect(sessions).toEqual([]);
    });
  });

  describe("findByStatus - Orphaned Book Filtering", () => {
    test("should exclude orphaned books by default", async () => {
      const normalBook = await bookRepository.create({
        title: "Normal Book",
        calibreId: 1,
        orphaned: false,
      });

      const orphanedBook = await bookRepository.create({
        title: "Orphaned Book",
        calibreId: 2,
        orphaned: true,
      });

      await sessionRepository.create({
        bookId: normalBook.id,
        sessionNumber: 1,
        status: "reading",
        isActive: true,
      });

      await sessionRepository.create({
        bookId: orphanedBook.id,
        sessionNumber: 1,
        status: "reading",
        isActive: true,
      });

      const sessions = await sessionRepository.findByStatus("reading", true);

      expect(sessions).toHaveLength(1);
      expect(sessions[0].bookId).toBe(normalBook.id);
    });

    test("should handle null orphaned field as non-orphaned", async () => {
      const book = await bookRepository.create({
        title: "Book Without Orphaned Field",
        calibreId: 1,
        // orphaned field not set (defaults to null)
      });

      await sessionRepository.create({
        bookId: book.id,
        sessionNumber: 1,
        status: "reading",
        isActive: true,
      });

      const sessions = await sessionRepository.findByStatus("reading", true);

      expect(sessions).toHaveLength(1);
      expect(sessions[0].bookId).toBe(book.id);
    });

    test("should include orphaned books when using findByStatusIncludingOrphaned", async () => {
      const normalBook = await bookRepository.create({
        title: "Normal Book",
        calibreId: 1,
        orphaned: false,
      });

      const orphanedBook = await bookRepository.create({
        title: "Orphaned Book",
        calibreId: 2,
        orphaned: true,
      });

      await sessionRepository.create({
        bookId: normalBook.id,
        sessionNumber: 1,
        status: "reading",
        isActive: true,
      });

      await sessionRepository.create({
        bookId: orphanedBook.id,
        sessionNumber: 1,
        status: "reading",
        isActive: true,
      });

      const sessions = await sessionRepository.findByStatusIncludingOrphaned("reading", true);

      expect(sessions).toHaveLength(2);
      const bookIds = sessions.map(s => s.bookId).sort();
      expect(bookIds).toEqual([normalBook.id, orphanedBook.id].sort());
    });

    test("should respect activeOnly parameter", async () => {
      const book = await bookRepository.create({
        title: "Test Book",
        calibreId: 1,
      });

      await sessionRepository.create({
        bookId: book.id,
        sessionNumber: 1,
        status: "reading",
        isActive: true,
      });

      await sessionRepository.create({
        bookId: book.id,
        sessionNumber: 2,
        status: "reading",
        isActive: false,
      });

      const activeSessions = await sessionRepository.findByStatus("reading", true);
      expect(activeSessions).toHaveLength(1);
      expect(activeSessions[0].isActive).toBe(true);

      const allSessions = await sessionRepository.findByStatus("reading", false);
      expect(allSessions).toHaveLength(2);
    });

    test("should respect limit parameter", async () => {
      // Create 5 different books with reading sessions
      for (let i = 1; i <= 5; i++) {
        const book = await bookRepository.create({
          title: `Test Book ${i}`,
          calibreId: i,
          path: `/test/book${i}.epub`,
        });

        await sessionRepository.create({
          bookId: book.id,
          sessionNumber: 1,
          status: "reading",
          isActive: true,
        });
      }

      const sessions = await sessionRepository.findByStatus("reading", true, 3);

      expect(sessions).toHaveLength(3);
    });
  });

  describe("countByStatus - Orphaned Book Filtering", () => {
    test("should exclude orphaned books from count by default", async () => {
      const normalBook = await bookRepository.create({
        title: "Normal Book",
        calibreId: 1,
        orphaned: false,
      });

      const orphanedBook = await bookRepository.create({
        title: "Orphaned Book",
        calibreId: 2,
        orphaned: true,
      });

      await sessionRepository.create({
        bookId: normalBook.id,
        sessionNumber: 1,
        status: "reading",
        isActive: true,
      });

      await sessionRepository.create({
        bookId: orphanedBook.id,
        sessionNumber: 1,
        status: "reading",
        isActive: true,
      });

      const count = await sessionRepository.countByStatus("reading", true);

      expect(count).toBe(1);
    });

    test("should count only non-orphaned books", async () => {
      // countByStatus excludes orphaned books via isNotOrphaned().
      // This test verifies that countByStatus correctly excludes orphaned books.
      const normalBook = await bookRepository.create({
        title: "Normal Book",
        calibreId: 1,
        orphaned: false,
      });

      const orphanedBook = await bookRepository.create({
        title: "Orphaned Book",
        calibreId: 2,
        orphaned: true,
      });

      await sessionRepository.create({
        bookId: normalBook.id,
        sessionNumber: 1,
        status: "reading",
        isActive: true,
      });

      await sessionRepository.create({
        bookId: orphanedBook.id,
        sessionNumber: 1,
        status: "reading",
        isActive: true,
      });

      // countByStatus excludes orphaned books — should only count the normal book
      const count = await sessionRepository.countByStatus("reading", true);

      expect(count).toBe(1);
    });

    test("should return 0 when no sessions match", async () => {
      const book = await bookRepository.create({
        title: "Test Book",
        calibreId: 1,
      });

      await sessionRepository.create({
        bookId: book.id,
        sessionNumber: 1,
        status: "reading",
        isActive: true,
      });

      const count = await sessionRepository.countByStatus("read", true);

      expect(count).toBe(0);
    });
  });

  describe("findActiveByBookId with transaction", () => {
    test("should work with transaction parameter", async () => {
      const book = await bookRepository.create({
        title: "Test Book",
        calibreId: 1,
      });

      await sessionRepository.create({
        bookId: book.id,
        sessionNumber: 1,
        status: "reading",
        isActive: true,
      });

      // Call with undefined transaction (uses default database)
      const session = await sessionRepository.findActiveByBookId(book.id, undefined);

      expect(session).toBeDefined();
      expect(session?.isActive).toBe(true);
    });
  });

  describe("findActiveSessionsByBookId", () => {
    test("should only return sessions that are both active AND reading status", async () => {
      const book = await bookRepository.create({
        title: "Test Book",
        calibreId: 1,
      });

      // Active + reading (should match)
      await sessionRepository.create({
        bookId: book.id,
        sessionNumber: 1,
        status: "reading",
        isActive: true,
      });

      // Reading but not active (should NOT match)
      await sessionRepository.create({
        bookId: book.id,
        sessionNumber: 2,
        status: "reading",
        isActive: false,
      });

      const sessions = await sessionRepository.findActiveSessionsByBookId(book.id);

      expect(sessions).toHaveLength(1);
      expect(sessions[0].sessionNumber).toBe(1);
      expect(sessions[0].status).toBe("reading");
      expect(sessions[0].isActive).toBe(true);
    });

    test("should return empty array when no active reading sessions exist", async () => {
      const book = await bookRepository.create({
        title: "Test Book",
        calibreId: 1,
      });

      const sessions = await sessionRepository.findActiveSessionsByBookId(book.id);

      expect(sessions).toEqual([]);
    });
  });

  describe("findMostRecentCompletedByBookId", () => {
    test("should return session with most recent completedDate", async () => {
      const book = await bookRepository.create({
        title: "Test Book",
        calibreId: 1,
      });

      await sessionRepository.create({
        bookId: book.id,
        sessionNumber: 1,
        status: "read",
        isActive: false,
        completedDate: "2024-01-01",
      });

      await sessionRepository.create({
        bookId: book.id,
        sessionNumber: 2,
        status: "read",
        isActive: false,
        completedDate: "2024-03-01",
      });

      await sessionRepository.create({
        bookId: book.id,
        sessionNumber: 3,
        status: "read",
        isActive: false,
        completedDate: "2024-02-01",
      });

      const session = await sessionRepository.findMostRecentCompletedByBookId(book.id);

      expect(session).toBeDefined();
      expect(session?.sessionNumber).toBe(2);
      expect(session?.completedDate).toBe("2024-03-01");
    });

    test("should use sessionNumber as tiebreaker for same completedDate", async () => {
      const book = await bookRepository.create({
        title: "Test Book",
        calibreId: 1,
      });

      await sessionRepository.create({
        bookId: book.id,
        sessionNumber: 1,
        status: "read",
        isActive: false,
        completedDate: "2024-01-01",
      });

      await sessionRepository.create({
        bookId: book.id,
        sessionNumber: 2,
        status: "read",
        isActive: false,
        completedDate: "2024-01-01",
      });

      const session = await sessionRepository.findMostRecentCompletedByBookId(book.id);

      expect(session).toBeDefined();
      expect(session?.sessionNumber).toBe(2);
    });

    test("should return undefined when no completed sessions exist", async () => {
      const book = await bookRepository.create({
        title: "Test Book",
        calibreId: 1,
      });

      await sessionRepository.create({
        bookId: book.id,
        sessionNumber: 1,
        status: "reading",
        isActive: true,
      });

      const session = await sessionRepository.findMostRecentCompletedByBookId(book.id);

      expect(session).toBeUndefined();
    });
  });

  describe("findLatestByBookId", () => {
    test("should return session with highest session number", async () => {
      const book = await bookRepository.create({
        title: "Test Book",
        calibreId: 1,
      });

      await sessionRepository.create({
        bookId: book.id,
        sessionNumber: 1,
        status: "read",
        isActive: false,
      });

      await sessionRepository.create({
        bookId: book.id,
        sessionNumber: 3,
        status: "reading",
        isActive: true,
      });

      await sessionRepository.create({
        bookId: book.id,
        sessionNumber: 2,
        status: "dnf",
        isActive: false,
      });

      const session = await sessionRepository.findLatestByBookId(book.id);

      expect(session).toBeDefined();
      expect(session?.sessionNumber).toBe(3);
    });

    test("should return undefined when book has no sessions", async () => {
      const book = await bookRepository.create({
        title: "Test Book",
        calibreId: 1,
      });

      const session = await sessionRepository.findLatestByBookId(book.id);

      expect(session).toBeUndefined();
    });
  });

  describe("findByBookIdAndSessionNumber", () => {
    test("should find specific session by book ID and session number", async () => {
      const book = await bookRepository.create({
        title: "Test Book",
        calibreId: 1,
      });

      await sessionRepository.create({
        bookId: book.id,
        sessionNumber: 1,
        status: "read",
        isActive: false,
      });

      const targetSession = await sessionRepository.create({
        bookId: book.id,
        sessionNumber: 2,
        status: "reading",
        isActive: true,
      });

      const found = await sessionRepository.findByBookIdAndSessionNumber(book.id, 2);

      expect(found).toBeDefined();
      expect(found?.id).toBe(targetSession.id);
      expect(found?.sessionNumber).toBe(2);
    });

    test("should return undefined when session number doesn't exist", async () => {
      const book = await bookRepository.create({
        title: "Test Book",
        calibreId: 1,
      });

      await sessionRepository.create({
        bookId: book.id,
        sessionNumber: 1,
        status: "reading",
        isActive: true,
      });

      const found = await sessionRepository.findByBookIdAndSessionNumber(book.id, 99);

      expect(found).toBeUndefined();
    });
  });

  describe("findAllByBookId with transaction", () => {
    test("should work with transaction parameter", async () => {
      const book = await bookRepository.create({
        title: "Test Book",
        calibreId: 1,
      });

      await sessionRepository.create({
        bookId: book.id,
        sessionNumber: 1,
        status: "reading",
        isActive: true,
      });

      await sessionRepository.create({
        bookId: book.id,
        sessionNumber: 2,
        status: "read",
        isActive: false,
      });

      // Call with undefined transaction (uses default database)
      const sessions = await sessionRepository.findAllByBookId(book.id, undefined);

      expect(sessions).toHaveLength(2);
      // Should be ordered by session number descending
      expect(sessions[0].sessionNumber).toBe(2);
      expect(sessions[1].sessionNumber).toBe(1);
    });
  });

  describe("moveReadNextToTop", () => {
    test("should move session to position 0 and shift others down", async () => {
      // Create 3 books with read-next sessions
      const book1 = await bookRepository.create({
        title: "Book 1",
        calibreId: 1,
      });
      const book2 = await bookRepository.create({
        title: "Book 2",
        calibreId: 2,
      });
      const book3 = await bookRepository.create({
        title: "Book 3",
        calibreId: 3,
      });

      const session1 = await sessionRepository.create({
        bookId: book1.id,
        sessionNumber: 1,
        status: "read-next",
        isActive: false,
        readNextOrder: 0,
      });
      const session2 = await sessionRepository.create({
        bookId: book2.id,
        sessionNumber: 1,
        status: "read-next",
        isActive: false,
        readNextOrder: 1,
      });
      const session3 = await sessionRepository.create({
        bookId: book3.id,
        sessionNumber: 1,
        status: "read-next",
        isActive: false,
        readNextOrder: 2,
      });

      // Move session3 (currently at position 2) to top
      await sessionRepository.moveReadNextToTop(session3.id);

      // Verify new positions
      const updatedSession1 = await sessionRepository.findById(session1.id);
      const updatedSession2 = await sessionRepository.findById(session2.id);
      const updatedSession3 = await sessionRepository.findById(session3.id);

      expect(updatedSession3?.readNextOrder).toBe(0); // Moved to top
      expect(updatedSession1?.readNextOrder).toBe(1); // Shifted down
      expect(updatedSession2?.readNextOrder).toBe(2); // Shifted down
    });

    test("should handle moving already top item (no-op)", async () => {
      const book1 = await bookRepository.create({
        title: "Book 1",
        calibreId: 1,
      });
      const book2 = await bookRepository.create({
        title: "Book 2",
        calibreId: 2,
      });

      const session1 = await sessionRepository.create({
        bookId: book1.id,
        sessionNumber: 1,
        status: "read-next",
        isActive: false,
        readNextOrder: 0,
      });
      const session2 = await sessionRepository.create({
        bookId: book2.id,
        sessionNumber: 1,
        status: "read-next",
        isActive: false,
        readNextOrder: 1,
      });

      // Move session1 (already at position 0) to top
      await sessionRepository.moveReadNextToTop(session1.id);

      // Verify positions unchanged
      const updatedSession1 = await sessionRepository.findById(session1.id);
      const updatedSession2 = await sessionRepository.findById(session2.id);

      expect(updatedSession1?.readNextOrder).toBe(0);
      expect(updatedSession2?.readNextOrder).toBe(1);
    });

    test("should only affect read-next sessions", async () => {
      const book1 = await bookRepository.create({
        title: "Book 1",
        calibreId: 1,
      });
      const book2 = await bookRepository.create({
        title: "Book 2",
        calibreId: 2,
      });
      const book3 = await bookRepository.create({
        title: "Book 3",
        calibreId: 3,
      });

      // Create read-next sessions
      const session1 = await sessionRepository.create({
        bookId: book1.id,
        sessionNumber: 1,
        status: "read-next",
        isActive: false,
        readNextOrder: 0,
      });
      const session2 = await sessionRepository.create({
        bookId: book2.id,
        sessionNumber: 1,
        status: "read-next",
        isActive: false,
        readNextOrder: 1,
      });

      // Create a non-read-next session (should not be affected)
      const readingSession = await sessionRepository.create({
        bookId: book3.id,
        sessionNumber: 1,
        status: "reading",
        isActive: true,
      });

      // Get initial readNextOrder value
      const initialReadingSession = await sessionRepository.findById(readingSession.id);
      const initialReadNextOrder = initialReadingSession?.readNextOrder;

      // Move session2 to top
      await sessionRepository.moveReadNextToTop(session2.id);

      // Verify reading session unaffected (readNextOrder should not change)
      const updatedReadingSession = await sessionRepository.findById(readingSession.id);
      expect(updatedReadingSession?.readNextOrder).toBe(initialReadNextOrder);
      expect(updatedReadingSession?.status).toBe("reading");
    });

    test("should work with single read-next item", async () => {
      const book = await bookRepository.create({
        title: "Book 1",
        calibreId: 1,
      });

      const session = await sessionRepository.create({
        bookId: book.id,
        sessionNumber: 1,
        status: "read-next",
        isActive: false,
        readNextOrder: 0,
      });

      await sessionRepository.moveReadNextToTop(session.id);

      const updatedSession = await sessionRepository.findById(session.id);
      expect(updatedSession?.readNextOrder).toBe(0);
    });

    test("should handle moving from middle position", async () => {
      // Create 5 books for a more comprehensive test
      const books = await Promise.all(
        Array.from({ length: 5 }, (_, i) =>
          bookRepository.create({
            title: `Book ${i + 1}`,
            calibreId: i + 1,
            path: `/test/book${i + 1}.epub`,
          })
        )
      );

      const sessions = await Promise.all(
        books.map((book, i) =>
          sessionRepository.create({
            bookId: book.id,
            sessionNumber: 1,
            status: "read-next",
            isActive: false,
            readNextOrder: i,
          })
        )
      );

      // Move session at position 2 to top
      await sessionRepository.moveReadNextToTop(sessions[2].id);

      // Verify all positions
      const updated = await Promise.all(
        sessions.map((s) => sessionRepository.findById(s.id))
      );

      expect(updated[2]?.readNextOrder).toBe(0); // Moved to top
      expect(updated[0]?.readNextOrder).toBe(1); // Shifted down
      expect(updated[1]?.readNextOrder).toBe(2); // Shifted down
      expect(updated[3]?.readNextOrder).toBe(3); // Unchanged
      expect(updated[4]?.readNextOrder).toBe(4); // Unchanged
    });
  });

  describe("moveReadNextToBottom", () => {
    test("should move session to bottom position and shift others up", async () => {
      // Create 3 books with read-next sessions
      const book1 = await bookRepository.create({
        title: "Book 1",
        calibreId: 1,
        path: "/test/book1.epub",
      });
      const book2 = await bookRepository.create({
        title: "Book 2",
        calibreId: 2,
        path: "/test/book2.epub",
      });
      const book3 = await bookRepository.create({
        title: "Book 3",
        calibreId: 3,
        path: "/test/book3.epub",
      });

      const session1 = await sessionRepository.create({
        bookId: book1.id,
        sessionNumber: 1,
        status: "read-next",
        isActive: false,
        readNextOrder: 0,
      });
      const session2 = await sessionRepository.create({
        bookId: book2.id,
        sessionNumber: 1,
        status: "read-next",
        isActive: false,
        readNextOrder: 1,
      });
      const session3 = await sessionRepository.create({
        bookId: book3.id,
        sessionNumber: 1,
        status: "read-next",
        isActive: false,
        readNextOrder: 2,
      });

      // Move session1 (currently at position 0) to bottom
      await sessionRepository.moveReadNextToBottom(session1.id);

      // Verify new positions
      const updatedSession1 = await sessionRepository.findById(session1.id);
      const updatedSession2 = await sessionRepository.findById(session2.id);
      const updatedSession3 = await sessionRepository.findById(session3.id);

      expect(updatedSession1?.readNextOrder).toBe(2); // Moved to bottom
      expect(updatedSession2?.readNextOrder).toBe(0); // Shifted up
      expect(updatedSession3?.readNextOrder).toBe(1); // Shifted up
    });

    test("should handle moving already bottom item (no-op)", async () => {
      const book1 = await bookRepository.create({
        title: "Book 1",
        calibreId: 1,
        path: "/test/book1.epub",
      });
      const book2 = await bookRepository.create({
        title: "Book 2",
        calibreId: 2,
        path: "/test/book2.epub",
      });

      const session1 = await sessionRepository.create({
        bookId: book1.id,
        sessionNumber: 1,
        status: "read-next",
        isActive: false,
        readNextOrder: 0,
      });
      const session2 = await sessionRepository.create({
        bookId: book2.id,
        sessionNumber: 1,
        status: "read-next",
        isActive: false,
        readNextOrder: 1,
      });

      // Move session2 (already at bottom position 1) to bottom
      await sessionRepository.moveReadNextToBottom(session2.id);

      // Verify positions unchanged
      const updatedSession1 = await sessionRepository.findById(session1.id);
      const updatedSession2 = await sessionRepository.findById(session2.id);

      expect(updatedSession1?.readNextOrder).toBe(0);
      expect(updatedSession2?.readNextOrder).toBe(1);
    });

    test("should only affect read-next sessions", async () => {
      const book1 = await bookRepository.create({
        title: "Book 1",
        calibreId: 1,
        path: "/test/book1.epub",
      });
      const book2 = await bookRepository.create({
        title: "Book 2",
        calibreId: 2,
        path: "/test/book2.epub",
      });
      const book3 = await bookRepository.create({
        title: "Book 3",
        calibreId: 3,
        path: "/test/book3.epub",
      });

      // Create read-next sessions
      const session1 = await sessionRepository.create({
        bookId: book1.id,
        sessionNumber: 1,
        status: "read-next",
        isActive: false,
        readNextOrder: 0,
      });
      const session2 = await sessionRepository.create({
        bookId: book2.id,
        sessionNumber: 1,
        status: "read-next",
        isActive: false,
        readNextOrder: 1,
      });

      // Create a non-read-next session (should not be affected)
      const readingSession = await sessionRepository.create({
        bookId: book3.id,
        sessionNumber: 1,
        status: "reading",
        isActive: true,
      });

      // Get initial readNextOrder value
      const initialReadingSession = await sessionRepository.findById(readingSession.id);
      const initialReadNextOrder = initialReadingSession?.readNextOrder;

      // Move session1 to bottom
      await sessionRepository.moveReadNextToBottom(session1.id);

      // Verify reading session unaffected (readNextOrder should not change)
      const updatedReadingSession = await sessionRepository.findById(readingSession.id);
      expect(updatedReadingSession?.readNextOrder).toBe(initialReadNextOrder);
      expect(updatedReadingSession?.status).toBe("reading");
    });

    test("should work with single read-next item", async () => {
      const book = await bookRepository.create({
        title: "Book 1",
        calibreId: 1,
        path: "/test/book.epub",
      });

      const session = await sessionRepository.create({
        bookId: book.id,
        sessionNumber: 1,
        status: "read-next",
        isActive: false,
        readNextOrder: 0,
      });

      await sessionRepository.moveReadNextToBottom(session.id);

      const updatedSession = await sessionRepository.findById(session.id);
      expect(updatedSession?.readNextOrder).toBe(0);
    });

    test("should handle moving from middle position", async () => {
      // Create 5 books for a more comprehensive test
      const books = await Promise.all(
        Array.from({ length: 5 }, (_, i) =>
          bookRepository.create({
            title: `Book ${i + 1}`,
            calibreId: i + 1,
            path: `/test/book${i + 1}.epub`,
          })
        )
      );

      const sessions = await Promise.all(
        books.map((book, i) =>
          sessionRepository.create({
            bookId: book.id,
            sessionNumber: 1,
            status: "read-next",
            isActive: false,
            readNextOrder: i,
          })
        )
      );

      // Move session at position 2 to bottom
      await sessionRepository.moveReadNextToBottom(sessions[2].id);

      // Verify all positions
      const updated = await Promise.all(
        sessions.map((s) => sessionRepository.findById(s.id))
      );

      expect(updated[0]?.readNextOrder).toBe(0); // Unchanged
      expect(updated[1]?.readNextOrder).toBe(1); // Unchanged
      expect(updated[2]?.readNextOrder).toBe(4); // Moved to bottom
      expect(updated[3]?.readNextOrder).toBe(2); // Shifted up
      expect(updated[4]?.readNextOrder).toBe(3); // Shifted up
    });

    test("should throw error if session not found", async () => {
      await expect(
        sessionRepository.moveReadNextToBottom(99999)
      ).rejects.toThrow(/Session with ID 99999 not found/);
    });

    test("should throw error if session not in read-next status", async () => {
      const book = await bookRepository.create({
        title: "Reading Book",
        calibreId: 1,
        path: "/test/book.epub",
      });

      const session = await sessionRepository.create({
        bookId: book.id,
        sessionNumber: 1,
        status: "reading",
        isActive: true,
      });

      await expect(
        sessionRepository.moveReadNextToBottom(session.id)
      ).rejects.toThrow(/not in read-next status/);
    });


  });
});

// ---------------------------------------------------------------------------
// Malformed date defense tests
// ---------------------------------------------------------------------------
// These tests verify that the isValidDateFormat() GLOB guard in the
// session repository correctly rejects sessions whose completedDate
// is not a valid YYYY-MM-DD string.  Malformed values are injected via
// raw SQL to bypass ORM type-safety.
// ---------------------------------------------------------------------------

describe("Malformed date defense (isValidDateFormat guard)", () => {
  beforeAll(async () => {
    await setupTestDatabase(__filename);
  });

  beforeEach(async () => {
    await clearTestDatabase(__filename);
  });

  afterAll(async () => {
    await teardownTestDatabase(__filename);
  });

  // --- Raw SQL helpers (bypass ORM type safety) ----------------------------

  function getRawDb() {
    return getTestSqlite(__filename);
  }

  function insertBook(title: string, calibreId: number): number {
    const rawDb = getRawDb();
    rawDb
      .prepare(
        `INSERT INTO books (title, calibre_id, authors, tags, orphaned)
         VALUES (?, ?, '[]', '[]', 0)`
      )
      .run(title, calibreId);

    const row = rawDb
      .prepare("SELECT last_insert_rowid() as id")
      .get() as { id: number };
    return row.id;
  }

  function insertSession(opts: {
    bookId: number;
    status: string;
    completedDate?: string | null;
    sessionNumber?: number;
  }): number {
    const rawDb = getRawDb();
    rawDb
      .prepare(
        `INSERT INTO reading_sessions (book_id, session_number, status, completed_date, is_active)
         VALUES (?, ?, ?, ?, 0)`
      )
      .run(
        opts.bookId,
        opts.sessionNumber ?? 1,
        opts.status,
        opts.completedDate ?? null
      );

    const row = rawDb
      .prepare("SELECT last_insert_rowid() as id")
      .get() as { id: number };
    return row.id;
  }

  // Representative malformed date strings that could appear in the database
  const MALFORMED_DATES = [
    "1737676800",             // Unix timestamp (numeric string)
    "2026-01",                // Partial date (YYYY-MM)
    "2026-03-15T10:30:00",    // ISO datetime with time suffix
    "March 15, 2026",         // Human-readable format
    "15/03/2026",             // DD/MM/YYYY format
    "not-a-date",             // Completely invalid
    "",                       // Empty string
  ];

  // --- countCompletedByYear() ----------------------------------------------

  describe("countCompletedByYear()", () => {
    test("should not count sessions with malformed completedDate", async () => {
      const bookId = insertBook("Malformed Year Book", 700);

      let sessionNum = 1;
      for (const badDate of MALFORMED_DATES) {
        insertSession({
          bookId,
          status: "read",
          completedDate: badDate,
          sessionNumber: sessionNum++,
        });
      }

      // Insert one valid session
      insertSession({
        bookId,
        status: "read",
        completedDate: "2026-08-20",
        sessionNumber: sessionNum,
      });

      const count = await sessionRepository.countCompletedByYear(2026);
      expect(count).toBe(1); // Only the valid date should count
    });
  });

  // --- countCompletedByYearMonth() -----------------------------------------

  describe("countCompletedByYearMonth()", () => {
    test("should not count sessions with malformed completedDate", async () => {
      const bookId = insertBook("Malformed YearMonth Book", 701);

      let sessionNum = 1;
      for (const badDate of MALFORMED_DATES) {
        insertSession({
          bookId,
          status: "read",
          completedDate: badDate,
          sessionNumber: sessionNum++,
        });
      }

      // Insert one valid session in November 2026
      insertSession({
        bookId,
        status: "read",
        completedDate: "2026-11-05",
        sessionNumber: sessionNum,
      });

      const count = await sessionRepository.countCompletedByYearMonth(2026, 11);
      expect(count).toBe(1); // Only the valid date should count
    });

    test("should not count malformed dates even when month matches numerically", async () => {
      const bookId = insertBook("Numeric Match Book", 702);

      // "1737676800" starts with "17..." — strftime could theoretically
      // extract a month from it if the GLOB guard didn't reject it first
      insertSession({
        bookId,
        status: "read",
        completedDate: "1737676800",
        sessionNumber: 1,
      });

      // Valid session in January 2025
      insertSession({
        bookId,
        status: "read",
        completedDate: "2025-01-24",
        sessionNumber: 2,
      });

      const count = await sessionRepository.countCompletedByYearMonth(2025, 1);
      expect(count).toBe(1);
    });
  });
});
