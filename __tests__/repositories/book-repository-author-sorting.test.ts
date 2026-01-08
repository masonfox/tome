import { describe, test, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { bookRepository } from "@/lib/repositories";
import { setupTestDatabase, teardownTestDatabase, clearTestDatabase } from "@/__tests__/helpers/db-setup";
import { createTestBook } from "../fixtures/test-data";

/**
 * BookRepository Author Sorting Tests
 *
 * Tests that author sorting works correctly by last name (not first name)
 * for both findWithFilters() and findWithFiltersAndRelations() methods.
 *
 * Covers edge cases:
 * - Multi-word names (e.g., "Ursula K. Le Guin" -> sorts by "Guin")
 * - Single names (e.g., "Plato" -> sorts by "Plato")
 * - Empty authors array
 * - Multiple authors per book (uses first author only)
 * - Mixed case handling
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

describe("BookRepository Author Sorting", () => {
  describe("findWithFilters() - Author Sorting", () => {
    test("should sort books by author last name in ascending order", async () => {
      // Create books with different author last names
      await bookRepository.create(createTestBook({
        calibreId: 1,
        title: "Book by Sanderson",
        authors: ["Brandon Sanderson"], // Last name: Sanderson
        path: "Brandon Sanderson/Book (1)",
        tags: [],
      }));

      await bookRepository.create(createTestBook({
        calibreId: 2,
        title: "Book by Rothfuss",
        authors: ["Patrick Rothfuss"], // Last name: Rothfuss
        path: "Patrick Rothfuss/Book (2)",
        tags: [],
      }));

      await bookRepository.create(createTestBook({
        calibreId: 3,
        title: "Book by Abercrombie",
        authors: ["Joe Abercrombie"], // Last name: Abercrombie
        path: "Joe Abercrombie/Book (3)",
        tags: [],
      }));

      await bookRepository.create(createTestBook({
        calibreId: 4,
        title: "Book by Le Guin",
        authors: ["Ursula K. Le Guin"], // Last name: Guin (last word)
        path: "Ursula K. Le Guin/Book (4)",
        tags: [],
      }));

      await bookRepository.create(createTestBook({
        calibreId: 5,
        title: "Book by Plato",
        authors: ["Plato"], // Single name: Plato
        path: "Plato/Book (5)",
        tags: [],
      }));

      // Get books sorted by author ascending
      const result = await bookRepository.findWithFilters({}, 50, 0, "author");

      expect(result.books).toHaveLength(5);
      expect(result.total).toBe(5);

      // Expected order by last name:
      // Abercrombie, Guin, Plato, Rothfuss, Sanderson
      expect(result.books[0].authors).toEqual(["Joe Abercrombie"]);
      expect(result.books[1].authors).toEqual(["Ursula K. Le Guin"]);
      expect(result.books[2].authors).toEqual(["Plato"]);
      expect(result.books[3].authors).toEqual(["Patrick Rothfuss"]);
      expect(result.books[4].authors).toEqual(["Brandon Sanderson"]);
    });

    test("should sort books by author last name in descending order", async () => {
      // Create books
      await bookRepository.create(createTestBook({
        calibreId: 1,
        title: "Book by Sanderson",
        authors: ["Brandon Sanderson"],
        path: "Brandon Sanderson/Book (1)",
        tags: [],
      }));

      await bookRepository.create(createTestBook({
        calibreId: 2,
        title: "Book by Abercrombie",
        authors: ["Joe Abercrombie"],
        path: "Joe Abercrombie/Book (2)",
        tags: [],
      }));

      await bookRepository.create(createTestBook({
        calibreId: 3,
        title: "Book by King",
        authors: ["Stephen King"],
        path: "Stephen King/Book (3)",
        tags: [],
      }));

      // Get books sorted by author descending
      const result = await bookRepository.findWithFilters({}, 50, 0, "author_desc");

      expect(result.books).toHaveLength(3);

      // Expected order by last name descending:
      // Sanderson, King, Abercrombie
      expect(result.books[0].authors).toEqual(["Brandon Sanderson"]);
      expect(result.books[1].authors).toEqual(["Stephen King"]);
      expect(result.books[2].authors).toEqual(["Joe Abercrombie"]);
    });

    test("should handle books with empty authors array", async () => {
      // Create book with author
      await bookRepository.create(createTestBook({
        calibreId: 1,
        title: "Book with Author",
        authors: ["Brandon Sanderson"],
        path: "Brandon Sanderson/Book (1)",
        tags: [],
      }));

      // Create book with empty authors
      await bookRepository.create(createTestBook({
        calibreId: 2,
        title: "Book without Author",
        authors: [],
        path: "Unknown/Book (2)",
        tags: [],
      }));

      // Create another book with author
      await bookRepository.create(createTestBook({
        calibreId: 3,
        title: "Book by Abercrombie",
        authors: ["Joe Abercrombie"],
        path: "Joe Abercrombie/Book (3)",
        tags: [],
      }));

      // Get books sorted by author
      const result = await bookRepository.findWithFilters({}, 50, 0, "author");

      expect(result.books).toHaveLength(3);

      // Books with no author (empty string) should come first
      expect(result.books[0].authors).toEqual([]);
      expect(result.books[1].authors).toEqual(["Joe Abercrombie"]);
      expect(result.books[2].authors).toEqual(["Brandon Sanderson"]);
    });

    test("should use first author when book has multiple authors", async () => {
      // Create books with multiple authors
      await bookRepository.create(createTestBook({
        calibreId: 1,
        title: "Book by Sanderson and Weeks",
        authors: ["Brandon Sanderson", "Brent Weeks"], // Should sort by Sanderson
        path: "Brandon Sanderson & Brent Weeks/Book (1)",
        tags: [],
      }));

      await bookRepository.create(createTestBook({
        calibreId: 2,
        title: "Book by Abercrombie and Lawrence",
        authors: ["Joe Abercrombie", "Mark Lawrence"], // Should sort by Abercrombie
        path: "Joe Abercrombie & Mark Lawrence/Book (2)",
        tags: [],
      }));

      await bookRepository.create(createTestBook({
        calibreId: 3,
        title: "Book by King",
        authors: ["Stephen King"],
        path: "Stephen King/Book (3)",
        tags: [],
      }));

      // Get books sorted by author
      const result = await bookRepository.findWithFilters({}, 50, 0, "author");

      expect(result.books).toHaveLength(3);

      // Expected order by first author's last name:
      // Abercrombie, King, Sanderson
      expect(result.books[0].authors[0]).toBe("Joe Abercrombie");
      expect(result.books[1].authors[0]).toBe("Stephen King");
      expect(result.books[2].authors[0]).toBe("Brandon Sanderson");
    });

    test("should handle mixed case author names", async () => {
      // Create books with various case patterns
      await bookRepository.create(createTestBook({
        calibreId: 1,
        title: "Book 1",
        authors: ["STEPHEN KING"],
        path: "STEPHEN KING/Book (1)",
        tags: [],
      }));

      await bookRepository.create(createTestBook({
        calibreId: 2,
        title: "Book 2",
        authors: ["stephen king"],
        path: "stephen king/Book (2)",
        tags: [],
      }));

      await bookRepository.create(createTestBook({
        calibreId: 3,
        title: "Book 3",
        authors: ["Joe Abercrombie"],
        path: "Joe Abercrombie/Book (3)",
        tags: [],
      }));

      // Get books sorted by author
      const result = await bookRepository.findWithFilters({}, 50, 0, "author");

      expect(result.books).toHaveLength(3);

      // Case-insensitive sorting: Abercrombie, then both Kings
      expect(result.books[0].authors[0]).toBe("Joe Abercrombie");
      // Both King entries should be sorted together (case-insensitive)
      expect(result.books[1].authors[0].toLowerCase()).toBe("stephen king");
      expect(result.books[2].authors[0].toLowerCase()).toBe("stephen king");
    });

    test("should work with pagination", async () => {
      // Create 5 books
      await bookRepository.create(createTestBook({
        calibreId: 1,
        title: "Book A",
        authors: ["Author E"],
        path: "Author E/Book (1)",
        tags: [],
      }));

      await bookRepository.create(createTestBook({
        calibreId: 2,
        title: "Book B",
        authors: ["Author D"],
        path: "Author D/Book (2)",
        tags: [],
      }));

      await bookRepository.create(createTestBook({
        calibreId: 3,
        title: "Book C",
        authors: ["Author C"],
        path: "Author C/Book (3)",
        tags: [],
      }));

      await bookRepository.create(createTestBook({
        calibreId: 4,
        title: "Book D",
        authors: ["Author B"],
        path: "Author B/Book (4)",
        tags: [],
      }));

      await bookRepository.create(createTestBook({
        calibreId: 5,
        title: "Book E",
        authors: ["Author A"],
        path: "Author A/Book (5)",
        tags: [],
      }));

      // Get first 3 books
      const page1 = await bookRepository.findWithFilters({}, 3, 0, "author");
      expect(page1.books).toHaveLength(3);
      expect(page1.total).toBe(5);
      expect(page1.books[0].authors[0]).toBe("Author A");
      expect(page1.books[1].authors[0]).toBe("Author B");
      expect(page1.books[2].authors[0]).toBe("Author C");

      // Get next 2 books
      const page2 = await bookRepository.findWithFilters({}, 3, 3, "author");
      expect(page2.books).toHaveLength(2);
      expect(page2.total).toBe(5);
      expect(page2.books[0].authors[0]).toBe("Author D");
      expect(page2.books[1].authors[0]).toBe("Author E");
    });
  });

  describe("findWithFiltersAndRelations() - Author Sorting", () => {
    test("should sort books by author last name in ascending order", async () => {
      // Create books with different author last names
      await bookRepository.create(createTestBook({
        calibreId: 1,
        title: "Book by Sanderson",
        authors: ["Brandon Sanderson"],
        path: "Brandon Sanderson/Book (1)",
        tags: [],
      }));

      await bookRepository.create(createTestBook({
        calibreId: 2,
        title: "Book by Abercrombie",
        authors: ["Joe Abercrombie"],
        path: "Joe Abercrombie/Book (2)",
        tags: [],
      }));

      await bookRepository.create(createTestBook({
        calibreId: 3,
        title: "Book by Le Guin",
        authors: ["Ursula K. Le Guin"],
        path: "Ursula K. Le Guin/Book (3)",
        tags: [],
      }));

      // Get books sorted by author ascending
      const result = await bookRepository.findWithFiltersAndRelations({}, 50, 0, "author");

      expect(result.books).toHaveLength(3);
      expect(result.total).toBe(3);

      // Expected order by last name:
      // Abercrombie, Guin, Sanderson
      expect(result.books[0].authors).toEqual(["Joe Abercrombie"]);
      expect(result.books[1].authors).toEqual(["Ursula K. Le Guin"]);
      expect(result.books[2].authors).toEqual(["Brandon Sanderson"]);
    });

    test("should sort books by author last name in descending order", async () => {
      // Create books
      await bookRepository.create(createTestBook({
        calibreId: 1,
        title: "Book by Sanderson",
        authors: ["Brandon Sanderson"],
        path: "Brandon Sanderson/Book (1)",
        tags: [],
      }));

      await bookRepository.create(createTestBook({
        calibreId: 2,
        title: "Book by Abercrombie",
        authors: ["Joe Abercrombie"],
        path: "Joe Abercrombie/Book (2)",
        tags: [],
      }));

      // Get books sorted by author descending
      const result = await bookRepository.findWithFiltersAndRelations({}, 50, 0, "author_desc");

      expect(result.books).toHaveLength(2);

      // Expected order by last name descending:
      // Sanderson, Abercrombie
      expect(result.books[0].authors).toEqual(["Brandon Sanderson"]);
      expect(result.books[1].authors).toEqual(["Joe Abercrombie"]);
    });

    test("should handle books with empty authors array", async () => {
      // Create book with author
      await bookRepository.create(createTestBook({
        calibreId: 1,
        title: "Book with Author",
        authors: ["Brandon Sanderson"],
        path: "Brandon Sanderson/Book (1)",
        tags: [],
      }));

      // Create book with empty authors
      await bookRepository.create(createTestBook({
        calibreId: 2,
        title: "Book without Author",
        authors: [],
        path: "Unknown/Book (2)",
        tags: [],
      }));

      // Get books sorted by author
      const result = await bookRepository.findWithFiltersAndRelations({}, 50, 0, "author");

      expect(result.books).toHaveLength(2);

      // Books with no author should come first
      expect(result.books[0].authors).toEqual([]);
      expect(result.books[1].authors).toEqual(["Brandon Sanderson"]);
    });

    test("should produce same sorting as findWithFilters()", async () => {
      // Create several books
      const testAuthors = [
        "Patrick Rothfuss",
        "Brandon Sanderson",
        "Joe Abercrombie",
        "Ursula K. Le Guin",
        "Plato",
      ];

      for (let i = 0; i < testAuthors.length; i++) {
        await bookRepository.create(createTestBook({
          calibreId: i + 1,
          title: `Book ${i + 1}`,
          authors: [testAuthors[i]],
          path: `${testAuthors[i]}/Book (${i + 1})`,
          tags: [],
        }));
      }

      // Get results from both methods
      const resultWithFilters = await bookRepository.findWithFilters({}, 50, 0, "author");
      const resultWithRelations = await bookRepository.findWithFiltersAndRelations({}, 50, 0, "author");

      expect(resultWithFilters.books).toHaveLength(5);
      expect(resultWithRelations.books).toHaveLength(5);

      // Both should have same sort order
      for (let i = 0; i < 5; i++) {
        expect(resultWithFilters.books[i].authors[0]).toBe(resultWithRelations.books[i].authors[0]);
      }

      // Verify the expected order
      expect(resultWithFilters.books[0].authors[0]).toBe("Joe Abercrombie");
      expect(resultWithFilters.books[1].authors[0]).toBe("Ursula K. Le Guin");
      expect(resultWithFilters.books[2].authors[0]).toBe("Plato");
      expect(resultWithFilters.books[3].authors[0]).toBe("Patrick Rothfuss");
      expect(resultWithFilters.books[4].authors[0]).toBe("Brandon Sanderson");
    });
  });

  describe("Edge Cases", () => {
    test("should handle special characters in author names", async () => {
      await bookRepository.create(createTestBook({
        calibreId: 1,
        title: "Book 1",
        authors: ["José Saramago"],
        path: "José Saramago/Book (1)",
        tags: [],
      }));

      await bookRepository.create(createTestBook({
        calibreId: 2,
        title: "Book 2",
        authors: ["François Rabelais"],
        path: "François Rabelais/Book (2)",
        tags: [],
      }));

      await bookRepository.create(createTestBook({
        calibreId: 3,
        title: "Book 3",
        authors: ["Søren Kierkegaard"],
        path: "Søren Kierkegaard/Book (3)",
        tags: [],
      }));

      // Get books sorted by author
      const result = await bookRepository.findWithFilters({}, 50, 0, "author");

      expect(result.books).toHaveLength(3);
      // Should use localeCompare which handles special characters
      // Order: Kierkegaard, Rabelais, Saramago
      expect(result.books[0].authors[0]).toBe("Søren Kierkegaard");
      expect(result.books[1].authors[0]).toBe("François Rabelais");
      expect(result.books[2].authors[0]).toBe("José Saramago");
    });

    test("should work with filters combined with author sorting", async () => {
      // Create books with tags
      await bookRepository.create(createTestBook({
        calibreId: 1,
        title: "Fantasy by Sanderson",
        authors: ["Brandon Sanderson"],
        path: "Brandon Sanderson/Book (1)",
        tags: ["Fantasy"],
      }));

      await bookRepository.create(createTestBook({
        calibreId: 2,
        title: "Fantasy by Abercrombie",
        authors: ["Joe Abercrombie"],
        path: "Joe Abercrombie/Book (2)",
        tags: ["Fantasy"],
      }));

      await bookRepository.create(createTestBook({
        calibreId: 3,
        title: "Sci-Fi by King",
        authors: ["Stephen King"],
        path: "Stephen King/Book (3)",
        tags: ["Sci-Fi"],
      }));

      // Get Fantasy books sorted by author
      const result = await bookRepository.findWithFilters({ tags: ["Fantasy"] }, 50, 0, "author");

      expect(result.books).toHaveLength(2);
      expect(result.total).toBe(2);

      // Should be sorted by last name: Abercrombie, Sanderson
      expect(result.books[0].authors[0]).toBe("Joe Abercrombie");
      expect(result.books[1].authors[0]).toBe("Brandon Sanderson");
    });
  });
});
