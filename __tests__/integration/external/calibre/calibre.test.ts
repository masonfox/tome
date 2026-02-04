import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import path from "path";
import {
  getAllBooks,
  getBookById,
  searchBooks,
  getBookTags,
  getAllBookTags,
  getBooksCount,
  resetCalibreDB,
} from "@/lib/db/calibre";

/**
 * Calibre Query Tests
 * Tests SQL query logic using real Calibre database fixtures
 *
 * These tests use actual Calibre database files (extracted from production)
 * to verify all query functions work correctly with real-world data and schema.
 * 
 * Fixtures are located in __tests__/fixtures/ and contain known test data
 * for deterministic testing. See CALIBRE_TEST_DATA.md for book IDs and metadata.
 * 
 * Uses better-sqlite3 for cross-platform compatibility with Vitest.
 * 
 * Test Approach: Set CALIBRE_DB_PATH environment variable to point to fixture files.
 * This allows the real getCalibreDB() function to open the test database, avoiding
 * complex mocking while maintaining test isolation.
 */

describe("Calibre Query Functions with Full Schema", () => {
  beforeAll(() => {
    // Set CALIBRE_DB_PATH to use the comprehensive test fixture
    const dbPath = path.join(__dirname, "..", "..", "..", "fixtures", "calibre-test-comprehensive.db");
    process.env.CALIBRE_DB_PATH = dbPath;
  });

  afterAll(() => {
    // Clean up environment variable and reset singleton
    delete process.env.CALIBRE_DB_PATH;
    resetCalibreDB();
  });

  afterAll(() => {
    // Clean up environment variable
    delete process.env.CALIBRE_DB_PATH;
  });

  describe("getAllBooks", () => {
    test("retrieves all books with complete data", () => {
      const books = getAllBooks();

      expect(books).toHaveLength(48);
      expect(books.length).toBeGreaterThan(0);
    });

    test("includes author names concatenated", () => {
      const books = getAllBooks();
      
      // ID 40: "10% Happier" - 3 authors
      const multiAuthorBook = books.find(b => b.id === 40);
      expect(multiAuthorBook).toBeDefined();
      expect(multiAuthorBook!.authors).toContain("Dan Harris");
      expect(multiAuthorBook!.authors).toContain("Jeffrey Warren");
      expect(multiAuthorBook!.authors).toContain("Carlye Adler");
    });

    test("includes series name and index when present", () => {
      const books = getAllBooks();
      
      // ID 147: "Dune" - First book in Dune series
      const dune = books.find(b => b.id === 147);
      expect(dune).toBeDefined();
      expect(dune!.series).toBe("Dune");
      expect(dune!.series_index).toBe(1.0);
      
      // ID 83: "Children of Dune" - Third book
      const childrenOfDune = books.find(b => b.id === 83);
      expect(childrenOfDune).toBeDefined();
      expect(childrenOfDune!.series).toBe("Dune");
      expect(childrenOfDune!.series_index).toBe(3.0);
    });

    test("handles books with null optional fields", () => {
      const books = getAllBooks();
      
      // ID 89: Book with no metadata (no rating, series, tags)
      const minimalBook = books.find(b => b.id === 89);
      expect(minimalBook).toBeDefined();
      expect(minimalBook!.series).toBeNull();
    });

    test("handles books with no tags", () => {
      const books = getAllBooks();
      
      // ID 89: Book with no tags
      const noTagsBook = books.find(b => b.id === 89);
      expect(noTagsBook).toBeDefined();
    });

    test("orders books alphabetically by title", () => {
      const books = getAllBooks();

      // Should be ordered alphabetically by title (case-insensitive)
      for (let i = 1; i < books.length; i++) {
        const prevTitle = books[i - 1].title.toLowerCase();
        const currTitle = books[i].title.toLowerCase();
        expect(prevTitle.localeCompare(currTitle)).toBeLessThanOrEqual(0);
      }
    });

    test("converts ratings from Calibre scale to stars", () => {
      const books = getAllBooks();
      
      // ID 147: "Dune" - 5 stars (Calibre rating: 10)
      const fiveStars = books.find(b => b.id === 147);
      expect(fiveStars!.rating).toBe(5);
      
      // ID 83: "Children of Dune" - 4 stars (Calibre rating: 8)
      const fourStars = books.find(b => b.id === 83);
      expect(fourStars!.rating).toBe(4);
      
      // ID 84: "Dune Messiah" - 3 stars (Calibre rating: 6)
      const threeStars = books.find(b => b.id === 84);
      expect(threeStars!.rating).toBe(3);
    });
  });

  describe("getBookById", () => {
    test("retrieves a specific book by ID", () => {
      // ID 147: "Dune" by Frank Herbert
      const book = getBookById(147);

      expect(book).toBeDefined();
      expect(book!.id).toBe(147);
      expect(book!.title).toBe("Dune");
      expect(book!.authors).toContain("Frank Herbert");
    });

    test("returns undefined for non-existent ID", () => {
      const book = getBookById(999999);

      expect(book).toBeFalsy();
      expect(book === undefined || book === null).toBe(true);
    });

    test("retrieves book with multiple authors", () => {
      // ID 40: "10% Happier" - 3 authors
      const book = getBookById(40);

      expect(book).toBeDefined();
      expect(book!.authors).toContain("Dan Harris");
      expect(book!.authors).toContain("Jeffrey Warren");
      expect(book!.authors).toContain("Carlye Adler");
    });

    test("retrieves rating correctly", () => {
      // ID 147: "Dune" - 5 stars
      const book = getBookById(147);

      expect(book).toBeDefined();
      expect(book!.rating).toBe(5);
    });

    test("handles book with no rating", () => {
      // ID 40: "10% Happier" - Book without rating
      const book = getBookById(40);

      expect(book).toBeDefined();
      expect(book!.rating).toBeNull();
    });

    test("retrieves series information", () => {
      // ID 147: "Dune" - First book in series
      const book = getBookById(147);

      expect(book!.series).toBe("Dune");
      expect(book!.series_index).toBe(1.0);
    });
  });

  describe("searchBooks", () => {
    test("finds books by title", () => {
      const results = searchBooks("Dune");

      expect(results.length).toBeGreaterThan(0);
      const titles = results.map(b => b.title);
      expect(titles.some(t => t.includes("Dune"))).toBe(true);
    });

    test("finds books by author name", () => {
      const results = searchBooks("Frank Herbert");

      expect(results.length).toBeGreaterThan(0);
      const hasHerbert = results.some(b => b.authors?.includes("Frank Herbert"));
      expect(hasHerbert).toBe(true);
    });

    test("search is case-insensitive", () => {
      const lowerResults = searchBooks("dune");
      const upperResults = searchBooks("DUNE");

      expect(lowerResults.length).toBeGreaterThan(0);
      expect(upperResults.length).toBeGreaterThan(0);
      expect(lowerResults.length).toBe(upperResults.length);
    });

    test("returns empty array for no matches", () => {
      const results = searchBooks("xyznonexistent12345");

      expect(results).toHaveLength(0);
    });

    test("partial matches work", () => {
      const results = searchBooks("Court");

      expect(results.length).toBeGreaterThan(0);
      // ID 859: "A Court of Thorns and Roses"
      const courtBook = results.find(b => b.id === 859);
      expect(courtBook).toBeDefined();
    });

    test("orders results by title", () => {
      const results = searchBooks("a");

      // Should be alphabetically sorted
      if (results.length > 1) {
        for (let i = 1; i < results.length; i++) {
          const prevTitle = results[i - 1].title.toLowerCase();
          const currTitle = results[i].title.toLowerCase();
          expect(prevTitle.localeCompare(currTitle)).toBeLessThanOrEqual(0);
        }
      }
    });
  });

  describe("getBookTags", () => {
    test("retrieves all tags for a book", () => {
      // ID 644: "Columbine" - 26 tags (most tags in fixture)
      const tags = getBookTags(644);

      expect(tags.length).toBeGreaterThan(20);
      expect(tags.length).toBeGreaterThanOrEqual(26);
    });

    test("orders tags alphabetically", () => {
      // ID 174: "1984" - 13 tags
      const tags = getBookTags(174);

      expect(tags.length).toBeGreaterThan(0);
      
      // Verify alphabetical order
      for (let i = 1; i < tags.length; i++) {
        expect(tags[i - 1].toLowerCase().localeCompare(tags[i].toLowerCase())).toBeLessThanOrEqual(0);
      }
    });

    test("returns empty array for book with no tags", () => {
      // ID 89: Book with no tags
      const tags = getBookTags(89);

      expect(tags).toHaveLength(0);
    });

    test("returns empty array for non-existent book", () => {
      const tags = getBookTags(999999);

      expect(tags).toHaveLength(0);
    });

    test("handles book with moderate number of tags", () => {
      // ID 147: "Dune" - 8 tags
      const tags = getBookTags(147);

      expect(tags).toHaveLength(8);
      expect(Array.isArray(tags)).toBe(true);
    });
  });
});

