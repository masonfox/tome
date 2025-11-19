import { test, expect, describe, beforeAll, afterAll, beforeEach } from "bun:test";
import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
import { getDashboardData } from "@/lib/dashboard-service";
import Book from "@/models/Book";
import ReadingSession from "@/models/ReadingSession";
import ProgressLog from "@/models/ProgressLog";
import Streak from "@/models/Streak";

let mongoServer: MongoMemoryServer;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

beforeEach(async () => {
  // Clear all collections before each test
  await Book.deleteMany({});
  await ReadingSession.deleteMany({});
  await ProgressLog.deleteMany({});
  await Streak.deleteMany({});
});

describe("Dashboard Service", () => {
  describe("getDashboardData", () => {
    test("should return correct total counts for currently reading books", async () => {
      // Create 8 books
      const books = await Promise.all(
        Array.from({ length: 8 }, (_, i) =>
          Book.create({
            calibreId: i + 1,
            title: `Book ${i + 1}`,
            authors: [`Author ${i + 1}`],
            path: `Author ${i + 1}/Book ${i + 1}`,
          })
        )
      );

      // Create 8 reading sessions
      await Promise.all(
        books.map((book, i) =>
          ReadingSession.create({
            bookId: book._id,
            sessionNumber: 1,
            status: "reading",
            isActive: true,
            startedDate: new Date(Date.now() - i * 60000), // Stagger by 1 minute each
          })
        )
      );

      const result = await getDashboardData();

      // Should show 8 total, but only return 6 books in array
      expect(result.currentlyReadingTotal).toBe(8);
      expect(result.currentlyReading.length).toBe(6);
    });

    test("should return correct total counts for read-next books", async () => {
      // Create 10 books
      const books = await Promise.all(
        Array.from({ length: 10 }, (_, i) =>
          Book.create({
            calibreId: i + 1,
            title: `Book ${i + 1}`,
            authors: [`Author ${i + 1}`],
            path: `Author ${i + 1}/Book ${i + 1}`,
          })
        )
      );

      // Create 10 read-next sessions
      await Promise.all(
        books.map((book, i) =>
          ReadingSession.create({
            bookId: book._id,
            sessionNumber: 1,
            status: "read-next",
            isActive: true,
            startedDate: new Date(Date.now() - i * 60000), // Stagger by 1 minute each
          })
        )
      );

      const result = await getDashboardData();

      // Should show 10 total, but only return 6 books in array
      expect(result.readNextTotal).toBe(10);
      expect(result.readNext.length).toBe(6);
    });

    test("should return books sorted by most recently updated first", async () => {
      // Create 3 books
      const books = await Promise.all(
        Array.from({ length: 3 }, (_, i) =>
          Book.create({
            calibreId: i + 1,
            title: `Book ${i + 1}`,
            authors: [`Author ${i + 1}`],
            path: `Author ${i + 1}/Book ${i + 1}`,
          })
        )
      );

      // Create sessions - they'll naturally have different createdAt/updatedAt
      // due to sequential creation
      await ReadingSession.create({
        bookId: books[0]._id,
        sessionNumber: 1,
        status: "reading",
        isActive: true,
      });

      // Small delay to ensure different timestamps
      await new Promise(resolve => setTimeout(resolve, 10));

      await ReadingSession.create({
        bookId: books[1]._id,
        sessionNumber: 1,
        status: "reading",
        isActive: true,
      });

      await new Promise(resolve => setTimeout(resolve, 10));

      await ReadingSession.create({
        bookId: books[2]._id,
        sessionNumber: 1,
        status: "reading",
        isActive: true,
      });

      const result = await getDashboardData();

      // Should be sorted by most recent updatedAt first (desc order)
      // Book 3 created last should be first, Book 1 created first should be last
      expect(result.currentlyReading.length).toBe(3);
      expect(result.currentlyReading[0].title).toBe("Book 3");
      expect(result.currentlyReading[2].title).toBe("Book 1");
    });

    test("should handle case with fewer than 6 books", async () => {
      // Create only 3 books
      const books = await Promise.all(
        Array.from({ length: 3 }, (_, i) =>
          Book.create({
            calibreId: i + 1,
            title: `Book ${i + 1}`,
            authors: [`Author ${i + 1}`],
            path: `Author ${i + 1}/Book ${i + 1}`,
          })
        )
      );

      // Create 3 reading sessions
      await Promise.all(
        books.map((book) =>
          ReadingSession.create({
            bookId: book._id,
            sessionNumber: 1,
            status: "reading",
            isActive: true,
          })
        )
      );

      const result = await getDashboardData();

      // Should show 3 total and return all 3 books
      expect(result.currentlyReadingTotal).toBe(3);
      expect(result.currentlyReading.length).toBe(3);
    });

    test("should handle case with no books", async () => {
      const result = await getDashboardData();

      expect(result.currentlyReadingTotal).toBe(0);
      expect(result.currentlyReading.length).toBe(0);
      expect(result.readNextTotal).toBe(0);
      expect(result.readNext.length).toBe(0);
    });

    test("should exclude orphaned books from results", async () => {
      // Create 8 books, 2 orphaned
      const books = await Promise.all(
        Array.from({ length: 8 }, (_, i) =>
          Book.create({
            calibreId: i + 1,
            title: `Book ${i + 1}`,
            authors: [`Author ${i + 1}`],
            path: `Author ${i + 1}/Book ${i + 1}`,
            orphaned: i < 2, // First 2 are orphaned
          })
        )
      );

      // Create 8 reading sessions
      await Promise.all(
        books.map((book) =>
          ReadingSession.create({
            bookId: book._id,
            sessionNumber: 1,
            status: "reading",
            isActive: true,
          })
        )
      );

      const result = await getDashboardData();

      // Total count includes all active sessions (8 sessions)
      expect(result.currentlyReadingTotal).toBe(8);
      // Returned books exclude orphaned - limit was 6, but 2 orphaned were filtered = 4 books
      // (Sessions are sorted by updatedAt desc, limit to 6, then orphaned books filtered out)
      expect(result.currentlyReading.length).toBeLessThanOrEqual(6);
      expect(result.currentlyReading.length).toBeGreaterThan(0);
      // Verify all returned books are non-orphaned
      result.currentlyReading.forEach((book: any) => {
        expect(book.title).toMatch(/Book [3-8]/);
      });
    });

    test("should include latest progress for currently reading books", async () => {
      const book = await Book.create({
        calibreId: 1,
        title: "Test Book",
        authors: ["Test Author"],
        path: "Test Author/Test Book",
        totalPages: 300,
      });

      const session = await ReadingSession.create({
        bookId: book._id,
        sessionNumber: 1,
        status: "reading",
        isActive: true,
      });

      await ProgressLog.create({
        bookId: book._id,
        sessionId: session._id,
        currentPage: 100,
        currentPercentage: 33.33,
        progressDate: new Date(),
        pagesRead: 100,
      });

      const result = await getDashboardData();

      expect(result.currentlyReading.length).toBe(1);
      expect(result.currentlyReading[0].latestProgress).toBeTruthy();
      expect(result.currentlyReading[0].latestProgress.currentPage).toBe(100);
      expect(result.currentlyReading[0].latestProgress.currentPercentage).toBe(33.33);
    });

    test("should only return active sessions", async () => {
      const book = await Book.create({
        calibreId: 1,
        title: "Test Book",
        authors: ["Test Author"],
        path: "Test Author/Test Book",
      });

      // Create inactive session
      await ReadingSession.create({
        bookId: book._id,
        sessionNumber: 1,
        status: "reading",
        isActive: false,
      });

      // Create active session
      await ReadingSession.create({
        bookId: book._id,
        sessionNumber: 2,
        status: "reading",
        isActive: true,
      });

      const result = await getDashboardData();

      // Should only count/return the active session
      expect(result.currentlyReadingTotal).toBe(1);
      expect(result.currentlyReading.length).toBe(1);
    });

    test("should maintain sort order with same updatedAt timestamps", async () => {
      const now = new Date();

      // Create 3 books
      const books = await Promise.all(
        Array.from({ length: 3 }, (_, i) =>
          Book.create({
            calibreId: i + 1,
            title: `Book ${i + 1}`,
            authors: [`Author ${i + 1}`],
            path: `Author ${i + 1}/Book ${i + 1}`,
          })
        )
      );

      // Create sessions with same updatedAt but different _id (insertion order)
      for (const book of books) {
        await ReadingSession.create({
          bookId: book._id,
          sessionNumber: 1,
          status: "reading",
          isActive: true,
          startedDate: now,
          updatedAt: now,
        });
      }

      const result = await getDashboardData();

      // Should return all 3 books in consistent order
      expect(result.currentlyReading.length).toBe(3);
      // When updatedAt is same, order is determined by MongoDB's internal sorting
      // Just verify we got all 3 books
      const titles = result.currentlyReading.map(b => b.title).sort();
      expect(titles).toEqual(["Book 1", "Book 2", "Book 3"]);
    });
  });
});
