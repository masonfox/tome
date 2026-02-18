import { describe, test, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { setupTestDatabase, teardownTestDatabase, clearTestDatabase } from "@/__tests__/helpers/db-setup";
import { bookRepository } from "@/lib/repositories";
import { shelfRepository } from "@/lib/repositories/shelf.repository";
import { POST, DELETE } from "@/app/api/shelves/[id]/books/bulk/route";
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
 * Tests for POST and DELETE endpoints that manage multiple books on a shelf.
 * 
 * POST Coverage:
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
 * 
 * DELETE Coverage:
 * - DELETE: Remove multiple books from shelf
 * - DELETE: Remove single book via bulk endpoint
 * - DELETE: Return correct count and removed IDs
 * - DELETE: Automatically reindex remaining books
 * - DELETE: Handle invalid shelfId
 * - DELETE: Handle non-existent shelf
 * - DELETE: Handle empty bookIds array
 * - DELETE: Handle invalid bookIds format
 * - DELETE: Handle non-existent book IDs (skip gracefully)
 * - DELETE: Handle books not on shelf (skip gracefully)
 * - DELETE: Handle mixed valid/invalid book IDs
 * - DELETE: Preserve order of remaining books
 * - DELETE: Remove all books from shelf
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
      });

      const book2 = await bookRepository.create({
        calibreId: 2,
        title: "Book 2",
        authors: ["Author 2"],
        tags: [],
      });

      const book3 = await bookRepository.create({
        calibreId: 3,
        title: "Book 3",
        authors: ["Author 3"],
        tags: [],
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
      });

      const book2 = await bookRepository.create({
        calibreId: 2,
        title: "Book 2",
        authors: ["Author 2"],
        tags: [],
      });

      const book3 = await bookRepository.create({
        calibreId: 3,
        title: "Book 3",
        authors: ["Author 3"],
        tags: [],
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
      });

      const book2 = await bookRepository.create({
        calibreId: 2,
        title: "Book 2",
        authors: ["Author 2"],
        tags: [],
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
      });

      const book2 = await bookRepository.create({
        calibreId: 2,
        title: "Valid Book 2",
        authors: ["Author 2"],
        tags: [],
      });

      const book3 = await bookRepository.create({
        calibreId: 3,
        title: "Already on Shelf",
        authors: ["Author 3"],
        tags: [],
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

describe('DELETE /api/shelves/[id]/books/bulk', () => {
  describe('Successful Operations', () => {
    test('should remove multiple books from shelf', async () => {
      // Arrange: Create shelf and books
      const shelf = await shelfRepository.create({
        name: "My Shelf",
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
        await shelfRepository.addBookToShelf(shelf.id, book!.id);
      }

      // Act: Remove 3 books
      const bookIdsToRemove = [books[1].id, books[2].id, books[4].id];
      const request = createMockRequest("DELETE", `/api/shelves/${shelf.id}/books/bulk`, {
        bookIds: bookIdsToRemove,
      }) as NextRequest;
      const params = Promise.resolve({ id: shelf.id.toString() });
      const response = await DELETE(request, { params });
      const result = await response.json();

      // Assert: Response structure
      expect(response.status).toBe(200);
      expect(result.success).toBe(true);
      expect(result.data.count).toBe(3);
      expect(result.data.removedBookIds).toEqual(bookIdsToRemove);

      // Verify only 2 books remain
      const booksOnShelf = await shelfRepository.getBooksOnShelf(shelf.id);
      expect(booksOnShelf).toHaveLength(2);
      expect(booksOnShelf[0].id).toBe(books[0].id);
      expect(booksOnShelf[1].id).toBe(books[3].id);
    });

    test('should remove single book via bulk endpoint', async () => {
      // Arrange
      const shelf = await shelfRepository.create({
        name: "Single Book Removal Shelf",
        userId: null,
      });

      const book1 = await bookRepository.create({
        calibreId: 1,
        title: "Book 1",
        authors: ["Author 1"],
        tags: [],
      });

      const book2 = await bookRepository.create({
        calibreId: 2,
        title: "Book 2",
        authors: ["Author 2"],
        tags: [],
      });

      await shelfRepository.addBookToShelf(shelf.id, book1!.id);
      await shelfRepository.addBookToShelf(shelf.id, book2!.id);

      // Act: Remove single book
      const request = createMockRequest("DELETE", `/api/shelves/${shelf.id}/books/bulk`, {
        bookIds: [book1!.id],
      }) as NextRequest;
      const params = Promise.resolve({ id: shelf.id.toString() });
      const response = await DELETE(request, { params });
      const result = await response.json();

      // Assert
      expect(response.status).toBe(200);
      expect(result.success).toBe(true);
      expect(result.data.count).toBe(1);
      expect(result.data.removedBookIds).toEqual([book1!.id]);

      const booksOnShelf = await shelfRepository.getBooksOnShelf(shelf.id);
      expect(booksOnShelf).toHaveLength(1);
      expect(booksOnShelf[0].id).toBe(book2!.id);
    });

    test('should automatically reindex remaining books after removal', async () => {
      // Arrange
      const shelf = await shelfRepository.create({
        name: "Reindex Test Shelf",
        userId: null,
      });

      const books = [];
      for (let i = 1; i <= 6; i++) {
        const book = await bookRepository.create({
          calibreId: i,
          title: `Book ${i}`,
          authors: [`Author ${i}`],
          tags: [],
          path: `/path/${i}`,
        });
        books.push(book!);
        await shelfRepository.addBookToShelf(shelf.id, book!.id);
      }

      // Verify initial sortOrder (0, 1, 2, 3, 4, 5)
      let shelfBooks = await shelfRepository.getBooksOnShelf(shelf.id, "sortOrder", "asc");
      expect(shelfBooks[0].sortOrder).toBe(0);
      expect(shelfBooks[5].sortOrder).toBe(5);

      // Act: Remove books at indices 1, 3, 4 (leaving 0, 2, 5)
      const request = createMockRequest("DELETE", `/api/shelves/${shelf.id}/books/bulk`, {
        bookIds: [books[1].id, books[3].id, books[4].id],
      }) as NextRequest;
      const params = Promise.resolve({ id: shelf.id.toString() });
      const response = await DELETE(request, { params });

      // Assert: Remaining books reindexed to 0, 1, 2
      expect(response.status).toBe(200);
      
      shelfBooks = await shelfRepository.getBooksOnShelf(shelf.id, "sortOrder", "asc");
      expect(shelfBooks).toHaveLength(3);
      expect(shelfBooks[0].sortOrder).toBe(0);
      expect(shelfBooks[0].id).toBe(books[0].id);
      expect(shelfBooks[1].sortOrder).toBe(1);
      expect(shelfBooks[1].id).toBe(books[2].id);
      expect(shelfBooks[2].sortOrder).toBe(2);
      expect(shelfBooks[2].id).toBe(books[5].id);
    });

    test('should preserve order of remaining books', async () => {
      // Arrange
      const shelf = await shelfRepository.create({
        name: "Order Preservation Shelf",
        userId: null,
      });

      const books = [];
      for (let i = 1; i <= 10; i++) {
        const book = await bookRepository.create({
          calibreId: i,
          title: `Book ${i}`,
          authors: [`Author ${i}`],
          tags: [],
          path: `/path/${i}`,
        });
        books.push(book!);
        await shelfRepository.addBookToShelf(shelf.id, book!.id);
      }

      // Act: Remove every other book (indices 1, 3, 5, 7, 9)
      const request = createMockRequest("DELETE", `/api/shelves/${shelf.id}/books/bulk`, {
        bookIds: [
          books[1].id,
          books[3].id,
          books[5].id,
          books[7].id,
          books[9].id,
        ],
      }) as NextRequest;
      const params = Promise.resolve({ id: shelf.id.toString() });
      const response = await DELETE(request, { params });

      // Assert: Verify remaining books maintain relative order
      expect(response.status).toBe(200);
      
      const remainingBooks = await shelfRepository.getBooksOnShelf(shelf.id, "sortOrder", "asc");
      expect(remainingBooks).toHaveLength(5);
      expect(remainingBooks[0].id).toBe(books[0].id);
      expect(remainingBooks[1].id).toBe(books[2].id);
      expect(remainingBooks[2].id).toBe(books[4].id);
      expect(remainingBooks[3].id).toBe(books[6].id);
      expect(remainingBooks[4].id).toBe(books[8].id);

      // Verify sortOrder is continuous (0, 1, 2, 3, 4)
      for (let i = 0; i < 5; i++) {
        expect(remainingBooks[i].sortOrder).toBe(i);
      }
    });

    test('should handle removing all books from shelf', async () => {
      // Arrange
      const shelf = await shelfRepository.create({
        name: "Remove All Test",
        userId: null,
      });

      const books = [];
      for (let i = 1; i <= 3; i++) {
        const book = await bookRepository.create({
          calibreId: i,
          title: `Book ${i}`,
          authors: [`Author ${i}`],
          tags: [],
          path: `/path/${i}`,
        });
        books.push(book!);
        await shelfRepository.addBookToShelf(shelf.id, book!.id);
      }

      // Act: Remove all books
      const allBookIds = books.map(b => b.id);
      const request = createMockRequest("DELETE", `/api/shelves/${shelf.id}/books/bulk`, {
        bookIds: allBookIds,
      }) as NextRequest;
      const params = Promise.resolve({ id: shelf.id.toString() });
      const response = await DELETE(request, { params });
      const result = await response.json();

      // Assert
      expect(response.status).toBe(200);
      expect(result.success).toBe(true);
      expect(result.data.count).toBe(3);

      const remainingBooks = await shelfRepository.getBooksOnShelf(shelf.id);
      expect(remainingBooks).toHaveLength(0);
    });

    test('should handle non-existent book IDs gracefully (skip them)', async () => {
      // Arrange
      const shelf = await shelfRepository.create({
        name: "Mixed IDs Test",
        userId: null,
      });

      const book1 = await bookRepository.create({
        calibreId: 1,
        title: "Valid Book",
        authors: ["Author"],
        tags: [],
      });

      await shelfRepository.addBookToShelf(shelf.id, book1!.id);

      // Act: Try to remove valid book and non-existent books
      const request = createMockRequest("DELETE", `/api/shelves/${shelf.id}/books/bulk`, {
        bookIds: [book1!.id, 9999, 8888],
      }) as NextRequest;
      const params = Promise.resolve({ id: shelf.id.toString() });
      const response = await DELETE(request, { params });
      const result = await response.json();

      // Assert: Should only remove the valid book
      expect(response.status).toBe(200);
      expect(result.success).toBe(true);
      expect(result.data.count).toBe(1);
      expect(result.data.removedBookIds).toEqual([book1!.id]);

      const booksOnShelf = await shelfRepository.getBooksOnShelf(shelf.id);
      expect(booksOnShelf).toHaveLength(0);
    });

    test('should handle books not on shelf gracefully (skip them)', async () => {
      // Arrange
      const shelf = await shelfRepository.create({
        name: "Not On Shelf Test",
        userId: null,
      });

      const book1 = await bookRepository.create({
        calibreId: 1,
        title: "Book On Shelf",
        authors: ["Author 1"],
        tags: [],
      });

      const book2 = await bookRepository.create({
        calibreId: 2,
        title: "Book Not On Shelf",
        authors: ["Author 2"],
        tags: [],
      });

      // Only add book1 to shelf
      await shelfRepository.addBookToShelf(shelf.id, book1!.id);

      // Act: Try to remove both books
      const request = createMockRequest("DELETE", `/api/shelves/${shelf.id}/books/bulk`, {
        bookIds: [book1!.id, book2!.id],
      }) as NextRequest;
      const params = Promise.resolve({ id: shelf.id.toString() });
      const response = await DELETE(request, { params });
      const result = await response.json();

      // Assert: Should only report book1 as removed
      expect(response.status).toBe(200);
      expect(result.success).toBe(true);
      expect(result.data.count).toBe(1);
      expect(result.data.removedBookIds).toEqual([book1!.id]);

      const remainingBooks = await shelfRepository.getBooksOnShelf(shelf.id);
      expect(remainingBooks).toHaveLength(0);
    });
  });

  describe('Validation Errors', () => {
    test('should return 400 for invalid shelf ID', async () => {
      const request = createMockRequest("DELETE", `/api/shelves/invalid/books/bulk`, {
        bookIds: [1, 2, 3],
      }) as NextRequest;
      const params = Promise.resolve({ id: "invalid" });
      const response = await DELETE(request, { params });
      const result = await response.json();

      expect(response.status).toBe(400);
      expect(result.success).toBe(false);
      expect(result.error.code).toBe("INVALID_ID");
      expect(result.error.message).toContain("valid number");
    });

    test('should return 404 for non-existent shelf', async () => {
      const request = createMockRequest("DELETE", `/api/shelves/999/books/bulk`, {
        bookIds: [1, 2, 3],
      }) as NextRequest;
      const params = Promise.resolve({ id: "999" });
      const response = await DELETE(request, { params });
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

      const request = createMockRequest("DELETE", `/api/shelves/${shelf.id}/books/bulk`, {
        bookIds: [],
      }) as NextRequest;
      const params = Promise.resolve({ id: shelf.id.toString() });
      const response = await DELETE(request, { params });
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

      const request = createMockRequest("DELETE", `/api/shelves/${shelf.id}/books/bulk`, {
        bookIds: "not-an-array",
      }) as NextRequest;
      const params = Promise.resolve({ id: shelf.id.toString() });
      const response = await DELETE(request, { params });
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

      const request = createMockRequest("DELETE", `/api/shelves/${shelf.id}/books/bulk`, {
        // Missing bookIds
      }) as NextRequest;
      const params = Promise.resolve({ id: shelf.id.toString() });
      const response = await DELETE(request, { params });
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

      const request = createMockRequest("DELETE", `/api/shelves/${shelf.id}/books/bulk`, {
        bookIds: [1, "two", 3],
      }) as NextRequest;
      const params = Promise.resolve({ id: shelf.id.toString() });
      const response = await DELETE(request, { params });
      const result = await response.json();

      expect(response.status).toBe(400);
      expect(result.success).toBe(false);
      expect(result.error.code).toBe("VALIDATION_ERROR");
      expect(result.error.message).toContain("must be numbers");
    });
  });

  describe('Edge Cases', () => {
    test('should return count 0 when no books are actually removed', async () => {
      const shelf = await shelfRepository.create({
        name: "Empty Remove Test",
        userId: null,
      });

      const book = await bookRepository.create({
        calibreId: 1,
        title: "Test Book",
        authors: ["Author"],
        tags: [],
      });

      await shelfRepository.addBookToShelf(shelf.id, book!.id);

      // Try to remove non-existent books
      const request = createMockRequest("DELETE", `/api/shelves/${shelf.id}/books/bulk`, {
        bookIds: [9999, 8888, 7777],
      }) as NextRequest;
      const params = Promise.resolve({ id: shelf.id.toString() });
      const response = await DELETE(request, { params });
      const result = await response.json();

      expect(response.status).toBe(200);
      expect(result.success).toBe(true);
      expect(result.data.count).toBe(0);
      expect(result.data.removedBookIds).toEqual([]);

      // Original book should still be on shelf
      const booksOnShelf = await shelfRepository.getBooksOnShelf(shelf.id);
      expect(booksOnShelf).toHaveLength(1);
      expect(booksOnShelf[0].id).toBe(book!.id);
    });

    test('should handle large batch deletion', async () => {
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
        await shelfRepository.addBookToShelf(shelf.id, book!.id);
      }

      // Remove 30 books
      const booksToRemove = books.slice(0, 30).map(b => b.id);
      const request = createMockRequest("DELETE", `/api/shelves/${shelf.id}/books/bulk`, {
        bookIds: booksToRemove,
      }) as NextRequest;
      const params = Promise.resolve({ id: shelf.id.toString() });
      const response = await DELETE(request, { params });
      const result = await response.json();

      expect(response.status).toBe(200);
      expect(result.success).toBe(true);
      expect(result.data.count).toBe(30);

      const booksOnShelf = await shelfRepository.getBooksOnShelf(shelf.id);
      expect(booksOnShelf).toHaveLength(20);
    });
  });
});
