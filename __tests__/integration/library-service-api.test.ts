import { describe, test, expect, beforeAll, afterAll, beforeEach, mock } from "bun:test";
import { bookRepository, sessionRepository, progressRepository } from "@/lib/repositories";
import { GET as GET_BOOKS } from "@/app/api/books/route";
import { GET as GET_TAGS } from "@/app/api/tags/route";
import { LibraryService } from "@/lib/library-service";
import { createMockRequest } from "../fixtures/test-data";
import { setupTestDatabase, teardownTestDatabase, clearTestDatabase } from "@/__tests__/helpers/db-setup";

/**
 * Mock Rationale: Prevent Next.js cache revalidation side effects during tests.
 * Library operations may trigger cache invalidation, but we don't need to test
 * Next.js's caching behavior - just our business logic.
 */
mock.module("next/cache", () => ({
  revalidatePath: () => {},
}));

let service: LibraryService;

/**
 * Mock Rationale: Route fetch calls to real API handlers for integration testing.
 * This integration test verifies LibraryService → API → Repository flows work
 * together correctly. We intercept fetch() and route to actual handlers rather
 * than starting a real HTTP server, making tests faster while still testing
 * the full integration path.
 */
// @ts-expect-error - Simplified fetch mock for integration testing
global.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof input === "string" ? input : input.toString();
  const method = init?.method || "GET";

  if (url.includes("/api/books")) {
    const request = createMockRequest(method, url, init?.body);
    return await GET_BOOKS(request);
  }

  if (url.includes("/api/tags")) {
    const request = createMockRequest(method, url);
    return await GET_TAGS(request);
  }

  throw new Error(`Unmocked URL: ${url}`);
};

beforeAll(async () => {
  await setupTestDatabase(__filename);
});

afterAll(async () => {
  await teardownTestDatabase(__filename);
});

beforeEach(async () => {
  await clearTestDatabase(__filename);
  service = new LibraryService(); // Fresh instance for each test
});

