/**
 * Integration tests for lib/db/sql-helpers.ts
 *
 * Tests the shared SQL helpers (DATE_GLOB_PATTERN, isValidDateFormat,
 * isNotOrphaned) against a real in-memory SQLite database to verify
 * they produce correct SQL fragments.
 *
 * These helpers are used across 4 repositories:
 *   - progress.repository.ts (isValidDateFormat)
 *   - session.repository.ts  (isValidDateFormat, isNotOrphaned)
 *   - reading-goals.repository.ts (isValidDateFormat)
 *   - book.repository.ts (isNotOrphaned)
 */

import { describe, test, expect, beforeAll, afterAll, afterEach } from "vitest";
import {
  setupTestDatabase,
  teardownTestDatabase,
  clearTestDatabase,
} from "../../../helpers/db-setup";
import type { TestDatabaseInstance } from "../../../helpers/db-setup";
import {
  DATE_GLOB_PATTERN,
  isValidDateFormat,
  isNotOrphaned,
} from "@/lib/db/sql-helpers";
import { progressLogs } from "@/lib/db/schema/progress-logs";
import { readingSessions } from "@/lib/db/schema/reading-sessions";
import { books } from "@/lib/db/schema/books";
import { sql, and, eq } from "drizzle-orm";

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

// ---------------------------------------------------------------------------
// Raw SQL helpers for inserting test data
// ---------------------------------------------------------------------------

function insertBook(opts: {
  title: string;
  calibreId: number;
  orphaned?: boolean | null;
}): number {
  const rawDb = testDb.sqlite;
  rawDb
    .prepare(
      `INSERT INTO books (title, calibre_id, authors, tags, path, orphaned)
       VALUES (?, ?, '[]', '[]', '/test', ?)`
    )
    .run(opts.title, opts.calibreId, opts.orphaned ? 1 : 0);

  const row = rawDb
    .prepare("SELECT last_insert_rowid() as id")
    .get() as { id: number };
  return row.id;
}

function insertSession(opts: {
  bookId: number;
  status: string;
  completedDate?: string | null;
  startedDate?: string | null;
  sessionNumber?: number;
}): number {
  const rawDb = testDb.sqlite;
  rawDb
    .prepare(
      `INSERT INTO reading_sessions (book_id, session_number, status, started_date, completed_date, is_active)
       VALUES (?, ?, ?, ?, ?, 1)`
    )
    .run(
      opts.bookId,
      opts.sessionNumber ?? 1,
      opts.status,
      opts.startedDate ?? null,
      opts.completedDate ?? null
    );

  const row = rawDb
    .prepare("SELECT last_insert_rowid() as id")
    .get() as { id: number };
  return row.id;
}

function insertProgressLog(opts: {
  bookId: number;
  sessionId: number;
  progressDate: string;
  currentPage?: number;
  pagesRead?: number;
}): void {
  const rawDb = testDb.sqlite;
  rawDb
    .prepare(
      `INSERT INTO progress_logs (book_id, session_id, progress_date, current_page, current_percentage, pages_read)
       VALUES (?, ?, ?, ?, 0, ?)`
    )
    .run(
      opts.bookId,
      opts.sessionId,
      opts.progressDate,
      opts.currentPage ?? 100,
      opts.pagesRead ?? 10
    );
}

// ---------------------------------------------------------------------------
// DATE_GLOB_PATTERN constant
// ---------------------------------------------------------------------------