describe("Calibre Query Functions without Optional Columns", () => {
  beforeAll(() => {
    // Set CALIBRE_DB_PATH to use the minimal schema fixture
    const dbPath = path.join(__dirname, "..", "..", "..", "fixtures", "calibre-test-minimal.db");
    process.env.CALIBRE_DB_PATH = dbPath;
  });

  afterAll(() => {
    // Clean up environment variable and reset singleton
    delete process.env.CALIBRE_DB_PATH;
    resetCalibreDB();
  });

  test("getAllBooks handles missing optional columns", () => {
    const books = getAllBooks();

    expect(books).toHaveLength(48);
    expect(books[0].title).toBeDefined();
    
    // Schema detection should handle missing columns gracefully
    // All books should still be queryable
  });

  test("getBookById handles missing series column", () => {
    // ID 147: "Dune"
    const book = getBookById(147);

    expect(book).toBeDefined();
    expect(book!.title).toBe("Dune");
    
    // Series should be handled even if column schema differs
  });

  test("searchBooks works without optional columns", () => {
    const results = searchBooks("Dune");

    expect(results.length).toBeGreaterThan(0);
    expect(results[0].title).toBeDefined();
  });
  
  test("getBookTags works with minimal schema", () => {
    // ID 147: "Dune" - should have 8 tags
    const tags = getBookTags(147);

    expect(tags).toHaveLength(8);
  });
});

