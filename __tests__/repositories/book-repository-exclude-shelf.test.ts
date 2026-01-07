import { describe, test, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { bookRepository } from "@/lib/repositories";
import { shelfRepository } from "@/lib/repositories/shelf.repository";
import { sessionRepository } from "@/lib/repositories/session.repository";
import { setupTestDatabase, teardownTestDatabase, clearTestDatabase } from "@/__tests__/helpers/db-setup";
import { createTestBook } from "../fixtures/test-data";

/**
 * BookRepository excludeShelfId Filter Tests
 * 
 * Tests the excludeShelfId filter in findWithFilters() and findWithFiltersAndRelations() methods.
 * This filter is used for the "Add Books to Shelf" modal to exclude books already on a shelf.
 * 
 * Coverage for lines 407-421 in book.repository.ts
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

describe("BookRepository excludeShelfId Filter", () => {
  describe("Basic excludeShelfId Filtering - findWithFilters()", () => {
    test("should exclude books on specified shelf", async () => {
      // Arrange: Create shelf and books
      const shelf = await shelfRepository.create({
        name: "My Shelf",
        userId: null,
      });

      const bookOnShelf = await bookRepository.create(createTestBook({
        calibreId: 1,
        title: "Book on Shelf",
        authors: ["Author 1"],
        path: "Author 1/Book on Shelf (1)",
      }));

      const bookNotOnShelf = await bookRepository.create(createTestBook({
        calibreId: 2,
        title: "Book Not on Shelf",
        authors: ["Author 2"],
        path: "Author 2/Book Not on Shelf (2)",
      }));

      // Add only bookOnShelf to the shelf
      await shelfRepository.addBookToShelf(shelf.id, bookOnShelf.id);

      // Act: Filter with excludeShelfId
      const result = await bookRepository.findWithFilters(
        { excludeShelfId: shelf.id },
        50,
        0
      );

      // Assert: Should only return bookNotOnShelf
      expect(result.total).toBe(1);
      expect(result.books).toHaveLength(1);
      expect(result.books[0].id).toBe(bookNotOnShelf.id);
      expect(result.books[0].title).toBe("Book Not on Shelf");
    });

    test("should return all books when excludeShelfId is not provided", async () => {
      // Arrange: Create books
      await bookRepository.create(createTestBook({
        calibreId: 1,
        title: "Book 1",
        authors: ["Author 1"],
        path: "Author 1/Book 1 (1)",
      }));

      await bookRepository.create(createTestBook({
        calibreId: 2,
        title: "Book 2",
        authors: ["Author 2"],
        path: "Author 2/Book 2 (2)",
      }));

      // Act: Filter without excludeShelfId
      const result = await bookRepository.findWithFilters({}, 50, 0);

      // Assert: Should return all books
      expect(result.total).toBe(2);
      expect(result.books).toHaveLength(2);
    });

    test("should return all books when shelf has no books", async () => {
      // Arrange: Create empty shelf and books
      const emptyShelf = await shelfRepository.create({
        name: "Empty Shelf",
        userId: null,
      });

      await bookRepository.create(createTestBook({
        calibreId: 1,
        title: "Book 1",
        authors: ["Author 1"],
        path: "Author 1/Book 1 (1)",
      }));

      await bookRepository.create(createTestBook({
        calibreId: 2,
        title: "Book 2",
        authors: ["Author 2"],
        path: "Author 2/Book 2 (2)",
      }));

      // Act: Filter with excludeShelfId on empty shelf
      const result = await bookRepository.findWithFilters(
        { excludeShelfId: emptyShelf.id },
        50,
        0
      );

      // Assert: Should return all books (nothing to exclude)
      expect(result.total).toBe(2);
      expect(result.books).toHaveLength(2);
    });

    test("should return all books when excluding non-existent shelf", async () => {
      // Arrange: Create books
      await bookRepository.create(createTestBook({
        calibreId: 1,
        title: "Book 1",
        authors: ["Author 1"],
        path: "Author 1/Book 1 (1)",
      }));

      await bookRepository.create(createTestBook({
        calibreId: 2,
        title: "Book 2",
        authors: ["Author 2"],
        path: "Author 2/Book 2 (2)",
      }));

      // Act: Filter with non-existent shelf ID
      const result = await bookRepository.findWithFilters(
        { excludeShelfId: 9999 },
        50,
        0
      );

      // Assert: Should return all books
      expect(result.total).toBe(2);
      expect(result.books).toHaveLength(2);
    });

    test("should exclude multiple books on the same shelf", async () => {
      // Arrange: Create shelf and books
      const shelf = await shelfRepository.create({
        name: "Multi-Book Shelf",
        userId: null,
      });

      const bookOnShelf1 = await bookRepository.create(createTestBook({
        calibreId: 1,
        title: "Book on Shelf 1",
        authors: ["Author 1"],
        path: "Author 1/Book 1 (1)",
      }));

      const bookOnShelf2 = await bookRepository.create(createTestBook({
        calibreId: 2,
        title: "Book on Shelf 2",
        authors: ["Author 2"],
        path: "Author 2/Book 2 (2)",
      }));

      const bookNotOnShelf = await bookRepository.create(createTestBook({
        calibreId: 3,
        title: "Book Not on Shelf",
        authors: ["Author 3"],
        path: "Author 3/Book 3 (3)",
      }));

      // Add two books to shelf
      await shelfRepository.addBookToShelf(shelf.id, bookOnShelf1.id);
      await shelfRepository.addBookToShelf(shelf.id, bookOnShelf2.id);

      // Act: Filter with excludeShelfId
      const result = await bookRepository.findWithFilters(
        { excludeShelfId: shelf.id },
        50,
        0
      );

      // Assert: Should only return bookNotOnShelf
      expect(result.total).toBe(1);
      expect(result.books).toHaveLength(1);
      expect(result.books[0].id).toBe(bookNotOnShelf.id);
    });
  });

  describe("excludeShelfId with findWithFiltersAndRelations()", () => {
    test("should exclude books on shelf with relations loaded", async () => {
      // Arrange: Create shelf and books with sessions
      const shelf = await shelfRepository.create({
        name: "Test Shelf",
        userId: null,
      });

      const bookOnShelf = await bookRepository.create(createTestBook({
        calibreId: 1,
        title: "Book on Shelf",
        authors: ["Author 1"],
        path: "Author 1/Book (1)",
      }));

      const bookNotOnShelf = await bookRepository.create(createTestBook({
        calibreId: 2,
        title: "Book Not on Shelf",
        authors: ["Author 2"],
        path: "Author 2/Book (2)",
      }));

      // Add sessions
      await sessionRepository.create({
        bookId: bookOnShelf.id,
        userId: null,
        sessionNumber: 1,
        status: "reading",
        isActive: true,
      });

      await sessionRepository.create({
        bookId: bookNotOnShelf.id,
        userId: null,
        sessionNumber: 1,
        status: "to-read",
        isActive: true,
      });

      // Add bookOnShelf to shelf
      await shelfRepository.addBookToShelf(shelf.id, bookOnShelf.id);

      // Act: Filter with excludeShelfId and load relations
      const result = await bookRepository.findWithFiltersAndRelations(
        { excludeShelfId: shelf.id },
        50,
        0
      );

      // Assert: Should only return bookNotOnShelf with loaded status
      expect(result.total).toBe(1);
      expect(result.books).toHaveLength(1);
      expect(result.books[0].id).toBe(bookNotOnShelf.id);
      expect(result.books[0].status).toBe("to-read");
    });
  });

  describe("excludeShelfId Combined with Other Filters", () => {
    test("should combine excludeShelfId with search filter", async () => {
      // Arrange: Create shelf and books
      const shelf = await shelfRepository.create({
        name: "Search Shelf",
        userId: null,
      });

      const dragonOnShelf = await bookRepository.create(createTestBook({
        calibreId: 1,
        title: "Dragons of Fire",
        authors: ["Author 1"],
        path: "Author 1/Dragons of Fire (1)",
      }));

      const dragonNotOnShelf = await bookRepository.create(createTestBook({
        calibreId: 2,
        title: "Dragons of Ice",
        authors: ["Author 2"],
        path: "Author 2/Dragons of Ice (2)",
      }));

      await bookRepository.create(createTestBook({
        calibreId: 3,
        title: "Wizards Magic",
        authors: ["Author 3"],
        path: "Author 3/Wizards Magic (3)",
      }));

      // Add dragonOnShelf to shelf
      await shelfRepository.addBookToShelf(shelf.id, dragonOnShelf.id);

      // Act: Filter with excludeShelfId AND search for "Dragons"
      const result = await bookRepository.findWithFilters(
        {
          excludeShelfId: shelf.id,
          search: "Dragons",
        },
        50,
        0
      );

      // Assert: Should only return dragonNotOnShelf (matches search AND not on shelf)
      expect(result.total).toBe(1);
      expect(result.books).toHaveLength(1);
      expect(result.books[0].id).toBe(dragonNotOnShelf.id);
    });

    test("should combine excludeShelfId with status filter", async () => {
      // Arrange: Create shelf and books with sessions
      const shelf = await shelfRepository.create({
        name: "Status Shelf",
        userId: null,
      });

      // Book 1: On shelf, reading status
      const book1 = await bookRepository.create(createTestBook({
        calibreId: 1,
        title: "Reading on Shelf",
        authors: ["Author 1"],
        path: "Author 1/Book 1 (1)",
      }));

      await sessionRepository.create({
        bookId: book1.id,
        userId: null,
        sessionNumber: 1,
        status: "reading",
        isActive: true,
      });

      // Book 2: Not on shelf, reading status
      const book2 = await bookRepository.create(createTestBook({
        calibreId: 2,
        title: "Reading Not on Shelf",
        authors: ["Author 2"],
        path: "Author 2/Book 2 (2)",
      }));

      await sessionRepository.create({
        bookId: book2.id,
        userId: null,
        sessionNumber: 1,
        status: "reading",
        isActive: true,
      });

      // Book 3: Not on shelf, to-read status
      const book3 = await bookRepository.create(createTestBook({
        calibreId: 3,
        title: "To-Read Not on Shelf",
        authors: ["Author 3"],
        path: "Author 3/Book 3 (3)",
      }));

      await sessionRepository.create({
        bookId: book3.id,
        userId: null,
        sessionNumber: 1,
        status: "to-read",
        isActive: true,
      });

      await shelfRepository.addBookToShelf(shelf.id, book1.id);

      // Act: Filter by excludeShelfId AND reading status
      const result = await bookRepository.findWithFilters(
        {
          excludeShelfId: shelf.id,
          status: "reading",
        },
        50,
        0
      );

      // Assert: Should only return book2 (not on shelf AND reading)
      expect(result.total).toBe(1);
      expect(result.books).toHaveLength(1);
      expect(result.books[0].id).toBe(book2.id);
    });

    test("should combine excludeShelfId with tags filter", async () => {
      // Arrange: Create shelf and books with tags
      const shelf = await shelfRepository.create({
        name: "Tagged Shelf",
        userId: null,
      });

      const fantasyOnShelf = await bookRepository.create(createTestBook({
        calibreId: 1,
        title: "Fantasy on Shelf",
        authors: ["Author 1"],
        path: "Author 1/Book 1 (1)",
        tags: ["Fantasy", "Magic"],
      }));

      const fantasyNotOnShelf = await bookRepository.create(createTestBook({
        calibreId: 2,
        title: "Fantasy Not on Shelf",
        authors: ["Author 2"],
        path: "Author 2/Book 2 (2)",
        tags: ["Fantasy", "Adventure"],
      }));

      await bookRepository.create(createTestBook({
        calibreId: 3,
        title: "Sci-Fi Not on Shelf",
        authors: ["Author 3"],
        path: "Author 3/Book 3 (3)",
        tags: ["Sci-Fi"],
      }));

      await shelfRepository.addBookToShelf(shelf.id, fantasyOnShelf.id);

      // Act: Filter by excludeShelfId AND Fantasy tag
      const result = await bookRepository.findWithFilters(
        {
          excludeShelfId: shelf.id,
          tags: ["Fantasy"],
        },
        50,
        0
      );

      // Assert: Should only return fantasyNotOnShelf
      expect(result.total).toBe(1);
      expect(result.books).toHaveLength(1);
      expect(result.books[0].id).toBe(fantasyNotOnShelf.id);
    });

    test("should combine excludeShelfId with rating filter", async () => {
      // Arrange: Create shelf and books with ratings
      const shelf = await shelfRepository.create({
        name: "Rated Shelf",
        userId: null,
      });

      const fiveStarOnShelf = await bookRepository.create(createTestBook({
        calibreId: 1,
        title: "5-Star on Shelf",
        authors: ["Author 1"],
        path: "Author 1/Book 1 (1)",
        rating: 5,
      }));

      const fiveStarNotOnShelf = await bookRepository.create(createTestBook({
        calibreId: 2,
        title: "5-Star Not on Shelf",
        authors: ["Author 2"],
        path: "Author 2/Book 2 (2)",
        rating: 5,
      }));

      await bookRepository.create(createTestBook({
        calibreId: 3,
        title: "3-Star Not on Shelf",
        authors: ["Author 3"],
        path: "Author 3/Book 3 (3)",
        rating: 3,
      }));

      await shelfRepository.addBookToShelf(shelf.id, fiveStarOnShelf.id);

      // Act: Filter by excludeShelfId AND 5-star rating
      const result = await bookRepository.findWithFilters(
        {
          excludeShelfId: shelf.id,
          rating: "5",
        },
        50,
        0
      );

      // Assert: Should only return fiveStarNotOnShelf
      expect(result.total).toBe(1);
      expect(result.books).toHaveLength(1);
      expect(result.books[0].id).toBe(fiveStarNotOnShelf.id);
    });

    test("should combine excludeShelfId with multiple filters simultaneously", async () => {
      // Arrange: Complex scenario
      const shelf = await shelfRepository.create({
        name: "Complex Shelf",
        userId: null,
      });

      // Book 1: On shelf, matches all filters
      const book1 = await bookRepository.create(createTestBook({
        calibreId: 1,
        title: "Perfect Dragon on Shelf",
        authors: ["Author 1"],
        path: "Author 1/Book 1 (1)",
        tags: ["Fantasy"],
        rating: 5,
      }));

      await sessionRepository.create({
        bookId: book1.id,
        userId: null,
        sessionNumber: 1,
        status: "reading",
        isActive: true,
      });

      // Book 2: Not on shelf, matches all filters
      const book2 = await bookRepository.create(createTestBook({
        calibreId: 2,
        title: "Perfect Dragon Not on Shelf",
        authors: ["Author 2"],
        path: "Author 2/Book 2 (2)",
        tags: ["Fantasy"],
        rating: 5,
      }));

      await sessionRepository.create({
        bookId: book2.id,
        userId: null,
        sessionNumber: 1,
        status: "reading",
        isActive: true,
      });

      // Book 3: Not on shelf, wrong status
      const book3 = await bookRepository.create(createTestBook({
        calibreId: 3,
        title: "Dragon Wrong Status",
        authors: ["Author 3"],
        path: "Author 3/Book 3 (3)",
        tags: ["Fantasy"],
        rating: 5,
      }));

      await sessionRepository.create({
        bookId: book3.id,
        userId: null,
        sessionNumber: 1,
        status: "to-read",
        isActive: true,
      });

      await shelfRepository.addBookToShelf(shelf.id, book1.id);

      // Act: Filter by excludeShelfId + status + search + tags + rating
      const result = await bookRepository.findWithFilters(
        {
          excludeShelfId: shelf.id,
          status: "reading",
          search: "Dragon",
          tags: ["Fantasy"],
          rating: "5",
        },
        50,
        0
      );

      // Assert: Should only return book2
      expect(result.total).toBe(1);
      expect(result.books).toHaveLength(1);
      expect(result.books[0].id).toBe(book2.id);
    });
  });

  describe("Edge Cases with excludeShelfId", () => {
    test("should handle book on multiple shelves - only exclude one shelf", async () => {
      // Arrange: Create two shelves
      const shelf1 = await shelfRepository.create({
        name: "Shelf 1",
        userId: null,
      });

      const shelf2 = await shelfRepository.create({
        name: "Shelf 2",
        userId: null,
      });

      // Book on both shelves
      const bookOnBoth = await bookRepository.create(createTestBook({
        calibreId: 1,
        title: "Book on Both",
        authors: ["Author 1"],
        path: "Author 1/Book (1)",
      }));

      // Book only on shelf1
      const bookOnShelf1 = await bookRepository.create(createTestBook({
        calibreId: 2,
        title: "Book on Shelf 1 Only",
        authors: ["Author 2"],
        path: "Author 2/Book (2)",
      }));

      // Book on no shelves
      const bookOnNeither = await bookRepository.create(createTestBook({
        calibreId: 3,
        title: "Book on No Shelves",
        authors: ["Author 3"],
        path: "Author 3/Book (3)",
      }));

      await shelfRepository.addBookToShelf(shelf1.id, bookOnBoth.id);
      await shelfRepository.addBookToShelf(shelf2.id, bookOnBoth.id);
      await shelfRepository.addBookToShelf(shelf1.id, bookOnShelf1.id);

      // Act: Exclude shelf1
      const result = await bookRepository.findWithFilters(
        { excludeShelfId: shelf1.id },
        50,
        0
      );

      // Assert: Should exclude books on shelf1 (bookOnBoth and bookOnShelf1)
      // Should return only bookOnNeither
      expect(result.total).toBe(1);
      expect(result.books).toHaveLength(1);
      expect(result.books[0].id).toBe(bookOnNeither.id);
    });

    test("should handle orphaned books with excludeShelfId", async () => {
      // Arrange: Create shelf with orphaned and normal books
      const shelf = await shelfRepository.create({
        name: "Mixed Shelf",
        userId: null,
      });

      const normalBookOnShelf = await bookRepository.create(createTestBook({
        calibreId: 1,
        title: "Normal Book on Shelf",
        authors: ["Author 1"],
        path: "Author 1/Book (1)",
        orphaned: false,
      }));

      const orphanedBookOnShelf = await bookRepository.create(createTestBook({
        calibreId: 2,
        title: "Orphaned Book on Shelf",
        authors: ["Author 2"],
        path: "Author 2/Book (2)",
        orphaned: true,
        orphanedAt: new Date(),
      }));

      const normalBookNotOnShelf = await bookRepository.create(createTestBook({
        calibreId: 3,
        title: "Normal Book Not on Shelf",
        authors: ["Author 3"],
        path: "Author 3/Book (3)",
        orphaned: false,
      }));

      await shelfRepository.addBookToShelf(shelf.id, normalBookOnShelf.id);
      await shelfRepository.addBookToShelf(shelf.id, orphanedBookOnShelf.id);

      // Act: Filter with excludeShelfId (orphaned books excluded by default)
      const result = await bookRepository.findWithFilters(
        { excludeShelfId: shelf.id },
        50,
        0
      );

      // Assert: Should return normalBookNotOnShelf only
      // (orphaned books excluded by default filter behavior)
      expect(result.total).toBe(1);
      expect(result.books).toHaveLength(1);
      expect(result.books[0].id).toBe(normalBookNotOnShelf.id);
    });

    test("should handle pagination with excludeShelfId", async () => {
      // Arrange: Create shelf and many books
      const shelf = await shelfRepository.create({
        name: "Paginated Shelf",
        userId: null,
      });

      const books = [];
      for (let i = 1; i <= 20; i++) {
        const book = await bookRepository.create(createTestBook({
          calibreId: i,
          title: `Book ${i}`,
          authors: [`Author ${i}`],
          path: `Author ${i}/Book ${i} (${i})`,
        }));
        books.push(book);
      }

      // Add first 10 books to shelf
      for (let i = 0; i < 10; i++) {
        await shelfRepository.addBookToShelf(shelf.id, books[i].id);
      }

      // Act: Get first page (5 books) excluding shelf
      const page1 = await bookRepository.findWithFilters(
        { excludeShelfId: shelf.id },
        5,
        0
      );

      // Assert: Should return 10 total, 5 on first page
      expect(page1.total).toBe(10);
      expect(page1.books).toHaveLength(5);

      // Act: Get second page
      const page2 = await bookRepository.findWithFilters(
        { excludeShelfId: shelf.id },
        5,
        5
      );

      // Assert: Should return next 5 books
      expect(page2.total).toBe(10);
      expect(page2.books).toHaveLength(5);

      // Verify no overlap
      const page1Ids = page1.books.map(b => b.id);
      const page2Ids = page2.books.map(b => b.id);
      const overlap = page1Ids.filter(id => page2Ids.includes(id));
      expect(overlap).toHaveLength(0);
    });

    test("should return empty result when all books are on excluded shelf", async () => {
      // Arrange: Create shelf and books
      const shelf = await shelfRepository.create({
        name: "Full Library Shelf",
        userId: null,
      });

      const book1 = await bookRepository.create(createTestBook({
        calibreId: 1,
        title: "Book 1",
        authors: ["Author 1"],
        path: "Author 1/Book (1)",
      }));

      const book2 = await bookRepository.create(createTestBook({
        calibreId: 2,
        title: "Book 2",
        authors: ["Author 2"],
        path: "Author 2/Book (2)",
      }));

      // Add all books to shelf
      await shelfRepository.addBookToShelf(shelf.id, book1.id);
      await shelfRepository.addBookToShelf(shelf.id, book2.id);

      // Act: Filter with excludeShelfId
      const result = await bookRepository.findWithFilters(
        { excludeShelfId: shelf.id },
        50,
        0
      );

      // Assert: Should return empty (all books excluded)
      expect(result.total).toBe(0);
      expect(result.books).toHaveLength(0);
    });
  });
});
