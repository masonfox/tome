import { describe, test, expect, beforeEach, afterEach, beforeAll, afterAll } from "bun:test";
import { bookRepository } from "@/lib/repositories";
import { setupTestDatabase, teardownTestDatabase, clearTestDatabase } from "@/__tests__/helpers/db-setup";

describe("Book Search Functionality", () => {
  beforeAll(async () => {
    await setupTestDatabase();
  });

  afterAll(async () => {
    await teardownTestDatabase();
  });

  beforeEach(async () => {
    await clearTestDatabase();
  });

  describe("Case Insensitive Search", () => {
    test("should search title case-insensitively", async () => {
      await bookRepository.create({
        calibreId: 1,
        title: "The Hobbit",
        authors: ["J.R.R. Tolkien"],
        tags: [],
        path: "/path1",
      });

      await bookRepository.create({
        calibreId: 2,
        title: "HARRY POTTER",
        authors: ["J.K. Rowling"],
        tags: [],
        path: "/path2",
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
        path: "/path",
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
        path: "/path",
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
        path: "/path",
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
        path: "/path",
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
        path: "/path",
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
        path: "/path",
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
        path: "/path1",
      });

      await bookRepository.create({
        calibreId: 2,
        title: "Harry Potter and the Chamber of Secrets",
        authors: ["J.K. Rowling"],
        tags: [],
        path: "/path2",
      });

      await bookRepository.create({
        calibreId: 3,
        title: "The Hobbit",
        authors: ["J.R.R. Tolkien"],
        tags: [],
        path: "/path3",
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
        path: "/path",
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
        path: "/path1",
      });

      await bookRepository.create({
        calibreId: 2,
        title: "Book 2",
        authors: ["Author 2"],
        tags: [],
        path: "/path2",
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
        path: "/path1",
      });

      await bookRepository.create({
        calibreId: 2,
        title: "Sci-Fi Book",
        authors: ["Author"],
        tags: ["Sci-Fi"],
        path: "/path2",
      });

      const result = await bookRepository.findWithFilters({ tags: ["Fantasy"] });
      expect(result.books).toHaveLength(1);
      expect(result.books[0].title).toBe("Fantasy Book");
    });

    test("should filter by multiple tags (OR logic)", async () => {
      await bookRepository.create({
        calibreId: 1,
        title: "Fantasy Book",
        authors: ["Author"],
        tags: ["Fantasy"],
        path: "/path1",
      });

      await bookRepository.create({
        calibreId: 2,
        title: "Sci-Fi Book",
        authors: ["Author"],
        tags: ["Sci-Fi"],
        path: "/path2",
      });

      await bookRepository.create({
        calibreId: 3,
        title: "Romance Book",
        authors: ["Author"],
        tags: ["Romance"],
        path: "/path3",
      });

      const result = await bookRepository.findWithFilters({ tags: ["Fantasy", "Sci-Fi"] });
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
        path: "/path1",
      });

      await bookRepository.create({
        calibreId: 2,
        title: "Harry Potter Sci-Fi",
        authors: ["J.K. Rowling"],
        tags: ["Sci-Fi"],
        path: "/path2",
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