describe("LibraryService → API Integration", () => {
  describe("Basic Fetching", () => {
    test("should fetch all books with no filters", async () => {
      // Create 3 books (no sessions)
      await Promise.all([
        bookRepository.create({
          calibreId: 1,
          title: "Book 1",
          authors: ["Author 1"],
          tags: ["fiction"],
          path: "Author 1/Book 1 (1)",
        }),
        bookRepository.create({
          calibreId: 2,
          title: "Book 2",
          authors: ["Author 2"],
          tags: ["non-fiction"],
          path: "Author 2/Book 2 (2)",
        }),
        bookRepository.create({
          calibreId: 3,
          title: "Book 3",
          authors: ["Author 3"],
          tags: ["history"],
          path: "Author 3/Book 3 (3)",
        }),
      ]);

      const result = await service.getBooks({
        pagination: { limit: 50, skip: 0 },
      });

      expect(result.books).toHaveLength(3);
      expect(result.total).toBe(3);
      expect(result.hasMore).toBe(false);
      expect(result.limit).toBe(50);
      expect(result.skip).toBe(0);
    });

    test("should filter by status correctly", async () => {
      // Create 2 books: 1 with "reading" session (active), 1 with "read" session (archived)
      const book1 = await bookRepository.create({
        calibreId: 1,
        title: "Currently Reading",
        authors: ["Author 1"],
        tags: [],
        path: "Author 1/Currently Reading (1)",
      });

      const book2 = await bookRepository.create({
        calibreId: 2,
        title: "Finished Book",
        authors: ["Author 2"],
        tags: [],
        path: "Author 2/Finished Book (2)",
      });

      await sessionRepository.create({
        bookId: book1.id,
        sessionNumber: 1,
        status: "reading",
        isActive: true,
        startedDate: new Date(),
      });

      await sessionRepository.create({
        bookId: book2.id,
        sessionNumber: 1,
        status: "read",
        isActive: false,
        completedDate: new Date(),
      });

      // Filter by "reading"
      const readingResult = await service.getBooks({
        status: "reading",
        pagination: { limit: 50, skip: 0 },
      });

      expect(readingResult.books).toHaveLength(1);
      expect(readingResult.books[0].title).toBe("Currently Reading");
      expect(readingResult.books[0].status).toBe("reading");

      // Filter by "read"
      const readResult = await service.getBooks({
        status: "read",
        pagination: { limit: 50, skip: 0 },
      });

      expect(readResult.books).toHaveLength(1);
      expect(readResult.books[0].title).toBe("Finished Book");
      expect(readResult.books[0].status).toBe("read");
    });

    test("should filter by search query", async () => {
      await Promise.all([
        bookRepository.create({
          calibreId: 1,
          title: "Harry Potter",
          authors: ["J.K. Rowling"],
          tags: [],
          path: "J.K. Rowling/Harry Potter (1)",
        }),
        bookRepository.create({
          calibreId: 2,
          title: "Lord of the Rings",
          authors: ["J.R.R. Tolkien"],
          tags: [],
          path: "J.R.R. Tolkien/Lord of the Rings (2)",
        }),
      ]);

      const result = await service.getBooks({
        search: "Harry",
        pagination: { limit: 50, skip: 0 },
      });

      expect(result.books).toHaveLength(1);
      expect(result.books[0].title).toBe("Harry Potter");
    });

    test("should filter by tags", async () => {
      await Promise.all([
        bookRepository.create({
          calibreId: 1,
          title: "Fantasy Book",
          authors: ["Author 1"],
          tags: ["fantasy", "magic"],
          path: "Author 1/Fantasy Book (1)",
        }),
        bookRepository.create({
          calibreId: 2,
          title: "Sci-Fi Book",
          authors: ["Author 2"],
          tags: ["sci-fi", "space"],
          path: "Author 2/Sci-Fi Book (2)",
        }),
      ]);

      const result = await service.getBooks({
        tags: ["fantasy"],
        pagination: { limit: 50, skip: 0 },
      });

      expect(result.books).toHaveLength(1);
      expect(result.books[0].title).toBe("Fantasy Book");
    });

    test("should handle combined filters", async () => {
      const book = await bookRepository.create({
        calibreId: 1,
        title: "Fantasy Novel",
        authors: ["Fantasy Author"],
        tags: ["fantasy", "adventure"],
        path: "Fantasy Author/Fantasy Novel (1)",
      });

      await sessionRepository.create({
        bookId: book.id,
        sessionNumber: 1,
        status: "reading",
        isActive: true,
      });

      const result = await service.getBooks({
        status: "reading",
        search: "Fantasy",
        tags: ["fantasy"],
        pagination: { limit: 50, skip: 0 },
      });

      expect(result.books).toHaveLength(1);
      expect(result.books[0].title).toBe("Fantasy Novel");
      expect(result.books[0].status).toBe("reading");
    });

    test("should handle pagination correctly", async () => {
      // Arrange: Create 10 books for pagination testing
      const books = await Promise.all(
        Array.from({ length: 10 }, (_, i) =>
          bookRepository.create({
            calibreId: i + 1,
            title: `Book ${i + 1}`,
            authors: [`Author ${i + 1}`],
            tags: [],
            path: `Author ${i + 1}/Book ${i + 1} (${i + 1})`,
          })
        )
      );

      // Act & Assert: Page 1 - First 5 books, has more
      const page1 = await service.getBooks({
        pagination: { limit: 5, skip: 0 },
      });
      expect(page1.books).toHaveLength(5);
      expect(page1.hasMore).toBe(true);

      // Act & Assert: Page 2 - Next 5 books, no more
      const page2 = await service.getBooks({
        pagination: { limit: 5, skip: 5 },
      });
      expect(page2.books).toHaveLength(5);
      expect(page2.hasMore).toBe(false);

      // Act & Assert: Page 3 - Beyond available books, empty
      const page3 = await service.getBooks({
        pagination: { limit: 5, skip: 10 },
      });
      expect(page3.books).toHaveLength(0);
      expect(page3.hasMore).toBe(false);
    });
  });

  describe("Cache Behavior", () => {
    test("should cache results for identical queries", async () => {
      await bookRepository.create({
        calibreId: 1,
        title: "Test Book",
        authors: ["Author"],
        tags: [],
        path: "Author/Test Book (1)",
      });

      const filters = { pagination: { limit: 50, skip: 0 } };

      // First call
      const result1 = await service.getBooks(filters);

      // Second call (should use cache)
      const result2 = await service.getBooks(filters);

      expect(result1.books).toHaveLength(1);
      expect(result2.books).toHaveLength(1);
      expect(result1.books[0].id).toEqual(result2.books[0].id);
    });

    test("should maintain separate cache entries for different filters", async () => {
      const book1 = await bookRepository.create({
        calibreId: 1,
        title: "Book 1",
        authors: ["Author"],
        tags: [],
        path: "Author/Book 1 (1)",
      });

      const book2 = await bookRepository.create({
        calibreId: 2,
        title: "Book 2",
        authors: ["Author"],
        tags: [],
        path: "Author/Book 2 (2)",
      });

      await sessionRepository.create({
        bookId: book1.id,
        sessionNumber: 1,
        status: "reading",
        isActive: true,
      });

      await sessionRepository.create({
        bookId: book2.id,
        sessionNumber: 1,
        status: "read",
        isActive: false,
      });

      // Cache entry A: status=reading
      const readingResult = await service.getBooks({
        status: "reading",
        pagination: { limit: 50, skip: 0 },
      });

      // Cache entry B: status=read
      const readResult = await service.getBooks({
        status: "read",
        pagination: { limit: 50, skip: 0 },
      });

      expect(readingResult.books).toHaveLength(1);
      expect(readingResult.books[0].status).toBe("reading");
      expect(readResult.books).toHaveLength(1);
      expect(readResult.books[0].status).toBe("read");
    });

    test("should clear cache when clearCache() called", async () => {
      await bookRepository.create({
        calibreId: 1,
        title: "Book 1",
        authors: ["Author"],
        tags: [],
        path: "Author/Book 1 (1)",
      });

      const filters = { pagination: { limit: 50, skip: 0 } };

      // Fetch books → cached
      const result1 = await service.getBooks(filters);
      expect(result1.total).toBe(1);

      // Add new book to database
      await bookRepository.create({
        calibreId: 2,
        title: "Book 2",
        authors: ["Author"],
        tags: [],
        path: "Author/Book 2 (2)",
      });

      // Fetch again → returns cached (old count)
      const result2 = await service.getBooks(filters);
      expect(result2.total).toBe(1); // Still cached

      // Clear cache
      service.clearCache();

      // Fetch again → returns fresh (new count)
      const result3 = await service.getBooks(filters);
      expect(result3.total).toBe(2); // Fresh data
    });

    test("should clear both book and tag caches", async () => {
      await bookRepository.create({
        calibreId: 1,
        title: "Book",
        authors: ["Author"],
        tags: ["tag1"],
        path: "Author/Book (1)",
      });

      // Fetch and cache tags
      const tags1 = await service.getAvailableTags();
      expect(tags1).toContain("tag1");

      // Fetch and cache books
      const books1 = await service.getBooks({
        pagination: { limit: 50, skip: 0 },
      });
      expect(books1.total).toBe(1);

      // Add new book with new tag
      await bookRepository.create({
        calibreId: 2,
        title: "Book 2",
        authors: ["Author"],
        tags: ["tag2"],
        path: "Author/Book 2 (2)",
      });

      // Both should return cached
      const tags2 = await service.getAvailableTags();
      expect(tags2).not.toContain("tag2");
      const books2 = await service.getBooks({
        pagination: { limit: 50, skip: 0 },
      });
      expect(books2.total).toBe(1);

      // Clear all caches
      service.clearCache();

      // Both should return fresh
      const tags3 = await service.getAvailableTags();
      expect(tags3).toContain("tag2");
      const books3 = await service.getBooks({
        pagination: { limit: 50, skip: 0 },
      });
      expect(books3.total).toBe(2);
    });
  });

  describe("Tags Fetching", () => {
    test("should fetch all unique tags sorted alphabetically", async () => {
      await Promise.all([
        bookRepository.create({
          calibreId: 1,
          title: "Book 1",
          authors: ["Author"],
          tags: ["fantasy", "magic"],
          path: "Author/Book 1 (1)",
        }),
        bookRepository.create({
          calibreId: 2,
          title: "Book 2",
          authors: ["Author"],
          tags: ["sci-fi", "space"],
          path: "Author/Book 2 (2)",
        }),
        bookRepository.create({
          calibreId: 3,
          title: "Book 3",
          authors: ["Author"],
          tags: ["fantasy"], // Duplicate
          path: "Author/Book 3 (3)",
        }),
      ]);

      const tags = await service.getAvailableTags();

      expect(tags).toEqual(["fantasy", "magic", "sci-fi", "space"]);
      expect(tags).toHaveLength(4);
    });

    test("should return empty array when no books have tags", async () => {
      await bookRepository.create({
        calibreId: 1,
        title: "Book",
        authors: ["Author"],
        tags: [],
        path: "Author/Book (1)",
      });

      const tags = await service.getAvailableTags();
      expect(tags).toEqual([]);
    });

    test("should cache tags and return cached on subsequent calls", async () => {
      await bookRepository.create({
        calibreId: 1,
        title: "Book",
        authors: ["Author"],
        tags: ["tag1"],
        path: "Author/Book (1)",
      });

      // Fetch tags → cached
      const tags1 = await service.getAvailableTags();
      expect(tags1).toContain("tag1");

      // Add book with new tag
      await bookRepository.create({
        calibreId: 2,
        title: "Book 2",
        authors: ["Author"],
        tags: ["tag2"],
        path: "Author/Book 2 (2)",
      });

      // Fetch tags again → returns cached (old tags)
      const tags2 = await service.getAvailableTags();
      expect(tags2).not.toContain("tag2");

      // Clear cache
      service.clearCache();

      // Fetch tags → returns new tags
      const tags3 = await service.getAvailableTags();
      expect(tags3).toContain("tag2");
    });
  });

  describe("Status Filtering Bug Coverage (isActive)", () => {
    test("should return archived 'read' sessions when filtering by 'read'", async () => {
      const book = await bookRepository.create({
        calibreId: 1,
        title: "Finished Book",
        authors: ["Author"],
        tags: [],
        path: "Author/Finished Book (1)",
      });

      await sessionRepository.create({
        bookId: book.id,
        sessionNumber: 1,
        status: "read",
        isActive: false, // Archived
        completedDate: new Date(),
      });

      const result = await service.getBooks({
        status: "read",
        pagination: { limit: 50, skip: 0 },
      });

      expect(result.books).toHaveLength(1);
      expect(result.books[0].title).toBe("Finished Book");
      expect(result.books[0].status).toBe("read");
    });

    test("should return active 'reading' sessions when filtering by 'reading'", async () => {
      const book = await bookRepository.create({
        calibreId: 1,
        title: "Currently Reading",
        authors: ["Author"],
        tags: [],
        path: "Author/Currently Reading (1)",
      });

      await sessionRepository.create({
        bookId: book.id,
        sessionNumber: 1,
        status: "reading",
        isActive: true, // Active
        startedDate: new Date(),
      });

      const result = await service.getBooks({
        status: "reading",
        pagination: { limit: 50, skip: 0 },
      });

      expect(result.books).toHaveLength(1);
      expect(result.books[0].title).toBe("Currently Reading");
      expect(result.books[0].status).toBe("reading");
    });

    test("should not return archived 'read' sessions when filtering by 'reading'", async () => {
      const book = await bookRepository.create({
        calibreId: 1,
        title: "Finished Book",
        authors: ["Author"],
        tags: [],
        path: "Author/Finished Book (1)",
      });

      await sessionRepository.create({
        bookId: book.id,
        sessionNumber: 1,
        status: "read",
        isActive: false,
        completedDate: new Date(),
      });

      const result = await service.getBooks({
        status: "reading",
        pagination: { limit: 50, skip: 0 },
      });

      expect(result.books).toHaveLength(0);
    });

    test("should not return active 'reading' sessions when filtering by 'read'", async () => {
      const book = await bookRepository.create({
        calibreId: 1,
        title: "Currently Reading",
        authors: ["Author"],
        tags: [],
        path: "Author/Currently Reading (1)",
      });

      await sessionRepository.create({
        bookId: book.id,
        sessionNumber: 1,
        status: "reading",
        isActive: true,
        startedDate: new Date(),
      });

      const result = await service.getBooks({
        status: "read",
        pagination: { limit: 50, skip: 0 },
      });

      expect(result.books).toHaveLength(0);
    });

    test("should handle re-reading scenario correctly", async () => {
      const book = await bookRepository.create({
        calibreId: 1,
        title: "Re-read Book",
        authors: ["Author"],
        tags: [],
        path: "Author/Re-read Book (1)",
        totalPages: 300,
        rating: 4,
      });

      // Archived "read" session (first read)
      const session1 = await sessionRepository.create({
        bookId: book.id,
        sessionNumber: 1,
        status: "read",
        isActive: false,
        completedDate: new Date("2024-01-01"),
        rating: 4,
      });

      // Active "reading" session (second read)
      const session2 = await sessionRepository.create({
        bookId: book.id,
        sessionNumber: 2,
        status: "reading",
        isActive: true,
        startedDate: new Date("2024-02-01"),
      });

      await progressRepository.create({
        bookId: book.id,
        sessionId: session2.id,
        currentPage: 150,
        currentPercentage: 50,
        progressDate: new Date(),
        pagesRead: 50,
      });

      // Filter by "read": expect book with rating 4 (archived session)
      const readResult = await service.getBooks({
        status: "read",
        pagination: { limit: 50, skip: 0 },
      });

      expect(readResult.books).toHaveLength(1);
      expect(readResult.books[0].status).toBe("read");
      expect(readResult.books[0].rating).toBe(4);

      // Filter by "reading": expect book with status "reading" (active session)
      const readingResult = await service.getBooks({
        status: "reading",
        pagination: { limit: 50, skip: 0 },
      });

      expect(readingResult.books).toHaveLength(1);
      expect(readingResult.books[0].status).toBe("reading");
      expect(readingResult.books[0].latestProgress?.currentPage).toBe(150);
    });

    test("should return active 'read-next' sessions when filtering by 'read-next'", async () => {
      const book = await bookRepository.create({
        calibreId: 1,
        title: "Read Next Book",
        authors: ["Author"],
        tags: [],
        path: "Author/Read Next Book (1)",
      });

      await sessionRepository.create({
        bookId: book.id,
        sessionNumber: 1,
        status: "read-next",
        isActive: true,
      });

      const result = await service.getBooks({
        status: "read-next",
        pagination: { limit: 50, skip: 0 },
      });

      expect(result.books).toHaveLength(1);
      expect(result.books[0].status).toBe("read-next");
    });

    test("should return active 'to-read' sessions when filtering by 'to-read'", async () => {
      const book = await bookRepository.create({
        calibreId: 1,
        title: "To Read Book",
        authors: ["Author"],
        tags: [],
        path: "Author/To Read Book (1)",
      });

      await sessionRepository.create({
        bookId: book.id,
        sessionNumber: 1,
        status: "to-read",
        isActive: true,
      });

      const result = await service.getBooks({
        status: "to-read",
        pagination: { limit: 50, skip: 0 },
      });

      expect(result.books).toHaveLength(1);
      expect(result.books[0].status).toBe("to-read");
    });
  });

  describe("Progress Data", () => {
    test("should include latest progress for active sessions", async () => {
      const book = await bookRepository.create({
        calibreId: 1,
        title: "Book with Progress",
        authors: ["Author"],
        tags: [],
        path: "Author/Book with Progress (1)",
        totalPages: 300,
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
        currentPage: 150,
        currentPercentage: 50,
        progressDate: new Date(),
        pagesRead: 50,
      });

      const result = await service.getBooks({
        status: "reading",
        pagination: { limit: 50, skip: 0 },
      });

      expect(result.books).toHaveLength(1);
      expect(result.books[0].latestProgress).toBeDefined();
      expect(result.books[0].latestProgress?.currentPage).toBe(150);
      expect(result.books[0].latestProgress?.currentPercentage).toBe(50);
    });

    test("should include latest progress for archived 'read' sessions", async () => {
      const book = await bookRepository.create({
        calibreId: 1,
        title: "Finished Book",
        authors: ["Author"],
        tags: [],
        path: "Author/Finished Book (1)",
        totalPages: 300,
      });

      const session = await sessionRepository.create({
        bookId: book.id,
        sessionNumber: 1,
        status: "read",
        isActive: false,
        completedDate: new Date(),
      });

      await progressRepository.create({
        bookId: book.id,
        sessionId: session.id,
        currentPage: 300,
        currentPercentage: 100,
        progressDate: new Date(),
        pagesRead: 50,
      });

      const result = await service.getBooks({
        status: "read",
        pagination: { limit: 50, skip: 0 },
      });

      expect(result.books).toHaveLength(1);
      expect(result.books[0].latestProgress).toBeDefined();
      expect(result.books[0].latestProgress?.currentPercentage).toBe(100);
    });

    test("should return null progress for books with no progress logs", async () => {
      const book = await bookRepository.create({
        calibreId: 1,
        title: "Book without Progress",
        authors: ["Author"],
        tags: [],
        path: "Author/Book without Progress (1)",
      });

      await sessionRepository.create({
        bookId: book.id,
        sessionNumber: 1,
        status: "reading",
        isActive: true,
      });

      const result = await service.getBooks({
        status: "reading",
        pagination: { limit: 50, skip: 0 },
      });

      expect(result.books).toHaveLength(1);
      expect(result.books[0].latestProgress).toBeNull();
    });
  });
});
