import { toProgressDate, toSessionDate } from '../test-utils';
import { describe, test, expect, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import {
  bookRepository,
  sessionRepository,
  progressRepository,
  streakRepository,
} from "@/lib/repositories";
import { setupTestDatabase, teardownTestDatabase, clearTestDatabase } from "@/__tests__/helpers/db-setup";
import { toDateString } from "@/utils/dateHelpers.server";

describe("Edge Case Tests", () => {
  beforeAll(async () => {
    await setupTestDatabase(__filename);
  });

  afterAll(async () => {
    await teardownTestDatabase(__filename);
  });

  beforeEach(async () => {
    await clearTestDatabase(__filename);
  });

  describe("Empty Arrays", () => {
    test("should handle book with empty authors array", async () => {
      const book = await bookRepository.create({
        calibreId: Math.floor(Math.random() * 1000000),
        title: "Anonymous Book",
        authors: [],
        tags: [],
        path: "/path",
      });

      expect(book.authors).toEqual([]);

      // Should be retrievable
      const retrieved = await bookRepository.findById(book.id);
      expect(retrieved?.authors).toEqual([]);
    });

    test("should handle book with empty tags array", async () => {
      const book = await bookRepository.create({
        calibreId: Math.floor(Math.random() * 1000000),
        title: "Untagged Book",
        authors: ["Author"],
        tags: [],
        path: "/path",
      });

      expect(book.tags).toEqual([]);
    });
  });

  describe("Book Without Sessions", () => {
    test("should query book without sessions", async () => {
      const book = await bookRepository.create({
        calibreId: Math.floor(Math.random() * 1000000),
        title: "Orphan Book",
        authors: ["Author"],
        tags: [],
        path: "/path",
      });

      // Book exists
      const retrieved = await bookRepository.findById(book.id);
      expect(retrieved).toBeDefined();

      // No sessions
      const sessions = await sessionRepository.findAllByBookId(book.id);
      expect(sessions).toHaveLength(0);
    });
  });

  describe("Session Without Progress", () => {
    test("should handle session without progress logs", async () => {
      const book = await bookRepository.create({
        calibreId: Math.floor(Math.random() * 1000000),
        title: "Book",
        authors: ["Author"],
        tags: [],
        path: "/path",
      });

      const session = await sessionRepository.create({
        bookId: book.id,
        sessionNumber: 1,
        status: "to-read",
        isActive: true,
      });

      // Session exists
      expect(session).toBeDefined();

      // No progress
      const progress = await progressRepository.findBySessionId(session.id);
      expect(progress).toHaveLength(0);

      // Should not throw
      const hasProgress = await progressRepository.hasProgressForSession(session.id);
      expect(hasProgress).toBe(false);
    });
  });

  describe("Pagination Edge Cases", () => {
    test("should handle skip greater than total", async () => {
      await bookRepository.create({
        calibreId: Math.floor(Math.random() * 1000000),
        title: "Book 1",
        authors: ["Author"],
        tags: [],
        path: "/path1",
      });

      const result = await bookRepository.findWithFilters({}, 10, 1000);

      expect(result.books).toHaveLength(0);
      expect(result.total).toBe(1);
    });

    test("should handle limit of 0", async () => {
      await bookRepository.create({
        calibreId: Math.floor(Math.random() * 1000000),
        title: "Book 1",
        authors: ["Author"],
        tags: [],
        path: "/path1",
      });

      const result = await bookRepository.findWithFilters({}, 0, 0);

      expect(result.books).toHaveLength(0);
      expect(result.total).toBe(1);
    });
  });

  describe("Status Changes", () => {
    test("should handle marking as read without started_date", async () => {
      const book = await bookRepository.create({
        calibreId: Math.floor(Math.random() * 1000000),
        title: "Book",
        authors: ["Author"],
        tags: [],
        path: "/path",
      });

      // Create session without started date
      const session = await sessionRepository.create({
        bookId: book.id,
        sessionNumber: 1,
        status: "to-read",
        isActive: true,
      });

      // Update to read status
      const updated = await sessionRepository.update(session.id, {
        status: "read",
        completedDate: toSessionDate(new Date()),
      });

      expect(updated?.status).toBe("read");
      expect(updated?.completedDate).toBeDefined();
    });
  });

  describe("Streak Calculation", () => {
    test("should handle streak with single day activity", async () => {
      const streak = await streakRepository.create({
        userId: null,
        currentStreak: 1,
        longestStreak: 1,
        lastActivityDate: toDateString(new Date()),
        streakStartDate: toDateString(new Date()),
        totalDaysActive: 1,
      });

      expect(streak.currentStreak).toBe(1);
      expect(streak.longestStreak).toBe(1);
    });

    test("should handle streak with no activity", async () => {
      const streak = await streakRepository.create({
        userId: null,
        currentStreak: 0,
        longestStreak: 0,
        lastActivityDate: toDateString(new Date()),
        streakStartDate: toDateString(new Date()),
        totalDaysActive: 0,
      });

      expect(streak.currentStreak).toBe(0);
      expect(streak.longestStreak).toBe(0);
    });
  });

  describe("Optional Fields", () => {
    test("should handle book with minimal fields", async () => {
      const book = await bookRepository.create({
        calibreId: Math.floor(Math.random() * 1000000),
        title: "Minimal Book",
        authors: ["Author"],
        tags: [],
        path: "/path",
        // All optional fields omitted
      });

      expect(book.isbn).toBeNull();
      expect(book.publisher).toBeNull();
      expect(book.description).toBeNull();
      expect(book.series).toBeNull();
    });

    test("should handle session with minimal fields", async () => {
      const book = await bookRepository.create({
        calibreId: Math.floor(Math.random() * 1000000),
        title: "Book",
        authors: ["Author"],
        tags: [],
        path: "/path",
      });

      const session = await sessionRepository.create({
        bookId: book.id,
        sessionNumber: 1,
        status: "to-read",
        isActive: true,
        // Optional fields omitted
      });

      expect(session.startedDate).toBeNull();
      expect(session.completedDate).toBeNull();
      expect(session.review).toBeNull();
    });
  });

  describe("Date Handling", () => {
    test("should handle dates correctly", async () => {
      const specificDate = new Date("2024-01-15T12:00:00Z");

      const book = await bookRepository.create({
        calibreId: Math.floor(Math.random() * 1000000),
        title: "Book",
        authors: ["Author"],
        tags: [],
        path: "/path",
        pubDate: specificDate,
      });

      const retrieved = await bookRepository.findById(book.id);
      expect(retrieved?.pubDate).toBeDefined();
    });

    test("should handle progress dates with time components", async () => {
      const book = await bookRepository.create({
        calibreId: Math.floor(Math.random() * 1000000),
        title: "Book",
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

      const progressDate = toProgressDate(new Date("2024-01-15T15:30:00Z"));

      const progress = await progressRepository.create({
        bookId: book.id,
        sessionId: session.id,
        currentPage: 50,
        currentPercentage: 50,
        pagesRead: 50,
        progressDate,
      });

      expect(progress.progressDate).toBeDefined();
    });
  });

  describe("Null Values", () => {
    test("should handle userId as null", async () => {
      const streak = await streakRepository.getOrCreate(null);
      expect(streak).toBeDefined();
      expect(streak.userId).toBeNull();
    });
  });

  describe("Large Values", () => {
    test("should handle large page numbers", async () => {
      const book = await bookRepository.create({
        calibreId: Math.floor(Math.random() * 1000000),
        title: "Long Book",
        authors: ["Author"],
        tags: [],
        path: "/path",
        totalPages: 10000,
      });

      const session = await sessionRepository.create({
        bookId: book.id,
        sessionNumber: 1,
        status: "reading",
        isActive: true,
      });

      const progress = await progressRepository.create({
        bookId: book.id,
        sessionId: session.id,
        currentPage: 9999,
        currentPercentage: 99.99,
        pagesRead: 9999,
        progressDate: toProgressDate(new Date()),
      });

      expect(progress.currentPage).toBe(9999);
    });

    test("should handle large session numbers", async () => {
      const book = await bookRepository.create({
        calibreId: Math.floor(Math.random() * 1000000),
        title: "Re-read Many Times",
        authors: ["Author"],
        tags: [],
        path: "/path",
      });

      const session = await sessionRepository.create({
        bookId: book.id,
        sessionNumber: 100,
        status: "read",
        isActive: false,
      });

      expect(session.sessionNumber).toBe(100);
    });
  });

  describe("Special Characters", () => {
    test("should handle titles with special characters", async () => {
      const book = await bookRepository.create({
        calibreId: Math.floor(Math.random() * 1000000),
        title: "Book: A Story (Part 1) - \"The Beginning\"",
        authors: ["O'Reilly"],
        tags: ["Sci-Fi", "Action/Adventure"],
        path: "/path/to/book's/file",
      });

      const retrieved = await bookRepository.findById(book.id);
      expect(retrieved?.title).toBe("Book: A Story (Part 1) - \"The Beginning\"");
      expect(retrieved?.authors[0]).toBe("O'Reilly");
    });
  });
});
