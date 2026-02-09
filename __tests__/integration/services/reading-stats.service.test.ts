import { describe, test, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { sessionRepository, progressRepository, readingGoalRepository } from "@/lib/repositories";
import { readingStatsService } from "@/lib/services";
import { setupTestDatabase, teardownTestDatabase, clearTestDatabase } from "../../helpers/db-setup";
import type { TestDatabaseInstance } from "../../helpers/db-setup";

let testDb: TestDatabaseInstance;

beforeAll(async () => {
  testDb = await setupTestDatabase(__filename);
});

afterAll(async () => {
  await teardownTestDatabase(testDb);
});

afterEach(async () => {
  await clearTestDatabase(testDb);
});

/**
 * Helper: Insert a book directly via raw SQL
 */
function insertBook(opts: { id?: number; title: string; calibreId: number; orphaned?: boolean }) {
  const rawDb = testDb.sqlite;
  rawDb.prepare(`
    INSERT INTO books (title, calibre_id, authors, tags, path, orphaned)
    VALUES (?, ?, '[]', '[]', '/test', ?)
  `).run(opts.title, opts.calibreId, opts.orphaned ? 1 : 0);
  
  const row = rawDb.prepare("SELECT last_insert_rowid() as id").get() as { id: number };
  return row.id;
}

/**
 * Helper: Insert a reading session directly via raw SQL
 */
function insertSession(opts: {
  bookId: number;
  status: string;
  completedDate?: string | null;
  startedDate?: string | null;
  sessionNumber?: number;
  isActive?: boolean;
}) {
  const rawDb = testDb.sqlite;
  rawDb.prepare(`
    INSERT INTO reading_sessions (book_id, session_number, status, started_date, completed_date, is_active)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    opts.bookId,
    opts.sessionNumber ?? 1,
    opts.status,
    opts.startedDate ?? null,
    opts.completedDate ?? null,
    opts.isActive !== false ? 1 : 0
  );

  const row = rawDb.prepare("SELECT last_insert_rowid() as id").get() as { id: number };
  return row.id;
}

/**
 * Helper: Insert a progress log directly via raw SQL
 */
function insertProgressLog(opts: {
  bookId: number;
  sessionId: number;
  progressDate: string;
  currentPage: number;
  pagesRead: number;
}) {
  const rawDb = testDb.sqlite;
  rawDb.prepare(`
    INSERT INTO progress_logs (book_id, session_id, progress_date, current_page, current_percentage, pages_read)
    VALUES (?, ?, ?, ?, 0, ?)
  `).run(opts.bookId, opts.sessionId, opts.progressDate, opts.currentPage, opts.pagesRead);
}

describe("Consolidated Stats Counting", () => {
  describe("sessionRepository.countCompletedByYear()", () => {
    test("counts books completed in a specific year", async () => {
      const bookId = insertBook({ title: "Book 1", calibreId: 1 });
      insertSession({ bookId, status: "read", completedDate: "2026-01-15" });

      const bookId2 = insertBook({ title: "Book 2", calibreId: 2 });
      insertSession({ bookId: bookId2, status: "read", completedDate: "2026-06-20" });

      const bookId3 = insertBook({ title: "Book 3", calibreId: 3 });
      insertSession({ bookId: bookId3, status: "read", completedDate: "2025-12-31" });

      const count = await sessionRepository.countCompletedByYear(2026);
      expect(count).toBe(2);
    });

    test("excludes malformed dates (Unix timestamps stored as text)", async () => {
      const bookId = insertBook({ title: "Good Book", calibreId: 1 });
      insertSession({ bookId, status: "read", completedDate: "2026-01-15" });

      const bookId2 = insertBook({ title: "Bad Date Book", calibreId: 2 });
      // Unix timestamp stored as text - this is the bug scenario
      insertSession({ bookId: bookId2, status: "read", completedDate: "841276800" });

      const count = await sessionRepository.countCompletedByYear(2026);
      expect(count).toBe(1);
    });

    test("excludes orphaned books", async () => {
      const bookId = insertBook({ title: "Normal Book", calibreId: 1 });
      insertSession({ bookId, status: "read", completedDate: "2026-03-01" });

      const orphanedBookId = insertBook({ title: "Orphaned Book", calibreId: 2, orphaned: true });
      insertSession({ bookId: orphanedBookId, status: "read", completedDate: "2026-03-15" });

      const count = await sessionRepository.countCompletedByYear(2026);
      expect(count).toBe(1);
    });

    test("only counts 'read' status, not other statuses", async () => {
      const bookId = insertBook({ title: "Read Book", calibreId: 1 });
      insertSession({ bookId, status: "read", completedDate: "2026-01-15" });

      const bookId2 = insertBook({ title: "DNF Book", calibreId: 2 });
      insertSession({ bookId: bookId2, status: "dnf", completedDate: "2026-02-15" });

      const bookId3 = insertBook({ title: "Reading Book", calibreId: 3 });
      insertSession({ bookId: bookId3, status: "reading" });

      const count = await sessionRepository.countCompletedByYear(2026);
      expect(count).toBe(1);
    });

    test("returns 0 for year with no completions", async () => {
      const count = await sessionRepository.countCompletedByYear(2099);
      expect(count).toBe(0);
    });
  });

  describe("sessionRepository.countCompletedByYearMonth()", () => {
    test("counts books completed in a specific month", async () => {
      const bookId = insertBook({ title: "Jan Book", calibreId: 1 });
      insertSession({ bookId, status: "read", completedDate: "2026-01-15" });

      const bookId2 = insertBook({ title: "Feb Book", calibreId: 2 });
      insertSession({ bookId: bookId2, status: "read", completedDate: "2026-02-20" });

      const bookId3 = insertBook({ title: "Another Jan Book", calibreId: 3 });
      insertSession({ bookId: bookId3, status: "read", completedDate: "2026-01-30" });

      const janCount = await sessionRepository.countCompletedByYearMonth(2026, 1);
      expect(janCount).toBe(2);

      const febCount = await sessionRepository.countCompletedByYearMonth(2026, 2);
      expect(febCount).toBe(1);
    });

    test("excludes malformed dates", async () => {
      const bookId = insertBook({ title: "Good Book", calibreId: 1 });
      insertSession({ bookId, status: "read", completedDate: "2026-02-09" });

      const bookId2 = insertBook({ title: "Bad Date", calibreId: 2 });
      insertSession({ bookId: bookId2, status: "read", completedDate: "841276800" });

      const count = await sessionRepository.countCompletedByYearMonth(2026, 2);
      expect(count).toBe(1);
    });

    test("excludes orphaned books", async () => {
      const bookId = insertBook({ title: "Normal", calibreId: 1 });
      insertSession({ bookId, status: "read", completedDate: "2026-02-01" });

      const orphanedId = insertBook({ title: "Orphaned", calibreId: 2, orphaned: true });
      insertSession({ bookId: orphanedId, status: "read", completedDate: "2026-02-15" });

      const count = await sessionRepository.countCompletedByYearMonth(2026, 2);
      expect(count).toBe(1);
    });

    test("returns 0 for month with no completions", async () => {
      const count = await sessionRepository.countCompletedByYearMonth(2026, 12);
      expect(count).toBe(0);
    });
  });

  describe("progressRepository.getPagesReadByYear()", () => {
    test("sums pages read in a specific year", async () => {
      const bookId = insertBook({ title: "Book 1", calibreId: 1 });
      const sessionId = insertSession({ bookId, status: "reading" });

      insertProgressLog({ bookId, sessionId, progressDate: "2026-01-10", currentPage: 50, pagesRead: 50 });
      insertProgressLog({ bookId, sessionId, progressDate: "2026-02-15", currentPage: 100, pagesRead: 50 });
      insertProgressLog({ bookId, sessionId, progressDate: "2025-12-20", currentPage: 30, pagesRead: 30 });

      const pages = await progressRepository.getPagesReadByYear(2026);
      expect(pages).toBe(100);
    });

    test("excludes malformed dates in progress logs", async () => {
      const bookId = insertBook({ title: "Book", calibreId: 1 });
      const sessionId = insertSession({ bookId, status: "reading" });

      insertProgressLog({ bookId, sessionId, progressDate: "2026-01-10", currentPage: 50, pagesRead: 50 });

      // Insert a progress log with malformed date via raw SQL
      testDb.sqlite.prepare(`
        INSERT INTO progress_logs (book_id, session_id, progress_date, current_page, current_percentage, pages_read)
        VALUES (?, ?, '1704067200', 100, 0, 100)
      `).run(bookId, sessionId);

      const pages = await progressRepository.getPagesReadByYear(2026);
      expect(pages).toBe(50);
    });

    test("returns 0 for year with no progress", async () => {
      const pages = await progressRepository.getPagesReadByYear(2099);
      expect(pages).toBe(0);
    });
  });

  describe("progressRepository.getPagesReadByYearMonth()", () => {
    test("sums pages read in a specific month", async () => {
      const bookId = insertBook({ title: "Book 1", calibreId: 1 });
      const sessionId = insertSession({ bookId, status: "reading" });

      insertProgressLog({ bookId, sessionId, progressDate: "2026-02-05", currentPage: 30, pagesRead: 30 });
      insertProgressLog({ bookId, sessionId, progressDate: "2026-02-15", currentPage: 80, pagesRead: 50 });
      insertProgressLog({ bookId, sessionId, progressDate: "2026-03-01", currentPage: 100, pagesRead: 20 });

      const febPages = await progressRepository.getPagesReadByYearMonth(2026, 2);
      expect(febPages).toBe(80);

      const marPages = await progressRepository.getPagesReadByYearMonth(2026, 3);
      expect(marPages).toBe(20);
    });

    test("returns 0 for month with no progress", async () => {
      const pages = await progressRepository.getPagesReadByYearMonth(2026, 12);
      expect(pages).toBe(0);
    });
  });

  describe("progressRepository.getPagesReadByDate()", () => {
    test("sums pages read on a specific date", async () => {
      const bookId = insertBook({ title: "Book 1", calibreId: 1 });
      const sessionId = insertSession({ bookId, status: "reading" });

      insertProgressLog({ bookId, sessionId, progressDate: "2026-02-09", currentPage: 50, pagesRead: 50 });

      const bookId2 = insertBook({ title: "Book 2", calibreId: 2 });
      const sessionId2 = insertSession({ bookId: bookId2, status: "reading" });
      insertProgressLog({ bookId: bookId2, sessionId: sessionId2, progressDate: "2026-02-09", currentPage: 30, pagesRead: 30 });

      const pages = await progressRepository.getPagesReadByDate("2026-02-09");
      expect(pages).toBe(80);
    });

    test("returns 0 for date with no progress", async () => {
      const pages = await progressRepository.getPagesReadByDate("2099-01-01");
      expect(pages).toBe(0);
    });
  });

  describe("Stats and Goals consistency", () => {
    test("Stats and Goals produce identical year counts", async () => {
      // Create books with valid dates
      const book1 = insertBook({ title: "Book 1", calibreId: 1 });
      insertSession({ bookId: book1, status: "read", completedDate: "2026-01-15" });

      const book2 = insertBook({ title: "Book 2", calibreId: 2 });
      insertSession({ bookId: book2, status: "read", completedDate: "2026-06-20" });

      // Create a book with malformed date (the bug scenario)
      const book3 = insertBook({ title: "Bad Date Book", calibreId: 3 });
      insertSession({ bookId: book3, status: "read", completedDate: "841276800" });

      // Both methods should return 2, excluding the malformed date
      const statsCount = await sessionRepository.countCompletedByYear(2026);
      expect(statsCount).toBe(2);

      // Goals repository also uses GLOB guard now
      const goalsCount = await readingGoalRepository.getBooksCompletedInYear(null, 2026);
      expect(goalsCount).toBe(2);

      // They must match
      expect(statsCount).toBe(goalsCount);
    });

    test("malformed Unix timestamp '841276800' is excluded by both Stats and Goals", async () => {
      const bookId = insertBook({ title: "Le Pietre Magiche", calibreId: 1283 });
      insertSession({ bookId, status: "read", completedDate: "841276800" });

      // Stats
      const statsCount = await sessionRepository.countCompletedByYear(2026);
      expect(statsCount).toBe(0);

      // Goals
      const goalsCount = await readingGoalRepository.getBooksCompletedInYear(null, 2026);
      expect(goalsCount).toBe(0);
    });

    test("string '841276800' >= '2025-12-31' would be true without GLOB guard", () => {
      // Demonstrate the bug: string comparison incorrectly matches
      expect("841276800" >= "2025-12-31").toBe(true);
      // But "841276800" is not a valid YYYY-MM-DD date
      expect("841276800").not.toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
  });
});
