import { describe, test, expect, beforeAll, afterAll, mock } from "bun:test";
import { Database } from "bun:sqlite";
import {
  getAllBooks,
  getBookById,
  searchBooks,
  getBookTags,
  getCoverPath,
} from "@/lib/db/calibre";

/**
 * Calibre Query Tests
 * Tests SQL query logic using SQLite :memory: database
 *
 * These tests create a mock Calibre database structure in memory
 * to verify all query functions work correctly without needing
 * a real Calibre database file.
 */

let testDb: Database;
let mockGetCalibreDB: ReturnType<typeof mock>;

// Mock the getCalibreDB function to return our test database
mock.module("@/lib/db/calibre", () => {
  const actual = require("@/lib/db/calibre");
  return {
    ...actual,
    getCalibreDB: () => mockGetCalibreDB(),
  };
});

/**
 * Creates a complete Calibre database schema in memory
 * This mimics the real Calibre database structure
 */
function createCalibreSchema(db: Database) {
  // Books table (core)
  db.run(`
    CREATE TABLE books (
      id INTEGER PRIMARY KEY,
      title TEXT NOT NULL,
      timestamp TEXT,
      pubdate TEXT,
      series_index REAL,
      path TEXT NOT NULL,
      has_cover INTEGER DEFAULT 0,
      publisher INTEGER,
      series INTEGER
    );
  `);

  // Authors
  db.run(`
    CREATE TABLE authors (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL
    );
  `);

  // Books-Authors link table
  db.run(`
    CREATE TABLE books_authors_link (
      id INTEGER PRIMARY KEY,
      book INTEGER NOT NULL,
      author INTEGER NOT NULL,
      FOREIGN KEY(book) REFERENCES books(id),
      FOREIGN KEY(author) REFERENCES authors(id)
    );
  `);

  // Publishers
  db.run(`
    CREATE TABLE publishers (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL
    );
  `);

  // Series
  db.run(`
    CREATE TABLE series (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL
    );
  `);

  // Tags
  db.run(`
    CREATE TABLE tags (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL
    );
  `);

  // Books-Tags link table
  db.run(`
    CREATE TABLE books_tags_link (
      id INTEGER PRIMARY KEY,
      book INTEGER NOT NULL,
      tag INTEGER NOT NULL,
      FOREIGN KEY(book) REFERENCES books(id),
      FOREIGN KEY(tag) REFERENCES tags(id)
    );
  `);

  // Identifiers (ISBN, etc.)
  db.run(`
    CREATE TABLE identifiers (
      id INTEGER PRIMARY KEY,
      book INTEGER NOT NULL,
      type TEXT NOT NULL,
      val TEXT NOT NULL,
      FOREIGN KEY(book) REFERENCES books(id)
    );
  `);

  // Comments (descriptions)
  db.run(`
    CREATE TABLE comments (
      id INTEGER PRIMARY KEY,
      book INTEGER NOT NULL,
      text TEXT,
      FOREIGN KEY(book) REFERENCES books(id)
    );
  `);
}

/**
 * Inserts sample book data for testing
 */