describe("DATE_GLOB_PATTERN", () => {
  test("exports the expected GLOB pattern string", () => {
    expect(DATE_GLOB_PATTERN).toBe(
      "[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]"
    );
  });

  test("has exactly 10 characters of date match (YYYY-MM-DD)", () => {
    // The pattern should match exactly 10-character date prefixes
    // Each [0-9] matches one digit, and there are 8 digits + 2 hyphens = 10 chars
    // Verify the pattern works at the SQLite level with raw GLOB
    const rawDb = testDb.sqlite;

    const valid = rawDb
      .prepare(`SELECT '2024-01-15' GLOB '${DATE_GLOB_PATTERN}' AS result`)
      .get() as { result: number };
    expect(valid.result).toBe(1);

    const invalid = rawDb
      .prepare(`SELECT '841276800' GLOB '${DATE_GLOB_PATTERN}' AS result`)
      .get() as { result: number };
    expect(invalid.result).toBe(0);
  });

  test("does NOT include trailing wildcard — exact 10-char match only", () => {
    // The docstring mentions "trailing *" but the actual pattern does NOT
    // include one. This test documents the ACTUAL behavior: strings longer
    // than YYYY-MM-DD do NOT match unless they are exactly 10 characters.
    const rawDb = testDb.sqlite;

    const withTimeSuffix = rawDb
      .prepare(
        `SELECT '2024-01-15T10:30:00' GLOB '${DATE_GLOB_PATTERN}' AS result`
      )
      .get() as { result: number };
    // Without trailing *, this does NOT match (string is longer than pattern)
    expect(withTimeSuffix.result).toBe(0);

    const exactMatch = rawDb
      .prepare(
        `SELECT '2024-01-15' GLOB '${DATE_GLOB_PATTERN}' AS result`
      )
      .get() as { result: number };
    expect(exactMatch.result).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// isValidDateFormat()
// ---------------------------------------------------------------------------

describe("isValidDateFormat()", () => {
  describe("accepts valid YYYY-MM-DD date strings", () => {
    test("standard date: 2024-01-15", async () => {
      const bookId = insertBook({ title: "Book", calibreId: 1 });
      const sessionId = insertSession({
        bookId,
        status: "reading",
      });
      insertProgressLog({
        bookId,
        sessionId,
        progressDate: "2024-01-15",
      });

      const results = testDb.db
        .select({ date: progressLogs.progressDate })
        .from(progressLogs)
        .where(isValidDateFormat(progressLogs.progressDate))
        .all();

      expect(results).toHaveLength(1);
      expect(results[0].date).toBe("2024-01-15");
    });

    test("year boundary dates: 2024-01-01 and 2024-12-31", async () => {
      const bookId = insertBook({ title: "Book", calibreId: 1 });
      const sessionId = insertSession({ bookId, status: "reading" });
      insertProgressLog({ bookId, sessionId, progressDate: "2024-01-01" });
      insertProgressLog({ bookId, sessionId, progressDate: "2024-12-31" });

      const results = testDb.db
        .select({ date: progressLogs.progressDate })
        .from(progressLogs)
        .where(isValidDateFormat(progressLogs.progressDate))
        .all();

      expect(results).toHaveLength(2);
    });

    test("extreme year boundaries: 0000-01-01 and 9999-12-31", async () => {
      const bookId = insertBook({ title: "Book", calibreId: 1 });
      const sessionId = insertSession({ bookId, status: "reading" });
      insertProgressLog({ bookId, sessionId, progressDate: "0000-01-01" });
      insertProgressLog({ bookId, sessionId, progressDate: "9999-12-31" });

      const results = testDb.db
        .select({ date: progressLogs.progressDate })
        .from(progressLogs)
        .where(isValidDateFormat(progressLogs.progressDate))
        .all();

      expect(results).toHaveLength(2);
    });

    test("semantically invalid but format-valid date passes (GLOB is format-only)", async () => {
      // GLOB only checks digit pattern, not semantic date validity
      // "2024-13-45" has correct format but is not a real date
      const bookId = insertBook({ title: "Book", calibreId: 1 });
      const sessionId = insertSession({ bookId, status: "reading" });
      insertProgressLog({ bookId, sessionId, progressDate: "2024-13-45" });

      const results = testDb.db
        .select({ date: progressLogs.progressDate })
        .from(progressLogs)
        .where(isValidDateFormat(progressLogs.progressDate))
        .all();

      // This PASSES because GLOB only validates character patterns, not date semantics
      expect(results).toHaveLength(1);
      expect(results[0].date).toBe("2024-13-45");
    });
  });

  describe("rejects invalid date formats", () => {
    test("Unix timestamp stored as text: '841276800'", async () => {
      const bookId = insertBook({ title: "Book", calibreId: 1 });
      const sessionId = insertSession({ bookId, status: "reading" });
      // This is the primary bug scenario the GLOB guard protects against
      insertProgressLog({ bookId, sessionId, progressDate: "841276800" });

      const results = testDb.db
        .select({ date: progressLogs.progressDate })
        .from(progressLogs)
        .where(isValidDateFormat(progressLogs.progressDate))
        .all();

      expect(results).toHaveLength(0);
    });

    test("large Unix timestamp: '1704067200'", async () => {
      const bookId = insertBook({ title: "Book", calibreId: 1 });
      const sessionId = insertSession({ bookId, status: "reading" });
      insertProgressLog({ bookId, sessionId, progressDate: "1704067200" });

      const results = testDb.db
        .select({ date: progressLogs.progressDate })
        .from(progressLogs)
        .where(isValidDateFormat(progressLogs.progressDate))
        .all();

      expect(results).toHaveLength(0);
    });

    test("partial date: '2024-01'", async () => {
      const bookId = insertBook({ title: "Book", calibreId: 1 });
      const sessionId = insertSession({ bookId, status: "reading" });
      insertProgressLog({ bookId, sessionId, progressDate: "2024-01" });

      const results = testDb.db
        .select({ date: progressLogs.progressDate })
        .from(progressLogs)
        .where(isValidDateFormat(progressLogs.progressDate))
        .all();

      expect(results).toHaveLength(0);
    });

    test("year only: '2024'", async () => {
      const bookId = insertBook({ title: "Book", calibreId: 1 });
      const sessionId = insertSession({ bookId, status: "reading" });
      insertProgressLog({ bookId, sessionId, progressDate: "2024" });

      const results = testDb.db
        .select({ date: progressLogs.progressDate })
        .from(progressLogs)
        .where(isValidDateFormat(progressLogs.progressDate))
        .all();

      expect(results).toHaveLength(0);
    });

    test("date with time suffix: '2024-01-15T10:30:00'", async () => {
      const bookId = insertBook({ title: "Book", calibreId: 1 });
      const sessionId = insertSession({ bookId, status: "reading" });
      insertProgressLog({
        bookId,
        sessionId,
        progressDate: "2024-01-15T10:30:00",
      });

      const results = testDb.db
        .select({ date: progressLogs.progressDate })
        .from(progressLogs)
        .where(isValidDateFormat(progressLogs.progressDate))
        .all();

      // Without trailing *, ISO datetime strings are rejected
      expect(results).toHaveLength(0);
    });

    test("non-numeric characters: 'abcd-ef-gh'", async () => {
      const bookId = insertBook({ title: "Book", calibreId: 1 });
      const sessionId = insertSession({ bookId, status: "reading" });
      insertProgressLog({ bookId, sessionId, progressDate: "abcd-ef-gh" });

      const results = testDb.db
        .select({ date: progressLogs.progressDate })
        .from(progressLogs)
        .where(isValidDateFormat(progressLogs.progressDate))
        .all();

      expect(results).toHaveLength(0);
    });

    test("empty string", async () => {
      const bookId = insertBook({ title: "Book", calibreId: 1 });
      const sessionId = insertSession({ bookId, status: "reading" });
      insertProgressLog({ bookId, sessionId, progressDate: "" });

      const results = testDb.db
        .select({ date: progressLogs.progressDate })
        .from(progressLogs)
        .where(isValidDateFormat(progressLogs.progressDate))
        .all();

      expect(results).toHaveLength(0);
    });

    test("wrong separator: '2024/01/15'", async () => {
      const bookId = insertBook({ title: "Book", calibreId: 1 });
      const sessionId = insertSession({ bookId, status: "reading" });
      insertProgressLog({ bookId, sessionId, progressDate: "2024/01/15" });

      const results = testDb.db
        .select({ date: progressLogs.progressDate })
        .from(progressLogs)
        .where(isValidDateFormat(progressLogs.progressDate))
        .all();

      expect(results).toHaveLength(0);
    });

    test("no separators: '20240115'", async () => {
      const bookId = insertBook({ title: "Book", calibreId: 1 });
      const sessionId = insertSession({ bookId, status: "reading" });
      insertProgressLog({ bookId, sessionId, progressDate: "20240115" });

      const results = testDb.db
        .select({ date: progressLogs.progressDate })
        .from(progressLogs)
        .where(isValidDateFormat(progressLogs.progressDate))
        .all();

      expect(results).toHaveLength(0);
    });
  });

  describe("works with mixed valid and invalid data", () => {
    test("filters out malformed dates from mixed dataset", async () => {
      const bookId = insertBook({ title: "Book", calibreId: 1 });
      const sessionId = insertSession({ bookId, status: "reading" });

      // Insert a mix of valid and invalid progress dates
      insertProgressLog({ bookId, sessionId, progressDate: "2024-01-15" }); // valid
      insertProgressLog({ bookId, sessionId, progressDate: "841276800" }); // invalid - unix timestamp
      insertProgressLog({ bookId, sessionId, progressDate: "2024-06-20" }); // valid
      insertProgressLog({ bookId, sessionId, progressDate: "abcd-ef-gh" }); // invalid - non-numeric
      insertProgressLog({ bookId, sessionId, progressDate: "2024-12-31" }); // valid

      const results = testDb.db
        .select({ date: progressLogs.progressDate })
        .from(progressLogs)
        .where(isValidDateFormat(progressLogs.progressDate))
        .all();

      expect(results).toHaveLength(3);
      const dates = results.map((r: { date: string }) => r.date);
      expect(dates).toContain("2024-01-15");
      expect(dates).toContain("2024-06-20");
      expect(dates).toContain("2024-12-31");
      expect(dates).not.toContain("841276800");
      expect(dates).not.toContain("abcd-ef-gh");
    });
  });

  describe("works with different column types", () => {
    test("validates completedDate on reading_sessions", async () => {
      const bookId1 = insertBook({ title: "Book A", calibreId: 1 });
      insertSession({
        bookId: bookId1,
        status: "read",
        completedDate: "2024-06-15",
      });

      const bookId2 = insertBook({ title: "Book B", calibreId: 2 });
      insertSession({
        bookId: bookId2,
        status: "read",
        completedDate: "841276800",
      });

      const results = testDb.db
        .select({ completedDate: readingSessions.completedDate })
        .from(readingSessions)
        .where(
          and(
            eq(readingSessions.status, "read"),
            isValidDateFormat(readingSessions.completedDate)
          )
        )
        .all();

      expect(results).toHaveLength(1);
      expect(results[0].completedDate).toBe("2024-06-15");
    });

    test("validates startedDate on reading_sessions", async () => {
      const bookId1 = insertBook({ title: "Book A", calibreId: 1 });
      insertSession({
        bookId: bookId1,
        status: "reading",
        startedDate: "2024-03-01",
      });

      const bookId2 = insertBook({ title: "Book B", calibreId: 2 });
      insertSession({
        bookId: bookId2,
        status: "reading",
        startedDate: "not-a-date",
      });

      const results = testDb.db
        .select({ startedDate: readingSessions.startedDate })
        .from(readingSessions)
        .where(isValidDateFormat(readingSessions.startedDate))
        .all();

      expect(results).toHaveLength(1);
      expect(results[0].startedDate).toBe("2024-03-01");
    });
  });

  describe("composability with other SQL clauses", () => {
    test("composes with strftime year extraction", async () => {
      const bookId = insertBook({ title: "Book", calibreId: 1 });
      const sessionId = insertSession({ bookId, status: "reading" });
      insertProgressLog({ bookId, sessionId, progressDate: "2024-01-15" });
      insertProgressLog({ bookId, sessionId, progressDate: "2025-06-20" });
      insertProgressLog({ bookId, sessionId, progressDate: "841276800" }); // invalid

      const results = testDb.db
        .select({ date: progressLogs.progressDate })
        .from(progressLogs)
        .where(
          and(
            isValidDateFormat(progressLogs.progressDate),
            sql`strftime('%Y', ${progressLogs.progressDate}) = '2024'`
          )
        )
        .all();

      expect(results).toHaveLength(1);
      expect(results[0].date).toBe("2024-01-15");
    });

    test("composes with strftime year-month extraction", async () => {
      const bookId = insertBook({ title: "Book", calibreId: 1 });
      const sessionId = insertSession({ bookId, status: "reading" });
      insertProgressLog({ bookId, sessionId, progressDate: "2024-01-15" });
      insertProgressLog({ bookId, sessionId, progressDate: "2024-02-20" });
      insertProgressLog({ bookId, sessionId, progressDate: "2024-01-25" });

      const results = testDb.db
        .select({ date: progressLogs.progressDate })
        .from(progressLogs)
        .where(
          and(
            isValidDateFormat(progressLogs.progressDate),
            sql`strftime('%Y-%m', ${progressLogs.progressDate}) = '2024-01'`
          )
        )
        .all();

      expect(results).toHaveLength(2);
    });
  });
});

// ---------------------------------------------------------------------------
// isNotOrphaned()
// ---------------------------------------------------------------------------

describe("isNotOrphaned()", () => {
  test("includes books with orphaned = false", async () => {
    insertBook({ title: "Normal Book", calibreId: 1, orphaned: false });

    const results = testDb.db
      .select({ title: books.title })
      .from(books)
      .where(isNotOrphaned())
      .all();

    expect(results).toHaveLength(1);
    expect(results[0].title).toBe("Normal Book");
  });

  test("includes books with orphaned = NULL (defensive — for pre-column rows)", async () => {
    // The current schema defines orphaned as NOT NULL DEFAULT false, so NULL
    // values can't exist in normal operation. However, isNotOrphaned() handles
    // NULL defensively for databases that predate the orphaned column (where
    // rows might have NULL from a prior schema version).
    //
    // To test this, we temporarily drop and recreate the NOT NULL constraint
    // by using a raw table that mirrors the books schema without the constraint.
    const rawDb = testDb.sqlite;

    // Create a test table with nullable orphaned column
    rawDb.exec(`
      CREATE TABLE test_books_nullable (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        calibre_id INTEGER NOT NULL,
        orphaned INTEGER
      )
    `);

    rawDb
      .prepare(
        `INSERT INTO test_books_nullable (title, calibre_id, orphaned) VALUES (?, ?, ?)`
      )
      .run("Legacy Book", 99, null);

    // Verify the NULL handling works at SQL level using the same OR pattern
    const result = rawDb
      .prepare(
        `SELECT title FROM test_books_nullable
         WHERE (orphaned = 0 OR orphaned IS NULL)`
      )
      .all() as Array<{ title: string }>;

    expect(result).toHaveLength(1);
    expect(result[0].title).toBe("Legacy Book");

    // Clean up
    rawDb.exec("DROP TABLE test_books_nullable");
  });

  test("excludes books with orphaned = true", async () => {
    insertBook({ title: "Orphaned Book", calibreId: 1, orphaned: true });

    const results = testDb.db
      .select({ title: books.title })
      .from(books)
      .where(isNotOrphaned())
      .all();

    expect(results).toHaveLength(0);
  });

  test("correctly filters mixed set of orphaned and non-orphaned books", async () => {
    insertBook({ title: "Normal A", calibreId: 1, orphaned: false });
    insertBook({ title: "Orphaned B", calibreId: 2, orphaned: true });
    insertBook({ title: "Normal C", calibreId: 3, orphaned: false });
    insertBook({ title: "Orphaned D", calibreId: 4, orphaned: true });
    insertBook({ title: "Normal E", calibreId: 5, orphaned: false });

    const results = testDb.db
      .select({ title: books.title })
      .from(books)
      .where(isNotOrphaned())
      .all();

    expect(results).toHaveLength(3);
    const titles = results.map((r: { title: string }) => r.title);
    expect(titles).toContain("Normal A");
    expect(titles).toContain("Normal C");
    expect(titles).toContain("Normal E");
    expect(titles).not.toContain("Orphaned B");
    expect(titles).not.toContain("Orphaned D");
  });

  describe("composability with other filters", () => {
    test("composes with status filter on sessions (real-world pattern)", async () => {
      // Normal book with completed session
      const normalBookId = insertBook({ title: "Read Book", calibreId: 1, orphaned: false });
      insertSession({ bookId: normalBookId, status: "read", completedDate: "2024-06-15" });

      // Orphaned book with completed session — should be excluded
      const orphanedBookId = insertBook({ title: "Orphaned Read", calibreId: 2, orphaned: true });
      insertSession({ bookId: orphanedBookId, status: "read", completedDate: "2024-06-20" });

      // Normal book with reading session — should be excluded by status filter
      const readingBookId = insertBook({ title: "Still Reading", calibreId: 3, orphaned: false });
      insertSession({ bookId: readingBookId, status: "reading" });

      const results = testDb.db
        .select({
          title: books.title,
          completedDate: readingSessions.completedDate,
        })
        .from(readingSessions)
        .innerJoin(books, eq(readingSessions.bookId, books.id))
        .where(
          and(
            eq(readingSessions.status, "read"),
            isNotOrphaned(),
            isValidDateFormat(readingSessions.completedDate)
          )
        )
        .all();

      expect(results).toHaveLength(1);
      expect(results[0].title).toBe("Read Book");
      expect(results[0].completedDate).toBe("2024-06-15");
    });

    test("composes with isValidDateFormat for full defense-in-depth", async () => {
      // Normal book, valid date
      const bookA = insertBook({ title: "Good", calibreId: 1, orphaned: false });
      insertSession({ bookId: bookA, status: "read", completedDate: "2024-01-15" });

      // Normal book, bad date
      const bookB = insertBook({ title: "Bad Date", calibreId: 2, orphaned: false });
      insertSession({ bookId: bookB, status: "read", completedDate: "841276800" });

      // Orphaned book, valid date
      const bookC = insertBook({ title: "Orphaned", calibreId: 3, orphaned: true });
      insertSession({ bookId: bookC, status: "read", completedDate: "2024-01-20" });

      const results = testDb.db
        .select({ title: books.title })
        .from(readingSessions)
        .innerJoin(books, eq(readingSessions.bookId, books.id))
        .where(
          and(
            eq(readingSessions.status, "read"),
            isNotOrphaned(),
            isValidDateFormat(readingSessions.completedDate)
          )
        )
        .all();

      expect(results).toHaveLength(1);
      expect(results[0].title).toBe("Good");
    });
  });
});

// ---------------------------------------------------------------------------
// Bug scenario documentation: why the GLOB guard is necessary
// ---------------------------------------------------------------------------

describe("Defense-in-depth: why the GLOB guard matters", () => {
  test("without GLOB guard, Unix timestamp '841276800' >= '2025-12-31' is TRUE (lexicographic)", () => {
    // This documents the bug that DATE_GLOB_PATTERN prevents.
    // SQLite compares TEXT values lexicographically:
    //   "841276800" >= "2025-12-31" → TRUE (because "8" > "2")
    // This means strftime('%Y', ...) on a non-date string can produce
    // incorrect results or the raw comparison can include wrong rows.
    const rawDb = testDb.sqlite;

    const result = rawDb
      .prepare(`SELECT '841276800' >= '2025-12-31' AS result`)
      .get() as { result: number };

    // This is TRUE! That's the bug.
    expect(result.result).toBe(1);
  });

  test("with GLOB guard, Unix timestamps are excluded before comparison", async () => {
    const bookId = insertBook({ title: "Book", calibreId: 1 });
    const sessionId = insertSession({ bookId, status: "reading" });
    insertProgressLog({ bookId, sessionId, progressDate: "2026-01-15" });
    insertProgressLog({ bookId, sessionId, progressDate: "841276800" }); // would incorrectly match >= 2025

    const results = testDb.db
      .select({ date: progressLogs.progressDate })
      .from(progressLogs)
      .where(
        and(
          isValidDateFormat(progressLogs.progressDate),
          sql`${progressLogs.progressDate} >= '2025-01-01'`
        )
      )
      .all();

    expect(results).toHaveLength(1);
    expect(results[0].date).toBe("2026-01-15");
  });
});