describe("getAllBookTags", () => {
  beforeAll(() => {
    // Set CALIBRE_DB_PATH to use the comprehensive test fixture
    const dbPath = path.join(__dirname, "..", "..", "..", "fixtures", "calibre-test-comprehensive.db");
    process.env.CALIBRE_DB_PATH = dbPath;
  });

  afterAll(() => {
    // Clean up environment variable and reset singleton
    delete process.env.CALIBRE_DB_PATH;
    resetCalibreDB();
  });

  test("fetches all tags for all books when no bookIds provided", () => {
    const tagsMap = getAllBookTags();

    expect(tagsMap.size).toBeGreaterThan(0);
    
    // Known data from fixture - ID 644: "Columbine" has 26 tags
    const book644Tags = tagsMap.get(644);
    expect(book644Tags).toBeDefined();
    expect(book644Tags!.length).toBe(26);
    
    // ID 521: "The Austere Academy" has 21 tags
    const book521Tags = tagsMap.get(521);
    expect(book521Tags).toBeDefined();
    expect(book521Tags!.length).toBe(21);
  });

  test("fetches tags only for specified book IDs", () => {
    const tagsMap = getAllBookTags([147, 644]); // Dune + Columbine
    
    expect(tagsMap.size).toBe(2);
    expect(tagsMap.get(147)).toHaveLength(8);
    expect(tagsMap.get(644)).toHaveLength(26);
  });

  test("returns empty map for empty bookIds array", () => {
    const tagsMap = getAllBookTags([]);
    
    expect(tagsMap.size).toBe(0);
  });

  test("returns only books with tags when specific IDs provided", () => {
    // Mix of books with tags and books without tags
    // ID 89 has 0 tags, ID 147 has 8 tags, ID 644 has 26 tags
    const tagsMap = getAllBookTags([89, 147, 644]);
    
    // Should only include books that have tags
    expect(tagsMap.size).toBe(2);
    expect(tagsMap.has(89)).toBe(false);  // No tags
    expect(tagsMap.has(147)).toBe(true);  // Has 8 tags
    expect(tagsMap.has(644)).toBe(true);  // Has 26 tags
  });

  test("handles single book ID", () => {
    const tagsMap = getAllBookTags([147]);
    
    expect(tagsMap.size).toBe(1);
    expect(tagsMap.get(147)).toHaveLength(8);
  });

  test("orders tags alphabetically per book", () => {
    const tagsMap = getAllBookTags([147]);
    const tags = tagsMap.get(147)!;
    
    expect(tags.length).toBe(8);
    
    // Verify alphabetical order
    for (let i = 1; i < tags.length; i++) {
      const prev = tags[i - 1].toLowerCase();
      const curr = tags[i].toLowerCase();
      expect(prev.localeCompare(curr)).toBeLessThanOrEqual(0);
    }
  });

  test("handles non-existent book IDs gracefully", () => {
    const tagsMap = getAllBookTags([999999, 888888]);
    
    expect(tagsMap.size).toBe(0);
  });

  test("handles mix of existent and non-existent book IDs", () => {
    const tagsMap = getAllBookTags([147, 999999, 644, 888888]);
    
    // Should only include existing books with tags
    expect(tagsMap.size).toBe(2);
    expect(tagsMap.has(147)).toBe(true);
    expect(tagsMap.has(644)).toBe(true);
    expect(tagsMap.has(999999)).toBe(false);
    expect(tagsMap.has(888888)).toBe(false);
  });

  test("returns correct tags for books with varying tag counts", () => {
    // ID 644: 26 tags, ID 174: 13 tags, ID 147: 8 tags
    const tagsMap = getAllBookTags([644, 174, 147]);
    
    expect(tagsMap.get(644)).toHaveLength(26);
    expect(tagsMap.get(174)).toHaveLength(13);
    expect(tagsMap.get(147)).toHaveLength(8);
  });
});