function insertSampleData(db: Database) {
  // Insert publishers
  db.prepare("INSERT INTO publishers (id, name) VALUES (?, ?)").run(1, "Bantam Books");
  db.prepare("INSERT INTO publishers (id, name) VALUES (?, ?)").run(2, "DAW Books");

  // Insert series
  db.prepare("INSERT INTO series (id, name) VALUES (?, ?)").run(1, "A Song of Ice and Fire");
  db.prepare("INSERT INTO series (id, name) VALUES (?, ?)").run(2, "The Kingkiller Chronicle");

  // Insert authors
  db.prepare("INSERT INTO authors (id, name) VALUES (?, ?)").run(1, "George R. R. Martin");
  db.prepare("INSERT INTO authors (id, name) VALUES (?, ?)").run(2, "Patrick Rothfuss");
  db.prepare("INSERT INTO authors (id, name) VALUES (?, ?)").run(3, "Neil Gaiman");
  db.prepare("INSERT INTO authors (id, name) VALUES (?, ?)").run(4, "Terry Pratchett");

  // Insert tags
  db.prepare("INSERT INTO tags (id, name) VALUES (?, ?)").run(1, "fantasy");
  db.prepare("INSERT INTO tags (id, name) VALUES (?, ?)").run(2, "epic");
  db.prepare("INSERT INTO tags (id, name) VALUES (?, ?)").run(3, "adventure");
  db.prepare("INSERT INTO tags (id, name) VALUES (?, ?)").run(4, "humor");

  // Book 1: Complete data with series
  db.prepare(`
    INSERT INTO books (id, title, timestamp, pubdate, series_index, path, has_cover, publisher, series)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    1,
    "A Dance with Dragons",
    "2025-11-01 10:00:00",
    "2011-07-12",
    5.0,
    "George R. R. Martin/A Dance with Dragons (1)",
    1,
    1,
    1
  );

  // Link author
  db.prepare("INSERT INTO books_authors_link (book, author) VALUES (?, ?)").run(1, 1);

  // Link tags
  db.prepare("INSERT INTO books_tags_link (book, tag) VALUES (?, ?)").run(1, 1);
  db.prepare("INSERT INTO books_tags_link (book, tag) VALUES (?, ?)").run(1, 2);

  // Add ISBN
  db.prepare("INSERT INTO identifiers (book, type, val) VALUES (?, ?, ?)").run(1, "isbn", "9780553801477");

  // Add description
  db.prepare("INSERT INTO comments (book, text) VALUES (?, ?)").run(1, "The future of the Seven Kingdoms hangs in the balance.");

  // Book 2: Multiple authors (Good Omens)
  db.prepare(`
    INSERT INTO books (id, title, timestamp, pubdate, series_index, path, has_cover, publisher, series)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    2,
    "Good Omens",
    "2025-11-02 10:00:00",
    "1990-05-01",
    null,
    "Neil Gaiman/Good Omens (2)",
    1,
    null,
    null
  );

  // Link multiple authors
  db.prepare("INSERT INTO books_authors_link (book, author) VALUES (?, ?)").run(2, 3);
  db.prepare("INSERT INTO books_authors_link (book, author) VALUES (?, ?)").run(2, 4);

  // Link tags
  db.prepare("INSERT INTO books_tags_link (book, tag) VALUES (?, ?)").run(2, 1);
  db.prepare("INSERT INTO books_tags_link (book, tag) VALUES (?, ?)").run(2, 4);

  // Book 3: Minimal data (no publisher, series, tags, ISBN, description)
  db.prepare(`
    INSERT INTO books (id, title, timestamp, pubdate, series_index, path, has_cover, publisher, series)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    3,
    "The Name of the Wind",
    "2025-11-03 10:00:00",
    "2007-03-27",
    1.0,
    "Patrick Rothfuss/The Name of the Wind (3)",
    0,
    null,
    2
  );

  // Link author
  db.prepare("INSERT INTO books_authors_link (book, author) VALUES (?, ?)").run(3, 2);

  // Book 4: No authors (edge case)
  db.prepare(`
    INSERT INTO books (id, title, timestamp, pubdate, series_index, path, has_cover, publisher, series)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    4,
    "Unknown Author Book",
    "2025-11-04 10:00:00",
    null,
    null,
    "Unknown/Unknown Author Book (4)",
    0,
    null,
    null
  );
}

