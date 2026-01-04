import { describe, test, expect, beforeAll, afterAll, beforeEach } from "bun:test";
import { bookRepository } from "@/lib/repositories";
import { setupTestDatabase, teardownTestDatabase, clearTestDatabase } from "@/__tests__/helpers/db-setup";
import { createTestBook } from "../fixtures/test-data";

/**
 * BookRepository Tag Methods Tests
 * 
 * Tests the tag-related methods in BookRepository:
 * - getTagStats(): Get all tags with book counts
 * - countBooksWithTags(): Count books that have at least one tag
 * - findByTag(): Find books by a specific tag with pagination
 * 
 * These methods use SQLite's json_each() for efficient tag querying.
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

describe("BookRepository.getTagStats()", () => {
  describe("Basic Functionality", () => {
    test("should return all tags with their book counts", async () => {
      // Arrange: Create books with various tags
      await bookRepository.create(createTestBook({
        calibreId: 1,
        title: "Book 1",
        authors: ["Author"],
        path: "Author/Book 1 (1)",
        tags: ["Fantasy", "Magic"],
      }));

      await bookRepository.create(createTestBook({
        calibreId: 2,
        title: "Book 2",
        authors: ["Author"],
        path: "Author/Book 2 (2)",
        tags: ["Fantasy", "Adventure"],
      }));

      await bookRepository.create(createTestBook({
        calibreId: 3,
        title: "Book 3",
        authors: ["Author"],
        path: "Author/Book 3 (3)",
        tags: ["Sci-Fi"],
      }));

      // Act
      const stats = await bookRepository.getTagStats();

      // Assert
      expect(stats).toHaveLength(4); // Adventure, Fantasy, Magic, Sci-Fi
      
      const fantasyTag = stats.find(s => s.name === "Fantasy");
      expect(fantasyTag).toBeDefined();
      expect(fantasyTag?.bookCount).toBe(2);
      
      const magicTag = stats.find(s => s.name === "Magic");
      expect(magicTag?.bookCount).toBe(1);
      
      const adventureTag = stats.find(s => s.name === "Adventure");
      expect(adventureTag?.bookCount).toBe(1);
      
      const sciFiTag = stats.find(s => s.name === "Sci-Fi");
      expect(sciFiTag?.bookCount).toBe(1);
    });

    test("should return empty array when no books have tags", async () => {
      // Arrange: Create books without tags
      await bookRepository.create(createTestBook({
        calibreId: 1,
        title: "Book",
        authors: ["Author"],
        path: "Author/Book (1)",
        tags: [],
      }));

      // Act
      const stats = await bookRepository.getTagStats();

      // Assert
      expect(stats).toHaveLength(0);
    });

    test("should return tags in alphabetical order", async () => {
      // Arrange: Create books with tags in non-alphabetical order
      await bookRepository.create(createTestBook({
        calibreId: 1,
        title: "Book 1",
        authors: ["Author"],
        path: "Author/Book 1 (1)",
        tags: ["Zebra", "Apple", "Monkey"],
      }));

      // Act
      const stats = await bookRepository.getTagStats();

      // Assert
      expect(stats).toHaveLength(3);
      expect(stats[0].name).toBe("Apple");
      expect(stats[1].name).toBe("Monkey");
      expect(stats[2].name).toBe("Zebra");
    });

    test("should count each book once per tag (no duplicates)", async () => {
      // Arrange: Multiple books with same tag
      await bookRepository.create(createTestBook({
        calibreId: 1,
        title: "Book 1",
        authors: ["Author"],
        path: "Author/Book 1 (1)",
        tags: ["Fantasy"],
      }));

      await bookRepository.create(createTestBook({
        calibreId: 2,
        title: "Book 2",
        authors: ["Author"],
        path: "Author/Book 2 (2)",
        tags: ["Fantasy"],
      }));

      await bookRepository.create(createTestBook({
        calibreId: 3,
        title: "Book 3",
        authors: ["Author"],
        path: "Author/Book 3 (3)",
        tags: ["Fantasy"],
      }));

      // Act
      const stats = await bookRepository.getTagStats();

      // Assert
      expect(stats).toHaveLength(1);
      expect(stats[0].name).toBe("Fantasy");
      expect(stats[0].bookCount).toBe(3); // 3 distinct books
    });
  });

  describe("Edge Cases", () => {
    test("should handle tags with special characters", async () => {
      // Arrange
      await bookRepository.create(createTestBook({
        calibreId: 1,
        title: "Book",
        authors: ["Author"],
        path: "Author/Book (1)",
        tags: ["Action & Adventure", "Science-Fiction", "Editor's Choice"],
      }));

      // Act
      const stats = await bookRepository.getTagStats();

      // Assert
      expect(stats).toHaveLength(3);
      expect(stats.some(s => s.name === "Action & Adventure")).toBe(true);
      expect(stats.some(s => s.name === "Science-Fiction")).toBe(true);
      expect(stats.some(s => s.name === "Editor's Choice")).toBe(true);
    });

    test("should handle unicode tag names", async () => {
      // Arrange
      await bookRepository.create(createTestBook({
        calibreId: 1,
        title: "Book",
        authors: ["Author"],
        path: "Author/Book (1)",
        tags: ["科幻小説", "ファンタジー", "🔮 Magic"],
      }));

      // Act
      const stats = await bookRepository.getTagStats();

      // Assert
      expect(stats).toHaveLength(3);
      expect(stats.some(s => s.name === "科幻小説")).toBe(true);
      expect(stats.some(s => s.name === "ファンタジー")).toBe(true);
      expect(stats.some(s => s.name === "🔮 Magic")).toBe(true);
    });

    test("should handle very long tag names", async () => {
      // Arrange
      const longTag = "A".repeat(200);
      await bookRepository.create(createTestBook({
        calibreId: 1,
        title: "Book",
        authors: ["Author"],
        path: "Author/Book (1)",
        tags: [longTag],
      }));

      // Act
      const stats = await bookRepository.getTagStats();

      // Assert
      expect(stats).toHaveLength(1);
      expect(stats[0].name).toBe(longTag);
      expect(stats[0].bookCount).toBe(1);
    });

    test("should handle large number of tags", async () => {
      // Arrange: Book with 50 tags
      const manyTags = Array.from({ length: 50 }, (_, i) => `Tag ${i + 1}`);
      await bookRepository.create(createTestBook({
        calibreId: 1,
        title: "Book",
        authors: ["Author"],
        path: "Author/Book (1)",
        tags: manyTags,
      }));

      // Act
      const stats = await bookRepository.getTagStats();

      // Assert
      expect(stats).toHaveLength(50);
      stats.forEach(stat => {
        expect(stat.bookCount).toBe(1);
      });
    });

    test("should handle books with duplicate tags (defensive)", async () => {
      // Note: This shouldn't happen in practice, but tests robustness
      // Manually create book with duplicate tag in JSON array
      const book = await bookRepository.create(createTestBook({
        calibreId: 1,
        title: "Book",
        authors: ["Author"],
        path: "Author/Book (1)",
        tags: ["Fantasy", "Fantasy"], // Duplicate
      }));

      // Act
      const stats = await bookRepository.getTagStats();

      // Assert: Should count as 1 book, not 2
      expect(stats).toHaveLength(1);
      expect(stats[0].name).toBe("Fantasy");
      expect(stats[0].bookCount).toBe(1); // COUNT(DISTINCT books.id)
    });

    test("should return empty array when database has no books", async () => {
      // Act
      const stats = await bookRepository.getTagStats();

      // Assert
      expect(stats).toEqual([]);
    });
  });

  describe("Multiple Books Scenarios", () => {
    test("should aggregate counts across all books", async () => {
      // Arrange: Complex tag distribution
      await bookRepository.create(createTestBook({
        calibreId: 1,
        title: "Book 1",
        authors: ["Author"],
        path: "Author/Book 1 (1)",
        tags: ["Fantasy", "Magic", "Adventure"],
      }));

      await bookRepository.create(createTestBook({
        calibreId: 2,
        title: "Book 2",
        authors: ["Author"],
        path: "Author/Book 2 (2)",
        tags: ["Fantasy", "Magic"], // Shares 2 tags with Book 1
      }));

      await bookRepository.create(createTestBook({
        calibreId: 3,
        title: "Book 3",
        authors: ["Author"],
        path: "Author/Book 3 (3)",
        tags: ["Sci-Fi", "Space"], // Completely different tags
      }));

      // Act
      const stats = await bookRepository.getTagStats();

      // Assert
      expect(stats).toHaveLength(5); // Adventure, Fantasy, Magic, Sci-Fi, Space
      
      const fantasyStat = stats.find(s => s.name === "Fantasy");
      expect(fantasyStat?.bookCount).toBe(2); // Books 1 & 2
      
      const magicStat = stats.find(s => s.name === "Magic");
      expect(magicStat?.bookCount).toBe(2); // Books 1 & 2
      
      const adventureStat = stats.find(s => s.name === "Adventure");
      expect(adventureStat?.bookCount).toBe(1); // Book 1 only
      
      const sciFiStat = stats.find(s => s.name === "Sci-Fi");
      expect(sciFiStat?.bookCount).toBe(1); // Book 3 only
    });
  });
});

describe("BookRepository.countBooksWithTags()", () => {
  describe("Basic Functionality", () => {
    test("should count books that have at least one tag", async () => {
      // Arrange
      await bookRepository.create(createTestBook({
        calibreId: 1,
        title: "Book 1",
        authors: ["Author"],
        path: "Author/Book 1 (1)",
        tags: ["Fantasy"],
      }));

      await bookRepository.create(createTestBook({
        calibreId: 2,
        title: "Book 2",
        authors: ["Author"],
        path: "Author/Book 2 (2)",
        tags: ["Sci-Fi", "Adventure"],
      }));

      // Book without tags (should not be counted)
      await bookRepository.create(createTestBook({
        calibreId: 3,
        title: "Book 3",
        authors: ["Author"],
        path: "Author/Book 3 (3)",
        tags: [],
      }));

      // Act
      const count = await bookRepository.countBooksWithTags();

      // Assert
      expect(count).toBe(2); // Books 1 & 2 have tags
    });

    test("should return 0 when no books have tags", async () => {
      // Arrange: Books without tags
      await bookRepository.create(createTestBook({
        calibreId: 1,
        title: "Book 1",
        authors: ["Author"],
        path: "Author/Book 1 (1)",
        tags: [],
      }));

      await bookRepository.create(createTestBook({
        calibreId: 2,
        title: "Book 2",
        authors: ["Author"],
        path: "Author/Book 2 (2)",
        tags: [],
      }));

      // Act
      const count = await bookRepository.countBooksWithTags();

      // Assert
      expect(count).toBe(0);
    });

    test("should return 0 when database is empty", async () => {
      // Act
      const count = await bookRepository.countBooksWithTags();

      // Assert
      expect(count).toBe(0);
    });
  });

  describe("Edge Cases", () => {
    test("should count each book once even if it has multiple tags", async () => {
      // Arrange: Book with 5 tags
      await bookRepository.create(createTestBook({
        calibreId: 1,
        title: "Book",
        authors: ["Author"],
        path: "Author/Book (1)",
        tags: ["Tag1", "Tag2", "Tag3", "Tag4", "Tag5"],
      }));

      // Act
      const count = await bookRepository.countBooksWithTags();

      // Assert
      expect(count).toBe(1); // Still just 1 book
    });

    test("should handle large number of books", async () => {
      // Arrange: 100 books with tags
      for (let i = 1; i <= 100; i++) {
        await bookRepository.create(createTestBook({
          calibreId: i,
          title: `Book ${i}`,
          authors: ["Author"],
          path: `Author/Book ${i} (${i})`,
          tags: [`Tag${i}`],
        }));
      }

      // Act
      const count = await bookRepository.countBooksWithTags();

      // Assert
      expect(count).toBe(100);
    });
  });
});

describe("BookRepository.findByTag()", () => {
  describe("Basic Functionality", () => {
    test("should find all books with a specific tag", async () => {
      // Arrange
      const book1 = await bookRepository.create(createTestBook({
        calibreId: 1,
        title: "Fantasy Book 1",
        authors: ["Author 1"],
        path: "Author 1/Fantasy Book 1 (1)",
        tags: ["Fantasy", "Magic"],
      }));

      const book2 = await bookRepository.create(createTestBook({
        calibreId: 2,
        title: "Fantasy Book 2",
        authors: ["Author 2"],
        path: "Author 2/Fantasy Book 2 (2)",
        tags: ["Fantasy", "Adventure"],
      }));

      // Book without the tag (should not be returned)
      await bookRepository.create(createTestBook({
        calibreId: 3,
        title: "Sci-Fi Book",
        authors: ["Author 3"],
        path: "Author 3/Sci-Fi Book (3)",
        tags: ["Sci-Fi"],
      }));

      // Act
      const result = await bookRepository.findByTag("Fantasy", 50, 0);

      // Assert
      expect(result.total).toBe(2);
      expect(result.books).toHaveLength(2);
      expect(result.books[0].id).toBe(book1.id);
      expect(result.books[1].id).toBe(book2.id);
    });

    test("should return empty result for non-existent tag", async () => {
      // Arrange
      await bookRepository.create(createTestBook({
        calibreId: 1,
        title: "Book",
        authors: ["Author"],
        path: "Author/Book (1)",
        tags: ["Fantasy"],
      }));

      // Act
      const result = await bookRepository.findByTag("NonExistent", 50, 0);

      // Assert
      expect(result.total).toBe(0);
      expect(result.books).toHaveLength(0);
    });

    test("should be case-sensitive", async () => {
      // Arrange
      await bookRepository.create(createTestBook({
        calibreId: 1,
        title: "Book",
        authors: ["Author"],
        path: "Author/Book (1)",
        tags: ["Fantasy"], // Capital F
      }));

      // Act: Search with lowercase
      const result = await bookRepository.findByTag("fantasy", 50, 0);

      // Assert: Should not match
      expect(result.total).toBe(0);
      expect(result.books).toHaveLength(0);
    });
  });

  describe("Pagination", () => {
    test("should support limit parameter", async () => {
      // Arrange: Create 10 books with same tag
      for (let i = 1; i <= 10; i++) {
        await bookRepository.create(createTestBook({
          calibreId: i,
          title: `Book ${i}`,
          authors: ["Author"],
          path: `Author/Book ${i} (${i})`,
          tags: ["Fantasy"],
        }));
      }

      // Act: Get only first 5
      const result = await bookRepository.findByTag("Fantasy", 5, 0);

      // Assert
      expect(result.total).toBe(10);
      expect(result.books).toHaveLength(5);
    });

    test("should support skip parameter", async () => {
      // Arrange: Create 10 books with same tag
      const createdBooks = [];
      for (let i = 1; i <= 10; i++) {
        const book = await bookRepository.create(createTestBook({
          calibreId: i,
          title: `Book ${i}`,
          authors: ["Author"],
          path: `Author/Book ${i} (${i})`,
          tags: ["Fantasy"],
        }));
        createdBooks.push(book);
      }

      // Act: Skip first 5, get next 3
      const result = await bookRepository.findByTag("Fantasy", 3, 5);

      // Assert
      expect(result.total).toBe(10);
      expect(result.books).toHaveLength(3);
      // Should get books 6, 7, 8 (0-indexed: books at positions 5, 6, 7)
    });

    test("should use default limit of 50", async () => {
      // Arrange: Create 3 books
      for (let i = 1; i <= 3; i++) {
        await bookRepository.create(createTestBook({
          calibreId: i,
          title: `Book ${i}`,
          authors: ["Author"],
          path: `Author/Book ${i} (${i})`,
          tags: ["Fantasy"],
        }));
      }

      // Act: Use default pagination
      const result = await bookRepository.findByTag("Fantasy", 50, 0);

      // Assert
      expect(result.total).toBe(3);
      expect(result.books).toHaveLength(3);
    });

    test("should handle skip beyond available books", async () => {
      // Arrange
      for (let i = 1; i <= 5; i++) {
        await bookRepository.create(createTestBook({
          calibreId: i,
          title: `Book ${i}`,
          authors: ["Author"],
          path: `Author/Book ${i} (${i})`,
          tags: ["Fantasy"],
        }));
      }

      // Act: Skip way beyond available books
      const result = await bookRepository.findByTag("Fantasy", 10, 100);

      // Assert
      expect(result.total).toBe(5);
      expect(result.books).toHaveLength(0);
    });
  });

  describe("Edge Cases", () => {
    test("should handle tags with special characters", async () => {
      // Arrange
      const book = await bookRepository.create(createTestBook({
        calibreId: 1,
        title: "Book",
        authors: ["Author"],
        path: "Author/Book (1)",
        tags: ["Action & Adventure"],
      }));

      // Act
      const result = await bookRepository.findByTag("Action & Adventure", 50, 0);

      // Assert
      expect(result.total).toBe(1);
      expect(result.books).toHaveLength(1);
      expect(result.books[0].id).toBe(book.id);
    });

    test("should handle unicode tag names", async () => {
      // Arrange
      const book = await bookRepository.create(createTestBook({
        calibreId: 1,
        title: "Book",
        authors: ["Author"],
        path: "Author/Book (1)",
        tags: ["科幻小説"],
      }));

      // Act
      const result = await bookRepository.findByTag("科幻小説", 50, 0);

      // Assert
      expect(result.total).toBe(1);
      expect(result.books[0].id).toBe(book.id);
    });

    test("should find books where tag appears with other tags", async () => {
      // Arrange: Books with multiple tags
      const book1 = await bookRepository.create(createTestBook({
        calibreId: 1,
        title: "Book 1",
        authors: ["Author"],
        path: "Author/Book 1 (1)",
        tags: ["Fantasy", "Magic", "Adventure"],
      }));

      const book2 = await bookRepository.create(createTestBook({
        calibreId: 2,
        title: "Book 2",
        authors: ["Author"],
        path: "Author/Book 2 (2)",
        tags: ["Sci-Fi", "Fantasy", "Space"],
      }));

      // Act: Search for "Fantasy" which appears in both
      const result = await bookRepository.findByTag("Fantasy", 50, 0);

      // Assert
      expect(result.total).toBe(2);
      expect(result.books).toHaveLength(2);
    });

    test("should return books sorted by createdAt descending", async () => {
      // Arrange: Create books at different times
      const book1 = await bookRepository.create(createTestBook({
        calibreId: 1,
        title: "Old Book",
        authors: ["Author"],
        path: "Author/Old Book (1)",
        tags: ["Fantasy"],
      }));

      // Wait 1 second to ensure different timestamps (SQLite uses seconds)
      await new Promise(resolve => setTimeout(resolve, 1100));

      const book2 = await bookRepository.create(createTestBook({
        calibreId: 2,
        title: "New Book",
        authors: ["Author"],
        path: "Author/New Book (2)",
        tags: ["Fantasy"],
      }));

      // Act
      const result = await bookRepository.findByTag("Fantasy", 50, 0);

      // Assert: Newer book should come first
      expect(result.books[0].id).toBe(book2.id);
      expect(result.books[1].id).toBe(book1.id);
    });
  });

  describe("Error Handling", () => {
    test("should handle empty tag name gracefully", async () => {
      // Act
      const result = await bookRepository.findByTag("", 50, 0);

      // Assert: Should return empty result (no books match empty tag)
      expect(result.total).toBe(0);
      expect(result.books).toHaveLength(0);
    });

    test("should handle very long tag name", async () => {
      // Arrange
      const longTag = "A".repeat(500);
      
      // Act
      const result = await bookRepository.findByTag(longTag, 50, 0);

      // Assert: Should not throw, just return empty
      expect(result.total).toBe(0);
      expect(result.books).toHaveLength(0);
    });
  });
});