describe("getBooksCount", () => {
  beforeAll(() => {
    // Set CALIBRE_DB_PATH to use the comprehensive test fixture
    const dbPath = path.join(__dirname, "..", "..", "..", "fixtures", "calibre-test-comprehensive.db");
    process.env.CALIBRE_DB_PATH = dbPath;
  });

  afterAll(() => {
    // Clean up environment variable and reset singleton
    delete process.env.CALIBRE_DB_PATH;
    resetCalibreDB();
  });

  test("returns total book count", () => {
    const count = getBooksCount();
    
    expect(count).toBe(48); // Known fixture size
    expect(typeof count).toBe("number");
  });
});

describe("Pagination", () => {
  beforeAll(() => {
    // Set CALIBRE_DB_PATH to use the comprehensive test fixture
    const dbPath = path.join(__dirname, "..", "..", "..", "fixtures", "calibre-test-comprehensive.db");
    process.env.CALIBRE_DB_PATH = dbPath;
  });

  afterAll(() => {
    // Clean up environment variable and reset singleton
    delete process.env.CALIBRE_DB_PATH;
    resetCalibreDB();
  });

  test("limits results when limit provided", () => {
    const books = getAllBooks({ limit: 10 });
    
    expect(books).toHaveLength(10);
  });

  test("skips results when offset provided", () => {
    const allBooks = getAllBooks();
    const offsetBooks = getAllBooks({ offset: 10, limit: 5 });
    
    expect(offsetBooks).toHaveLength(5);
    expect(offsetBooks[0].id).toBe(allBooks[10].id);
  });

  test("handles offset beyond total count", () => {
    const books = getAllBooks({ offset: 1000, limit: 10 });
    
    expect(books).toHaveLength(0);
  });

  test("handles limit larger than total count", () => {
    const books = getAllBooks({ limit: 1000 });
    
    expect(books).toHaveLength(48); // Total books in fixture
  });

  test("handles both limit and offset", () => {
    const allBooks = getAllBooks();
    const pagedBooks = getAllBooks({ offset: 5, limit: 10 });
    
    expect(pagedBooks).toHaveLength(10);
    expect(pagedBooks[0].id).toBe(allBooks[5].id);
    expect(pagedBooks[9].id).toBe(allBooks[14].id);
  });

  test("handles offset at exact boundary", () => {
    const books = getAllBooks({ offset: 48, limit: 10 }); // Exactly at the end
    
    expect(books).toHaveLength(0);
  });

  test("handles limit of 1", () => {
    const books = getAllBooks({ limit: 1 });
    
    expect(books).toHaveLength(1);
  });

  test("returns all books when no pagination options provided", () => {
    const books = getAllBooks();
    
    expect(books).toHaveLength(48);
  });
});