describe("Calibre Query Functions with Full Schema", () => {
  beforeAll(() => {
    // Create in-memory database with full Calibre schema
    testDb = new Database(":memory:");
    createCalibreSchema(testDb);
    insertSampleData(testDb);

    // Mock getCalibreDB to return our test database
    mockGetCalibreDB = mock(() => testDb);
  });

  afterAll(() => {
    testDb.close();
  });

  describe("getAllBooks", () => {
    test("retrieves all books with complete data", () => {
      const books = getAllBooks();

      expect(books).toHaveLength(4);
      expect(books[0].title).toBe("A Dance with Dragons");
    });

    test("includes author names concatenated", () => {
      const books = getAllBooks();
      const goodOmens = books.find(b => b.title === "Good Omens");

      expect(goodOmens).toBeDefined();
      // Multiple authors should be concatenated
      expect(goodOmens!.authors).toContain("Neil Gaiman");
      expect(goodOmens!.authors).toContain("Terry Pratchett");
    });

    test("includes publisher name when present", () => {
      const books = getAllBooks();
      const danceWithDragons = books.find(b => b.title === "A Dance with Dragons");

      expect(danceWithDragons!.publisher).toBe("Bantam Books");
    });

    test("includes series name and index when present", () => {
      const books = getAllBooks();
      const danceWithDragons = books.find(b => b.title === "A Dance with Dragons");

      expect(danceWithDragons!.series).toBe("A Song of Ice and Fire");
      expect(danceWithDragons!.series_index).toBe(5.0);
    });

    test("includes ISBN when present", () => {
      const books = getAllBooks();
      const danceWithDragons = books.find(b => b.title === "A Dance with Dragons");

      expect(danceWithDragons!.isbn).toBe("9780553801477");
    });

    test("includes description when present", () => {
      const books = getAllBooks();
      const danceWithDragons = books.find(b => b.title === "A Dance with Dragons");

      expect(danceWithDragons!.description).toContain("Seven Kingdoms");
    });

    test("handles books with null optional fields", () => {
      const books = getAllBooks();
      const nameOfWind = books.find(b => b.title === "The Name of the Wind");

      expect(nameOfWind!.publisher).toBeNull();
      expect(nameOfWind!.isbn).toBeNull();
      expect(nameOfWind!.description).toBeNull();
    });

    test("handles books with no authors", () => {
      const books = getAllBooks();
      const unknownBook = books.find(b => b.title === "Unknown Author Book");

      expect(unknownBook).toBeDefined();
      expect(unknownBook!.authors).toBeNull();
    });

    test("orders books by title", () => {
      const books = getAllBooks();

      // Should be alphabetically sorted
      expect(books[0].title).toBe("A Dance with Dragons");
      expect(books[1].title).toBe("Good Omens");
      expect(books[2].title).toBe("The Name of the Wind");
      expect(books[3].title).toBe("Unknown Author Book");
    });
  });

  describe("getBookById", () => {
    test("retrieves a specific book by ID", () => {
      const book = getBookById(1);

      expect(book).toBeDefined();
      expect(book!.id).toBe(1);
      expect(book!.title).toBe("A Dance with Dragons");
      expect(book!.authors).toBe("George R. R. Martin");
    });

    test("returns undefined for non-existent ID", () => {
      const book = getBookById(999);

      // SQLite returns null for non-existent records
      expect(book).toBeFalsy();
      expect(book === undefined || book === null).toBe(true);
    });

    test("retrieves book with multiple authors", () => {
      const book = getBookById(2);

      expect(book!.authors).toContain("Neil Gaiman");
      expect(book!.authors).toContain("Terry Pratchett");
    });

    test("retrieves all fields correctly", () => {
      const book = getBookById(1);

      expect(book!.title).toBe("A Dance with Dragons");
      expect(book!.publisher).toBe("Bantam Books");
      expect(book!.series).toBe("A Song of Ice and Fire");
      expect(book!.series_index).toBe(5.0);
      expect(book!.isbn).toBe("9780553801477");
      expect(book!.has_cover).toBe(1);
      expect(book!.path).toContain("George R. R. Martin");
      expect(book!.description).toContain("Seven Kingdoms");
    });
  });

  describe("searchBooks", () => {
    test("finds books by title", () => {
      const results = searchBooks("Dragon");

      expect(results).toHaveLength(1);
      expect(results[0].title).toBe("A Dance with Dragons");
    });

    test("finds books by author name", () => {
      const results = searchBooks("Rothfuss");

      expect(results).toHaveLength(1);
      expect(results[0].title).toBe("The Name of the Wind");
    });

    test("search is case-insensitive", () => {
      const results = searchBooks("good omens");

      expect(results).toHaveLength(1);
      expect(results[0].title).toBe("Good Omens");
    });

    test("returns multiple matches when applicable", () => {
      const results = searchBooks("the");

      // Should find "The Name of the Wind" at minimum
      expect(results.length).toBeGreaterThan(0);
      const titles = results.map(b => b.title);
      expect(titles).toContain("The Name of the Wind");
    });

    test("returns empty array for no matches", () => {
      const results = searchBooks("xyznonexistent");

      expect(results).toHaveLength(0);
    });

    test("partial matches work", () => {
      const results = searchBooks("Wind");

      expect(results).toHaveLength(1);
      expect(results[0].title).toBe("The Name of the Wind");
    });

    test("orders results by title", () => {
      const results = searchBooks("a");

      // Should be alphabetically sorted
      if (results.length > 1) {
        for (let i = 1; i < results.length; i++) {
          expect(results[i - 1].title.localeCompare(results[i].title)).toBeLessThanOrEqual(0);
        }
      }
    });
  });

  describe("getBookTags", () => {
    test("retrieves all tags for a book", () => {
      const tags = getBookTags(1);

      expect(tags).toHaveLength(2);
      expect(tags).toContain("fantasy");
      expect(tags).toContain("epic");
    });

    test("orders tags alphabetically", () => {
      const tags = getBookTags(1);

      // "epic" should come before "fantasy" alphabetically
      expect(tags[0]).toBe("epic");
      expect(tags[1]).toBe("fantasy");
    });

    test("returns empty array for book with no tags", () => {
      const tags = getBookTags(3);

      expect(tags).toHaveLength(0);
    });

    test("returns empty array for non-existent book", () => {
      const tags = getBookTags(999);

      expect(tags).toHaveLength(0);
    });

    test("handles book with multiple tags correctly", () => {
      const tags = getBookTags(2);

      expect(tags).toHaveLength(2);
      expect(tags).toContain("fantasy");
      expect(tags).toContain("humor");
    });
  });

  describe("getCoverPath", () => {
    test("returns API path for book cover", () => {
      const path = getCoverPath(1);

      expect(path).toBe("/api/covers/1/cover.jpg");
    });

    test("uses book ID in path", () => {
      const path = getCoverPath(42);

      expect(path).toBe("/api/covers/42/cover.jpg");
    });

    test("always returns same format regardless of has_cover status", () => {
      // Even if book doesn't have cover in DB, path format is consistent
      const path = getCoverPath(3);

      expect(path).toBe("/api/covers/3/cover.jpg");
    });
  });
});

