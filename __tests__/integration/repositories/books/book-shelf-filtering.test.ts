import { describe, test, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { bookRepository } from "@/lib/repositories";
import { shelfRepository } from "@/lib/repositories/shelf.repository";
import { sessionRepository } from "@/lib/repositories/session.repository";
import { setupTestDatabase, teardownTestDatabase, clearTestDatabase } from "@/__tests__/helpers/db-setup";
import { createTestBook } from "../../../fixtures/test-data";

/**
 * BookRepository Shelf Filtering Tests
 * 
 * Tests the shelfIds filter in findWithFilters() and countWithFilters() methods.
 * Shelf filtering uses OR logic - books must be on ANY of the selected shelves.
 * 
 * Coverage for lines 389-404 and 708-723 in book.repository.ts
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

describe("BookRepository Shelf Filter - findWithFilters()", () => {
  describe("Basic Shelf Filtering", () => {
    test("should filter books by single shelf", async () => {
      // Arrange: Create shelf and books
      const shelf1 = await shelfRepository.create({
        name: "Favorites",
        userId: null,
      });

      const book1 = await bookRepository.create(createTestBook({
        calibreId: 1,
        title: "Book on Favorites",
        authors: ["Author 1"],
        path: "Author 1/Book on Favorites (1)",
      }));

      // Create book not on any shelf (for test completeness)
      await bookRepository.create(createTestBook({
        calibreId: 2,
        title: "Book Not on Shelf",
        authors: ["Author 2"],
        path: "Author 2/Book Not on Shelf (2)",
      }));

      // Add only book1 to shelf
      await shelfRepository.addBookToShelf(shelf1.id, book1.id);

      // Act: Filter by shelf
      const result = await bookRepository.findWithFilters({ shelfIds: [shelf1.id] }, 50, 0);

      // Assert: Should only return book1
      expect(result.total).toBe(1);
      expect(result.books).toHaveLength(1);
      expect(result.books[0].id).toBe(book1.id);
      expect(result.books[0].title).toBe("Book on Favorites");
    });

    test("should filter books by multiple shelves (OR logic)", async () => {
      // Arrange: Create multiple shelves and books
      const shelfFavorites = await shelfRepository.create({
        name: "Favorites",
        userId: null,
      });

      const shelfToRead = await shelfRepository.create({
        name: "To Read",
        userId: null,
      });

      const book1 = await bookRepository.create(createTestBook({
        calibreId: 1,
        title: "Book on Favorites Only",
        authors: ["Author 1"],
        path: "Author 1/Book 1 (1)",
      }));

      const book2 = await bookRepository.create(createTestBook({
        calibreId: 2,
        title: "Book on To Read Only",
        authors: ["Author 2"],
        path: "Author 2/Book 2 (2)",
      }));

      const book3 = await bookRepository.create(createTestBook({
        calibreId: 3,
        title: "Book on Both Shelves",
        authors: ["Author 3"],
        path: "Author 3/Book 3 (3)",
      }));

      const book4 = await bookRepository.create(createTestBook({
        calibreId: 4,
        title: "Book on No Shelves",
        authors: ["Author 4"],
        path: "Author 4/Book 4 (4)",
      }));

      // Add books to shelves
      await shelfRepository.addBookToShelf(shelfFavorites.id, book1.id);
      await shelfRepository.addBookToShelf(shelfToRead.id, book2.id);
      await shelfRepository.addBookToShelf(shelfFavorites.id, book3.id);
      await shelfRepository.addBookToShelf(shelfToRead.id, book3.id);

      // Act: Filter by both shelves (OR logic)
      const result = await bookRepository.findWithFilters(
        { shelfIds: [shelfFavorites.id, shelfToRead.id] },
        50,
        0
      );

      // Assert: Should return books 1, 2, and 3 (any book on ANY shelf)
      expect(result.total).toBe(3);
      expect(result.books).toHaveLength(3);
      
      const bookIds = result.books.map(b => b.id);
      expect(bookIds).toContain(book1.id);
      expect(bookIds).toContain(book2.id);
      expect(bookIds).toContain(book3.id);
      expect(bookIds).not.toContain(book4.id);
    });

    test("should return empty result when filtering by shelf with no books", async () => {
      // Arrange: Create empty shelf and a book not on any shelf
      const emptyShelf = await shelfRepository.create({
        name: "Empty Shelf",
        userId: null,
      });

      await bookRepository.create(createTestBook({
        calibreId: 1,
        title: "Book Not on Shelf",
        authors: ["Author"],
        path: "Author/Book (1)",
      }));

      // Act: Filter by empty shelf
      const result = await bookRepository.findWithFilters({ shelfIds: [emptyShelf.id] }, 50, 0);

      // Assert: Should return empty result (critical edge case)
      expect(result.total).toBe(0);
      expect(result.books).toHaveLength(0);
    });

    test("should return empty result when filtering by non-existent shelf", async () => {
      // Arrange: Create a book
      await bookRepository.create(createTestBook({
        calibreId: 1,
        title: "Book",
        authors: ["Author"],
        path: "Author/Book (1)",
      }));

      // Act: Filter by non-existent shelf ID
      const result = await bookRepository.findWithFilters({ shelfIds: [9999] }, 50, 0);

      // Assert: Should return empty result
      expect(result.total).toBe(0);
      expect(result.books).toHaveLength(0);
    });
  });

  describe("Shelf Filter Combined with Other Filters", () => {
    test("should combine shelf filter with status filter", async () => {
      // Arrange: Create shelf, books, and sessions
      const shelf = await shelfRepository.create({
        name: "Currently Reading",
        userId: null,
      });

      // Book 1: On shelf, reading status
      const book1 = await bookRepository.create(createTestBook({
        calibreId: 1,
        title: "Reading on Shelf",
        authors: ["Author 1"],
        path: "Author 1/Book 1 (1)",
      }));

      const session1 = await sessionRepository.create({
        bookId: book1.id,
        userId: null,
        sessionNumber: 1,
        status: "reading",
        isActive: true,
      });

      // Book 2: On shelf, to-read status
      const book2 = await bookRepository.create(createTestBook({
        calibreId: 2,
        title: "To-Read on Shelf",
        authors: ["Author 2"],
        path: "Author 2/Book 2 (2)",
      }));

      await sessionRepository.create({
        bookId: book2.id,
        userId: null,
        sessionNumber: 1,
        status: "to-read",
        isActive: true,
      });

      // Book 3: Not on shelf, reading status
      const book3 = await bookRepository.create(createTestBook({
        calibreId: 3,
        title: "Reading Not on Shelf",
        authors: ["Author 3"],
        path: "Author 3/Book 3 (3)",
      }));

      await sessionRepository.create({
        bookId: book3.id,
        userId: null,
        sessionNumber: 1,
        status: "reading",
        isActive: true,
      });

      // Add books to shelf
      await shelfRepository.addBookToShelf(shelf.id, book1.id);
      await shelfRepository.addBookToShelf(shelf.id, book2.id);

      // Act: Filter by shelf AND reading status
      const result = await bookRepository.findWithFilters(
        { shelfIds: [shelf.id], status: "reading" },
        50,
        0
      );

      // Assert: Should only return book1 (on shelf AND reading)
      expect(result.total).toBe(1);
      expect(result.books).toHaveLength(1);
      expect(result.books[0].id).toBe(book1.id);
    });

    test("should combine shelf filter with search filter", async () => {
      // Arrange: Create shelf and books
      const shelf = await shelfRepository.create({
        name: "Fantasy Shelf",
        userId: null,
      });

      const book1 = await bookRepository.create(createTestBook({
        calibreId: 1,
        title: "Dragons of Fantasy",
        authors: ["Author 1"],
        path: "Author 1/Dragons of Fantasy (1)",
      }));

      const book2 = await bookRepository.create(createTestBook({
        calibreId: 2,
        title: "Wizards Magic",
        authors: ["Author 2"],
        path: "Author 2/Wizards Magic (2)",
      }));

      const book3 = await bookRepository.create(createTestBook({
        calibreId: 3,
        title: "Dragons of Science",
        authors: ["Author 3"],
        path: "Author 3/Dragons of Science (3)",
      }));

      // Add books 1 and 2 to shelf (not book 3)
      await shelfRepository.addBookToShelf(shelf.id, book1.id);
      await shelfRepository.addBookToShelf(shelf.id, book2.id);

      // Act: Filter by shelf AND search for "Dragons"
      const result = await bookRepository.findWithFilters(
        { shelfIds: [shelf.id], search: "Dragons" },
        50,
        0
      );

      // Assert: Should only return book1 (on shelf AND matches search)
      expect(result.total).toBe(1);
      expect(result.books).toHaveLength(1);
      expect(result.books[0].id).toBe(book1.id);
    });

    test("should combine shelf filter with tag filter", async () => {
      // Arrange: Create shelf and books with tags
      const shelf = await shelfRepository.create({
        name: "Tagged Shelf",
        userId: null,
      });

      const book1 = await bookRepository.create(createTestBook({
        calibreId: 1,
        title: "Fantasy on Shelf",
        authors: ["Author 1"],
        path: "Author 1/Book 1 (1)",
        tags: ["Fantasy", "Magic"],
      }));

      const book2 = await bookRepository.create(createTestBook({
        calibreId: 2,
        title: "Sci-Fi on Shelf",
        authors: ["Author 2"],
        path: "Author 2/Book 2 (2)",
        tags: ["Sci-Fi"],
      }));

      const book3 = await bookRepository.create(createTestBook({
        calibreId: 3,
        title: "Fantasy Not on Shelf",
        authors: ["Author 3"],
        path: "Author 3/Book 3 (3)",
        tags: ["Fantasy"],
      }));

      // Add books 1 and 2 to shelf
      await shelfRepository.addBookToShelf(shelf.id, book1.id);
      await shelfRepository.addBookToShelf(shelf.id, book2.id);

      // Act: Filter by shelf AND Fantasy tag
      const result = await bookRepository.findWithFilters(
        { shelfIds: [shelf.id], tags: ["Fantasy"] },
        50,
        0
      );

      // Assert: Should only return book1 (on shelf AND has Fantasy tag)
      expect(result.total).toBe(1);
      expect(result.books).toHaveLength(1);
      expect(result.books[0].id).toBe(book1.id);
    });

    test("should combine shelf filter with rating filter", async () => {
      // Arrange: Create shelf and books with ratings
      const shelf = await shelfRepository.create({
        name: "Rated Shelf",
        userId: null,
      });

      const book1 = await bookRepository.create(createTestBook({
        calibreId: 1,
        title: "5-Star Book on Shelf",
        authors: ["Author 1"],
        path: "Author 1/Book 1 (1)",
        rating: 5,
      }));

      const book2 = await bookRepository.create(createTestBook({
        calibreId: 2,
        title: "3-Star Book on Shelf",
        authors: ["Author 2"],
        path: "Author 2/Book 2 (2)",
        rating: 3,
      }));

      const book3 = await bookRepository.create(createTestBook({
        calibreId: 3,
        title: "5-Star Book Not on Shelf",
        authors: ["Author 3"],
        path: "Author 3/Book 3 (3)",
        rating: 5,
      }));

      // Add books 1 and 2 to shelf
      await shelfRepository.addBookToShelf(shelf.id, book1.id);
      await shelfRepository.addBookToShelf(shelf.id, book2.id);

      // Act: Filter by shelf AND 5-star rating
      const result = await bookRepository.findWithFilters(
        { shelfIds: [shelf.id], rating: "5" },
        50,
        0
      );

      // Assert: Should only return book1
      expect(result.total).toBe(1);
      expect(result.books).toHaveLength(1);
      expect(result.books[0].id).toBe(book1.id);
    });

    test("should combine shelf filter with multiple filters simultaneously", async () => {
      // Arrange: Complex scenario with multiple filters
      const shelf = await shelfRepository.create({
        name: "Complex Shelf",
        userId: null,
      });

      // Book 1: Matches ALL filters
      const book1 = await bookRepository.create(createTestBook({
        calibreId: 1,
        title: "Perfect Match Dragon",
        authors: ["Best Author"],
        path: "Best Author/Perfect Match Dragon (1)",
        tags: ["Fantasy"],
        rating: 5,
      }));

      const session1 = await sessionRepository.create({
        bookId: book1.id,
        userId: null,
        sessionNumber: 1,
        status: "reading",
        isActive: true,
      });

      // Book 2: On shelf but doesn't match other filters
      const book2 = await bookRepository.create(createTestBook({
        calibreId: 2,
        title: "Wrong Status",
        authors: ["Author 2"],
        path: "Author 2/Book 2 (2)",
        tags: ["Fantasy"],
        rating: 5,
      }));

      await sessionRepository.create({
        bookId: book2.id,
        userId: null,
        sessionNumber: 1,
        status: "to-read",
        isActive: true,
      });

      // Add both books to shelf
      await shelfRepository.addBookToShelf(shelf.id, book1.id);
      await shelfRepository.addBookToShelf(shelf.id, book2.id);

      // Act: Filter by shelf + status + search + tags + rating
      const result = await bookRepository.findWithFilters(
        {
          shelfIds: [shelf.id],
          status: "reading",
          search: "Dragon",
          tags: ["Fantasy"],
          rating: "5",
        },
        50,
        0
      );

      // Assert: Should only return book1
      expect(result.total).toBe(1);
      expect(result.books).toHaveLength(1);
      expect(result.books[0].id).toBe(book1.id);
    });
  });

  describe("Orphaned Books with Shelf Filter", () => {
    test("should exclude orphaned books from shelf filter results", async () => {
      // Arrange: Create shelf with normal and orphaned books
      const shelf = await shelfRepository.create({
        name: "Mixed Shelf",
        userId: null,
      });

      const normalBook = await bookRepository.create(createTestBook({
        calibreId: 1,
        title: "Normal Book",
        authors: ["Author 1"],
        path: "Author 1/Normal Book (1)",
        orphaned: false,
      }));

      const orphanedBook = await bookRepository.create(createTestBook({
        calibreId: 2,
        title: "Orphaned Book",
        authors: ["Author 2"],
        path: "Author 2/Orphaned Book (2)",
        orphaned: true,
        orphanedAt: new Date(),
      }));

      // Add both books to shelf
      await shelfRepository.addBookToShelf(shelf.id, normalBook.id);
      await shelfRepository.addBookToShelf(shelf.id, orphanedBook.id);

      // Act: Filter by shelf (orphaned books excluded by default)
      const result = await bookRepository.findWithFilters({ shelfIds: [shelf.id] }, 50, 0);

      // Assert: Should only return normal book
      expect(result.total).toBe(1);
      expect(result.books).toHaveLength(1);
      expect(result.books[0].id).toBe(normalBook.id);
    });

    test("should include orphaned books when showOrphaned is true", async () => {
      // Arrange: Create shelf with normal and orphaned books
      const shelf = await shelfRepository.create({
        name: "Mixed Shelf",
        userId: null,
      });

      const normalBook = await bookRepository.create(createTestBook({
        calibreId: 1,
        title: "Normal Book",
        authors: ["Author 1"],
        path: "Author 1/Normal Book (1)",
        orphaned: false,
      }));

      const orphanedBook = await bookRepository.create(createTestBook({
        calibreId: 2,
        title: "Orphaned Book",
        authors: ["Author 2"],
        path: "Author 2/Orphaned Book (2)",
        orphaned: true,
        orphanedAt: new Date(),
      }));

      // Add both books to shelf
      await shelfRepository.addBookToShelf(shelf.id, normalBook.id);
      await shelfRepository.addBookToShelf(shelf.id, orphanedBook.id);

      // Act: Filter by shelf with showOrphaned = true
      const result = await bookRepository.findWithFilters(
        { shelfIds: [shelf.id], showOrphaned: true },
        50,
        0
      );

      // Assert: Should return both books
      expect(result.total).toBe(2);
      expect(result.books).toHaveLength(2);
      const bookIds = result.books.map(b => b.id);
      expect(bookIds).toContain(normalBook.id);
      expect(bookIds).toContain(orphanedBook.id);
    });

    test("should return only orphaned books when orphanedOnly is true", async () => {
      // Arrange: Create shelf with normal and orphaned books
      const shelf = await shelfRepository.create({
        name: "Mixed Shelf",
        userId: null,
      });

      const normalBook = await bookRepository.create(createTestBook({
        calibreId: 1,
        title: "Normal Book",
        authors: ["Author 1"],
        path: "Author 1/Normal Book (1)",
        orphaned: false,
      }));

      const orphanedBook = await bookRepository.create(createTestBook({
        calibreId: 2,
        title: "Orphaned Book",
        authors: ["Author 2"],
        path: "Author 2/Orphaned Book (2)",
        orphaned: true,
        orphanedAt: new Date(),
      }));

      // Add both books to shelf
      await shelfRepository.addBookToShelf(shelf.id, normalBook.id);
      await shelfRepository.addBookToShelf(shelf.id, orphanedBook.id);

      // Act: Filter by shelf with orphanedOnly = true
      const result = await bookRepository.findWithFilters(
        { shelfIds: [shelf.id], orphanedOnly: true },
        50,
        0
      );

      // Assert: Should only return orphaned book
      expect(result.total).toBe(1);
      expect(result.books).toHaveLength(1);
      expect(result.books[0].id).toBe(orphanedBook.id);
    });
  });

  describe("Pagination with Shelf Filter", () => {
    test("should support pagination with shelf filter", async () => {
      // Arrange: Create shelf with 10 books
      const shelf = await shelfRepository.create({
        name: "Large Shelf",
        userId: null,
      });

      const createdBooks = [];
      for (let i = 1; i <= 10; i++) {
        const book = await bookRepository.create(createTestBook({
          calibreId: i,
          title: `Book ${i}`,
          authors: ["Author"],
          path: `Author/Book ${i} (${i})`,
        }));
        await shelfRepository.addBookToShelf(shelf.id, book.id);
        createdBooks.push(book);
      }

      // Act: Get first page (5 books)
      const page1 = await bookRepository.findWithFilters({ shelfIds: [shelf.id] }, 5, 0);

      // Assert page 1
      expect(page1.total).toBe(10);
      expect(page1.books).toHaveLength(5);

      // Act: Get second page (next 5 books)
      const page2 = await bookRepository.findWithFilters({ shelfIds: [shelf.id] }, 5, 5);

      // Assert page 2
      expect(page2.total).toBe(10);
      expect(page2.books).toHaveLength(5);

      // Verify no overlap between pages
      const page1Ids = page1.books.map(b => b.id);
      const page2Ids = page2.books.map(b => b.id);
      const overlap = page1Ids.filter(id => page2Ids.includes(id));
      expect(overlap).toHaveLength(0);
    });

    test("should handle skip beyond available books", async () => {
      // Arrange: Create shelf with 5 books
      const shelf = await shelfRepository.create({
        name: "Small Shelf",
        userId: null,
      });

      for (let i = 1; i <= 5; i++) {
        const book = await bookRepository.create(createTestBook({
          calibreId: i,
          title: `Book ${i}`,
          authors: ["Author"],
          path: `Author/Book ${i} (${i})`,
        }));
        await shelfRepository.addBookToShelf(shelf.id, book.id);
      }

      // Act: Skip way beyond available books
      const result = await bookRepository.findWithFilters({ shelfIds: [shelf.id] }, 10, 100);

      // Assert
      expect(result.total).toBe(5);
      expect(result.books).toHaveLength(0);
    });
  });

  describe("Edge Cases", () => {
    test("should handle empty shelfIds array", async () => {
      // Arrange: Create books
      await bookRepository.create(createTestBook({
        calibreId: 1,
        title: "Book",
        authors: ["Author"],
        path: "Author/Book (1)",
      }));

      // Act: Filter with empty shelfIds array
      const result = await bookRepository.findWithFilters({ shelfIds: [] }, 50, 0);

      // Assert: Should return all books (empty array means no filter)
      expect(result.total).toBe(1);
      expect(result.books).toHaveLength(1);
    });

    test("should handle book on multiple shelves correctly", async () => {
      // Arrange: Create multiple shelves
      const shelf1 = await shelfRepository.create({
        name: "Shelf 1",
        userId: null,
      });

      const shelf2 = await shelfRepository.create({
        name: "Shelf 2",
        userId: null,
      });

      const shelf3 = await shelfRepository.create({
        name: "Shelf 3",
        userId: null,
      });

      // Create a book on all three shelves
      const book = await bookRepository.create(createTestBook({
        calibreId: 1,
        title: "Multi-Shelf Book",
        authors: ["Author"],
        path: "Author/Book (1)",
      }));

      await shelfRepository.addBookToShelf(shelf1.id, book.id);
      await shelfRepository.addBookToShelf(shelf2.id, book.id);
      await shelfRepository.addBookToShelf(shelf3.id, book.id);

      // Act: Filter by all three shelves
      const result = await bookRepository.findWithFilters(
        { shelfIds: [shelf1.id, shelf2.id, shelf3.id] },
        50,
        0
      );

      // Assert: Should return book only once (no duplicates)
      expect(result.total).toBe(1);
      expect(result.books).toHaveLength(1);
      expect(result.books[0].id).toBe(book.id);
    });

    test("should handle shelf with single book", async () => {
      // Arrange: Create shelf with one book
      const shelf = await shelfRepository.create({
        name: "Single Book Shelf",
        userId: null,
      });

      const book = await bookRepository.create(createTestBook({
        calibreId: 1,
        title: "Only Book",
        authors: ["Author"],
        path: "Author/Only Book (1)",
      }));

      await shelfRepository.addBookToShelf(shelf.id, book.id);

      // Act
      const result = await bookRepository.findWithFilters({ shelfIds: [shelf.id] }, 50, 0);

      // Assert
      expect(result.total).toBe(1);
      expect(result.books).toHaveLength(1);
      expect(result.books[0].id).toBe(book.id);
    });
  });
});


