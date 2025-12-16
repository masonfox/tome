import { describe, test, expect, beforeAll, afterAll, beforeEach } from "bun:test";
import { setupTestDatabase, teardownTestDatabase, clearTestDatabase } from "../helpers/db-setup";
import { bookRepository, sessionRepository, progressRepository } from "@/lib/repositories";
import { journalService } from "@/lib/services/journal.service";

/**
 * Journal Service Tests
 * 
 * Tests the core business logic for the journal feature:
 * - Progress log fetching with pagination
 * - Date grouping (YYYY-MM-DD extraction from ISO timestamps)
 * - Multi-level grouping (date → book → entries)
 * - Sorting (dates descending, entries within books descending)
 * - Archive metadata generation (year/month/week hierarchy)
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

describe("JournalService", () => {
  describe("getJournalEntries", () => {
    describe("date grouping", () => {
      test("should group entries by UTC date (YYYY-MM-DD)", async () => {
        // Arrange: Create book and session
        const book = await bookRepository.create({
          calibreId: 1,
          title: "Test Book",
          authors: ["Test Author"],
          tags: [],
          path: "Test Author/Test Book (1)",
        });

        const session = await sessionRepository.create({
          bookId: book.id,
          sessionNumber: 1,
          status: "reading",
          isActive: true,
        });

        // Create progress on two different dates
        await progressRepository.create({
          bookId: book.id,
          sessionId: session.id,
          currentPage: 50,
          currentPercentage: 50,
          pagesRead: 50,
          progressDate: new Date("2024-11-15T10:30:00.000Z"),
        });

        await progressRepository.create({
          bookId: book.id,
          sessionId: session.id,
          currentPage: 100,
          currentPercentage: 100,
          pagesRead: 50,
          progressDate: new Date("2024-11-16T14:45:00.000Z"),
        });

        // Act
        const result = await journalService.getJournalEntries("America/New_York", 50, 0);

        // Assert: Should have 2 date groups
        expect(result.entries).toHaveLength(2);
        expect(result.entries[0].date).toBe("2024-11-16"); // Most recent first
        expect(result.entries[1].date).toBe("2024-11-15");
      });

      test("should group multiple entries on same date together", async () => {
        // Arrange: Create book with multiple progress logs on same day
        const book = await bookRepository.create({
          calibreId: 1,
          title: "Test Book",
          authors: ["Test Author"],
          tags: [],
          path: "Test Author/Test Book (1)",
        });

        const session = await sessionRepository.create({
          bookId: book.id,
          sessionNumber: 1,
          status: "reading",
          isActive: true,
        });

        // Morning progress
        await progressRepository.create({
          bookId: book.id,
          sessionId: session.id,
          currentPage: 25,
          currentPercentage: 25,
          pagesRead: 25,
          progressDate: new Date("2024-11-15T08:00:00.000Z"),
        });

        // Evening progress (same date)
        await progressRepository.create({
          bookId: book.id,
          sessionId: session.id,
          currentPage: 75,
          currentPercentage: 75,
          pagesRead: 50,
          progressDate: new Date("2024-11-15T20:00:00.000Z"),
        });

        // Act
        const result = await journalService.getJournalEntries("America/New_York", 50, 0);

        // Assert: Should have 1 date group with 2 entries
        expect(result.entries).toHaveLength(1);
        expect(result.entries[0].date).toBe("2024-11-15");
        expect(result.entries[0].books).toHaveLength(1);
        expect(result.entries[0].books[0].entries).toHaveLength(2);
      });

      test("should handle entries across month boundaries", async () => {
        // Arrange: Create progress on Jan 31 and Feb 1
        const book = await bookRepository.create({
          calibreId: 1,
          title: "Test Book",
          authors: ["Test Author"],
          tags: [],
          path: "Test Author/Test Book (1)",
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
          progressDate: new Date("2024-01-31T23:00:00.000Z"),
        });

        await progressRepository.create({
          bookId: book.id,
          sessionId: session.id,
          currentPage: 100,
          currentPercentage: 100,
          pagesRead: 50,
          progressDate: new Date("2024-02-01T01:00:00.000Z"),
        });

        // Act
        const result = await journalService.getJournalEntries("America/New_York", 50, 0);

        // Assert: Should be grouped into separate dates
        expect(result.entries).toHaveLength(2);
        expect(result.entries[0].date).toBe("2024-02-01");
        expect(result.entries[1].date).toBe("2024-01-31");
      });

      test("should handle entries across year boundaries", async () => {
        // Arrange: Create progress on Dec 31 and Jan 1
        const book = await bookRepository.create({
          calibreId: 1,
          title: "Test Book",
          authors: ["Test Author"],
          tags: [],
          path: "Test Author/Test Book (1)",
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
          progressDate: new Date("2023-12-31T23:00:00.000Z"),
        });

        await progressRepository.create({
          bookId: book.id,
          sessionId: session.id,
          currentPage: 100,
          currentPercentage: 100,
          pagesRead: 50,
          progressDate: new Date("2024-01-01T01:00:00.000Z"),
        });

        // Act
        const result = await journalService.getJournalEntries("America/New_York", 50, 0);

        // Assert: Should be grouped into separate dates across years
        expect(result.entries).toHaveLength(2);
        expect(result.entries[0].date).toBe("2024-01-01");
        expect(result.entries[1].date).toBe("2023-12-31");
      });

      test("should handle leap year dates (Feb 29)", async () => {
        // Arrange: Create progress on Feb 29, 2024 (leap year)
        const book = await bookRepository.create({
          calibreId: 1,
          title: "Test Book",
          authors: ["Test Author"],
          tags: [],
          path: "Test Author/Test Book (1)",
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
          currentPage: 100,
          currentPercentage: 100,
          pagesRead: 100,
          progressDate: new Date("2024-02-29T12:00:00.000Z"),
        });

        // Act
        const result = await journalService.getJournalEntries("America/New_York", 50, 0);

        // Assert: Should correctly handle leap year date
        expect(result.entries).toHaveLength(1);
        expect(result.entries[0].date).toBe("2024-02-29");
      });
    });

    describe("book grouping", () => {
      test("should group entries by book within same date", async () => {
        // Arrange: Create two books with progress on same date
        const book1 = await bookRepository.create({
          calibreId: 1,
          title: "Book 1",
          authors: ["Author 1"],
          tags: [],
          path: "Author 1/Book 1 (1)",
        });

        const book2 = await bookRepository.create({
          calibreId: 2,
          title: "Book 2",
          authors: ["Author 2"],
          tags: [],
          path: "Author 2/Book 2 (2)",
        });

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

        // Both books have progress on same date
        await progressRepository.create({
          bookId: book1.id,
          sessionId: session1.id,
          currentPage: 50,
          currentPercentage: 50,
          pagesRead: 50,
          progressDate: new Date("2024-11-15T10:00:00.000Z"),
        });

        await progressRepository.create({
          bookId: book2.id,
          sessionId: session2.id,
          currentPage: 75,
          currentPercentage: 75,
          pagesRead: 75,
          progressDate: new Date("2024-11-15T14:00:00.000Z"),
        });

        // Act
        const result = await journalService.getJournalEntries("America/New_York", 50, 0);

        // Assert: Should have 1 date with 2 books
        expect(result.entries).toHaveLength(1);
        expect(result.entries[0].date).toBe("2024-11-15");
        expect(result.entries[0].books).toHaveLength(2);
        expect(result.entries[0].books[0].bookTitle).toBeDefined();
        expect(result.entries[0].books[1].bookTitle).toBeDefined();
      });

      test("should handle multiple entries for same book on same date", async () => {
        // Arrange: Create book with multiple progress logs on same day
        const book = await bookRepository.create({
          calibreId: 1,
          title: "Test Book",
          authors: ["Test Author"],
          tags: [],
          path: "Test Author/Test Book (1)",
        });

        const session = await sessionRepository.create({
          bookId: book.id,
          sessionNumber: 1,
          status: "reading",
          isActive: true,
        });

        // Create 3 progress entries on same date
        await progressRepository.create({
          bookId: book.id,
          sessionId: session.id,
          currentPage: 25,
          currentPercentage: 25,
          pagesRead: 25,
          progressDate: new Date("2024-11-15T08:00:00.000Z"),
        });

        await progressRepository.create({
          bookId: book.id,
          sessionId: session.id,
          currentPage: 50,
          currentPercentage: 50,
          pagesRead: 25,
          progressDate: new Date("2024-11-15T12:00:00.000Z"),
        });

        await progressRepository.create({
          bookId: book.id,
          sessionId: session.id,
          currentPage: 75,
          currentPercentage: 75,
          pagesRead: 25,
          progressDate: new Date("2024-11-15T18:00:00.000Z"),
        });

        // Act
        const result = await journalService.getJournalEntries("America/New_York", 50, 0);

        // Assert: Should have 1 date, 1 book, 3 entries
        expect(result.entries).toHaveLength(1);
        expect(result.entries[0].books).toHaveLength(1);
        expect(result.entries[0].books[0].entries).toHaveLength(3);
      });
    });

    describe("sorting", () => {
      test("should sort dates in descending order (most recent first)", async () => {
        // Arrange: Create progress across multiple dates
        const book = await bookRepository.create({
          calibreId: 1,
          title: "Test Book",
          authors: ["Test Author"],
          tags: [],
          path: "Test Author/Test Book (1)",
        });

        const session = await sessionRepository.create({
          bookId: book.id,
          sessionNumber: 1,
          status: "reading",
          isActive: true,
        });

        // Create in random order
        await progressRepository.create({
          bookId: book.id,
          sessionId: session.id,
          currentPage: 25,
          currentPercentage: 25,
          pagesRead: 25,
          progressDate: new Date("2024-11-13T10:00:00.000Z"),
        });

        await progressRepository.create({
          bookId: book.id,
          sessionId: session.id,
          currentPage: 75,
          currentPercentage: 75,
          pagesRead: 25,
          progressDate: new Date("2024-11-15T10:00:00.000Z"),
        });

        await progressRepository.create({
          bookId: book.id,
          sessionId: session.id,
          currentPage: 50,
          currentPercentage: 50,
          pagesRead: 25,
          progressDate: new Date("2024-11-14T10:00:00.000Z"),
        });

        // Act
        const result = await journalService.getJournalEntries("America/New_York", 50, 0);

        // Assert: Dates should be sorted descending
        expect(result.entries).toHaveLength(3);
        expect(result.entries[0].date).toBe("2024-11-15");
        expect(result.entries[1].date).toBe("2024-11-14");
        expect(result.entries[2].date).toBe("2024-11-13");
      });

      test("should sort entries within same book by timestamp descending", async () => {
        // Arrange: Create multiple entries for same book on same date
        const book = await bookRepository.create({
          calibreId: 1,
          title: "Test Book",
          authors: ["Test Author"],
          tags: [],
          path: "Test Author/Test Book (1)",
        });

        const session = await sessionRepository.create({
          bookId: book.id,
          sessionNumber: 1,
          status: "reading",
          isActive: true,
        });

        // Morning
        await progressRepository.create({
          bookId: book.id,
          sessionId: session.id,
          currentPage: 25,
          currentPercentage: 25,
          pagesRead: 25,
          progressDate: new Date("2024-11-15T08:00:00.000Z"),
        });

        // Evening
        await progressRepository.create({
          bookId: book.id,
          sessionId: session.id,
          currentPage: 75,
          currentPercentage: 75,
          pagesRead: 50,
          progressDate: new Date("2024-11-15T20:00:00.000Z"),
        });

        // Afternoon
        await progressRepository.create({
          bookId: book.id,
          sessionId: session.id,
          currentPage: 50,
          currentPercentage: 50,
          pagesRead: 25,
          progressDate: new Date("2024-11-15T14:00:00.000Z"),
        });

        // Act
        const result = await journalService.getJournalEntries("America/New_York", 50, 0);

        // Assert: Entries should be sorted descending by time
        const entries = result.entries[0].books[0].entries;
        expect(entries).toHaveLength(3);
        expect(entries[0].currentPage).toBe(75); // Evening (most recent)
        expect(entries[1].currentPage).toBe(50); // Afternoon
        expect(entries[2].currentPage).toBe(25); // Morning
      });
    });

    describe("pagination", () => {
      test("should respect limit parameter", async () => {
        // Arrange: Create 10 progress entries
        const book = await bookRepository.create({
          calibreId: 1,
          title: "Test Book",
          authors: ["Test Author"],
          tags: [],
          path: "Test Author/Test Book (1)",
        });

        const session = await sessionRepository.create({
          bookId: book.id,
          sessionNumber: 1,
          status: "reading",
          isActive: true,
        });

        for (let i = 0; i < 10; i++) {
          await progressRepository.create({
            bookId: book.id,
            sessionId: session.id,
            currentPage: (i + 1) * 10,
            currentPercentage: (i + 1) * 10,
            pagesRead: 10,
            progressDate: new Date(`2024-11-${15 + i}T10:00:00.000Z`),
          });
        }

        // Act: Request only 3 entries
        const result = await journalService.getJournalEntries("America/New_York", 3, 0);

        // Assert: Should return only 3 most recent entries
        expect(result.entries.length).toBeLessThanOrEqual(3);
        expect(result.total).toBe(10);
        expect(result.hasMore).toBe(true);
      });

      test("should handle skip parameter for pagination", async () => {
        // Arrange: Create 5 progress entries
        const book = await bookRepository.create({
          calibreId: 1,
          title: "Test Book",
          authors: ["Test Author"],
          tags: [],
          path: "Test Author/Test Book (1)",
        });

        const session = await sessionRepository.create({
          bookId: book.id,
          sessionNumber: 1,
          status: "reading",
          isActive: true,
        });

        for (let i = 0; i < 5; i++) {
          await progressRepository.create({
            bookId: book.id,
            sessionId: session.id,
            currentPage: (i + 1) * 20,
            currentPercentage: (i + 1) * 20,
            pagesRead: 20,
            progressDate: new Date(`2024-11-${10 + i}T10:00:00.000Z`),
          });
        }

        // Act: Skip first 2, get next 2
        const result = await journalService.getJournalEntries("America/New_York", 2, 2);

        // Assert: Should skip 2 most recent and return next 2
        expect(result.entries.length).toBeLessThanOrEqual(2);
        expect(result.total).toBe(5);
        expect(result.hasMore).toBe(true);
      });

      test("should calculate hasMore=false on last page", async () => {
        // Arrange: Create exactly 5 entries
        const book = await bookRepository.create({
          calibreId: 1,
          title: "Test Book",
          authors: ["Test Author"],
          tags: [],
          path: "Test Author/Test Book (1)",
        });

        const session = await sessionRepository.create({
          bookId: book.id,
          sessionNumber: 1,
          status: "reading",
          isActive: true,
        });

        for (let i = 0; i < 5; i++) {
          await progressRepository.create({
            bookId: book.id,
            sessionId: session.id,
            currentPage: (i + 1) * 20,
            currentPercentage: (i + 1) * 20,
            pagesRead: 20,
            progressDate: new Date(`2024-11-${10 + i}T10:00:00.000Z`),
          });
        }

        // Act: Request all 5
        const result = await journalService.getJournalEntries("America/New_York", 50, 0);

        // Assert: hasMore should be false
        expect(result.total).toBe(5);
        expect(result.hasMore).toBe(false);
      });

      test("should handle skip > total gracefully", async () => {
        // Arrange: Create 3 entries
        const book = await bookRepository.create({
          calibreId: 1,
          title: "Test Book",
          authors: ["Test Author"],
          tags: [],
          path: "Test Author/Test Book (1)",
        });

        const session = await sessionRepository.create({
          bookId: book.id,
          sessionNumber: 1,
          status: "reading",
          isActive: true,
        });

        for (let i = 0; i < 3; i++) {
          await progressRepository.create({
            bookId: book.id,
            sessionId: session.id,
            currentPage: (i + 1) * 20,
            currentPercentage: (i + 1) * 20,
            pagesRead: 20,
            progressDate: new Date(`2024-11-${10 + i}T10:00:00.000Z`),
          });
        }

        // Act: Skip 10 (more than total)
        const result = await journalService.getJournalEntries("America/New_York", 50, 10);

        // Assert: Should return empty results
        expect(result.entries).toHaveLength(0);
        expect(result.total).toBe(3);
        expect(result.hasMore).toBe(false);
      });

      test("should handle limit=0", async () => {
        // Arrange: Create some entries
        const book = await bookRepository.create({
          calibreId: 1,
          title: "Test Book",
          authors: ["Test Author"],
          tags: [],
          path: "Test Author/Test Book (1)",
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
          progressDate: new Date("2024-11-15T10:00:00.000Z"),
        });

        // Act: Request with limit=0
        const result = await journalService.getJournalEntries("America/New_York", 0, 0);

        // Assert: Should return empty results
        expect(result.entries).toHaveLength(0);
        expect(result.total).toBe(1);
      });
    });

    describe("empty results", () => {
      test("should return empty array when no progress logs exist", async () => {
        // Act: No data in database
        const result = await journalService.getJournalEntries("America/New_York", 50, 0);

        // Assert
        expect(result.entries).toHaveLength(0);
        expect(result.total).toBe(0);
        expect(result.hasMore).toBe(false);
      });

      test("should handle book with no progress logs", async () => {
        // Arrange: Create book and session but no progress
        const book = await bookRepository.create({
          calibreId: 1,
          title: "Test Book",
          authors: ["Test Author"],
          tags: [],
          path: "Test Author/Test Book (1)",
        });

        await sessionRepository.create({
          bookId: book.id,
          sessionNumber: 1,
          status: "to-read",
          isActive: true,
        });

        // Act
        const result = await journalService.getJournalEntries("America/New_York", 50, 0);

        // Assert: No progress logs = no journal entries
        expect(result.entries).toHaveLength(0);
        expect(result.total).toBe(0);
      });
    });

    describe("edge cases", () => {
      test("should handle entries with identical timestamps", async () => {
        // Arrange: Create entries with exact same timestamp
        const book = await bookRepository.create({
          calibreId: 1,
          title: "Test Book",
          authors: ["Test Author"],
          tags: [],
          path: "Test Author/Test Book (1)",
        });

        const session = await sessionRepository.create({
          bookId: book.id,
          sessionNumber: 1,
          status: "reading",
          isActive: true,
        });

        const sameTimestamp = new Date("2024-11-15T10:00:00.000Z");

        await progressRepository.create({
          bookId: book.id,
          sessionId: session.id,
          currentPage: 50,
          currentPercentage: 50,
          pagesRead: 50,
          progressDate: sameTimestamp,
        });

        await progressRepository.create({
          bookId: book.id,
          sessionId: session.id,
          currentPage: 75,
          currentPercentage: 75,
          pagesRead: 25,
          progressDate: sameTimestamp,
        });

        // Act
        const result = await journalService.getJournalEntries("America/New_York", 50, 0);

        // Assert: Should handle gracefully (both grouped on same date)
        expect(result.entries).toHaveLength(1);
        expect(result.entries[0].books[0].entries).toHaveLength(2);
      });

      test("should handle midnight boundary (23:59 → 00:01)", async () => {
        // Arrange: Create progress just before and after midnight
        const book = await bookRepository.create({
          calibreId: 1,
          title: "Test Book",
          authors: ["Test Author"],
          tags: [],
          path: "Test Author/Test Book (1)",
        });

        const session = await sessionRepository.create({
          bookId: book.id,
          sessionNumber: 1,
          status: "reading",
          isActive: true,
        });

        // 23:59:59 on Nov 15
        await progressRepository.create({
          bookId: book.id,
          sessionId: session.id,
          currentPage: 50,
          currentPercentage: 50,
          pagesRead: 50,
          progressDate: new Date("2024-11-15T23:59:59.000Z"),
        });

        // 00:01:00 on Nov 16
        await progressRepository.create({
          bookId: book.id,
          sessionId: session.id,
          currentPage: 75,
          currentPercentage: 75,
          pagesRead: 25,
          progressDate: new Date("2024-11-16T00:01:00.000Z"),
        });

        // Act
        const result = await journalService.getJournalEntries("America/New_York", 50, 0);

        // Assert: Should be on different dates
        expect(result.entries).toHaveLength(2);
        expect(result.entries[0].date).toBe("2024-11-16");
        expect(result.entries[1].date).toBe("2024-11-15");
      });
    });
  });

  describe("getArchiveMetadata", () => {
    test("should return empty array when no progress logs exist", async () => {
      // Act
      const result = await journalService.getArchiveMetadata();

      // Assert
      expect(result).toHaveLength(0);
    });

    test("should build year/month/week hierarchy", async () => {
      // Arrange: Create progress spanning multiple months
      const book = await bookRepository.create({
        calibreId: 1,
        title: "Test Book",
        authors: ["Test Author"],
        tags: [],
        path: "Test Author/Test Book (1)",
      });

      const session = await sessionRepository.create({
        bookId: book.id,
        sessionNumber: 1,
        status: "reading",
        isActive: true,
      });

      // November entries
      await progressRepository.create({
        bookId: book.id,
        sessionId: session.id,
        currentPage: 50,
        currentPercentage: 50,
        pagesRead: 50,
        progressDate: new Date("2024-11-15T10:00:00.000Z"),
      });

      // December entries
      await progressRepository.create({
        bookId: book.id,
        sessionId: session.id,
        currentPage: 100,
        currentPercentage: 100,
        pagesRead: 50,
        progressDate: new Date("2024-12-10T10:00:00.000Z"),
      });

      // Act
      const result = await journalService.getArchiveMetadata();

      // Assert: Should have 1 year with 2 months
      expect(result).toHaveLength(1);
      expect(result[0].type).toBe("year");
      expect(result[0].label).toBe("2024");
      expect(result[0].children).toHaveLength(2);
      expect(result[0].children![0].type).toBe("month");
      expect(result[0].children![1].type).toBe("month");
    });

    test("should count entries correctly at each level", async () => {
      // Arrange: Create multiple entries in same month
      const book = await bookRepository.create({
        calibreId: 1,
        title: "Test Book",
        authors: ["Test Author"],
        tags: [],
        path: "Test Author/Test Book (1)",
      });

      const session = await sessionRepository.create({
        bookId: book.id,
        sessionNumber: 1,
        status: "reading",
        isActive: true,
      });

      // Create 3 entries in November
      for (let i = 0; i < 3; i++) {
        await progressRepository.create({
          bookId: book.id,
          sessionId: session.id,
          currentPage: (i + 1) * 30,
          currentPercentage: (i + 1) * 30,
          pagesRead: 30,
          progressDate: new Date(`2024-11-${10 + i}T10:00:00.000Z`),
        });
      }

      // Act
      const result = await journalService.getArchiveMetadata();

      // Assert: Counts should be accurate
      expect(result[0].count).toBe(3); // Year count
      expect(result[0].children![0].count).toBe(3); // Month count
    });

    test("should handle entries spanning multiple years", async () => {
      // Arrange: Create entries in 2023 and 2024
      const book = await bookRepository.create({
        calibreId: 1,
        title: "Test Book",
        authors: ["Test Author"],
        tags: [],
        path: "Test Author/Test Book (1)",
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
        progressDate: new Date("2023-12-15T10:00:00.000Z"),
      });

      await progressRepository.create({
        bookId: book.id,
        sessionId: session.id,
        currentPage: 100,
        currentPercentage: 100,
        pagesRead: 50,
        progressDate: new Date("2024-01-15T10:00:00.000Z"),
      });

      // Act
      const result = await journalService.getArchiveMetadata();

      // Assert: Should have 2 years
      expect(result).toHaveLength(2);
      expect(result[0].label).toBe("2024"); // Most recent first
      expect(result[1].label).toBe("2023");
    });

    test("should sort hierarchy in descending order", async () => {
      // Arrange: Create entries in random order
      const book = await bookRepository.create({
        calibreId: 1,
        title: "Test Book",
        authors: ["Test Author"],
        tags: [],
        path: "Test Author/Test Book (1)",
      });

      const session = await sessionRepository.create({
        bookId: book.id,
        sessionNumber: 1,
        status: "reading",
        isActive: true,
      });

      // Create in random month order
      await progressRepository.create({
        bookId: book.id,
        sessionId: session.id,
        currentPage: 33,
        currentPercentage: 33,
        pagesRead: 33,
        progressDate: new Date("2024-03-15T10:00:00.000Z"),
      });

      await progressRepository.create({
        bookId: book.id,
        sessionId: session.id,
        currentPage: 66,
        currentPercentage: 66,
        pagesRead: 33,
        progressDate: new Date("2024-01-15T10:00:00.000Z"),
      });

      await progressRepository.create({
        bookId: book.id,
        sessionId: session.id,
        currentPage: 100,
        currentPercentage: 100,
        pagesRead: 34,
        progressDate: new Date("2024-02-15T10:00:00.000Z"),
      });

      // Act
      const result = await journalService.getArchiveMetadata();

      // Assert: Months should be sorted descending (March, Feb, Jan)
      const months = result[0].children!;
      expect(months[0].dateKey).toBe("2024-03");
      expect(months[1].dateKey).toBe("2024-02");
      expect(months[2].dateKey).toBe("2024-01");
    });
  });
});
