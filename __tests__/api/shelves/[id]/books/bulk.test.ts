import { describe, test, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { setupTestDatabase, teardownTestDatabase, clearTestDatabase } from "@/__tests__/helpers/db-setup";
import { bookRepository } from "@/lib/repositories";
import { shelfRepository } from "@/lib/repositories/shelf.repository";
import { POST } from "@/app/api/shelves/[id]/books/bulk/route";
import { createMockRequest } from "@/__tests__/fixtures/test-data";
import type { NextRequest } from "next/server";

/**
 * Mock Rationale: Prevent Next.js cache revalidation side effects during tests.
 */
vi.mock("next/cache", () => ({
  revalidatePath: () => {},
}));

/**
 * API Route Tests: /api/shelves/[id]/books/bulk
 * 
 * Tests for POST endpoint that adds multiple books to a shelf.
 * 
 * Coverage:
 * - POST: Add multiple books to shelf
 * - POST: Add single book via bulk endpoint
 * - POST: Return correct count of added books
 * - POST: Handle invalid shelfId
 * - POST: Handle non-existent shelf
 * - POST: Handle empty bookIds array
 * - POST: Handle invalid bookIds format
 * - POST: Handle non-existent book IDs (skip gracefully)
 * - POST: Handle books already on shelf (skip gracefully)
 * - POST: Handle mixed valid/invalid book IDs
 * - POST: Verify shelf reindexing
 * - POST: Verify path revalidation
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

describe('POST /api/shelves/[id]/books/bulk', () => {
  describe('Successful Operations', () => {
    test('should add multiple books to shelf', async () => {
      // Arrange: Create shelf and books
      const shelf = await shelfRepository.create({
        name: "My Shelf",
        userId: null,
      });

      const book1 = await bookRepository.create({
        calibreId: 1,
        title: "Book 1",
        authors: ["Author 1"],
        tags: [],
        path: "/path/1",
      });

      const book2 = await bookRepository.create({
        calibreId: 2,
        title: "Book 2",
        authors: ["Author 2"],
        tags: [],
        path: "/path/2",
      });

      const book3 = await bookRepository.create({
        calibreId: 3,
        title: "Book 3",
        authors: ["Author 3"],
        tags: [],
        path: "/path/3",
      });

      // Act: Add books via bulk endpoint
      const request = createMockRequest("POST", `/api/shelves/${shelf.id}/books/bulk`, {
        bookIds: [book1!.id, book2!.id, book3!.id],
      }) as NextRequest;
      const params = Promise.resolve({ id: shelf.id.toString() });
      const response = await POST(request, { params });
      const result = await response.json();

      // Assert: Response structure
      expect(response.status).toBe(201);
      expect(result.success).toBe(true);
      expect(result.data.added).toBe(true);
      expect(result.data.count).toBe(3);

      // Verify books are on shelf
      const booksOnShelf = await shelfRepository.getBooksOnShelf(shelf.id);
      expect(booksOnShelf).toHaveLength(3);
      const bookIdsOnShelf = booksOnShelf.map(b => b.id);
      expect(bookIdsOnShelf).toContain(book1!.id);
      expect(bookIdsOnShelf).toContain(book2!.id);
      expect(bookIdsOnShelf).toContain(book3!.id);
    });

    test('should add single book via bulk endpoint', async () => {
      // Arrange
      const shelf = await shelfRepository.create({
        name: "Single Book Shelf",
        userId: null,
      });

      const book = await bookRepository.create({
        calibreId: 1,
        title: "Solo Book",
        authors: ["Author"],
        tags: [],
        path: "/path/1",
      });

      // Act
      const request = createMockRequest("POST", `/api/shelves/${shelf.id}/books/bulk`, {
        bookIds: [book!.id],
      }) as NextRequest;
      const params = Promise.resolve({ id: shelf.id.toString() });
      const response = await POST(request, { params });
      const result = await response.json();

      // Assert
      expect(response.status).toBe(201);
      expect(result.success).toBe(true);
      expect(result.data.count).toBe(1);

      const booksOnShelf = await shelfRepository.getBooksOnShelf(shelf.id);
      expect(booksOnShelf).toHaveLength(1);
      expect(booksOnShelf[0].id).toBe(book!.id);
    });

    test('should return correct count when some books already on shelf', async () => {
      // Arrange: Create shelf and books
      const shelf = await shelfRepository.create({
        name: "Partial Shelf",
        userId: null,
      });

      const book1 = await bookRepository.create({
        calibreId: 1,
        title: "Book 1",
        authors: ["Author 1"],
        tags: [],
        path: "/path/1",
      });

      const book2 = await bookRepository.create({
        calibreId: 2,
        title: "Book 2",
        authors: ["Author 2"],
        tags: [],
        path: "/path/2",
      });

      const book3 = await bookRepository.create({
        calibreId: 3,
        title: "Book 3",
        authors: ["Author 3"],
        tags: [],
        path: "/path/3",
      });

      // Add book1 beforehand
      await shelfRepository.addBookToShelf(shelf.id, book1!.id);

      // Act: Try to add all three books (book1 already on shelf)
      const request = createMockRequest("POST", `/api/shelves/${shelf.id}/books/bulk`, {
        bookIds: [book1!.id, book2!.id, book3!.id],
      }) as NextRequest;
      const params = Promise.resolve({ id: shelf.id.toString() });
      const response = await POST(request, { params });
      const result = await response.json();

      // Assert: Should only add book2 and book3 (count = 2)
      expect(response.status).toBe(201);
      expect(result.success).toBe(true);
      expect(result.data.count).toBe(2);

      const booksOnShelf = await shelfRepository.getBooksOnShelf(shelf.id);
      expect(booksOnShelf).toHaveLength(3);
    });

    test('should handle non-existent book IDs gracefully (skip them)', async () => {
      // Arrange
      const shelf = await shelfRepository.create({
        name: "Test Shelf",
        userId: null,
      });

      const book1 = await bookRepository.create({
        calibreId: 1,
        title: "Valid Book",
        authors: ["Author"],
        tags: [],
        path: "/path/1",
      });

      // Act: Include one valid book and two non-existent IDs
      const request = createMockRequest("POST", `/api/shelves/${shelf.id}/books/bulk`, {
        bookIds: [book1!.id, 9999, 8888],
      }) as NextRequest;
      const params = Promise.resolve({ id: shelf.id.toString() });
      const response = await POST(request, { params });
      const result = await response.json();

      // Assert: Should succeed and add only the valid book
      expect(response.status).toBe(201);
      expect(result.success).toBe(true);
      expect(result.data.count).toBe(1);

      const booksOnShelf = await shelfRepository.getBooksOnShelf(shelf.id);
      expect(booksOnShelf).toHaveLength(1);
      expect(booksOnShelf[0].id).toBe(book1!.id);
    });

    test('should verify books are reindexed after bulk add', async () => {
      // Arrange
      const shelf = await shelfRepository.create({
        name: "Reindex Test Shelf",
        userId: null,
      });

      const books = [];
      for (let i = 1; i <= 5; i++) {
        const book = await bookRepository.create({
          calibreId: i,
          title: `Book ${i}`,
          authors: [`Author ${i}`],
          tags: [],
          path: `/path/${i}`,
        });
        books.push(book!);
      }

      // Act: Add all books
      const request = createMockRequest("POST", `/api/shelves/${shelf.id}/books/bulk`, {
        bookIds: books.map(b => b.id),
      }) as NextRequest;
      const params = Promise.resolve({ id: shelf.id.toString() });
      const response = await POST(request, { params });
      const result = await response.json();

      // Assert: Books should be reindexed with continuous sortOrder
      expect(response.status).toBe(201);
      expect(result.data.count).toBe(5);

      const booksOnShelf = await shelfRepository.getBooksOnShelf(shelf.id, "sortOrder", "asc");
      expect(booksOnShelf).toHaveLength(5);
      
      // Verify sortOrder is 0, 1, 2, 3, 4 (continuous)
      booksOnShelf.forEach((book, index) => {
        expect(book.sortOrder).toBe(index);
      });
    });
  });

  describe('Validation Errors', () => {
    test('should return 400 for invalid shelf ID', async () => {
      const request = createMockRequest("POST", `/api/shelves/invalid/books/bulk`, {
        bookIds: [1, 2, 3],
      }) as NextRequest;
      const params = Promise.resolve({ id: "invalid" });
      const response = await POST(request, { params });
      const result = await response.json();

      expect(response.status).toBe(400);
      expect(result.success).toBe(false);
      expect(result.error.code).toBe("INVALID_ID");
      expect(result.error.message).toContain("valid number");
    });

    test('should return 404 for non-existent shelf', async () => {
      const request = createMockRequest("POST", `/api/shelves/999/books/bulk`, {
        bookIds: [1, 2, 3],
      }) as NextRequest;
      const params = Promise.resolve({ id: "999" });
      const response = await POST(request, { params });
      const result = await response.json();

      expect(response.status).toBe(404);
      expect(result.success).toBe(false);
      expect(result.error.code).toBe("NOT_FOUND");
      expect(result.error.message).toContain("not found");
    });

    test('should return 400 for empty bookIds array', async () => {
      const shelf = await shelfRepository.create({
        name: "Test Shelf",
        userId: null,
      });

      const request = createMockRequest("POST", `/api/shelves/${shelf.id}/books/bulk`, {
        bookIds: [],
      }) as NextRequest;
      const params = Promise.resolve({ id: shelf.id.toString() });
      const response = await POST(request, { params });
      const result = await response.json();

      expect(response.status).toBe(400);
      expect(result.success).toBe(false);
      expect(result.error.code).toBe("VALIDATION_ERROR");
      expect(result.error.message).toContain("cannot be empty");
    });

    test('should return 400 when bookIds is not an array', async () => {
      const shelf = await shelfRepository.create({
        name: "Test Shelf",
        userId: null,
      });

      const request = createMockRequest("POST", `/api/shelves/${shelf.id}/books/bulk`, {
        bookIds: "not-an-array",
      }) as NextRequest;
      const params = Promise.resolve({ id: shelf.id.toString() });
      const response = await POST(request, { params });
      const result = await response.json();

      expect(response.status).toBe(400);
      expect(result.success).toBe(false);
      expect(result.error.code).toBe("VALIDATION_ERROR");
      expect(result.error.message).toContain("must be an array");
    });

    test('should return 400 when bookIds is missing', async () => {
      const shelf = await shelfRepository.create({
        name: "Test Shelf",
        userId: null,
      });

      const request = createMockRequest("POST", `/api/shelves/${shelf.id}/books/bulk`, {
        // Missing bookIds
      }) as NextRequest;
      const params = Promise.resolve({ id: shelf.id.toString() });
      const response = await POST(request, { params });
      const result = await response.json();

      expect(response.status).toBe(400);
      expect(result.success).toBe(false);
      expect(result.error.code).toBe("VALIDATION_ERROR");
      expect(result.error.message).toContain("required");
    });

    test('should return 400 when bookIds contains non-numbers', async () => {
      const shelf = await shelfRepository.create({
        name: "Test Shelf",
        userId: null,
      });

      const request = createMockRequest("POST", `/api/shelves/${shelf.id}/books/bulk`, {
        bookIds: [1, "two", 3],
      }) as NextRequest;
      const params = Promise.resolve({ id: shelf.id.toString() });
      const response = await POST(request, { params });
      const result = await response.json();

      expect(response.status).toBe(400);
      expect(result.success).toBe(false);
      expect(result.error.code).toBe("VALIDATION_ERROR");
      expect(result.error.message).toContain("must be numbers");
    });
  });

  describe('Edge Cases', () => {
    test('should return count 0 when all books are non-existent', async () => {
      const shelf = await shelfRepository.create({
        name: "Empty Result Shelf",
        userId: null,
      });

      const request = createMockRequest("POST", `/api/shelves/${shelf.id}/books/bulk`, {
        bookIds: [9999, 8888, 7777],
      }) as NextRequest;
      const params = Promise.resolve({ id: shelf.id.toString() });
      const response = await POST(request, { params });
      const result = await response.json();

      expect(response.status).toBe(201);
      expect(result.success).toBe(true);
      expect(result.data.count).toBe(0);

      const booksOnShelf = await shelfRepository.getBooksOnShelf(shelf.id);
      expect(booksOnShelf).toHaveLength(0);
    });

    test('should return count 0 when all books are already on shelf', async () => {
      const shelf = await shelfRepository.create({
        name: "Already Full Shelf",
        userId: null,
      });

      const book1 = await bookRepository.create({
        calibreId: 1,
        title: "Book 1",
        authors: ["Author 1"],
        tags: [],
        path: "/path/1",
      });

      const book2 = await bookRepository.create({
        calibreId: 2,
        title: "Book 2",
        authors: ["Author 2"],
        tags: [],
        path: "/path/2",
      });

      // Add both books beforehand
      await shelfRepository.addBookToShelf(shelf.id, book1!.id);
      await shelfRepository.addBookToShelf(shelf.id, book2!.id);

      // Try to add again
      const request = createMockRequest("POST", `/api/shelves/${shelf.id}/books/bulk`, {
        bookIds: [book1!.id, book2!.id],
      }) as NextRequest;
      const params = Promise.resolve({ id: shelf.id.toString() });
      const response = await POST(request, { params });
      const result = await response.json();

      expect(response.status).toBe(201);
      expect(result.success).toBe(true);
      expect(result.data.count).toBe(0);

      const booksOnShelf = await shelfRepository.getBooksOnShelf(shelf.id);
      expect(booksOnShelf).toHaveLength(2);
    });

    test('should handle mixed valid/invalid/duplicate book IDs', async () => {
      const shelf = await shelfRepository.create({
        name: "Mixed Shelf",
        userId: null,
      });

      const book1 = await bookRepository.create({
        calibreId: 1,
        title: "Valid Book 1",
        authors: ["Author 1"],
        tags: [],
        path: "/path/1",
      });

      const book2 = await bookRepository.create({
        calibreId: 2,
        title: "Valid Book 2",
        authors: ["Author 2"],
        tags: [],
        path: "/path/2",
      });

      const book3 = await bookRepository.create({
        calibreId: 3,
        title: "Already on Shelf",
        authors: ["Author 3"],
        tags: [],
        path: "/path/3",
      });

      // Add book3 beforehand
      await shelfRepository.addBookToShelf(shelf.id, book3!.id);

      // Act: Mix valid, invalid, and already-on-shelf books
      const request = createMockRequest("POST", `/api/shelves/${shelf.id}/books/bulk`, {
        bookIds: [
          book1!.id,     // Valid
          9999,          // Non-existent
          book2!.id,     // Valid
          book3!.id,     // Already on shelf
          8888,          // Non-existent
        ],
      }) as NextRequest;
      const params = Promise.resolve({ id: shelf.id.toString() });
      const response = await POST(request, { params });
      const result = await response.json();

      // Assert: Should add book1 and book2 only (count = 2)
      expect(response.status).toBe(201);
      expect(result.success).toBe(true);
      expect(result.data.count).toBe(2);

      const booksOnShelf = await shelfRepository.getBooksOnShelf(shelf.id);
      expect(booksOnShelf).toHaveLength(3); // book1, book2, book3
      const bookIdsOnShelf = booksOnShelf.map(b => b.id);
      expect(bookIdsOnShelf).toContain(book1!.id);
      expect(bookIdsOnShelf).toContain(book2!.id);
      expect(bookIdsOnShelf).toContain(book3!.id);
    });

    test('should handle large batch of books', async () => {
      const shelf = await shelfRepository.create({
        name: "Large Batch Shelf",
        userId: null,
      });

      const books = [];
      for (let i = 1; i <= 50; i++) {
        const book = await bookRepository.create({
          calibreId: i,
          title: `Book ${i}`,
          authors: [`Author ${i}`],
          tags: [],
          path: `/path/${i}`,
        });
        books.push(book!);
      }

      const request = createMockRequest("POST", `/api/shelves/${shelf.id}/books/bulk`, {
        bookIds: books.map(b => b.id),
      }) as NextRequest;
      const params = Promise.resolve({ id: shelf.id.toString() });
      const response = await POST(request, { params });
      const result = await response.json();

      expect(response.status).toBe(201);
      expect(result.success).toBe(true);
      expect(result.data.count).toBe(50);

      const booksOnShelf = await shelfRepository.getBooksOnShelf(shelf.id);
      expect(booksOnShelf).toHaveLength(50);
    });
  });
});
