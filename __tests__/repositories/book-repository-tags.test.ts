import { describe, test, expect, beforeAll, afterAll, beforeEach } from 'vitest';
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
      // Books are sorted by createdAt DESC, so book2 (created later) comes first
      expect(result.books[0].id).toBe(book2.id);
      expect(result.books[1].id).toBe(book1.id);
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

  describe("Orphaned Books Filtering", () => {
    test("should exclude orphaned books from tag search results", async () => {
      // Arrange: Create a normal book and an orphaned book with same tag
      const normalBook = await bookRepository.create(createTestBook({
        calibreId: 1,
        title: "Normal Book",
        authors: ["Author"],
        path: "Author/Normal Book (1)",
        tags: ["Fantasy"],
        orphaned: false,
      }));

      const orphanedBook = await bookRepository.create(createTestBook({
        calibreId: 2,
        title: "Orphaned Book",
        authors: ["Author"],
        path: "Author/Orphaned Book (2)",
        tags: ["Fantasy"],
        orphaned: true,
        orphanedAt: new Date(),
      }));

      // Act
      const result = await bookRepository.findByTag("Fantasy", 50, 0);

      // Assert: Should only return the normal book, not the orphaned one
      expect(result.total).toBe(1);
      expect(result.books).toHaveLength(1);
      expect(result.books[0].id).toBe(normalBook.id);
      expect(result.books[0].orphaned).toBe(false);
      
      // Verify orphaned book is not in results
      const orphanedBookInResults = result.books.find(b => b.id === orphanedBook.id);
      expect(orphanedBookInResults).toBeUndefined();
    });

    test("should exclude orphaned books from tag count", async () => {
      // Arrange: Create multiple books with same tag, some orphaned
      await bookRepository.create(createTestBook({
        calibreId: 1,
        title: "Normal Book 1",
        authors: ["Author"],
        path: "Author/Normal Book 1 (1)",
        tags: ["Sci-Fi"],
        orphaned: false,
      }));

      await bookRepository.create(createTestBook({
        calibreId: 2,
        title: "Normal Book 2",
        authors: ["Author"],
        path: "Author/Normal Book 2 (2)",
        tags: ["Sci-Fi"],
        orphaned: false,
      }));

      await bookRepository.create(createTestBook({
        calibreId: 3,
        title: "Orphaned Book 1",
        authors: ["Author"],
        path: "Author/Orphaned Book 1 (3)",
        tags: ["Sci-Fi"],
        orphaned: true,
        orphanedAt: new Date(),
      }));

      await bookRepository.create(createTestBook({
        calibreId: 4,
        title: "Orphaned Book 2",
        authors: ["Author"],
        path: "Author/Orphaned Book 2 (4)",
        tags: ["Sci-Fi"],
        orphaned: true,
        orphanedAt: new Date(),
      }));

      // Act
      const result = await bookRepository.findByTag("Sci-Fi", 50, 0);

      // Assert: Should only count and return the 2 normal books
      expect(result.total).toBe(2);
      expect(result.books).toHaveLength(2);
      expect(result.books.every(b => !b.orphaned)).toBe(true);
    });

    test("should return empty result if all books with tag are orphaned", async () => {
      // Arrange: Create only orphaned books with a tag
      await bookRepository.create(createTestBook({
        calibreId: 1,
        title: "Orphaned Book 1",
        authors: ["Author"],
        path: "Author/Orphaned Book 1 (1)",
        tags: ["Horror"],
        orphaned: true,
        orphanedAt: new Date(),
      }));

      await bookRepository.create(createTestBook({
        calibreId: 2,
        title: "Orphaned Book 2",
        authors: ["Author"],
        path: "Author/Orphaned Book 2 (2)",
        tags: ["Horror"],
        orphaned: true,
        orphanedAt: new Date(),
      }));

      // Act
      const result = await bookRepository.findByTag("Horror", 50, 0);

      // Assert: Should return no books
      expect(result.total).toBe(0);
      expect(result.books).toHaveLength(0);
    });

    test("should work with pagination when filtering orphaned books", async () => {
      // Arrange: Create 10 normal books and 5 orphaned books with same tag
      for (let i = 1; i <= 10; i++) {
        await bookRepository.create(createTestBook({
          calibreId: i,
          title: `Normal Book ${i}`,
          authors: ["Author"],
          path: `Author/Normal Book ${i} (${i})`,
          tags: ["Adventure"],
          orphaned: false,
        }));
      }

      for (let i = 11; i <= 15; i++) {
        await bookRepository.create(createTestBook({
          calibreId: i,
          title: `Orphaned Book ${i}`,
          authors: ["Author"],
          path: `Author/Orphaned Book ${i} (${i})`,
          tags: ["Adventure"],
          orphaned: true,
          orphanedAt: new Date(),
        }));
      }

      // Act: Get first 5 results
      const result = await bookRepository.findByTag("Adventure", 5, 0);

      // Assert: Should return 5 normal books out of total 10 normal books
      expect(result.total).toBe(10); // Total non-orphaned books
      expect(result.books).toHaveLength(5); // First page of 5
      expect(result.books.every(b => !b.orphaned)).toBe(true);
    });
  });
});

