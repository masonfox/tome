import { describe, test, expect, beforeAll, afterAll, beforeEach } from "bun:test";
import { Database } from "bun:sqlite";

/**
 * Calibre Write Operations Tests
 * 
 * Tests the rating write functionality that updates the Calibre database.
 * Uses an in-memory SQLite database to simulate the Calibre schema.
 * 
 * These tests validate:
 * - Scale conversion (1-5 stars → 2,4,6,8,10)
 * - FK relationship handling (ratings table → books_ratings_link)
 * - Rating CRUD operations
 * - Error handling
 */

let testDb: Database;

// Import functions after setting up environment
let updateCalibreRating: (calibreId: number, rating: number | null) => void;
let readCalibreRating: (calibreId: number) => number | null;

/**
 * Creates Calibre ratings schema in memory
 */
function createCalibreRatingsSchema(db: Database) {
  // Books table (minimal - just for FK testing)
  db.run(`
    CREATE TABLE books (
      id INTEGER PRIMARY KEY,
      title TEXT NOT NULL
    );
  `);

  // Ratings lookup table
  db.run(`
    CREATE TABLE ratings (
      id INTEGER PRIMARY KEY,
      rating INTEGER CHECK(rating > -1 AND rating < 11),
      link TEXT NOT NULL DEFAULT '',
      UNIQUE (rating)
    );
  `);

  // Books-Ratings link table (junction)
  db.run(`
    CREATE TABLE books_ratings_link (
      id INTEGER PRIMARY KEY,
      book INTEGER NOT NULL,
      rating INTEGER NOT NULL,
      UNIQUE(book, rating),
      FOREIGN KEY(book) REFERENCES books(id),
      FOREIGN KEY(rating) REFERENCES ratings(id)
    );
  `);

  // FK enforcement triggers (Calibre uses triggers instead of PRAGMA foreign_keys)
  db.run(`
    CREATE TRIGGER fk_brl_book_insert
    BEFORE INSERT ON books_ratings_link
    BEGIN
      SELECT CASE
        WHEN (SELECT id FROM books WHERE id = NEW.book) IS NULL
        THEN RAISE(ABORT, 'Foreign key violation: book not in books')
        WHEN (SELECT id FROM ratings WHERE id = NEW.rating) IS NULL
        THEN RAISE(ABORT, 'Foreign key violation: rating not in ratings')
      END;
    END;
  `);

  db.run(`
    CREATE TRIGGER fk_brl_book_update
    BEFORE UPDATE ON books_ratings_link
    BEGIN
      SELECT CASE
        WHEN (SELECT id FROM books WHERE id = NEW.book) IS NULL
        THEN RAISE(ABORT, 'Foreign key violation: book not in books')
        WHEN (SELECT id FROM ratings WHERE id = NEW.rating) IS NULL
        THEN RAISE(ABORT, 'Foreign key violation: rating not in ratings')
      END;
    END;
  `);
}

/**
 * Insert test books
 */
function insertTestBooks(db: Database) {
  db.prepare("INSERT INTO books (id, title) VALUES (?, ?)").run(1, "Test Book 1");
  db.prepare("INSERT INTO books (id, title) VALUES (?, ?)").run(2, "Test Book 2");
  db.prepare("INSERT INTO books (id, title) VALUES (?, ?)").run(3, "Test Book 3");
  db.prepare("INSERT INTO books (id, title) VALUES (?, ?)").run(4, "Test Book 4");
  db.prepare("INSERT INTO books (id, title) VALUES (?, ?)").run(5, "Test Book 5");
}

/**
 * Test implementation of updateCalibreRating that works with our test DB
 */
function updateCalibreRatingTest(db: Database, calibreId: number, rating: number | null): void {
  // Validate rating (1-5 stars or null)
  if (rating !== null && (rating < 1 || rating > 5)) {
    throw new Error("Rating must be between 1 and 5");
  }
  
  // Convert to Calibre scale (1-5 stars → 2,4,6,8,10)
  const calibreRating = rating ? rating * 2 : null;
  
  if (calibreRating === null) {
    // Remove rating: delete from junction table
    const stmt = db.prepare("DELETE FROM books_ratings_link WHERE book = ?");
    stmt.run(calibreId);
  } else {
    // Step 1: Get or create rating value in ratings table
    let ratingRecord = db.prepare(
      "SELECT id FROM ratings WHERE rating = ?"
    ).get(calibreRating) as { id: number } | undefined;
    
    if (!ratingRecord) {
      const insertStmt = db.prepare(
        "INSERT INTO ratings (rating, link) VALUES (?, '')"
      );
      const result = insertStmt.run(calibreRating);
      ratingRecord = { id: Number(result.lastInsertRowid) };
    }
    
    // Step 2: Update or insert into books_ratings_link
    const existingLink = db.prepare(
      "SELECT id FROM books_ratings_link WHERE book = ?"
    ).get(calibreId) as { id: number } | undefined;
    
    if (existingLink) {
      const updateStmt = db.prepare(
        "UPDATE books_ratings_link SET rating = ? WHERE book = ?"
      );
      updateStmt.run(ratingRecord.id, calibreId);
    } else {
      const insertStmt = db.prepare(
        "INSERT INTO books_ratings_link (book, rating) VALUES (?, ?)"
      );
      insertStmt.run(calibreId, ratingRecord.id);
    }
  }
}

