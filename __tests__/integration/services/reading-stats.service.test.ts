import { describe, test, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { sessionRepository, progressRepository, readingGoalRepository, streakRepository } from "@/lib/repositories";
import { readingStatsService } from "@/lib/services";
import { setupTestDatabase, teardownTestDatabase, clearTestDatabase } from "../../helpers/db-setup";
import type { TestDatabaseInstance } from "../../helpers/db-setup";
import { formatInTimeZone } from "date-fns-tz";

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

/**
 * Helper: Get current date parts in the default timezone (America/New_York)
 * Mirrors the logic in ReadingStatsService.getOverview() to avoid timezone drift
 */
function getCurrentDateParts(timezone = "America/New_York") {
  const now = new Date();
  const today = formatInTimeZone(now, timezone, "yyyy-MM-dd");
  const year = parseInt(formatInTimeZone(now, timezone, "yyyy"), 10);
  const month = parseInt(formatInTimeZone(now, timezone, "MM"), 10);
  return { today, year, month };
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

  describe("ReadingStatsService.getOverview()", () => {
    test("returns correct structure with all zero values when no data exists", async () => {
      const overview = await readingStatsService.getOverview();

      expect(overview).toEqual({
        booksRead: {
          total: 0,
          thisYear: 0,
          thisMonth: 0,
        },
        currentlyReading: 0,
        pagesRead: {
          total: 0,
          thisYear: 0,
          thisMonth: 0,
          today: 0,
        },
        avgPagesPerDay: 0,
      });
    });

    test("aggregates books read correctly across total, thisYear, and thisMonth", async () => {
      const { today, year, month } = getCurrentDateParts();

      // Book completed this month (counts toward total, thisYear, and thisMonth)
      const book1 = insertBook({ title: "This Month Book", calibreId: 1 });
      insertSession({ bookId: book1, status: "read", completedDate: today });

      // Book completed earlier this year but different month
      // Use January if current month is not January, otherwise use a previous year
      const earlierThisYear = month > 1
        ? `${year}-01-05`
        : `${year - 1}-06-15`;
      const book2 = insertBook({ title: "Earlier Book", calibreId: 2 });
      insertSession({ bookId: book2, status: "read", completedDate: earlierThisYear });

      // Book completed last year (only counts toward total)
      const book3 = insertBook({ title: "Last Year Book", calibreId: 3 });
      insertSession({ bookId: book3, status: "read", completedDate: `${year - 1}-03-10` });

      const overview = await readingStatsService.getOverview();

      expect(overview.booksRead.total).toBe(3);
      if (month > 1) {
        // book1 (this month) + book2 (earlier this year) = 2
        expect(overview.booksRead.thisYear).toBe(2);
      } else {
        // January: book1 (this month) = 1 this year, book2 was placed in prior year
        expect(overview.booksRead.thisYear).toBe(1);
      }
      expect(overview.booksRead.thisMonth).toBe(1);
    });

    test("counts currently reading sessions", async () => {
      const book1 = insertBook({ title: "Reading 1", calibreId: 1 });
      insertSession({ bookId: book1, status: "reading", isActive: true });

      const book2 = insertBook({ title: "Reading 2", calibreId: 2 });
      insertSession({ bookId: book2, status: "reading", isActive: true });

      // Inactive reading session should not count
      const book3 = insertBook({ title: "Paused", calibreId: 3 });
      insertSession({ bookId: book3, status: "reading", isActive: false });

      // Completed session should not count
      const book4 = insertBook({ title: "Done", calibreId: 4 });
      insertSession({ bookId: book4, status: "read", completedDate: "2026-01-01", isActive: false });

      const overview = await readingStatsService.getOverview();

      expect(overview.currentlyReading).toBe(2);
    });

    test("aggregates pages read correctly across total, thisYear, thisMonth, and today", async () => {
      const { today, year, month } = getCurrentDateParts();

      const book = insertBook({ title: "Book", calibreId: 1 });
      const sessionId = insertSession({ bookId: book, status: "reading" });

      // Pages read today (counts toward all: total, thisYear, thisMonth, today)
      insertProgressLog({ bookId: book, sessionId, progressDate: today, currentPage: 50, pagesRead: 50 });

      // Pages read earlier this month (but not today)
      // Only add if today is not the 1st, to avoid date collision
      const dayOfMonth = parseInt(today.split("-")[2], 10);
      if (dayOfMonth > 1) {
        const earlierThisMonth = `${year}-${String(month).padStart(2, "0")}-01`;
        insertProgressLog({ bookId: book, sessionId, progressDate: earlierThisMonth, currentPage: 80, pagesRead: 30 });
      }

      // Pages read last year (only counts toward total)
      insertProgressLog({ bookId: book, sessionId, progressDate: `${year - 1}-06-15`, currentPage: 120, pagesRead: 40 });

      const overview = await readingStatsService.getOverview();

      if (dayOfMonth > 1) {
        expect(overview.pagesRead.total).toBe(120); // 50 + 30 + 40
        expect(overview.pagesRead.thisYear).toBe(80); // 50 + 30
        expect(overview.pagesRead.thisMonth).toBe(80); // 50 + 30
      } else {
        expect(overview.pagesRead.total).toBe(90); // 50 + 40
        expect(overview.pagesRead.thisYear).toBe(50);
        expect(overview.pagesRead.thisMonth).toBe(50);
      }
      expect(overview.pagesRead.today).toBe(50);
    });

    test("excludes malformed dates from year/month/today counts", async () => {
      const { today } = getCurrentDateParts();

      // Valid book completed today
      const goodBook = insertBook({ title: "Good Book", calibreId: 1 });
      insertSession({ bookId: goodBook, status: "read", completedDate: today });

      // Book with malformed Unix timestamp date — still has status "read",
      // so it IS counted by countByStatus (total) which doesn't filter by date,
      // but EXCLUDED from thisYear/thisMonth which use strftime + GLOB
      const badBook = insertBook({ title: "Bad Date Book", calibreId: 2 });
      insertSession({ bookId: badBook, status: "read", completedDate: "841276800" });

      // Valid progress today
      const readingBook = insertBook({ title: "Reading Book", calibreId: 3 });
      const sessionId = insertSession({ bookId: readingBook, status: "reading" });
      insertProgressLog({ bookId: readingBook, sessionId, progressDate: today, currentPage: 50, pagesRead: 50 });

      // Malformed progress date — excluded from year/month/today sums but included in total
      testDb.sqlite.prepare(`
        INSERT INTO progress_logs (book_id, session_id, progress_date, current_page, current_percentage, pages_read)
        VALUES (?, ?, '1704067200', 100, 0, 100)
      `).run(readingBook, sessionId);

      const overview = await readingStatsService.getOverview();

      // booksRead.total uses countByStatus (no date filter) — counts both
      expect(overview.booksRead.total).toBe(2);
      // thisYear/thisMonth use GLOB + strftime — malformed date excluded
      expect(overview.booksRead.thisYear).toBe(1);
      expect(overview.booksRead.thisMonth).toBe(1);

      // pagesRead.total includes all progress (no date filter on getTotalPagesRead)
      expect(overview.pagesRead.total).toBe(150); // 50 + 100
      // Year/month/today use GLOB guard — malformed progress excluded
      expect(overview.pagesRead.thisYear).toBe(50);
      expect(overview.pagesRead.today).toBe(50);
    });

    test("excludes orphaned books from book counts", async () => {
      const { today } = getCurrentDateParts();

      // Normal completed book
      const normalBook = insertBook({ title: "Normal", calibreId: 1 });
      insertSession({ bookId: normalBook, status: "read", completedDate: today });

      // Orphaned completed book
      const orphanedBook = insertBook({ title: "Orphaned", calibreId: 2, orphaned: true });
      insertSession({ bookId: orphanedBook, status: "read", completedDate: today });

      const overview = await readingStatsService.getOverview();

      // countByStatus (total) excludes orphaned via isNotOrphaned join
      // countCompletedByYear and countCompletedByYearMonth also exclude orphaned
      expect(overview.booksRead.total).toBe(1);
      expect(overview.booksRead.thisYear).toBe(1);
      expect(overview.booksRead.thisMonth).toBe(1);
    });

    test("calculates avgPagesPerDay from recent progress", async () => {
      const { year } = getCurrentDateParts();

      const book = insertBook({ title: "Book", calibreId: 1 });
      const sessionId = insertSession({ bookId: book, status: "reading" });

      // Add progress on two distinct days within the last 30 days
      const recentDay1 = `${year}-${String(new Date().getMonth() + 1).padStart(2, "0")}-${String(Math.max(1, new Date().getDate() - 2)).padStart(2, "0")}`;
      const recentDay2 = `${year}-${String(new Date().getMonth() + 1).padStart(2, "0")}-${String(Math.max(1, new Date().getDate() - 1)).padStart(2, "0")}`;

      insertProgressLog({ bookId: book, sessionId, progressDate: recentDay1, currentPage: 60, pagesRead: 60 });
      insertProgressLog({ bookId: book, sessionId, progressDate: recentDay2, currentPage: 100, pagesRead: 40 });

      const overview = await readingStatsService.getOverview();

      // Average should be (60 + 40) / 2 = 50 pages per day
      expect(overview.avgPagesPerDay).toBe(50);
    });
  });
});