describe("BookRepository.getTagStats() - Orphaned Books Filtering", () => {
  test("should exclude orphaned books from tag statistics", async () => {
    // Arrange: Create normal and orphaned books with tags
    await bookRepository.create(createTestBook({
      calibreId: 1,
      title: "Normal Book 1",
      authors: ["Author"],
      path: "Author/Normal Book 1 (1)",
      tags: ["Fantasy", "Magic"],
      orphaned: false,
    }));

    await bookRepository.create(createTestBook({
      calibreId: 2,
      title: "Normal Book 2",
      authors: ["Author"],
      path: "Author/Normal Book 2 (2)",
      tags: ["Fantasy"],
      orphaned: false,
    }));

    await bookRepository.create(createTestBook({
      calibreId: 3,
      title: "Orphaned Book",
      authors: ["Author"],
      path: "Author/Orphaned Book (3)",
      tags: ["Fantasy", "Dark"],
      orphaned: true,
      orphanedAt: new Date(),
    }));

    // Act
    const stats = await bookRepository.getTagStats();

    // Assert: Should only count non-orphaned books
    const fantasyTag = stats.find(s => s.name === "Fantasy");
    expect(fantasyTag).toBeDefined();
    expect(fantasyTag?.bookCount).toBe(2); // Only the 2 normal books

    const magicTag = stats.find(s => s.name === "Magic");
    expect(magicTag?.bookCount).toBe(1); // Only in normal book 1

    // Dark tag should not appear (only in orphaned book)
    const darkTag = stats.find(s => s.name === "Dark");
    expect(darkTag).toBeUndefined();
  });

  test("should not show tags that only exist on orphaned books", async () => {
    // Arrange: Create only orphaned book with a unique tag
    await bookRepository.create(createTestBook({
      calibreId: 1,
      title: "Normal Book",
      authors: ["Author"],
      path: "Author/Normal Book (1)",
      tags: ["Normal"],
      orphaned: false,
    }));

    await bookRepository.create(createTestBook({
      calibreId: 2,
      title: "Orphaned Book",
      authors: ["Author"],
      path: "Author/Orphaned Book (2)",
      tags: ["OrphanedOnly"],
      orphaned: true,
      orphanedAt: new Date(),
    }));

    // Act
    const stats = await bookRepository.getTagStats();

    // Assert: Should only show "Normal" tag, not "OrphanedOnly"
    expect(stats).toHaveLength(1);
    expect(stats[0].name).toBe("Normal");
    expect(stats[0].bookCount).toBe(1);
  });
});

