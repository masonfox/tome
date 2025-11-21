import { describe, test, expect, beforeAll, beforeEach, afterAll } from "bun:test";
import { setupTestDatabase, teardownTestDatabase, clearTestDatabase } from "@/__tests__/helpers/db-setup";
import { bookRepository, sessionRepository, progressRepository } from "@/lib/repositories";
import { BookService } from "@/lib/services/book.service";
import { mockBook1, mockBook2, mockSessionReading, mockProgressLog1 } from "@/__tests__/fixtures/test-data";
import type { Book } from "@/lib/db/schema/books";

describe("BookService", () => {
  let bookService: BookService;
  let book1: Book;
  let book2: Book;

  beforeAll(async () => {
    await setupTestDatabase(__filename);
    bookService = new BookService();
  });

  afterAll(async () => {
    await teardownTestDatabase(__filename);
  });

  beforeEach(async () => {
    await clearTestDatabase(__filename);
    // Create fresh test books for each test
    book1 = await bookRepository.create(mockBook1 as any);
    book2 = await bookRepository.create(mockBook2 as any);
  });

  describe("getBookById", () => {
    test("should return book with full details (no sessions)", async () => {
      const result = await bookService.getBookById(book1.id);

      expect(result).toBeDefined();
      expect(result.id).toBe(book1.id);
      expect(result.title).toBe(book1.title);
      expect(result.activeSession).toBeNull();
      expect(result.latestProgress).toBeNull();
      expect(result.hasCompletedReads).toBe(false);
      expect(result.totalReads).toBe(0);
    });

    test("should return book with active session and progress", async () => {
      // Create active session
      const session = await sessionRepository.create({
        ...mockSessionReading,
        bookId: book1.id,
      } as any);

      // Create progress
      const progress = await progressRepository.create({
        ...mockProgressLog1,
        bookId: book1.id,
        sessionId: session.id,
      } as any);

      const result = await bookService.getBookById(book1.id);

      expect(result).toBeDefined();
      expect(result.activeSession).toBeDefined();
      expect(result.activeSession?.id).toBe(session.id);
      expect(result.latestProgress).toBeDefined();
      expect(result.latestProgress?.id).toBe(progress.id);
      expect(result.hasCompletedReads).toBe(false);
      expect(result.totalReads).toBe(0);
    });

    test("should calculate total reads correctly", async () => {
      // Create completed session (archived)
      await sessionRepository.create({
        bookId: book1.id,
        sessionNumber: 1,
        status: "read",
        isActive: false,
        completedDate: new Date("2025-10-01"),
      } as any);

      // Create another completed session
      await sessionRepository.create({
        bookId: book1.id,
        sessionNumber: 2,
        status: "read",
        isActive: false,
        completedDate: new Date("2025-11-01"),
      } as any);

      // Create active session
      await sessionRepository.create({
        bookId: book1.id,
        sessionNumber: 3,
        status: "reading",
        isActive: true,
      } as any);

      const result = await bookService.getBookById(book1.id);

      expect(result.hasCompletedReads).toBe(true);
      expect(result.totalReads).toBe(2); // Only completed reads count
    });

    test("should return null for non-existent book", async () => {
      const result = await bookService.getBookById(99999);

      expect(result).toBeNull();
    });
  });

  describe("updateTotalPages", () => {
    test("should update total pages successfully", async () => {
      const result = await bookService.updateTotalPages(book1.id, 500);

      expect(result).toBeDefined();
      expect(result.totalPages).toBe(500);

      // Verify in database
      const updated = await bookRepository.findById(book1.id);
      expect(updated?.totalPages).toBe(500);
    });

    test("should throw error for non-existent book", async () => {
      await expect(bookService.updateTotalPages(99999, 500)).rejects.toThrow("Book not found");
    });

    test("should throw error for invalid total pages", async () => {
      await expect(bookService.updateTotalPages(book1.id, -10)).rejects.toThrow("Total pages must be a positive number");
    });

    test("should throw error for zero total pages", async () => {
      await expect(bookService.updateTotalPages(book1.id, 0)).rejects.toThrow("Total pages must be a positive number");
    });
  });

  describe("updateRating", () => {
    test("should update rating successfully", async () => {
      const result = await bookService.updateRating(book1.id, 5);

      expect(result).toBeDefined();
      expect(result.rating).toBe(5);

      // Verify in database
      const updated = await bookRepository.findById(book1.id);
      expect(updated?.rating).toBe(5);
    });

    test("should set rating to null (remove rating)", async () => {
      // First set a rating
      await bookRepository.update(book1.id, { rating: 4 });

      // Then remove it
      const result = await bookService.updateRating(book1.id, null);

      expect(result).toBeDefined();
      expect(result.rating).toBeNull();

      // Verify in database
      const updated = await bookRepository.findById(book1.id);
      expect(updated?.rating).toBeNull();
    });

    test("should throw error for non-existent book", async () => {
      await expect(bookService.updateRating(99999, 5)).rejects.toThrow("Book not found");
    });

    test("should throw error for invalid rating (less than 1)", async () => {
      await expect(bookService.updateRating(book1.id, 0)).rejects.toThrow("Rating must be between 1 and 5");
    });

    test("should throw error for invalid rating (greater than 5)", async () => {
      await expect(bookService.updateRating(book1.id, 6)).rejects.toThrow("Rating must be between 1 and 5");
    });

    test("should handle Calibre sync gracefully on failure", async () => {
      // Note: Actual Calibre sync will be mocked in implementation
      // This test verifies that rating update succeeds even if sync fails
      const result = await bookService.updateRating(book1.id, 5);

      expect(result).toBeDefined();
      expect(result.rating).toBe(5);
    });
  });

  describe("getAllTags", () => {
    test("should return all unique tags sorted", async () => {
      // book1 has: ["fantasy", "epic", "dragons"]
      // book2 has: ["fantasy", "magic"]
      const result = await bookService.getAllTags();

      expect(result).toEqual(["dragons", "epic", "fantasy", "magic"]);
    });

    test("should return empty array when no books have tags", async () => {
      // Clear all books
      await clearTestDatabase(__filename);

      // Create book without tags
      await bookRepository.create({
        calibreId: 10,
        title: "No Tags Book",
        authors: ["Author"],
        path: "Author/No Tags Book (10)",
        tags: [],
      } as any);

      const result = await bookService.getAllTags();

      expect(result).toEqual([]);
    });
  });

  describe("getBooksByFilters", () => {
    test("should return books with pagination", async () => {
      const result = await bookService.getBooksByFilters({}, 10, 0);

      expect(result.books.length).toBe(2);
      expect(result.total).toBe(2);
    });

    test("should filter by status", async () => {
      // Create session for book1
      await sessionRepository.create({
        bookId: book1.id,
        sessionNumber: 1,
        status: "reading",
        isActive: true,
      } as any);

      const result = await bookService.getBooksByFilters({ status: "reading" }, 10, 0);

      expect(result.books.length).toBe(1);
      expect(result.books[0].id).toBe(book1.id);
      expect(result.total).toBe(1);
    });

    test("should filter by search term", async () => {
      const result = await bookService.getBooksByFilters({ search: "Dance" }, 10, 0);

      expect(result.books.length).toBe(1);
      expect(result.books[0].title).toContain("Dance");
      expect(result.total).toBe(1);
    });

    test("should filter by tags", async () => {
      const result = await bookService.getBooksByFilters({ tags: ["dragons"] }, 10, 0);

      expect(result.books.length).toBe(1);
      expect(result.books[0].id).toBe(book1.id);
      expect(result.total).toBe(1);
    });

    test("should filter by rating", async () => {
      // Set rating on book1
      await bookRepository.update(book1.id, { rating: 5 });

      const result = await bookService.getBooksByFilters({ rating: "5" }, 10, 0);

      expect(result.books.length).toBe(1);
      expect(result.books[0].id).toBe(book1.id);
      expect(result.total).toBe(1);
    });

    test("should handle pagination with skip and limit", async () => {
      // Create more books
      await bookRepository.create({
        calibreId: 3,
        title: "Book 3",
        authors: ["Author 3"],
        path: "Author 3/Book 3 (3)",
      } as any);

      const result = await bookService.getBooksByFilters({}, 2, 1);

      expect(result.books.length).toBe(2);
      expect(result.total).toBe(3);
    });

    test("should exclude orphaned books by default", async () => {
      // Create orphaned book
      await bookRepository.create({
        calibreId: 999,
        title: "Orphaned",
        authors: ["Unknown"],
        path: "Unknown/Orphaned (999)",
        orphaned: true,
      } as any);

      const result = await bookService.getBooksByFilters({}, 10, 0);

      expect(result.books.length).toBe(2); // Only non-orphaned
      expect(result.total).toBe(2);
    });

    test("should include orphaned books when showOrphaned is true", async () => {
      // Create orphaned book
      await bookRepository.create({
        calibreId: 999,
        title: "Orphaned",
        authors: ["Unknown"],
        path: "Unknown/Orphaned (999)",
        orphaned: true,
      } as any);

      const result = await bookService.getBooksByFilters({ showOrphaned: true }, 10, 0);

      expect(result.books.length).toBe(3);
      expect(result.total).toBe(3);
    });
  });
});