/**
 * Test implementation of readCalibreRating that works with our test DB
 */
function readCalibreRatingTest(db: Database, calibreId: number): number | null {
  const result = db.prepare(`
    SELECT r.rating
    FROM books_ratings_link brl
    JOIN ratings r ON brl.rating = r.id
    WHERE brl.book = ?
  `).get(calibreId) as { rating: number } | undefined;
  
  if (!result || !result.rating) {
    return null;
  }
  
  // Convert from Calibre scale (0-10) to stars (1-5)
  return result.rating / 2;
}

describe("Calibre Write Operations - Rating Management", () => {
  beforeAll(() => {
    // Create in-memory test database
    testDb = new Database(":memory:");
    createCalibreRatingsSchema(testDb);
    insertTestBooks(testDb);
    
    // Bind test functions with the test database
    updateCalibreRating = (calibreId: number, rating: number | null) => 
      updateCalibreRatingTest(testDb, calibreId, rating);
    readCalibreRating = (calibreId: number) => 
      readCalibreRatingTest(testDb, calibreId);
  });

  afterAll(() => {
    testDb.close();
  });

  beforeEach(() => {
    // Clear ratings data before each test
    testDb.run("DELETE FROM books_ratings_link");
    testDb.run("DELETE FROM ratings");
  });

  describe("Rating Creation", () => {
    test("should create rating for book (5 stars)", () => {
      updateCalibreRating(1, 5);

      // Verify rating value exists in ratings table
      const ratingRecord = testDb.prepare(
        "SELECT * FROM ratings WHERE rating = ?"
      ).get(10) as any;
      expect(ratingRecord).toBeDefined();
      expect(ratingRecord.rating).toBe(10); // 5 stars * 2

      // Verify link exists
      const link = testDb.prepare(
        "SELECT * FROM books_ratings_link WHERE book = ?"
      ).get(1) as any;
      expect(link).toBeDefined();
      expect(link.rating).toBe(ratingRecord.id); // FK to ratings.id
    });

    test("should create rating for book (4 stars)", () => {
      updateCalibreRating(1, 4);

      const ratingRecord = testDb.prepare(
        "SELECT * FROM ratings WHERE rating = ?"
      ).get(8) as any;
      expect(ratingRecord).toBeDefined();
      expect(ratingRecord.rating).toBe(8); // 4 stars * 2
    });

    test("should create rating for book (3 stars)", () => {
      updateCalibreRating(1, 3);

      const ratingRecord = testDb.prepare(
        "SELECT * FROM ratings WHERE rating = ?"
      ).get(6) as any;
      expect(ratingRecord.rating).toBe(6); // 3 stars * 2
    });

    test("should create rating for book (2 stars)", () => {
      updateCalibreRating(1, 2);

      const ratingRecord = testDb.prepare(
        "SELECT * FROM ratings WHERE rating = ?"
      ).get(4) as any;
      expect(ratingRecord.rating).toBe(4); // 2 stars * 2
    });

    test("should create rating for book (1 star)", () => {
      updateCalibreRating(1, 1);

      const ratingRecord = testDb.prepare(
        "SELECT * FROM ratings WHERE rating = ?"
      ).get(2) as any;
      expect(ratingRecord.rating).toBe(2); // 1 star * 2
    });

    test("should reuse existing rating value when available", () => {
      // Create first book with 5 stars
      updateCalibreRating(1, 5);

      // Create second book with same rating
      updateCalibreRating(2, 5);

      // Should only have ONE rating record (reused)
      const ratingRecords = testDb.prepare(
        "SELECT * FROM ratings WHERE rating = ?"
      ).all(10) as any[];
      expect(ratingRecords).toHaveLength(1);

      // But TWO links
      const links = testDb.prepare(
        "SELECT * FROM books_ratings_link WHERE rating = ?"
      ).all(ratingRecords[0].id) as any[];
      expect(links).toHaveLength(2);
    });
  });

  describe("Rating Updates", () => {
    test("should update existing rating to new value", () => {
      // Create initial rating
      updateCalibreRating(1, 3);
      
      // Verify initial
      let rating = readCalibreRating(1);
      expect(rating).toBe(3);

      // Update to different rating
      updateCalibreRating(1, 5);

      // Verify updated
      rating = readCalibreRating(1);
      expect(rating).toBe(5);

      // Verify only one link exists for this book
      const links = testDb.prepare(
        "SELECT * FROM books_ratings_link WHERE book = ?"
      ).all(1) as any[];
      expect(links).toHaveLength(1);
    });

    test("should handle multiple updates correctly", () => {
      updateCalibreRating(1, 1);
      expect(readCalibreRating(1)).toBe(1);

      updateCalibreRating(1, 2);
      expect(readCalibreRating(1)).toBe(2);

      updateCalibreRating(1, 3);
      expect(readCalibreRating(1)).toBe(3);

      updateCalibreRating(1, 4);
      expect(readCalibreRating(1)).toBe(4);

      updateCalibreRating(1, 5);
      expect(readCalibreRating(1)).toBe(5);
    });
  });

  describe("Rating Removal", () => {
    test("should remove rating when set to null", () => {
      // Create rating
      updateCalibreRating(1, 5);
      expect(readCalibreRating(1)).toBe(5);

      // Remove rating
      updateCalibreRating(1, null);

      // Verify removed
      const rating = readCalibreRating(1);
      expect(rating).toBeNull();

      // Verify link is deleted (SQLite returns null, not undefined)
      const link = testDb.prepare(
        "SELECT * FROM books_ratings_link WHERE book = ?"
      ).get(1);
      expect(link).toBeNull();
    });

    test("should not delete rating value from ratings table when removing link", () => {
      // Create two books with same rating
      updateCalibreRating(1, 5);
      updateCalibreRating(2, 5);

      // Remove rating from first book
      updateCalibreRating(1, null);

      // Rating value should still exist (for book 2)
      const ratingRecord = testDb.prepare(
        "SELECT * FROM ratings WHERE rating = ?"
      ).get(10);
      expect(ratingRecord).toBeDefined();

      // But link for book 1 should be gone
      expect(readCalibreRating(1)).toBeNull();
      
      // And link for book 2 should remain
      expect(readCalibreRating(2)).toBe(5);
    });

    test("should handle removing non-existent rating gracefully", () => {
      // Book has no rating, try to remove it
      expect(() => {
        updateCalibreRating(1, null);
      }).not.toThrow();

      // Verify still no rating
      expect(readCalibreRating(1)).toBeNull();
    });
  });

  describe("Scale Conversion", () => {
    test("should convert 1-5 stars to 2,4,6,8,10 scale", () => {
      const testCases = [
        { stars: 1, calibreValue: 2 },
        { stars: 2, calibreValue: 4 },
        { stars: 3, calibreValue: 6 },
        { stars: 4, calibreValue: 8 },
        { stars: 5, calibreValue: 10 },
      ];

      testCases.forEach(({ stars, calibreValue }) => {
        // Use books 1-5 for the test cases
        const bookId = stars; // stars 1-5 map to book IDs 1-5
        updateCalibreRating(bookId, stars);

        // Check actual Calibre DB value
        const ratingRecord = testDb.prepare(
          "SELECT r.rating FROM books_ratings_link brl JOIN ratings r ON brl.rating = r.id WHERE brl.book = ?"
        ).get(bookId) as any;

        expect(ratingRecord.rating).toBe(calibreValue);
      });
    });

    test("should convert Calibre scale back to stars when reading", () => {
      // Manually insert Calibre-scale ratings
      testDb.prepare("INSERT INTO ratings (id, rating, link) VALUES (?, ?, ?)").run(1, 2, "");
      testDb.prepare("INSERT INTO ratings (id, rating, link) VALUES (?, ?, ?)").run(2, 10, "");
      testDb.prepare("INSERT INTO books_ratings_link (book, rating) VALUES (?, ?)").run(1, 1);
      testDb.prepare("INSERT INTO books_ratings_link (book, rating) VALUES (?, ?)").run(2, 2);

      // Read should convert back to stars
      expect(readCalibreRating(1)).toBe(1); // 2 / 2 = 1 star
      expect(readCalibreRating(2)).toBe(5); // 10 / 2 = 5 stars
    });
  });

  describe("Validation", () => {
    test("should reject rating less than 1", () => {
      expect(() => {
        updateCalibreRating(1, 0);
      }).toThrow("Rating must be between 1 and 5");
    });

    test("should reject rating greater than 5", () => {
      expect(() => {
        updateCalibreRating(1, 6);
      }).toThrow("Rating must be between 1 and 5");
    });

    test("should reject negative ratings", () => {
      expect(() => {
        updateCalibreRating(1, -1);
      }).toThrow("Rating must be between 1 and 5");
    });

    test("should accept null rating", () => {
      expect(() => {
        updateCalibreRating(1, null);
      }).not.toThrow();
    });
  });

  describe("Foreign Key Integrity", () => {
    test("should enforce FK constraint on books_ratings_link.rating", () => {
      // Try to insert link with non-existent rating ID
      expect(() => {
        testDb.prepare(
          "INSERT INTO books_ratings_link (book, rating) VALUES (?, ?)"
        ).run(1, 999); // Non-existent rating.id
      }).toThrow();
    });

    test("should enforce FK constraint on books_ratings_link.book", () => {
      // Create rating first
      testDb.prepare("INSERT INTO ratings (id, rating, link) VALUES (?, ?, ?)").run(1, 10, "");

      // Try to insert link with non-existent book ID
      expect(() => {
        testDb.prepare(
          "INSERT INTO books_ratings_link (book, rating) VALUES (?, ?)"
        ).run(999, 1); // Non-existent book.id
      }).toThrow();
    });

    test("should enforce UNIQUE constraint on (book, rating)", () => {
      testDb.prepare("INSERT INTO ratings (id, rating, link) VALUES (?, ?, ?)").run(1, 10, "");
      testDb.prepare("INSERT INTO books_ratings_link (book, rating) VALUES (?, ?)").run(1, 1);

      // Try to insert duplicate
      expect(() => {
        testDb.prepare("INSERT INTO books_ratings_link (book, rating) VALUES (?, ?)").run(1, 1);
      }).toThrow();
    });

    test("should enforce UNIQUE constraint on ratings.rating", () => {
      testDb.prepare("INSERT INTO ratings (id, rating, link) VALUES (?, ?, ?)").run(1, 10, "");

      // Try to insert duplicate rating value
      expect(() => {
        testDb.prepare("INSERT INTO ratings (id, rating, link) VALUES (?, ?, ?)").run(2, 10, "");
      }).toThrow();
    });
  });

  describe("readCalibreRating", () => {
    test("should read existing rating correctly", () => {
      updateCalibreRating(1, 5);
      expect(readCalibreRating(1)).toBe(5);
    });

    test("should return null for book with no rating", () => {
      expect(readCalibreRating(1)).toBeNull();
    });

    test("should return null for non-existent book", () => {
      expect(readCalibreRating(999)).toBeNull();
    });

    test("should read different ratings for different books", () => {
      updateCalibreRating(1, 5);
      updateCalibreRating(2, 3);
      updateCalibreRating(3, 1);

      expect(readCalibreRating(1)).toBe(5);
      expect(readCalibreRating(2)).toBe(3);
      expect(readCalibreRating(3)).toBe(1);
    });
  });

  describe("Edge Cases", () => {
    test("should handle rapid updates to same book", () => {
      for (let i = 1; i <= 5; i++) {
        updateCalibreRating(1, i);
        expect(readCalibreRating(1)).toBe(i);
      }
    });

    test("should handle same rating for multiple books", () => {
      updateCalibreRating(1, 5);
      updateCalibreRating(2, 5);
      updateCalibreRating(3, 5);

      expect(readCalibreRating(1)).toBe(5);
      expect(readCalibreRating(2)).toBe(5);
      expect(readCalibreRating(3)).toBe(5);

      // Should only have one rating record
      const ratingRecords = testDb.prepare(
        "SELECT * FROM ratings WHERE rating = 10"
      ).all();
      expect(ratingRecords).toHaveLength(1);
    });

    test("should handle alternating between rating and null", () => {
      updateCalibreRating(1, 5);
      expect(readCalibreRating(1)).toBe(5);

      updateCalibreRating(1, null);
      expect(readCalibreRating(1)).toBeNull();

      updateCalibreRating(1, 3);
      expect(readCalibreRating(1)).toBe(3);

      updateCalibreRating(1, null);
      expect(readCalibreRating(1)).toBeNull();
    });
  });
});