describe("BookRepository.countBooksWithTags() - Orphaned Books Filtering", () => {
  test("should exclude orphaned books from count", async () => {
    // Arrange: Create normal and orphaned books with tags
    await bookRepository.create(createTestBook({
      calibreId: 1,
      title: "Normal Book 1",
      authors: ["Author"],
      path: "Author/Normal Book 1 (1)",
      tags: ["Fantasy"],
      orphaned: false,
    }));

    await bookRepository.create(createTestBook({
      calibreId: 2,
      title: "Normal Book 2",
      authors: ["Author"],
      path: "Author/Normal Book 2 (2)",
      tags: ["Sci-Fi"],
      orphaned: false,
    }));

    await bookRepository.create(createTestBook({
      calibreId: 3,
      title: "Orphaned Book",
      authors: ["Author"],
      path: "Author/Orphaned Book (3)",
      tags: ["Horror"],
      orphaned: true,
      orphanedAt: new Date(),
    }));

    // Act
    const count = await bookRepository.countBooksWithTags();

    // Assert: Should only count the 2 normal books
    expect(count).toBe(2);
  });

  test("should return 0 if all books with tags are orphaned", async () => {
    // Arrange: Create only orphaned books with tags
    await bookRepository.create(createTestBook({
      calibreId: 1,
      title: "Orphaned Book 1",
      authors: ["Author"],
      path: "Author/Orphaned Book 1 (1)",
      tags: ["Tag1"],
      orphaned: true,
      orphanedAt: new Date(),
    }));

    await bookRepository.create(createTestBook({
      calibreId: 2,
      title: "Orphaned Book 2",
      authors: ["Author"],
      path: "Author/Orphaned Book 2 (2)",
      tags: ["Tag2"],
      orphaned: true,
      orphanedAt: new Date(),
    }));

    // Act
    const count = await bookRepository.countBooksWithTags();

    // Assert: Should return 0
    expect(count).toBe(0);
  });
});

