import { describe, test, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { setupTestDatabase, teardownTestDatabase, clearTestDatabase } from "../../../helpers/db-setup";
import { bookRepository } from "@/lib/repositories";

/**
 * Comprehensive test suite for book repository tag filtering with AND logic
 * 
 * Tests both findWithFilters and findWithFiltersAndRelations methods
 * to ensure consistent behavior across the repository layer.
 * 
 * Bug Fix Context: Changed from OR to AND logic for multiple tag filters.
 * Books must now have ALL selected tags instead of ANY of them.
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

describe("Book Repository - Tag Filtering with AND Logic", () => {
  // ============================================================================
  // SINGLE TAG FILTERING (should work unchanged)
  // ============================================================================

  describe("Single Tag Filtering", () => {
    test("findWithFilters: should filter by single tag", async () => {
      await bookRepository.create({
        calibreId: 1,
        path: "/path1",
        title: "Fantasy Book",
        authors: ["Author 1"],
        tags: ["fantasy", "magic"],
        totalPages: 300,
      });

      await bookRepository.create({
        calibreId: 2,
        path: "/path2",
        title: "Sci-Fi Book",
        authors: ["Author 2"],
        tags: ["sci-fi", "space"],
        totalPages: 400,
      });

      const result = await bookRepository.findWithFilters({ tags: ["fantasy"] });
      
      expect(result.books).toHaveLength(1);
      expect(result.books[0].title).toBe("Fantasy Book");
      expect(result.total).toBe(1);
    });

    test("findWithFiltersAndRelations: should filter by single tag", async () => {
      await bookRepository.create({
        calibreId: 1,
        path: "/path1",
        title: "Fantasy Book",
        authors: ["Author 1"],
        tags: ["fantasy", "magic"],
        totalPages: 300,
      });

      await bookRepository.create({
        calibreId: 2,
        path: "/path2",
        title: "Sci-Fi Book",
        authors: ["Author 2"],
        tags: ["sci-fi", "space"],
        totalPages: 400,
      });

      const result = await bookRepository.findWithFiltersAndRelations({ tags: ["fantasy"] });
      
      expect(result.books).toHaveLength(1);
      expect(result.books[0].title).toBe("Fantasy Book");
      expect(result.total).toBe(1);
    });
  });

  // ============================================================================
  // MULTIPLE TAG FILTERING WITH AND LOGIC (main bug fix)
  // ============================================================================

  describe("Multiple Tags - AND Logic (Core Behavior)", () => {
    beforeEach(async () => {
      // Standard test data setup matching the bug description
      // Book A: tags ["fantasy", "magic", "adventure"]
      await bookRepository.create({
        calibreId: 1,
        path: "/path1",
        title: "Book A - Fantasy Magic Adventure",
        authors: ["Author A"],
        tags: ["fantasy", "magic", "adventure"],
        totalPages: 500,
      });

      // Book B: tags ["fantasy", "adventure"]
      await bookRepository.create({
        calibreId: 2,
        path: "/path2",
        title: "Book B - Fantasy Adventure",
        authors: ["Author B"],
        tags: ["fantasy", "adventure"],
        totalPages: 400,
      });

      // Book C: tags ["sci-fi", "space"]
      await bookRepository.create({
        calibreId: 3,
        path: "/path3",
        title: "Book C - Sci-Fi Space",
        authors: ["Author C"],
        tags: ["sci-fi", "space"],
        totalPages: 450,
      });

      // Book D: tags ["fantasy"]
      await bookRepository.create({
        calibreId: 4,
        path: "/path4",
        title: "Book D - Fantasy Only",
        authors: ["Author D"],
        tags: ["fantasy"],
        totalPages: 300,
      });
    });

    test("findWithFilters: should return only books with ALL specified tags", async () => {
      // Query: tags=fantasy,adventure
      // Expected: Books A and B (both have fantasy AND adventure)
      // NOT: Book D (has fantasy but not adventure)
      const result = await bookRepository.findWithFilters({
        tags: ["fantasy", "adventure"],
      });

      expect(result.books).toHaveLength(2);
      expect(result.total).toBe(2);
      
      const titles = result.books.map((b) => b.title).sort();
      expect(titles).toEqual([
        "Book A - Fantasy Magic Adventure",
        "Book B - Fantasy Adventure",
      ]);
    });

    test("findWithFiltersAndRelations: should return only books with ALL specified tags", async () => {
      const result = await bookRepository.findWithFiltersAndRelations({
        tags: ["fantasy", "adventure"],
      });

      expect(result.books).toHaveLength(2);
      expect(result.total).toBe(2);
      
      const titles = result.books.map((b) => b.title).sort();
      expect(titles).toEqual([
        "Book A - Fantasy Magic Adventure",
        "Book B - Fantasy Adventure",
      ]);
    });

    test("findWithFilters: should handle three-tag filter (AND logic)", async () => {
      // Only Book A has all three tags
      const result = await bookRepository.findWithFilters({
        tags: ["fantasy", "magic", "adventure"],
      });

      expect(result.books).toHaveLength(1);
      expect(result.books[0].title).toBe("Book A - Fantasy Magic Adventure");
    });

    test("findWithFiltersAndRelations: should handle three-tag filter (AND logic)", async () => {
      const result = await bookRepository.findWithFiltersAndRelations({
        tags: ["fantasy", "magic", "adventure"],
      });

      expect(result.books).toHaveLength(1);
      expect(result.books[0].title).toBe("Book A - Fantasy Magic Adventure");
    });

    test("findWithFilters: should return empty when no books have all tags", async () => {
      // No book has both fantasy and sci-fi
      const result = await bookRepository.findWithFilters({
        tags: ["fantasy", "sci-fi"],
      });

      expect(result.books).toHaveLength(0);
      expect(result.total).toBe(0);
    });

    test("findWithFiltersAndRelations: should return empty when no books have all tags", async () => {
      const result = await bookRepository.findWithFiltersAndRelations({
        tags: ["fantasy", "sci-fi"],
      });

      expect(result.books).toHaveLength(0);
      expect(result.total).toBe(0);
    });
  });

  // ============================================================================
  // EDGE CASES AND BOUNDARY CONDITIONS
  // ============================================================================

  describe("Edge Cases", () => {
    test("findWithFilters: should handle books with superset of requested tags", async () => {
      // Book has many tags, we filter by a subset
      await bookRepository.create({
        calibreId: 1,
        path: "/path1",
        title: "Rich Tag Book",
        authors: ["Author"],
        tags: ["fantasy", "magic", "adventure", "dragons", "quest", "young-adult"],
        totalPages: 600,
      });

      await bookRepository.create({
        calibreId: 2,
        path: "/path2",
        title: "Minimal Tag Book",
        authors: ["Author"],
        tags: ["fantasy", "adventure"],
        totalPages: 300,
      });

      const result = await bookRepository.findWithFilters({
        tags: ["fantasy", "adventure"],
      });

      // Both books should be returned since both have fantasy AND adventure
      expect(result.books).toHaveLength(2);
    });

    test("findWithFilters: should handle empty tags filter", async () => {
      await bookRepository.create({
        calibreId: 1,
        path: "/path1",
        title: "Book 1",
        authors: ["Author"],
        tags: ["fantasy"],
        totalPages: 300,
      });

      await bookRepository.create({
        calibreId: 2,
        path: "/path2",
        title: "Book 2",
        authors: ["Author"],
        tags: ["sci-fi"],
        totalPages: 400,
      });

      // Empty tags array should not filter by tags
      const result = await bookRepository.findWithFilters({ tags: [] });
      expect(result.books).toHaveLength(2);
    });

    test("findWithFilters: should handle books with no tags", async () => {
      await bookRepository.create({
        calibreId: 1,
        path: "/path1",
        title: "Tagged Book",
        authors: ["Author"],
        tags: ["fantasy"],
        totalPages: 300,
      });

      await bookRepository.create({
        calibreId: 2,
        path: "/path2",
        title: "Untagged Book",
        authors: ["Author"],
        tags: [],
        totalPages: 400,
      });

      const result = await bookRepository.findWithFilters({ tags: ["fantasy"] });
      
      expect(result.books).toHaveLength(1);
      expect(result.books[0].title).toBe("Tagged Book");
    });

    test("findWithFilters: should handle duplicate tags in query", async () => {
      await bookRepository.create({
        calibreId: 1,
        path: "/path1",
        title: "Fantasy Book",
        authors: ["Author"],
        tags: ["fantasy", "magic"],
        totalPages: 300,
      });

      // Query with duplicate tag
      const result = await bookRepository.findWithFilters({
        tags: ["fantasy", "fantasy"],
      });

      // Should still work correctly (though input should ideally be deduplicated)
      expect(result.books).toHaveLength(1);
    });

    test("findWithFilters: should be case-sensitive for tag matching", async () => {
      await bookRepository.create({
        calibreId: 1,
        path: "/path1",
        title: "Lowercase Tags",
        authors: ["Author"],
        tags: ["fantasy", "magic"],
        totalPages: 300,
      });

      await bookRepository.create({
        calibreId: 2,
        path: "/path2",
        title: "Capitalized Tags",
        authors: ["Author"],
        tags: ["Fantasy", "Magic"],
        totalPages: 400,
      });

      const lowercaseResult = await bookRepository.findWithFilters({
        tags: ["fantasy", "magic"],
      });
      expect(lowercaseResult.books).toHaveLength(1);
      expect(lowercaseResult.books[0].title).toBe("Lowercase Tags");

      const capitalizedResult = await bookRepository.findWithFilters({
        tags: ["Fantasy", "Magic"],
      });
      expect(capitalizedResult.books).toHaveLength(1);
      expect(capitalizedResult.books[0].title).toBe("Capitalized Tags");
    });
  });

  // ============================================================================
  // COMBINED FILTERS (tags with other filters)
  // ============================================================================

  describe("Combined Filters - Tags with Search", () => {
    test("findWithFilters: should combine tag AND logic with search filter", async () => {
      await bookRepository.create({
        calibreId: 1,
        path: "/path1",
        title: "Harry Potter Fantasy Adventure",
        authors: ["J.K. Rowling"],
        tags: ["fantasy", "adventure", "young-adult"],
        totalPages: 400,
      });

      await bookRepository.create({
        calibreId: 2,
        path: "/path2",
        title: "Harry Potter Mystery",
        authors: ["J.K. Rowling"],
        tags: ["mystery"],
        totalPages: 350,
      });

      await bookRepository.create({
        calibreId: 3,
        path: "/path3",
        title: "Lord of the Rings",
        authors: ["J.R.R. Tolkien"],
        tags: ["fantasy", "adventure"],
        totalPages: 500,
      });

      // Search for "Harry" AND has both fantasy and adventure tags
      const result = await bookRepository.findWithFilters({
        search: "Harry",
        tags: ["fantasy", "adventure"],
      });

      expect(result.books).toHaveLength(1);
      expect(result.books[0].title).toBe("Harry Potter Fantasy Adventure");
    });

    test("findWithFiltersAndRelations: should combine tag AND logic with search filter", async () => {
      await bookRepository.create({
        calibreId: 1,
        path: "/path1",
        title: "Epic Fantasy Adventure",
        authors: ["Author A"],
        tags: ["fantasy", "adventure", "epic"],
        totalPages: 500,
      });

      await bookRepository.create({
        calibreId: 2,
        path: "/path2",
        title: "Epic Sci-Fi",
        authors: ["Author B"],
        tags: ["sci-fi", "epic"],
        totalPages: 400,
      });

      const result = await bookRepository.findWithFiltersAndRelations({
        search: "Epic",
        tags: ["fantasy", "adventure"],
      });

      expect(result.books).toHaveLength(1);
      expect(result.books[0].title).toBe("Epic Fantasy Adventure");
    });
  });

  // ============================================================================
  // PAGINATION WITH TAG FILTERS
  // ============================================================================

  describe("Pagination with Tag Filters", () => {
    test("findWithFilters: should respect pagination with AND tag filter", async () => {
      // Create 10 books with fantasy and adventure tags
      for (let i = 1; i <= 10; i++) {
        await bookRepository.create({
          calibreId: i,
          path: `/path${i}`,
          title: `Fantasy Adventure Book ${i}`,
          authors: ["Author"],
          tags: ["fantasy", "adventure"],
          totalPages: 300 + i * 10,
        });
      }

      // Create 5 books with only fantasy
      for (let i = 11; i <= 15; i++) {
        await bookRepository.create({
          calibreId: i,
          path: `/path${i}`,
          title: `Fantasy Only Book ${i}`,
          authors: ["Author"],
          tags: ["fantasy"],
          totalPages: 300 + i * 10,
        });
      }

      // Query with pagination: limit 5, skip 0
      const result = await bookRepository.findWithFilters(
        { tags: ["fantasy", "adventure"] },
        5,  // limit
        0   // skip
      );

      expect(result.books).toHaveLength(5);
      expect(result.total).toBe(10); // Total matching books
    });

    test("findWithFiltersAndRelations: should respect pagination with AND tag filter", async () => {
      for (let i = 1; i <= 10; i++) {
        await bookRepository.create({
          calibreId: i,
          path: `/path${i}`,
          title: `Multi-Tag Book ${i}`,
          authors: ["Author"],
          tags: ["fantasy", "magic", "adventure"],
          totalPages: 300,
        });
      }

      const result = await bookRepository.findWithFiltersAndRelations(
        { tags: ["fantasy", "magic", "adventure"] },
        3,  // limit
        2   // skip (skip first 2)
      );

      expect(result.books).toHaveLength(3);
      expect(result.total).toBe(10);
    });
  });

  // ============================================================================
  // REAL-WORLD SCENARIOS
  // ============================================================================

  describe("Real-World Scenarios", () => {
    test("should handle typical library filtering: 'young-adult' + 'fantasy'", async () => {
      await bookRepository.create({
        calibreId: 1,
        path: "/path1",
        title: "YA Fantasy",
        authors: ["Author A"],
        tags: ["young-adult", "fantasy", "romance"],
        totalPages: 350,
      });

      await bookRepository.create({
        calibreId: 2,
        path: "/path2",
        title: "Adult Fantasy",
        authors: ["Author B"],
        tags: ["fantasy", "epic"],
        totalPages: 600,
      });

      await bookRepository.create({
        calibreId: 3,
        path: "/path3",
        title: "YA Contemporary",
        authors: ["Author C"],
        tags: ["young-adult", "contemporary"],
        totalPages: 300,
      });

      const result = await bookRepository.findWithFilters({
        tags: ["young-adult", "fantasy"],
      });

      expect(result.books).toHaveLength(1);
      expect(result.books[0].title).toBe("YA Fantasy");
    });

    test("should handle genre + format tags: 'fantasy' + 'audiobook'", async () => {
      await bookRepository.create({
        calibreId: 1,
        path: "/path1",
        title: "Fantasy Audiobook",
        authors: ["Author A"],
        tags: ["fantasy", "audiobook", "adventure"],
        totalPages: 400,
      });

      await bookRepository.create({
        calibreId: 2,
        path: "/path2",
        title: "Fantasy eBook",
        authors: ["Author B"],
        tags: ["fantasy", "ebook"],
        totalPages: 350,
      });

      await bookRepository.create({
        calibreId: 3,
        path: "/path3",
        title: "Mystery Audiobook",
        authors: ["Author C"],
        tags: ["mystery", "audiobook"],
        totalPages: 300,
      });

      const result = await bookRepository.findWithFilters({
        tags: ["fantasy", "audiobook"],
      });

      expect(result.books).toHaveLength(1);
      expect(result.books[0].title).toBe("Fantasy Audiobook");
    });

    test("should handle series + status tags: 'series' + 'completed'", async () => {
      await bookRepository.create({
        calibreId: 1,
        path: "/path1",
        title: "Completed Series Book",
        authors: ["Author A"],
        tags: ["series", "completed", "fantasy"],
        totalPages: 500,
      });

      await bookRepository.create({
        calibreId: 2,
        path: "/path2",
        title: "Ongoing Series Book",
        authors: ["Author B"],
        tags: ["series", "ongoing"],
        totalPages: 400,
      });

      await bookRepository.create({
        calibreId: 3,
        path: "/path3",
        title: "Standalone Completed",
        authors: ["Author C"],
        tags: ["completed", "standalone"],
        totalPages: 350,
      });

      const result = await bookRepository.findWithFilters({
        tags: ["series", "completed"],
      });

      expect(result.books).toHaveLength(1);
      expect(result.books[0].title).toBe("Completed Series Book");
    });
  });

  // ============================================================================
  // CONSISTENCY BETWEEN METHODS
  // ============================================================================

  describe("Method Consistency", () => {
    test("findWithFilters and findWithFiltersAndRelations should return same books", async () => {
      await bookRepository.create({
        calibreId: 1,
        path: "/path1",
        title: "Book A",
        authors: ["Author"],
        tags: ["fantasy", "magic", "adventure"],
        totalPages: 400,
      });

      await bookRepository.create({
        calibreId: 2,
        path: "/path2",
        title: "Book B",
        authors: ["Author"],
        tags: ["fantasy", "adventure"],
        totalPages: 350,
      });

      await bookRepository.create({
        calibreId: 3,
        path: "/path3",
        title: "Book C",
        authors: ["Author"],
        tags: ["fantasy"],
        totalPages: 300,
      });

      const filters = { tags: ["fantasy", "adventure"] };

      const result1 = await bookRepository.findWithFilters(filters);
      const result2 = await bookRepository.findWithFiltersAndRelations(filters);

      // Both methods should return the same books
      expect(result1.total).toBe(result2.total);
      expect(result1.books).toHaveLength(result2.books.length);

      const titles1 = result1.books.map((b) => b.title).sort();
      const titles2 = result2.books.map((b) => b.title).sort();
      expect(titles1).toEqual(titles2);
    });
  });
});