describe("Calibre Query Functions without Optional Columns", () => {
  let minimalDb: Database;
  let mockGetMinimalDB: ReturnType<typeof mock>;

  beforeAll(() => {
    // Create minimal schema without publisher and series columns
    minimalDb = new Database(":memory:");

    // Books table WITHOUT publisher and series columns
    minimalDb.run(`
      CREATE TABLE books (
        id INTEGER PRIMARY KEY,
        title TEXT NOT NULL,
        timestamp TEXT,
        pubdate TEXT,
        path TEXT NOT NULL,
        has_cover INTEGER DEFAULT 0
      );
    `);

    // Authors
    minimalDb.run(`
      CREATE TABLE authors (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL
      );
    `);

    // Books-Authors link
    minimalDb.run(`
      CREATE TABLE books_authors_link (
        id INTEGER PRIMARY KEY,
        book INTEGER NOT NULL,
        author INTEGER NOT NULL
      );
    `);

    // Tags
    minimalDb.run(`
      CREATE TABLE tags (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL
      );
    `);

    // Books-Tags link
    minimalDb.run(`
      CREATE TABLE books_tags_link (
        id INTEGER PRIMARY KEY,
        book INTEGER NOT NULL,
        tag INTEGER NOT NULL
      );
    `);

    // Identifiers
    minimalDb.run(`
      CREATE TABLE identifiers (
        id INTEGER PRIMARY KEY,
        book INTEGER NOT NULL,
        type TEXT NOT NULL,
        val TEXT NOT NULL
      );
    `);

    // Comments
    minimalDb.run(`
      CREATE TABLE comments (
        id INTEGER PRIMARY KEY,
        book INTEGER NOT NULL,
        text TEXT
      );
    `);

    // Insert minimal test data
    minimalDb.prepare(`
      INSERT INTO books (id, title, timestamp, pubdate, path, has_cover)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(1, "Test Book", "2025-11-01 10:00:00", "2020-01-01", "Test/Book", 1);

    minimalDb.prepare("INSERT INTO authors (id, name) VALUES (?, ?)").run(1, "Test Author");
    minimalDb.prepare("INSERT INTO books_authors_link (book, author) VALUES (?, ?)").run(1, 1);

    // Mock to use minimal database
    mockGetMinimalDB = mock(() => minimalDb);
  });

  afterAll(() => {
    minimalDb.close();
  });

  test("getAllBooks handles missing publisher column", () => {
    // Temporarily swap the mock
    const originalMock = mockGetCalibreDB;
    mockGetCalibreDB = mockGetMinimalDB;

    const books = getAllBooks();

    expect(books).toHaveLength(1);
    expect(books[0].publisher).toBeNull();
    expect(books[0].series).toBeNull();
    expect(books[0].series_index).toBeNull();

    // Restore original mock
    mockGetCalibreDB = originalMock;
  });

  test("getBookById handles missing series column", () => {
    const originalMock = mockGetCalibreDB;
    mockGetCalibreDB = mockGetMinimalDB;

    const book = getBookById(1);

    expect(book).toBeDefined();
    expect(book!.series).toBeNull();
    expect(book!.series_index).toBeNull();

    mockGetCalibreDB = originalMock;
  });

  test("searchBooks works without publisher/series columns", () => {
    const originalMock = mockGetCalibreDB;
    mockGetCalibreDB = mockGetMinimalDB;

    const results = searchBooks("Test");

    expect(results).toHaveLength(1);
    expect(results[0].title).toBe("Test Book");

    mockGetCalibreDB = originalMock;
  });
});