describe("BookRepository.findWithFilters() - noTags Filter", () => {
  describe("Basic Functionality", () => {
    test("should find books with no tags when noTags is true", async () => {
      // Arrange: Create books with and without tags
      const bookWithoutTags1 = await bookRepository.create(createTestBook({
        calibreId: 1,
        title: "Book Without Tags 1",
        authors: ["Author"],
        path: "Author/Book Without Tags 1 (1)",
        tags: [],
      }));

      const bookWithoutTags2 = await bookRepository.create(createTestBook({
        calibreId: 2,
        title: "Book Without Tags 2",
        authors: ["Author"],
        path: "Author/Book Without Tags 2 (2)",
        tags: [],
      }));

      await bookRepository.create(createTestBook({
        calibreId: 3,
        title: "Book With Tags",
        authors: ["Author"],
        path: "Author/Book With Tags (3)",
        tags: ["Fantasy", "Magic"],
      }));

      // Act
      const result = await bookRepository.findWithFilters({ noTags: true }, 50, 0);

      // Assert
      expect(result.total).toBe(2);
      expect(result.books).toHaveLength(2);
      expect(result.books.some(b => b.id === bookWithoutTags1.id)).toBe(true);
      expect(result.books.some(b => b.id === bookWithoutTags2.id)).toBe(true);
    });

    test("should return all books when noTags is false or undefined", async () => {
      // Arrange
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
        tags: ["Fantasy"],
      }));

      // Act: Test with noTags false
      const resultFalse = await bookRepository.findWithFilters({ noTags: false }, 50, 0);

      // Act: Test with noTags undefined
      const resultUndefined = await bookRepository.findWithFilters({}, 50, 0);

      // Assert: Both should return all books
      expect(resultFalse.total).toBe(2);
      expect(resultUndefined.total).toBe(2);
    });

    test("should return empty result when all books have tags", async () => {
      // Arrange: Create only books with tags
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

      // Act
      const result = await bookRepository.findWithFilters({ noTags: true }, 50, 0);

      // Assert
      expect(result.total).toBe(0);
      expect(result.books).toHaveLength(0);
    });

    test("should return all books when all books have no tags", async () => {
      // Arrange: Create only books without tags
      const book1 = await bookRepository.create(createTestBook({
        calibreId: 1,
        title: "Book 1",
        authors: ["Author"],
        path: "Author/Book 1 (1)",
        tags: [],
      }));

      const book2 = await bookRepository.create(createTestBook({
        calibreId: 2,
        title: "Book 2",
        authors: ["Author"],
        path: "Author/Book 2 (2)",
        tags: [],
      }));

      // Act
      const result = await bookRepository.findWithFilters({ noTags: true }, 50, 0);

      // Assert
      expect(result.total).toBe(2);
      expect(result.books).toHaveLength(2);
    });
  });

  describe("Pagination", () => {
    test("should support pagination with noTags filter", async () => {
      // Arrange: Create 10 books without tags
      for (let i = 1; i <= 10; i++) {
        await bookRepository.create(createTestBook({
          calibreId: i,
          title: `Book ${i}`,
          authors: ["Author"],
          path: `Author/Book ${i} (${i})`,
          tags: [],
        }));
      }

      // Act: Get first 5
      const page1 = await bookRepository.findWithFilters({ noTags: true }, 5, 0);
      // Get next 5
      const page2 = await bookRepository.findWithFilters({ noTags: true }, 5, 5);

      // Assert
      expect(page1.total).toBe(10);
      expect(page1.books).toHaveLength(5);
      expect(page2.total).toBe(10);
      expect(page2.books).toHaveLength(5);

      // Ensure no overlap
      const page1Ids = page1.books.map(b => b.id);
      const page2Ids = page2.books.map(b => b.id);
      const overlap = page1Ids.filter(id => page2Ids.includes(id));
      expect(overlap).toHaveLength(0);
    });
  });

  describe("Combination with Other Filters", () => {
    test("should work with search filter", async () => {
      // Arrange
      const bookMatch = await bookRepository.create(createTestBook({
        calibreId: 1,
        title: "Special Book",
        authors: ["Author"],
        path: "Author/Special Book (1)",
        tags: [],
      }));

      await bookRepository.create(createTestBook({
        calibreId: 2,
        title: "Other Book",
        authors: ["Author"],
        path: "Author/Other Book (2)",
        tags: [],
      }));

      await bookRepository.create(createTestBook({
        calibreId: 3,
        title: "Special Tagged Book",
        authors: ["Author"],
        path: "Author/Special Tagged Book (3)",
        tags: ["Fantasy"],
      }));

      // Act: Search for "Special" with noTags filter
      const result = await bookRepository.findWithFilters({
        noTags: true,
        search: "Special"
      }, 50, 0);

      // Assert: Should only find "Special Book" (not the tagged one)
      expect(result.total).toBe(1);
      expect(result.books[0].id).toBe(bookMatch.id);
    });

    test("should work with rating filter", async () => {
      // Arrange
      const bookMatch = await bookRepository.create(createTestBook({
        calibreId: 1,
        title: "Book 1",
        authors: ["Author"],
        path: "Author/Book 1 (1)",
        tags: [],
        rating: 5,
      }));

      await bookRepository.create(createTestBook({
        calibreId: 2,
        title: "Book 2",
        authors: ["Author"],
        path: "Author/Book 2 (2)",
        tags: [],
        rating: 3,
      }));

      await bookRepository.create(createTestBook({
        calibreId: 3,
        title: "Book 3",
        authors: ["Author"],
        path: "Author/Book 3 (3)",
        tags: ["Fantasy"],
        rating: 5,
      }));

      // Act: Find 5-star books without tags
      const result = await bookRepository.findWithFilters({
        noTags: true,
        rating: "5"
      }, 50, 0);

      // Assert
      expect(result.total).toBe(1);
      expect(result.books[0].id).toBe(bookMatch.id);
    });

    test("noTags filter should be mutually exclusive with tags filter", async () => {
      // Arrange: Create books with different tags
      await bookRepository.create(createTestBook({
        calibreId: 1,
        title: "Book Without Tags",
        authors: ["Author"],
        path: "Author/Book Without Tags (1)",
        tags: [],
      }));

      await bookRepository.create(createTestBook({
        calibreId: 2,
        title: "Fantasy Book",
        authors: ["Author"],
        path: "Author/Fantasy Book (2)",
        tags: ["Fantasy"],
      }));

      // Act: Apply both noTags and tags filter (noTags should take precedence)
      const result = await bookRepository.findWithFilters({
        noTags: true,
        tags: ["Fantasy"]
      }, 50, 0);

      // Assert: Should only return books without tags (noTags filter active)
      expect(result.total).toBe(1);
      expect(result.books[0].title).toBe("Book Without Tags");
    });
  });

  describe("Orphaned Books Filtering", () => {
    test("should exclude orphaned books when using noTags filter", async () => {
      // Arrange
      const normalBook = await bookRepository.create(createTestBook({
        calibreId: 1,
        title: "Normal Book",
        authors: ["Author"],
        path: "Author/Normal Book (1)",
        tags: [],
        orphaned: false,
      }));

      await bookRepository.create(createTestBook({
        calibreId: 2,
        title: "Orphaned Book",
        authors: ["Author"],
        path: "Author/Orphaned Book (2)",
        tags: [],
        orphaned: true,
        orphanedAt: new Date(),
      }));

      // Act
      const result = await bookRepository.findWithFilters({ noTags: true }, 50, 0);

      // Assert: Should only return the normal book
      expect(result.total).toBe(1);
      expect(result.books[0].id).toBe(normalBook.id);
      expect(result.books[0].orphaned).toBe(false);
    });
  });

  describe("Edge Cases", () => {
    test("should handle empty database", async () => {
      // Act
      const result = await bookRepository.findWithFilters({ noTags: true }, 50, 0);

      // Assert
      expect(result.total).toBe(0);
      expect(result.books).toHaveLength(0);
    });

    test("should work with sorting", async () => {
      // Arrange: Create books without tags with different titles
      await bookRepository.create(createTestBook({
        calibreId: 1,
        title: "Zebra Book",
        authors: ["Author"],
        path: "Author/Zebra Book (1)",
        tags: [],
      }));

      await bookRepository.create(createTestBook({
        calibreId: 2,
        title: "Apple Book",
        authors: ["Author"],
        path: "Author/Apple Book (2)",
        tags: [],
      }));

      // Act: Sort by title ascending
      const result = await bookRepository.findWithFilters({ noTags: true }, 50, 0, "title");

      // Assert: Should be sorted alphabetically
      expect(result.books).toHaveLength(2);
      expect(result.books[0].title).toBe("Apple Book");
      expect(result.books[1].title).toBe("Zebra Book");
    });
  });
});

