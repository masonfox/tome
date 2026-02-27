import { describe, test, expect, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import { bookRepository } from "@/lib/repositories";
import { setupTestDatabase, teardownTestDatabase, clearTestDatabase } from "@/__tests__/helpers/db-setup";

describe("Book Search Functionality", () => {
  beforeAll(async () => {
    await setupTestDatabase(__filename);
  });

  afterAll(async () => {
    await teardownTestDatabase(__filename);
  });

  beforeEach(async () => {
    await clearTestDatabase(__filename);
  });

  describe("Case Insensitive Search", () => {
    test("should search title case-insensitively", async () => {
      await bookRepository.create({
        calibreId: 1,
        title: "The Hobbit",
        authors: ["J.R.R. Tolkien"],
        tags: [],
      });

      await bookRepository.create({
        calibreId: 2,
        title: "HARRY POTTER",
        authors: ["J.K. Rowling"],
        tags: [],
      });

      // Search lowercase
      const result1 = await bookRepository.findWithFilters({ search: "hobbit" });
      expect(result1.books).toHaveLength(1);
      expect(result1.books[0].title).toBe("The Hobbit");

      // Search uppercase
      const result2 = await bookRepository.findWithFilters({ search: "POTTER" });
      expect(result2.books).toHaveLength(1);
      expect(result2.books[0].title).toBe("HARRY POTTER");

      // Search mixed case
      const result3 = await bookRepository.findWithFilters({ search: "HoBbIt" });
      expect(result3.books).toHaveLength(1);
    });

    test("should search authors case-insensitively", async () => {
      await bookRepository.create({
        calibreId: 1,
        title: "Book",
        authors: ["Brandon Sanderson"],
        tags: [],
      });

      const result = await bookRepository.findWithFilters({ search: "sanderson" });
      expect(result.books).toHaveLength(1);
      expect(result.books[0].authors[0]).toBe("Brandon Sanderson");
    });
  });

  describe("Partial Matching", () => {
    test("should find partial title matches", async () => {
      await bookRepository.create({
        calibreId: 1,
        title: "The Way of Kings",
        authors: ["Brandon Sanderson"],
        tags: [],
      });

      const result = await bookRepository.findWithFilters({ search: "Way" });
      expect(result.books).toHaveLength(1);
    });

    test("should find partial author matches", async () => {
      await bookRepository.create({
        calibreId: 1,
        title: "Book",
        authors: ["Patrick Rothfuss"],
        tags: [],
      });

      const result = await bookRepository.findWithFilters({ search: "Roth" });
      expect(result.books).toHaveLength(1);
    });
  });

  describe("Special Characters in Search", () => {
    test("should handle apostrophes in search", async () => {
      await bookRepository.create({
        calibreId: 1,
        title: "O'Reilly's Book",
        authors: ["Author"],
        tags: [],
      });

      const result = await bookRepository.findWithFilters({ search: "O'Reilly" });
      expect(result.books).toHaveLength(1);
    });

    test("should handle hyphens in search", async () => {
      await bookRepository.create({
        calibreId: 1,
        title: "Spider-Man",
        authors: ["Author"],
        tags: [],
      });

      const result = await bookRepository.findWithFilters({ search: "Spider-Man" });
      expect(result.books).toHaveLength(1);
    });

    test("should handle parentheses in search", async () => {
      await bookRepository.create({
        calibreId: 1,
        title: "Book (Special Edition)",
        authors: ["Author"],
        tags: [],
      });

      const result = await bookRepository.findWithFilters({ search: "(Special" });
      expect(result.books).toHaveLength(1);
    });
  });

  describe("Multiple Results", () => {
    test("should return all matching books", async () => {
      await bookRepository.create({
        calibreId: 1,
        title: "Harry Potter and the Philosopher's Stone",
        authors: ["J.K. Rowling"],
        tags: [],
      });

      await bookRepository.create({
        calibreId: 2,
        title: "Harry Potter and the Chamber of Secrets",
        authors: ["J.K. Rowling"],
        tags: [],
      });

      await bookRepository.create({
        calibreId: 3,
        title: "The Hobbit",
        authors: ["J.R.R. Tolkien"],
        tags: [],
      });

      const result = await bookRepository.findWithFilters({ search: "Harry Potter" });
      expect(result.books).toHaveLength(2);
    });

    test("should respect pagination with search", async () => {
      for (let i = 1; i <= 10; i++) {
        await bookRepository.create({
          calibreId: i,
          title: `Fantasy Book ${i}`,
          authors: ["Author"],
          tags: [],
          path: `/path${i}`,
        });
      }

      const result = await bookRepository.findWithFilters({ search: "Fantasy" }, 5, 0);
      expect(result.books).toHaveLength(5);
      expect(result.total).toBe(10);
    });
  });

  describe("No Results", () => {
    test("should return empty array for no matches", async () => {
      await bookRepository.create({
        calibreId: 1,
        title: "The Hobbit",
        authors: ["J.R.R. Tolkien"],
        tags: [],
      });

      const result = await bookRepository.findWithFilters({ search: "Nonexistent" });
      expect(result.books).toHaveLength(0);
      expect(result.total).toBe(0);
    });
  });

  describe("Empty Search", () => {
    test("should return all books for empty search", async () => {
      await bookRepository.create({
        calibreId: 1,
        title: "Book 1",
        authors: ["Author 1"],
        tags: [],
      });

      await bookRepository.create({
        calibreId: 2,
        title: "Book 2",
        authors: ["Author 2"],
        tags: [],
      });

      const result = await bookRepository.findWithFilters({ search: "" });
      expect(result.books).toHaveLength(2);
    });
  });

  describe("Tag Filtering", () => {
    test("should filter by single tag", async () => {
      await bookRepository.create({
        calibreId: 1,
        title: "Fantasy Book",
        authors: ["Author"],
        tags: ["Fantasy", "Adventure"],
      });

      await bookRepository.create({
        calibreId: 2,
        title: "Sci-Fi Book",
        authors: ["Author"],
        tags: ["Sci-Fi"],
      });

      const result = await bookRepository.findWithFilters({ tags: ["Fantasy"] });
      expect(result.books).toHaveLength(1);
      expect(result.books[0].title).toBe("Fantasy Book");
    });

    test("should filter by multiple tags (AND logic)", async () => {
      // Book with Fantasy only
      await bookRepository.create({
        calibreId: 1,
        title: "Fantasy Book",
        authors: ["Author"],
        tags: ["Fantasy"],
      });

      // Book with Sci-Fi only
      await bookRepository.create({
        calibreId: 2,
        title: "Sci-Fi Book",
        authors: ["Author"],
        tags: ["Sci-Fi"],
      });

      // Book with both Fantasy AND Sci-Fi
      await bookRepository.create({
        calibreId: 3,
        title: "Fantasy Sci-Fi Hybrid",
        authors: ["Author"],
        tags: ["Fantasy", "Sci-Fi"],
      });

      // Book with Romance only
      await bookRepository.create({
        calibreId: 4,
        title: "Romance Book",
        authors: ["Author"],
        tags: ["Romance"],
      });

      // When filtering by multiple tags, only books with ALL tags should be returned
      const result = await bookRepository.findWithFilters({ tags: ["Fantasy", "Sci-Fi"] });
      expect(result.books).toHaveLength(1);
      expect(result.books[0].title).toBe("Fantasy Sci-Fi Hybrid");
    });

    test("should return book with superset of tags when filtering by multiple tags", async () => {
      // Book A: has fantasy, magic, adventure (superset)
      await bookRepository.create({
        calibreId: 1,
        title: "Epic Fantasy",
        authors: ["Author"],
        tags: ["fantasy", "magic", "adventure", "dragons"],
      });

      // Book B: has fantasy, adventure (exact match)
      await bookRepository.create({
        calibreId: 2,
        title: "Simple Fantasy",
        authors: ["Author"],
        tags: ["fantasy", "adventure"],
      });

      // Book C: has only fantasy (subset)
      await bookRepository.create({
        calibreId: 3,
        title: "Pure Fantasy",
        authors: ["Author"],
        tags: ["fantasy"],
      });

      // Query for fantasy AND adventure - should return Books A and B
      const result = await bookRepository.findWithFilters({ tags: ["fantasy", "adventure"] });
      expect(result.books).toHaveLength(2);
      expect(result.books.map((b) => b.title).sort()).toEqual(["Epic Fantasy", "Simple Fantasy"]);
    });

    test("should handle three-tag AND filter correctly", async () => {
      // Book with all three tags
      await bookRepository.create({
        calibreId: 1,
        title: "Complete Book",
        authors: ["Author"],
        tags: ["fantasy", "magic", "adventure"],
      });

      // Book with only two tags
      await bookRepository.create({
        calibreId: 2,
        title: "Incomplete Book",
        authors: ["Author"],
        tags: ["fantasy", "magic"],
      });

      const result = await bookRepository.findWithFilters({
        tags: ["fantasy", "magic", "adventure"],
      });
      expect(result.books).toHaveLength(1);
      expect(result.books[0].title).toBe("Complete Book");
    });

    test("should return empty array when no books match all tags", async () => {
      await bookRepository.create({
        calibreId: 1,
        title: "Fantasy Book",
        authors: ["Author"],
        tags: ["fantasy"],
      });

      await bookRepository.create({
        calibreId: 2,
        title: "Sci-Fi Book",
        authors: ["Author"],
        tags: ["sci-fi"],
      });

      // Query for tags that no book has together
      const result = await bookRepository.findWithFilters({ tags: ["fantasy", "sci-fi"] });
      expect(result.books).toHaveLength(0);
      expect(result.total).toBe(0);
    });

    test("should handle empty tags array", async () => {
      await bookRepository.create({
        calibreId: 1,
        title: "Book 1",
        authors: ["Author"],
        tags: ["fantasy"],
      });

      await bookRepository.create({
        calibreId: 2,
        title: "Book 2",
        authors: ["Author"],
        tags: ["sci-fi"],
      });

      // Empty tags array should return all books
      const result = await bookRepository.findWithFilters({ tags: [] });
      expect(result.books).toHaveLength(2);
    });
  });

  describe("Combined Filters", () => {
    test("should combine search and tag filters", async () => {
      await bookRepository.create({
        calibreId: 1,
        title: "Harry Potter Fantasy",
        authors: ["J.K. Rowling"],
        tags: ["Fantasy"],
      });

      await bookRepository.create({
        calibreId: 2,
        title: "Harry Potter Sci-Fi",
        authors: ["J.K. Rowling"],
        tags: ["Sci-Fi"],
      });

      const result = await bookRepository.findWithFilters({
        search: "Harry",
        tags: ["Fantasy"],
      });
      expect(result.books).toHaveLength(1);
      expect(result.books[0].title).toBe("Harry Potter Fantasy");
    });
  });
});
