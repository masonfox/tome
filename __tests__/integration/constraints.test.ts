import { describe, test, expect, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import {
  bookRepository,
  sessionRepository,
  progressRepository,
  streakRepository,
} from "@/lib/repositories";
import { setupTestDatabase, teardownTestDatabase, clearTestDatabase } from "@/__tests__/helpers/db-setup";

// Use in-memory database for tests
describe("Database Constraints", () => {
  beforeAll(async () => {
    await setupTestDatabase(__filename);
  });

  afterAll(async () => {
    await teardownTestDatabase(__filename);
  });

  beforeEach(async () => {
    await clearTestDatabase(__filename);
  });

  describe("Book Constraints", () => {
    test("should prevent duplicate calibreId", async () => {
      // Create first book
      await bookRepository.create({
        calibreId: 1,
        title: "Test Book",
        authors: ["Author 1"],
        tags: [],
        path: "/path/to/book",
      });

      // Attempt to create duplicate
      await expect(
        bookRepository.create({
          calibreId: 1,
          title: "Another Book",
          authors: ["Author 2"],
          tags: [],
          path: "/path/to/another",
        })
      ).rejects.toThrow();
    });
  });

  describe("Reading Session Constraints", () => {
    test("should prevent duplicate active sessions for same book", async () => {
      // Create book
      const book = await bookRepository.create({
        calibreId: 1,
        title: "Test Book",
        authors: ["Author"],
        tags: [],
        path: "/path",
      });

      // Create first active session
      await sessionRepository.create({
        bookId: book.id,
        sessionNumber: 1,
        status: "reading",
        isActive: true,
      });

      // Attempt to create second active session - should fail
      await expect(
        sessionRepository.create({
          bookId: book.id,
          sessionNumber: 2,
          status: "reading",
          isActive: true,
        })
      ).rejects.toThrow();
    });

    test("should allow multiple inactive sessions for same book", async () => {
      const book = await bookRepository.create({
        calibreId: 1,
        title: "Test Book",
        authors: ["Author"],
        tags: [],
        path: "/path",
      });

      // Create first inactive session
      const session1 = await sessionRepository.create({
        bookId: book.id,
        sessionNumber: 1,
        status: "read",
        isActive: false,
      });
      expect(session1).toBeDefined();

      // Create second inactive session - should succeed
      const session2 = await sessionRepository.create({
        bookId: book.id,
        sessionNumber: 2,
        status: "read",
        isActive: false,
      });
      expect(session2).toBeDefined();
    });

    test("should prevent duplicate (bookId, sessionNumber)", async () => {
      const book = await bookRepository.create({
        calibreId: 1,
        title: "Test Book",
        authors: ["Author"],
        tags: [],
        path: "/path",
      });

      // Create session
      await sessionRepository.create({
        bookId: book.id,
        sessionNumber: 1,
        status: "reading",
        isActive: true,
      });

      // Archive it
      const sessions = await sessionRepository.findAllByBookId(book.id);
      await sessionRepository.archive(sessions[0].id);

      // Attempt to create another with same bookId + sessionNumber - should fail
      await expect(
        sessionRepository.create({
          bookId: book.id,
          sessionNumber: 1,
          status: "reading",
          isActive: true,
        })
      ).rejects.toThrow();
    });
  });

  describe("Foreign Key Constraints", () => {
    test("should enforce foreign key constraint on sessionId", async () => {
      const book = await bookRepository.create({
        calibreId: 1,
        title: "Test Book",
        authors: ["Author"],
        tags: [],
        path: "/path",
      });

      // Attempt to create progress log with non-existent sessionId
      await expect(
        progressRepository.create({
          bookId: book.id,
          sessionId: 99999, // Non-existent
          currentPage: 50,
          currentPercentage: 50,
          pagesRead: 50,
          progressDate: new Date(),
        })
      ).rejects.toThrow();
    });

    test("should cascade delete sessions when book deleted", async () => {
      const book = await bookRepository.create({
        calibreId: 1,
        title: "Test Book",
        authors: ["Author"],
        tags: [],
        path: "/path",
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
        currentPage: 50,
        currentPercentage: 50,
        pagesRead: 50,
        progressDate: new Date(),
      });

      // Delete book
      await bookRepository.delete(book.id);

      // Verify sessions are deleted
      const sessions = await sessionRepository.findAllByBookId(book.id);
      expect(sessions).toHaveLength(0);

      // Verify progress logs are deleted
      const progressLogs = await progressRepository.findByBookId(book.id);
      expect(progressLogs).toHaveLength(0);
    });

    test("should cascade delete progress logs when session deleted", async () => {
      const book = await bookRepository.create({
        calibreId: 1,
        title: "Test Book",
        authors: ["Author"],
        tags: [],
        path: "/path",
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
        currentPage: 50,
        currentPercentage: 50,
        pagesRead: 50,
        progressDate: new Date(),
      });

      // Delete session
      await sessionRepository.delete(session.id);

      // Verify progress logs are deleted
      const progressLogs = await progressRepository.findBySessionId(session.id);
      expect(progressLogs).toHaveLength(0);
    });
  });

  describe("Streak Constraints", () => {
    test("should enforce one streak per user (singleton pattern)", async () => {
      // Create first streak for user null
      await streakRepository.create({
        userId: null,
        currentStreak: 0,
        longestStreak: 0,
        lastActivityDate: new Date(),
        streakStartDate: new Date(),
        totalDaysActive: 0,
      });

      // Attempt to create duplicate - should fail
      let error: any;
      try {
        await streakRepository.create({
          userId: null,
          currentStreak: 0,
          longestStreak: 0,
          lastActivityDate: new Date(),
          streakStartDate: new Date(),
          totalDaysActive: 0,
        });
      } catch (e) {
        error = e;
      }
      expect(error).toBeDefined();
    });
  });

  describe("Check Constraints", () => {
    test("should enforce rating between 1 and 5 on books table", async () => {
      const book = await bookRepository.create({
        calibreId: 1,
        title: "Rating Test Book",
        authors: ["Author"],
        tags: [],
        path: "/path",
        rating: 5, // Valid rating
      });
      expect(book.rating).toBe(5);

      // Invalid rating - should fail (rating is on books table, not sessions)
      let error: any;
      try {
        await bookRepository.create({
          calibreId: 2,
          title: "Invalid Rating Book",
          authors: ["Author"],
          tags: [],
          path: "/path",
          rating: 6, // Out of range
        });
      } catch (e) {
        error = e;
      }
      expect(error).toBeDefined();
    });

    test("should enforce non-negative currentPage", async () => {
      const book = await bookRepository.create({
        calibreId: 1,
        title: "Test Book",
        authors: ["Author"],
        tags: [],
        path: "/path",
      });

      const session = await sessionRepository.create({
        bookId: book.id,
        sessionNumber: 1,
        status: "reading",
        isActive: true,
      });

      // Negative page - should fail
      let error: any;
      try {
        await progressRepository.create({
          bookId: book.id,
          sessionId: session.id,
          currentPage: -1,
          currentPercentage: 0,
          pagesRead: 0,
          progressDate: new Date(),
        });
      } catch (e) {
        error = e;
      }
      expect(error).toBeDefined();
    });

    test("should enforce percentage between 0 and 100", async () => {
      const book = await bookRepository.create({
        calibreId: 1,
        title: "Test Book",
        authors: ["Author"],
        tags: [],
        path: "/path",
      });

      const session = await sessionRepository.create({
        bookId: book.id,
        sessionNumber: 1,
        status: "reading",
        isActive: true,
      });

      // Valid percentage
      const validProgress = await progressRepository.create({
        bookId: book.id,
        sessionId: session.id,
        currentPage: 100,
        currentPercentage: 100,
        pagesRead: 100,
        progressDate: new Date(),
      });
      expect(validProgress.currentPercentage).toBe(100);

      // Invalid percentage - should fail
      let error: any;
      try {
        await progressRepository.create({
          bookId: book.id,
          sessionId: session.id,
          currentPage: 200,
          currentPercentage: 150, // Out of range
          pagesRead: 100,
          progressDate: new Date(),
        });
      } catch (e) {
        error = e;
      }
      expect(error).toBeDefined();
    });
  });
});