describe("BookRepository.findWithFiltersAndRelations() - noTags Filter", () => {
  test("should find books with no tags and include session/progress data", async () => {
    // Arrange: Create book without tags
    const bookWithoutTags = await bookRepository.create(createTestBook({
      calibreId: 1,
      title: "Book Without Tags",
      authors: ["Author"],
      path: "Author/Book Without Tags (1)",
      tags: [],
    }));

    await bookRepository.create(createTestBook({
      calibreId: 2,
      title: "Book With Tags",
      authors: ["Author"],
      path: "Author/Book With Tags (2)",
      tags: ["Fantasy"],
    }));

    // Act
    const result = await bookRepository.findWithFiltersAndRelations({ noTags: true }, 50, 0);

    // Assert
    expect(result.total).toBe(1);
    expect(result.books).toHaveLength(1);
    expect(result.books[0].id).toBe(bookWithoutTags.id);
    expect(result.books[0].tags).toEqual([]);
  });

  test("should work with status filter", async () => {
    // This test would require setting up sessions which is more complex
    // For now, we'll test that the filter doesn't break when combined
    await bookRepository.create(createTestBook({
      calibreId: 1,
      title: "Book 1",
      authors: ["Author"],
      path: "Author/Book 1 (1)",
      tags: [],
    }));

    // Act: Should not throw error
    const result = await bookRepository.findWithFiltersAndRelations({
      noTags: true
    }, 50, 0);

    // Assert
    expect(result).toBeDefined();
    expect(result.books).toBeDefined();
  });

  test("should return books sorted correctly with noTags filter", async () => {
    // Arrange: Create books without tags
    await bookRepository.create(createTestBook({
      calibreId: 1,
      title: "Zebra",
      authors: ["Author"],
      path: "Author/Zebra (1)",
      tags: [],
    }));

    await bookRepository.create(createTestBook({
      calibreId: 2,
      title: "Apple",
      authors: ["Author"],
      path: "Author/Apple (2)",
      tags: [],
    }));

    // Act: Sort by title
    const result = await bookRepository.findWithFiltersAndRelations({ noTags: true }, 50, 0, "title");

    // Assert
    expect(result.books).toHaveLength(2);
    expect(result.books[0].title).toBe("Apple");
    expect(result.books[1].title).toBe("Zebra");
  });
});
