import { describe, test, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { toSessionDate } from '../../test-utils';
import { readingGoalRepository } from "@/lib/repositories";
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

describe("ReadingGoalRepository", () => {
  describe("create()", () => {
    test("creates goal with valid data", async () => {
      const goal = await readingGoalRepository.create({
        userId: null,
        year: 2026,
        booksGoal: 40,
      });

      expect(goal).toBeDefined();
      expect(goal.id).toBeGreaterThan(0);
      expect(goal.year).toBe(2026);
      expect(goal.booksGoal).toBe(40);
      expect(goal.userId).toBeNull();
    });

    test("prevents duplicate user-year combinations", async () => {
      await readingGoalRepository.create({
        userId: null,
        year: 2026,
        booksGoal: 40,
      });

      // Attempt to create duplicate
      await expect(
        readingGoalRepository.create({
          userId: null,
          year: 2026,
          booksGoal: 50,
        })
      ).rejects.toThrow();
    });

    test("enforces minimum goal constraint", async () => {
      await expect(
        readingGoalRepository.create({
          userId: null,
          year: 2026,
          booksGoal: 0,
        })
      ).rejects.toThrow();
    });

    test("enforces year range constraint", async () => {
      await expect(
        readingGoalRepository.create({
          userId: null,
          year: 1899,
          booksGoal: 40,
        })
      ).rejects.toThrow();

      await expect(
        readingGoalRepository.create({
          userId: null,
          year: 10000,
          booksGoal: 40,
        })
      ).rejects.toThrow();
    });
  });

  describe("findByUserAndYear()", () => {
    test("finds goal for specific year", async () => {
      const created = await readingGoalRepository.create({
        userId: null,
        year: 2026,
        booksGoal: 40,
      });

      const found = await readingGoalRepository.findByUserAndYear(null, 2026);
      expect(found).toBeDefined();
      expect(found?.id).toBe(created.id);
      expect(found?.year).toBe(2026);
      expect(found?.booksGoal).toBe(40);
    });

    test("returns undefined for non-existent year", async () => {
      const found = await readingGoalRepository.findByUserAndYear(null, 2099);
      expect(found).toBeUndefined();
    });

    test("returns undefined when no goals exist", async () => {
      const found = await readingGoalRepository.findByUserAndYear(null, 2026);
      expect(found).toBeUndefined();
    });
  });

  describe("findByUserId()", () => {
    test("returns all goals for user ordered by year descending", async () => {
      await readingGoalRepository.create({
        userId: null,
        year: 2024,
        booksGoal: 30,
      });

      await readingGoalRepository.create({
        userId: null,
        year: 2026,
        booksGoal: 50,
      });

      await readingGoalRepository.create({
        userId: null,
        year: 2025,
        booksGoal: 40,
      });

      const goals = await readingGoalRepository.findByUserId(null);
      expect(goals).toHaveLength(3);
      expect(goals[0].year).toBe(2026);
      expect(goals[1].year).toBe(2025);
      expect(goals[2].year).toBe(2024);
    });

    test("returns empty array when no goals exist", async () => {
      const goals = await readingGoalRepository.findByUserId(null);
      expect(goals).toEqual([]);
    });
  });

  describe("update()", () => {
    test("updates goal successfully", async () => {
      const created = await readingGoalRepository.create({
        userId: null,
        year: 2026,
        booksGoal: 40,
      });

      const updated = await readingGoalRepository.update(created.id, {
        booksGoal: 50,
      });

      expect(updated).toBeDefined();
      expect(updated?.booksGoal).toBe(50);
      expect(updated?.year).toBe(2026); // Unchanged
    });

    test("returns undefined for non-existent goal", async () => {
      const updated = await readingGoalRepository.update(99999, {
        booksGoal: 50,
      });

      expect(updated).toBeUndefined();
    });
  });

  describe("delete()", () => {
    test("deletes goal successfully", async () => {
      const created = await readingGoalRepository.create({
        userId: null,
        year: 2026,
        booksGoal: 40,
      });

      const deleted = await readingGoalRepository.delete(created.id);
      expect(deleted).toBe(true);

      const found = await readingGoalRepository.findById(created.id);
      expect(found).toBeUndefined();
    });

    test("returns false for non-existent goal", async () => {
      const deleted = await readingGoalRepository.delete(99999);
      expect(deleted).toBe(false);
    });
  });

  describe("getBooksCompletedInYear()", () => {
    test("returns zero when no books completed", async () => {
      const count = await readingGoalRepository.getBooksCompletedInYear(null, 2026);
      expect(count).toBe(0);
    });

    test("returns correct count with actual book data", async () => {
      const { bookRepository, sessionRepository } = await import("@/lib/repositories");
      const year = 2026;

      // Create and complete 3 books
      for (let i = 1; i <= 3; i++) {
        const book = await bookRepository.create({
          calibreId: i,
          path: `test/path/${i}`,
          title: `Book ${i}`,
          authors: ["Author"],
          totalPages: 300,
        });

        await sessionRepository.create({
          bookId: book.id,
          sessionNumber: 1,
          status: "read",
          startedDate: toSessionDate(new Date(year, 0, 1)),
          completedDate: toSessionDate(new Date(year, i, 15)),
          isActive: false,
        });
      }

      const count = await readingGoalRepository.getBooksCompletedInYear(null, year);
      expect(count).toBe(3);
    });

    test("counts re-reads as separate completions", async () => {
      const { bookRepository, sessionRepository } = await import("@/lib/repositories");
      const year = 2026;

      // Create one book
      const book = await bookRepository.create({
        calibreId: 1,
        path: "test/path/1",
        title: "Re-read Book",
        authors: ["Author"],
        totalPages: 300,
      });

      // Complete it twice in the same year
      await sessionRepository.create({
        bookId: book.id,
        sessionNumber: 1,
        status: "read",
        startedDate: toSessionDate(new Date(year, 0, 1)),
        completedDate: toSessionDate(new Date(year, 2, 15)),
        isActive: false,
      });

      await sessionRepository.create({
        bookId: book.id,
        sessionNumber: 2,
        status: "read",
        startedDate: toSessionDate(new Date(year, 6, 1)),
        completedDate: toSessionDate(new Date(year, 8, 15)),
        isActive: false,
      });

      const count = await readingGoalRepository.getBooksCompletedInYear(null, year);
      expect(count).toBe(2);
    });

    test("does not count books from other years", async () => {
      const { bookRepository, sessionRepository } = await import("@/lib/repositories");

      // Complete books in 2025 and 2027
      const book1 = await bookRepository.create({
        calibreId: 1,
        path: "test/path/1",
        title: "Book 2025",
        authors: ["Author"],
        totalPages: 300,
      });

      await sessionRepository.create({
        bookId: book1.id,
        sessionNumber: 1,
        status: "read",
        startedDate: toSessionDate(new Date(2025, 0, 1)),
        completedDate: toSessionDate(new Date(2025, 6, 15)),
        isActive: false,
      });

      const book2 = await bookRepository.create({
        calibreId: 2,
        path: "test/path/2",
        title: "Book 2027",
        authors: ["Author"],
        totalPages: 300,
      });

      await sessionRepository.create({
        bookId: book2.id,
        sessionNumber: 1,
        status: "read",
        startedDate: toSessionDate(new Date(2027, 0, 1)),
        completedDate: toSessionDate(new Date(2027, 6, 15)),
        isActive: false,
      });

      const count = await readingGoalRepository.getBooksCompletedInYear(null, 2026);
      expect(count).toBe(0);
    });
  });

  describe("getYearsWithCompletedBooks()", () => {
    test("returns empty array when no books completed", async () => {
      const years = await readingGoalRepository.getYearsWithCompletedBooks(null);
      expect(years).toEqual([]);
    });

    test("returns years with completed books in descending order", async () => {
      const { bookRepository, sessionRepository } = await import("@/lib/repositories");

      // Complete books in different years
      const yearsToCreate = [2023, 2025, 2024, 2026];

      for (let i = 0; i < yearsToCreate.length; i++) {
        const year = yearsToCreate[i];
        const book = await bookRepository.create({
          calibreId: i + 1,
          path: `test/path/${i + 1}`,
          title: `Book ${year}`,
          authors: ["Author"],
          totalPages: 300,
        });

        await sessionRepository.create({
          bookId: book.id,
          sessionNumber: 1,
          status: "read",
          startedDate: toSessionDate(new Date(year, 0, 1)),
          completedDate: toSessionDate(new Date(year, 6, 15)),
          isActive: false,
        });
      }

      const years = await readingGoalRepository.getYearsWithCompletedBooks(null);

      expect(years).toHaveLength(4);
      // Function returns {year, count} objects
      expect(years[0].year).toBe(2026);
      expect(years[1].year).toBe(2025);
      expect(years[2].year).toBe(2024);
      expect(years[3].year).toBe(2023);
      // Each year has 1 book
      expect(years[0].count).toBe(1);
    });

    test("returns unique years with counts (no duplicates)", async () => {
      const { bookRepository, sessionRepository } = await import("@/lib/repositories");

      // Complete multiple books in the same year
      for (let i = 1; i <= 3; i++) {
        const book = await bookRepository.create({
          calibreId: i,
          path: `test/path/${i}`,
          title: `Book ${i}`,
          authors: ["Author"],
          totalPages: 300,
        });

        await sessionRepository.create({
          bookId: book.id,
          sessionNumber: 1,
          status: "read",
          startedDate: toSessionDate(new Date(2026, 0, 1)),
          completedDate: toSessionDate(new Date(2026, i, 15)),
          isActive: false,
        });
      }

      const years = await readingGoalRepository.getYearsWithCompletedBooks(null);

      expect(years).toHaveLength(1);
      expect(years[0].year).toBe(2026);
      expect(years[0].count).toBe(3);
    });
  });

  describe("getBooksCompletedByMonth()", () => {
    test("returns all 12 months with zero counts when no books completed", async () => {
      const monthlyData = await readingGoalRepository.getBooksCompletedByMonth(null, 2026);

      expect(monthlyData).toHaveLength(12);

      // Verify all months 1-12 are present
      for (let month = 1; month <= 12; month++) {
        const monthData = monthlyData.find(m => m.month === month);
        expect(monthData).toBeDefined();
        expect(monthData?.count).toBe(0);
      }
    });

    test("returns months in order (1-12)", async () => {
      const monthlyData = await readingGoalRepository.getBooksCompletedByMonth(null, 2026);

      expect(monthlyData).toHaveLength(12);

      // Verify months are in ascending order
      for (let i = 0; i < 12; i++) {
        expect(monthlyData[i].month).toBe(i + 1);
      }
    });

    test("returns correct counts per month with actual data", async () => {
      const { bookRepository, sessionRepository } = await import("@/lib/repositories");
      const year = 2026;

      // Complete 2 books in January, 3 in June, 1 in December
      const completions = [
        { month: 0, day: 15 }, // Jan
        { month: 0, day: 20 }, // Jan
        { month: 5, day: 10 }, // Jun
        { month: 5, day: 15 }, // Jun
        { month: 5, day: 25 }, // Jun
        { month: 11, day: 31 }, // Dec
      ];

      for (let i = 0; i < completions.length; i++) {
        const { month, day } = completions[i];
        const book = await bookRepository.create({
          calibreId: i + 1,
          path: `test/path/${i + 1}`,
          title: `Book ${i + 1}`,
          authors: ["Author"],
          totalPages: 300,
        });

        await sessionRepository.create({
          bookId: book.id,
          sessionNumber: 1,
          status: "read",
          startedDate: toSessionDate(new Date(year, 0, 1)),
          completedDate: toSessionDate(new Date(year, month, day)),
          isActive: false,
        });
      }

      const monthlyData = await readingGoalRepository.getBooksCompletedByMonth(null, year);

      expect(monthlyData[0].count).toBe(2); // January
      expect(monthlyData[1].count).toBe(0); // February
      expect(monthlyData[5].count).toBe(3); // June
      expect(monthlyData[11].count).toBe(1); // December
    });

    test("handles edge case: January 1st completion", async () => {
      const { bookRepository, sessionRepository } = await import("@/lib/repositories");
      const year = 2026;

      const book = await bookRepository.create({
        calibreId: 1,
        path: "test/path/1",
        title: "New Year Book",
        authors: ["Author"],
        totalPages: 300,
      });

      await sessionRepository.create({
        bookId: book.id,
        sessionNumber: 1,
        status: "read",
        startedDate: toSessionDate(new Date(year - 1, 11, 1)), // Started previous year
        completedDate: toSessionDate(new Date(year, 0, 1)), // Jan 1
        isActive: false,
      });

      const monthlyData = await readingGoalRepository.getBooksCompletedByMonth(null, year);

      expect(monthlyData[0].count).toBe(1); // January
    });

    test("handles edge case: December 31st completion", async () => {
      const { bookRepository, sessionRepository } = await import("@/lib/repositories");
      const year = 2026;

      const book = await bookRepository.create({
        calibreId: 1,
        path: "test/path/1",
        title: "Year End Book",
        authors: ["Author"],
        totalPages: 300,
      });

      await sessionRepository.create({
        bookId: book.id,
        sessionNumber: 1,
        status: "read",
        startedDate: toSessionDate(new Date(year, 11, 1)),
        completedDate: toSessionDate(new Date(year, 11, 31)), // Dec 31
        isActive: false,
      });

      const monthlyData = await readingGoalRepository.getBooksCompletedByMonth(null, year);

      expect(monthlyData[11].count).toBe(1); // December
    });

    test("does not include completions from other years", async () => {
      const { bookRepository, sessionRepository } = await import("@/lib/repositories");

      // Complete a book in 2025
      const book = await bookRepository.create({
        calibreId: 1,
        path: "test/path/1",
        title: "Last Year Book",
        authors: ["Author"],
        totalPages: 300,
      });

      await sessionRepository.create({
        bookId: book.id,
        sessionNumber: 1,
        status: "read",
        startedDate: toSessionDate(new Date(2025, 5, 1)),
        completedDate: toSessionDate(new Date(2025, 5, 15)),
        isActive: false,
      });

      const monthlyData = await readingGoalRepository.getBooksCompletedByMonth(null, 2026);

      // All months should be zero for 2026
      const totalCount = monthlyData.reduce((sum, m) => sum + m.count, 0);
      expect(totalCount).toBe(0);
    });
  });

  describe("getBooksByCompletionYear()", () => {
    test("returns books completed in specified year", async () => {
      const { bookRepository, sessionRepository } = await import("@/lib/repositories");
      const year = 2026;
      
      // Create books completed in target year
      const book1 = await bookRepository.create({
        calibreId: 1,
        path: "test/path/1",
        title: "Book 2026-1",
        authors: ["Author One"],
        totalPages: 300,
      });
      
      const book2 = await bookRepository.create({
        calibreId: 2,
        path: "test/path/2",
        title: "Book 2026-2",
        authors: ["Author Two"],
        totalPages: 400,
      });
      
      // Create completed sessions in target year
      await sessionRepository.create({
        bookId: book1.id,
        sessionNumber: 1,
        status: "read",
        startedDate: toSessionDate(new Date(year, 0, 1)),
        completedDate: toSessionDate(new Date(year, 5, 15)), // June 15, 2026
        isActive: false,
      });
      
      await sessionRepository.create({
        bookId: book2.id,
        sessionNumber: 1,
        status: "read",
        startedDate: toSessionDate(new Date(year, 0, 1)),
        completedDate: toSessionDate(new Date(year, 7, 20)), // August 20, 2026
        isActive: false,
      });
      
      const books = await readingGoalRepository.getBooksByCompletionYear(null, year);
      
      expect(books).toHaveLength(2);
      expect(books.some(b => b.title === "Book 2026-1")).toBe(true);
      expect(books.some(b => b.title === "Book 2026-2")).toBe(true);
    });

    test("returns books ordered by completion date descending", async () => {
      const { bookRepository, sessionRepository } = await import("@/lib/repositories");
      const year = 2026;
      
      // Create books with specific completion dates
      const book1 = await bookRepository.create({
        calibreId: 1,
        path: "test/path/1",
        title: "First Completed",
        authors: ["Author"],
        totalPages: 300,
      });
      
      const book2 = await bookRepository.create({
        calibreId: 2,
        path: "test/path/2",
        title: "Last Completed",
        authors: ["Author"],
        totalPages: 300,
      });
      
      const book3 = await bookRepository.create({
        calibreId: 3,
        path: "test/path/3",
        title: "Middle Completed",
        authors: ["Author"],
        totalPages: 300,
      });
      
      // Create sessions with different completion dates
      await sessionRepository.create({
        bookId: book1.id,
        sessionNumber: 1,
        status: "read",
        startedDate: toSessionDate(new Date(year, 0, 1)),
        completedDate: toSessionDate(new Date(year, 0, 15)), // January 15
        isActive: false,
      });
      
      await sessionRepository.create({
        bookId: book2.id,
        sessionNumber: 1,
        status: "read",
        startedDate: toSessionDate(new Date(year, 0, 1)),
        completedDate: toSessionDate(new Date(year, 11, 25)), // December 25
        isActive: false,
      });
      
      await sessionRepository.create({
        bookId: book3.id,
        sessionNumber: 1,
        status: "read",
        startedDate: toSessionDate(new Date(year, 0, 1)),
        completedDate: toSessionDate(new Date(year, 5, 10)), // June 10
        isActive: false,
      });
      
      const books = await readingGoalRepository.getBooksByCompletionYear(null, year);
      
      expect(books).toHaveLength(3);
      expect(books[0].title).toBe("Last Completed"); // December (most recent)
      expect(books[1].title).toBe("Middle Completed"); // June
      expect(books[2].title).toBe("First Completed"); // January (oldest)
    });

    test("includes completion dates in response", async () => {
      const { bookRepository, sessionRepository } = await import("@/lib/repositories");
      const year = 2026;
      const completionDate = toSessionDate(new Date(year, 6, 15));
      
      const book = await bookRepository.create({
        calibreId: 1,
        path: "test/path/1",
        title: "Test Book",
        authors: ["Author"],
        totalPages: 300,
      });
      
      await sessionRepository.create({
        bookId: book.id,
        sessionNumber: 1,
        status: "read",
        startedDate: toSessionDate(new Date(year, 6, 1)),
        completedDate: completionDate,
        isActive: false,
      });
      
      const books = await readingGoalRepository.getBooksByCompletionYear(null, year);
      
      expect(books).toHaveLength(1);
      expect(books[0].completedDate).toBeDefined();
      expect(books[0].completedDate).not.toBeNull();
      // Note: Dates from DB are Unix timestamps, so we compare the values
      expect(new Date(books[0].completedDate).getFullYear()).toBe(year);
    });

    test("returns empty array for year with no completions", async () => {
      const books = await readingGoalRepository.getBooksByCompletionYear(null, 2099);
      expect(books).toEqual([]);
    });

    test("handles books with multiple completion sessions in same year", async () => {
      const { bookRepository, sessionRepository } = await import("@/lib/repositories");
      const year = 2026;
      
      // Create a book that was read twice in the same year (re-read)
      const book = await bookRepository.create({
        calibreId: 1,
        path: "test/path/1",
        title: "Re-read Book",
        authors: ["Author"],
        totalPages: 300,
      });
      
      // First read in January
      await sessionRepository.create({
        bookId: book.id,
        sessionNumber: 1,
        status: "read",
        startedDate: toSessionDate(new Date(year, 0, 1)),
        completedDate: toSessionDate(new Date(year, 0, 31)), // January 31
        isActive: false,
      });
      
      // Second read (re-read) in October
      await sessionRepository.create({
        bookId: book.id,
        sessionNumber: 2,
        status: "read",
        startedDate: toSessionDate(new Date(year, 9, 1)),
        completedDate: toSessionDate(new Date(year, 9, 31)), // October 31
        isActive: false,
      });
      
      const books = await readingGoalRepository.getBooksByCompletionYear(null, year);
      
      // Should return both sessions as separate entries
      expect(books).toHaveLength(2);
      expect(books[0].title).toBe("Re-read Book");
      expect(books[1].title).toBe("Re-read Book");
      
      // Verify they have different completion dates (ordered descending)
      const date1 = new Date(books[0].completedDate).getTime();
      const date2 = new Date(books[1].completedDate).getTime();
      expect(date1).toBeGreaterThan(date2); // October > January
    });

    test("does not include books completed in other years", async () => {
      const { bookRepository, sessionRepository } = await import("@/lib/repositories");
      const targetYear = 2026;
      
      // Create book completed in target year
      const book2026 = await bookRepository.create({
        calibreId: 1,
        path: "test/path/1",
        title: "Book 2026",
        authors: ["Author"],
        totalPages: 300,
      });
      
      await sessionRepository.create({
        bookId: book2026.id,
        sessionNumber: 1,
        status: "read",
        startedDate: toSessionDate(new Date(targetYear, 0, 1)),
        completedDate: toSessionDate(new Date(targetYear, 6, 15)),
        isActive: false,
      });
      
      // Create books completed in other years
      const book2025 = await bookRepository.create({
        calibreId: 2,
        path: "test/path/2",
        title: "Book 2025",
        authors: ["Author"],
        totalPages: 300,
      });
      
      await sessionRepository.create({
        bookId: book2025.id,
        sessionNumber: 1,
        status: "read",
        startedDate: toSessionDate(new Date(2025, 0, 1)),
        completedDate: toSessionDate(new Date(2025, 11, 31)),
        isActive: false,
      });
      
      const book2027 = await bookRepository.create({
        calibreId: 3,
        path: "test/path/3",
        title: "Book 2027",
        authors: ["Author"],
        totalPages: 300,
      });
      
      await sessionRepository.create({
        bookId: book2027.id,
        sessionNumber: 1,
        status: "read",
        startedDate: toSessionDate(new Date(2027, 0, 1)),
        completedDate: toSessionDate(new Date(2027, 0, 15)),
        isActive: false,
      });
      
      const books = await readingGoalRepository.getBooksByCompletionYear(null, targetYear);
      
      expect(books).toHaveLength(1);
      expect(books[0].title).toBe("Book 2026");
    });

    test("includes all book fields in response", async () => {
      const { bookRepository, sessionRepository } = await import("@/lib/repositories");
      const year = 2026;
      
      const book = await bookRepository.create({
        calibreId: 1,
        path: "test/path/1",
        title: "Complete Book",
        authors: ["Author One", "Author Two"],
        totalPages: 450,
        isbn: "9781234567890",
        publisher: "Test Publisher",
        series: "Test Series",
        seriesIndex: 1.0,
        tags: ["fiction", "fantasy"],
      });
      
      await sessionRepository.create({
        bookId: book.id,
        sessionNumber: 1,
        status: "read",
        startedDate: toSessionDate(new Date(year, 0, 1)),
        completedDate: toSessionDate(new Date(year, 6, 15)),
        isActive: false,
      });
      
      const books = await readingGoalRepository.getBooksByCompletionYear(null, year);
      
      expect(books).toHaveLength(1);
      const returnedBook = books[0];
      
      expect(returnedBook.id).toBeDefined();
      expect(returnedBook.title).toBe("Complete Book");
      expect(returnedBook.authors).toEqual(["Author One", "Author Two"]);
      expect(returnedBook.totalPages).toBe(450);
      expect(returnedBook.isbn).toBe("9781234567890");
      expect(returnedBook.publisher).toBe("Test Publisher");
      expect(returnedBook.series).toBe("Test Series");
      expect(returnedBook.completedDate).toBeDefined();
    });
  });
});

// ---------------------------------------------------------------------------
// Malformed date defense tests
// ---------------------------------------------------------------------------
// These tests verify that the isValidDateFormat() GLOB guard in the
// reading-goals repository correctly rejects sessions whose completedDate
// is not a valid YYYY-MM-DD string.  Malformed values are injected via
// raw SQL to bypass ORM type-safety.
// ---------------------------------------------------------------------------

describe("Malformed date defense (isValidDateFormat guard)", () => {
  // --- Raw SQL helpers (bypass ORM type safety) ----------------------------

  function insertBook(title: string, calibreId: number): number {
    const rawDb = testDb.sqlite;
    rawDb
      .prepare(
        `INSERT INTO books (title, calibre_id, authors, tags, path, orphaned)
         VALUES (?, ?, '[]', '[]', '/test', 0)`
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
    const rawDb = testDb.sqlite;
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

  // --- getBooksCompletedInYear() -------------------------------------------

  describe("getBooksCompletedInYear()", () => {
    test("should not count sessions with malformed completedDate", async () => {
      const bookId = insertBook("Malformed Date Book", 900);

      let sessionNum = 1;
      for (const badDate of MALFORMED_DATES) {
        insertSession({
          bookId,
          status: "read",
          completedDate: badDate,
          sessionNumber: sessionNum++,
        });
      }

      // Insert one valid session to confirm valid dates ARE counted
      insertSession({
        bookId,
        status: "read",
        completedDate: "2026-07-15",
        sessionNumber: sessionNum,
      });

      const count = await readingGoalRepository.getBooksCompletedInYear(null, 2026);
      expect(count).toBe(1); // Only the valid date should count
    });
  });

  // --- getYearsWithCompletedBooks() ----------------------------------------

  describe("getYearsWithCompletedBooks()", () => {
    test("should not include years derived from malformed dates", async () => {
      const bookId = insertBook("Malformed Years Book", 901);

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
        completedDate: "2025-12-01",
        sessionNumber: sessionNum,
      });

      const years = await readingGoalRepository.getYearsWithCompletedBooks(null);
      expect(years).toHaveLength(1);
      expect(years[0].year).toBe(2025);
      expect(years[0].count).toBe(1);
    });
  });

  // --- getBooksCompletedByMonth() ------------------------------------------

  describe("getBooksCompletedByMonth()", () => {
    test("should not count malformed dates in monthly breakdown", async () => {
      const bookId = insertBook("Malformed Monthly Book", 902);

      let sessionNum = 1;
      for (const badDate of MALFORMED_DATES) {
        insertSession({
          bookId,
          status: "read",
          completedDate: badDate,
          sessionNumber: sessionNum++,
        });
      }

      // Insert one valid session in March 2026
      insertSession({
        bookId,
        status: "read",
        completedDate: "2026-03-20",
        sessionNumber: sessionNum,
      });

      const months = await readingGoalRepository.getBooksCompletedByMonth(null, 2026);

      // Should return all 12 months
      expect(months).toHaveLength(12);

      // Only March should have count 1
      const march = months.find((m) => m.month === 3);
      expect(march?.count).toBe(1);

      // All other months should be 0
      const totalCount = months.reduce((sum, m) => sum + m.count, 0);
      expect(totalCount).toBe(1);
    });
  });

  // --- getBooksByCompletionYear() ------------------------------------------

  describe("getBooksByCompletionYear()", () => {
    test("should not return books with malformed completedDate", async () => {
      const bookId = insertBook("Malformed Completion Book", 903);

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
        completedDate: "2026-05-10",
        sessionNumber: sessionNum,
      });

      const resultBooks = await readingGoalRepository.getBooksByCompletionYear(null, 2026);
      expect(resultBooks).toHaveLength(1);
      expect(resultBooks[0].title).toBe("Malformed Completion Book");
      expect(resultBooks[0].completedDate).toBe("2026-05-10");
    });
  });
});
