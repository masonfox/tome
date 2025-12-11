import { describe, test, expect, beforeAll, afterAll, afterEach } from "bun:test";
import { readingGoalRepository } from "@/lib/repositories";
import { setupTestDatabase, teardownTestDatabase, clearTestDatabase } from "../helpers/db-setup";
import type { TestDatabaseInstance } from "../helpers/db-setup";

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
      expect(
        readingGoalRepository.create({
          userId: null,
          year: 2026,
          booksGoal: 50,
        })
      ).rejects.toThrow();
    });

    test("enforces minimum goal constraint", async () => {
      expect(
        readingGoalRepository.create({
          userId: null,
          year: 2026,
          booksGoal: 0,
        })
      ).rejects.toThrow();
    });

    test("enforces year range constraint", async () => {
      expect(
        readingGoalRepository.create({
          userId: null,
          year: 1899,
          booksGoal: 40,
        })
      ).rejects.toThrow();

      expect(
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

    // Note: Testing with actual book data would require setting up books and sessions
    // This would be done in integration tests
  });

  describe("getYearsWithCompletedBooks()", () => {
    test("returns empty array when no books completed", async () => {
      const years = await readingGoalRepository.getYearsWithCompletedBooks(null);
      expect(years).toEqual([]);
    });

    // Note: Testing with actual book data would require setting up books and sessions
    // This would be done in integration tests
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

    // Note: Testing with actual book completion data would require setting up
    // books and sessions with specific completion dates
    // This would be done in integration tests
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
        startedDate: new Date(year, 0, 1),
        completedDate: new Date(year, 5, 15), // June 15, 2026
        isActive: false,
      });
      
      await sessionRepository.create({
        bookId: book2.id,
        sessionNumber: 1,
        status: "read",
        startedDate: new Date(year, 0, 1),
        completedDate: new Date(year, 7, 20), // August 20, 2026
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
        startedDate: new Date(year, 0, 1),
        completedDate: new Date(year, 0, 15), // January 15
        isActive: false,
      });
      
      await sessionRepository.create({
        bookId: book2.id,
        sessionNumber: 1,
        status: "read",
        startedDate: new Date(year, 0, 1),
        completedDate: new Date(year, 11, 25), // December 25
        isActive: false,
      });
      
      await sessionRepository.create({
        bookId: book3.id,
        sessionNumber: 1,
        status: "read",
        startedDate: new Date(year, 0, 1),
        completedDate: new Date(year, 5, 10), // June 10
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
      const completionDate = new Date(year, 6, 15);
      
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
        startedDate: new Date(year, 6, 1),
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
        startedDate: new Date(year, 0, 1),
        completedDate: new Date(year, 0, 31), // January 31
        isActive: false,
      });
      
      // Second read (re-read) in October
      await sessionRepository.create({
        bookId: book.id,
        sessionNumber: 2,
        status: "read",
        startedDate: new Date(year, 9, 1),
        completedDate: new Date(year, 9, 31), // October 31
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
        startedDate: new Date(targetYear, 0, 1),
        completedDate: new Date(targetYear, 6, 15),
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
        startedDate: new Date(2025, 0, 1),
        completedDate: new Date(2025, 11, 31),
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
        startedDate: new Date(2027, 0, 1),
        completedDate: new Date(2027, 0, 15),
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
        startedDate: new Date(year, 0, 1),
        completedDate: new Date(year, 6, 15),
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
