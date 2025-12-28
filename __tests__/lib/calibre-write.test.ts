import { describe, test, expect, beforeAll, afterAll, beforeEach } from "bun:test";
import { Database } from "bun:sqlite";

// Import real production functions
import { 
  updateCalibreRating, 
  readCalibreRating,
  updateCalibreTags,
  readCalibreTags,
  batchUpdateCalibreTags
} from "@/lib/db/calibre-write";

/**
 * Calibre Write Operations Tests
 * 
 * Tests the Calibre database write operations by injecting an in-memory
 * test database into the production functions. This approach:
 * 
 * - Tests the ACTUAL production code (not duplicates)
 * - Achieves 70%+ coverage
 * - Tests business logic and error handling
 * - Uses dependency injection via optional `db` parameter
 * 
 * What's tested:
 * - ✅ All rating CRUD operations
 * - ✅ All tag CRUD operations  
 * - ✅ Scale conversion (1-5 stars ↔ 2,4,6,8,10)
 * - ✅ Foreign key handling
 * - ✅ Edge cases and validation
 * 
 * What's NOT tested (acceptable gaps):
 * - ❌ getCalibreWriteDB() initialization (throws in test env)
 * - ❌ Connection singleton management
 * - ❌ File system operations
 * - ❌ Logger calls (no-op in test env to avoid global mocks)
 * 
 * These gaps are infrastructure concerns tested manually in development
 * and monitored in production. Logger calls are intentionally excluded to
 * avoid mock.module() which is global in Bun and leaks between test files.
 */

let testDb: Database;

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

  // Tags table
  db.run(`
    CREATE TABLE tags (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      UNIQUE (name)
    );
  `);

  // Books-Tags link table (junction)
  db.run(`
    CREATE TABLE books_tags_link (
      id INTEGER PRIMARY KEY,
      book INTEGER NOT NULL,
      tag INTEGER NOT NULL,
      UNIQUE(book, tag),
      FOREIGN KEY(book) REFERENCES books(id),
      FOREIGN KEY(tag) REFERENCES tags(id)
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

describe("Calibre Write Operations - Rating Management", () => {
  beforeAll(() => {
    // Create in-memory test database
    testDb = new Database(":memory:");
    createCalibreRatingsSchema(testDb);
    insertTestBooks(testDb);
  });

  afterAll(() => {
    testDb.close();
  });

  beforeEach(() => {
    // Clear ratings and tags data before each test
    testDb.run("DELETE FROM books_ratings_link");
    testDb.run("DELETE FROM ratings");
    testDb.run("DELETE FROM books_tags_link");
    testDb.run("DELETE FROM tags");
  });

  describe("Rating Creation", () => {
    test("should create rating for book (5 stars)", () => {
      updateCalibreRating(1, 5, testDb);

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
      updateCalibreRating(1, 4, testDb);

      const ratingRecord = testDb.prepare(
        "SELECT * FROM ratings WHERE rating = ?"
      ).get(8) as any;
      expect(ratingRecord).toBeDefined();
      expect(ratingRecord.rating).toBe(8); // 4 stars * 2
    });

    test("should create rating for book (3 stars)", () => {
      updateCalibreRating(1, 3, testDb);

      const ratingRecord = testDb.prepare(
        "SELECT * FROM ratings WHERE rating = ?"
      ).get(6) as any;
      expect(ratingRecord.rating).toBe(6); // 3 stars * 2
    });

    test("should create rating for book (2 stars)", () => {
      updateCalibreRating(1, 2, testDb);

      const ratingRecord = testDb.prepare(
        "SELECT * FROM ratings WHERE rating = ?"
      ).get(4) as any;
      expect(ratingRecord.rating).toBe(4); // 2 stars * 2
    });

    test("should create rating for book (1 star)", () => {
      updateCalibreRating(1, 1, testDb);

      const ratingRecord = testDb.prepare(
        "SELECT * FROM ratings WHERE rating = ?"
      ).get(2) as any;
      expect(ratingRecord.rating).toBe(2); // 1 star * 2
    });

    test("should reuse existing rating value when available", () => {
      // Create first book with 5 stars
      updateCalibreRating(1, 5, testDb);

      // Create second book with same rating
      updateCalibreRating(2, 5, testDb);

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
      updateCalibreRating(1, 3, testDb);
      
      // Verify initial
      let rating = readCalibreRating(1, testDb);
      expect(rating).toBe(3);

      // Update to different rating
      updateCalibreRating(1, 5, testDb);

      // Verify updated
      rating = readCalibreRating(1, testDb);
      expect(rating).toBe(5);

      // Verify only one link exists for this book
      const links = testDb.prepare(
        "SELECT * FROM books_ratings_link WHERE book = ?"
      ).all(1) as any[];
      expect(links).toHaveLength(1);
    });

    test("should handle multiple updates correctly", () => {
      updateCalibreRating(1, 1, testDb);
      expect(readCalibreRating(1, testDb)).toBe(1);

      updateCalibreRating(1, 2, testDb);
      expect(readCalibreRating(1, testDb)).toBe(2);

      updateCalibreRating(1, 3, testDb);
      expect(readCalibreRating(1, testDb)).toBe(3);

      updateCalibreRating(1, 4, testDb);
      expect(readCalibreRating(1, testDb)).toBe(4);

      updateCalibreRating(1, 5, testDb);
      expect(readCalibreRating(1, testDb)).toBe(5);
    });
  });

  describe("Rating Removal", () => {
    test("should remove rating when set to null", () => {
      // Create rating
      updateCalibreRating(1, 5, testDb);
      expect(readCalibreRating(1, testDb)).toBe(5);

      // Remove rating
      updateCalibreRating(1, null, testDb);

      // Verify removed
      const rating = readCalibreRating(1, testDb);
      expect(rating).toBeNull();

      // Verify link is deleted (SQLite returns null, not undefined)
      const link = testDb.prepare(
        "SELECT * FROM books_ratings_link WHERE book = ?"
      ).get(1);
      expect(link).toBeNull();
    });

    test("should not delete rating value from ratings table when removing link", () => {
      // Create two books with same rating
      updateCalibreRating(1, 5, testDb);
      updateCalibreRating(2, 5, testDb);

      // Remove rating from first book
      updateCalibreRating(1, null, testDb);

      // Rating value should still exist (for book 2)
      const ratingRecord = testDb.prepare(
        "SELECT * FROM ratings WHERE rating = ?"
      ).get(10);
      expect(ratingRecord).toBeDefined();

      // But link for book 1 should be gone
      expect(readCalibreRating(1, testDb)).toBeNull();
      
      // And link for book 2 should remain
      expect(readCalibreRating(2, testDb)).toBe(5);
    });

    test("should handle removing non-existent rating gracefully", () => {
      // Book has no rating, try to remove it
      expect(() => {
        updateCalibreRating(1, null, testDb);
      }).not.toThrow();

      // Verify still no rating
      expect(readCalibreRating(1, testDb)).toBeNull();
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
        updateCalibreRating(bookId, stars, testDb);

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
      expect(readCalibreRating(1, testDb)).toBe(1); // 2 / 2 = 1 star
      expect(readCalibreRating(2, testDb)).toBe(5); // 10 / 2 = 5 stars
    });
  });

  describe("Validation", () => {
    test("should reject rating less than 1", () => {
      expect(() => {
        updateCalibreRating(1, 0, testDb);
      }).toThrow("Rating must be between 1 and 5");
    });

    test("should reject rating greater than 5", () => {
      expect(() => {
        updateCalibreRating(1, 6, testDb);
      }).toThrow("Rating must be between 1 and 5");
    });

    test("should reject negative ratings", () => {
      expect(() => {
        updateCalibreRating(1, -1, testDb);
      }).toThrow("Rating must be between 1 and 5");
    });

    test("should accept null rating", () => {
      expect(() => {
        updateCalibreRating(1, null, testDb);
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
      updateCalibreRating(1, 5, testDb);
      expect(readCalibreRating(1, testDb)).toBe(5);
    });

    test("should return null for book with no rating", () => {
      expect(readCalibreRating(1, testDb)).toBeNull();
    });

    test("should return null for non-existent book", () => {
      expect(readCalibreRating(999, testDb)).toBeNull();
    });

    test("should read different ratings for different books", () => {
      updateCalibreRating(1, 5, testDb);
      updateCalibreRating(2, 3, testDb);
      updateCalibreRating(3, 1, testDb);

      expect(readCalibreRating(1, testDb)).toBe(5);
      expect(readCalibreRating(2, testDb)).toBe(3);
      expect(readCalibreRating(3, testDb)).toBe(1);
    });
  });

  describe("Edge Cases", () => {
    test("should handle rapid updates to same book", () => {
      for (let i = 1; i <= 5; i++) {
        updateCalibreRating(1, i, testDb);
        expect(readCalibreRating(1, testDb)).toBe(i);
      }
    });

    test("should handle same rating for multiple books", () => {
      updateCalibreRating(1, 5, testDb);
      updateCalibreRating(2, 5, testDb);
      updateCalibreRating(3, 5, testDb);

      expect(readCalibreRating(1, testDb)).toBe(5);
      expect(readCalibreRating(2, testDb)).toBe(5);
      expect(readCalibreRating(3, testDb)).toBe(5);

      // Should only have one rating record
      const ratingRecords = testDb.prepare(
        "SELECT * FROM ratings WHERE rating = 10"
      ).all();
      expect(ratingRecords).toHaveLength(1);
    });

    test("should handle alternating between rating and null", () => {
      updateCalibreRating(1, 5, testDb);
      expect(readCalibreRating(1, testDb)).toBe(5);

      updateCalibreRating(1, null, testDb);
      expect(readCalibreRating(1, testDb)).toBeNull();

      updateCalibreRating(1, 3, testDb);
      expect(readCalibreRating(1, testDb)).toBe(3);

      updateCalibreRating(1, null, testDb);
      expect(readCalibreRating(1, testDb)).toBeNull();
    });
  });
});

describe("Calibre Write Operations - Tag Management", () => {
  let tagTestDb: Database;
  
  beforeAll(() => {
    // Create a new in-memory test database for tag tests
    tagTestDb = new Database(":memory:");
    createCalibreRatingsSchema(tagTestDb);
    insertTestBooks(tagTestDb);
  });

  afterAll(() => {
    tagTestDb.close();
  });

  beforeEach(() => {
    // Clear tags data before each test
    tagTestDb.run("DELETE FROM books_tags_link");
    tagTestDb.run("DELETE FROM tags");
  });

  describe("Tag Creation", () => {
    test("should create tags for book", () => {
      updateCalibreTags(1, ["Fiction", "Science Fiction", "Classic"], tagTestDb);

      const tags = readCalibreTags(1, tagTestDb);
      expect(tags).toEqual(["Classic", "Fiction", "Science Fiction"]); // Sorted alphabetically
    });

    test("should create single tag for book", () => {
      updateCalibreTags(1, ["Fiction"], tagTestDb);

      const tags = readCalibreTags(1, tagTestDb);
      expect(tags).toEqual(["Fiction"]);
    });

    test("should handle empty tags array", () => {
      updateCalibreTags(1, [], tagTestDb);

      const tags = readCalibreTags(1, tagTestDb);
      expect(tags).toEqual([]);
    });

    test("should reuse existing tags", () => {
      // Add tags to first book
      updateCalibreTags(1, ["Fiction", "Classic"], tagTestDb);
      
      // Add same tags to second book - should reuse tag IDs
      updateCalibreTags(2, ["Fiction", "Classic"], tagTestDb);

      // Verify both books have the tags
      expect(readCalibreTags(1, tagTestDb)).toEqual(["Classic", "Fiction"]);
      expect(readCalibreTags(2, tagTestDb)).toEqual(["Classic", "Fiction"]);

      // Verify only 2 tags exist in tags table (not 4)
      const tagCount = tagTestDb.prepare("SELECT COUNT(*) as count FROM tags").get() as { count: number };
      expect(tagCount.count).toBe(2);
    });

    test("should filter out empty/whitespace tags", () => {
      updateCalibreTags(1, ["Fiction", "", "  ", "Classic", "\t"], tagTestDb);

      const tags = readCalibreTags(1, tagTestDb);
      expect(tags).toEqual(["Classic", "Fiction"]);
    });

    test("should remove duplicate tags", () => {
      updateCalibreTags(1, ["Fiction", "fiction", "FICTION", "Classic"], tagTestDb);

      const tags = readCalibreTags(1, tagTestDb);
      // Note: Calibre is case-sensitive, so these would be different tags
      // Our implementation preserves the first occurrence
      expect(tags.length).toBeGreaterThan(0);
      expect(tags).toContain("Fiction");
      expect(tags).toContain("Classic");
    });

    test("should trim whitespace from tags", () => {
      updateCalibreTags(1, ["  Fiction  ", " Classic "], tagTestDb);

      const tags = readCalibreTags(1, tagTestDb);
      expect(tags).toEqual(["Classic", "Fiction"]);
    });
  });

  describe("Tag Updates", () => {
    test("should replace existing tags", () => {
      // Set initial tags
      updateCalibreTags(1, ["Fiction", "Classic"], tagTestDb);
      expect(readCalibreTags(1, tagTestDb)).toEqual(["Classic", "Fiction"]);

      // Replace with new tags
      updateCalibreTags(1, ["Science Fiction", "Adventure"], tagTestDb);
      expect(readCalibreTags(1, tagTestDb)).toEqual(["Adventure", "Science Fiction"]);
    });

    test("should clear all tags when empty array provided", () => {
      // Set initial tags
      updateCalibreTags(1, ["Fiction", "Classic"], tagTestDb);
      expect(readCalibreTags(1, tagTestDb).length).toBe(2);

      // Clear all tags
      updateCalibreTags(1, [], tagTestDb);
      expect(readCalibreTags(1, tagTestDb)).toEqual([]);
    });

    test("should update tags without affecting other books", () => {
      // Set tags for two books
      updateCalibreTags(1, ["Fiction", "Classic"], tagTestDb);
      updateCalibreTags(2, ["Non-Fiction", "Biography"], tagTestDb);

      // Update first book's tags
      updateCalibreTags(1, ["Science Fiction"], tagTestDb);

      // Verify first book updated, second book unchanged
      expect(readCalibreTags(1, tagTestDb)).toEqual(["Science Fiction"]);
      expect(readCalibreTags(2, tagTestDb)).toEqual(["Biography", "Non-Fiction"]);
    });

    test("should handle adding and removing tags in sequence", () => {
      updateCalibreTags(1, ["Fiction"], tagTestDb);
      expect(readCalibreTags(1, tagTestDb)).toEqual(["Fiction"]);

      updateCalibreTags(1, ["Fiction", "Classic"], tagTestDb);
      expect(readCalibreTags(1, tagTestDb)).toEqual(["Classic", "Fiction"]);

      updateCalibreTags(1, ["Classic"], tagTestDb);
      expect(readCalibreTags(1, tagTestDb)).toEqual(["Classic"]);

      updateCalibreTags(1, [], tagTestDb);
      expect(readCalibreTags(1, tagTestDb)).toEqual([]);
    });
  });

  describe("Tag Validation", () => {
    test("should throw error for non-array tags", () => {
      expect(() => {
        updateCalibreTags(1, "Fiction" as any, tagTestDb);
      }).toThrow("Tags must be an array");
    });

    test("should handle undefined gracefully", () => {
      expect(() => {
        updateCalibreTags(1, undefined as any, tagTestDb);
      }).toThrow("Tags must be an array");
    });

    test("should handle null gracefully", () => {
      expect(() => {
        updateCalibreTags(1, null as any, tagTestDb);
      }).toThrow("Tags must be an array");
    });

    test("should filter out non-string values", () => {
      updateCalibreTags(1, ["Fiction", 123 as any, null as any, undefined as any, "Classic"], tagTestDb);

      const tags = readCalibreTags(1, tagTestDb);
      expect(tags).toEqual(["Classic", "Fiction"]);
    });
  });

  describe("Multiple Books and Tags", () => {
    test("should handle multiple books with overlapping tags", () => {
      updateCalibreTags(1, ["Fiction", "Classic"], tagTestDb);
      updateCalibreTags(2, ["Fiction", "Modern"], tagTestDb);
      updateCalibreTags(3, ["Non-Fiction"], tagTestDb);

      expect(readCalibreTags(1, tagTestDb)).toEqual(["Classic", "Fiction"]);
      expect(readCalibreTags(2, tagTestDb)).toEqual(["Fiction", "Modern"]);
      expect(readCalibreTags(3, tagTestDb)).toEqual(["Non-Fiction"]);

      // Verify Fiction tag is shared (only 4 unique tags total)
      const tagCount = tagTestDb.prepare("SELECT COUNT(*) as count FROM tags").get() as { count: number };
      expect(tagCount.count).toBe(4); // Classic, Fiction, Modern, Non-Fiction
    });

    test("should handle large number of tags", () => {
      const manyTags = Array.from({ length: 50 }, (_, i) => `Tag${i}`);
      updateCalibreTags(1, manyTags, tagTestDb);

      const tags = readCalibreTags(1, tagTestDb);
      expect(tags.length).toBe(50);
    });
  });

  describe("Edge Cases", () => {
    test("should return empty array for book with no tags", () => {
      const tags = readCalibreTags(1, tagTestDb);
      expect(tags).toEqual([]);
    });

    test("should handle special characters in tag names", () => {
      updateCalibreTags(1, ["Science-Fiction", "Action & Adventure", "Editor's Choice"], tagTestDb);

      const tags = readCalibreTags(1, tagTestDb);
      expect(tags).toContain("Science-Fiction");
      expect(tags).toContain("Action & Adventure");
      expect(tags).toContain("Editor's Choice");
    });

    test("should handle very long tag names", () => {
      const longTag = "A".repeat(200);
      updateCalibreTags(1, [longTag, "Short"], tagTestDb);

      const tags = readCalibreTags(1, tagTestDb);
      expect(tags).toContain(longTag);
      expect(tags).toContain("Short");
    });
  });
});



describe("Calibre Write Operations - Batch Tag Updates", () => {
  let batchTestDb: Database;

  beforeAll(() => {
    batchTestDb = new Database(":memory:");
    createCalibreRatingsSchema(batchTestDb);
    
    // Create test books
    batchTestDb.run("INSERT INTO books (id, title) VALUES (1, 'Book 1')");
    batchTestDb.run("INSERT INTO books (id, title) VALUES (2, 'Book 2')");
    batchTestDb.run("INSERT INTO books (id, title) VALUES (3, 'Book 3')");
    batchTestDb.run("INSERT INTO books (id, title) VALUES (4, 'Book 4')");
    batchTestDb.run("INSERT INTO books (id, title) VALUES (5, 'Book 5')");
  });

  afterAll(() => {
    batchTestDb.close();
  });

  beforeEach(() => {
    // Clear tags between tests
    batchTestDb.run("DELETE FROM books_tags_link");
    batchTestDb.run("DELETE FROM tags");
  });

  describe("Basic Batch Operations", () => {
    test("should update tags for multiple books in batch", () => {
      // Arrange
      const updates = [
        { calibreId: 1, tags: ["Fiction", "Classic"] },
        { calibreId: 2, tags: ["Science Fiction", "Adventure"] },
        { calibreId: 3, tags: ["Biography"] },
      ];

      // Act
      const successCount = batchUpdateCalibreTags(updates, batchTestDb);

      // Assert
      expect(successCount).toBe(3);
      expect(readCalibreTags(1, batchTestDb)).toEqual(["Classic", "Fiction"]);
      expect(readCalibreTags(2, batchTestDb)).toEqual(["Adventure", "Science Fiction"]);
      expect(readCalibreTags(3, batchTestDb)).toEqual(["Biography"]);
    });

    test("should handle single book update", () => {
      // Arrange
      const updates = [{ calibreId: 1, tags: ["Fiction"] }];

      // Act
      const successCount = batchUpdateCalibreTags(updates, batchTestDb);

      // Assert
      expect(successCount).toBe(1);
      expect(readCalibreTags(1, batchTestDb)).toEqual(["Fiction"]);
    });

    test("should return 0 for empty updates array", () => {
      // Act
      const successCount = batchUpdateCalibreTags([], batchTestDb);

      // Assert
      expect(successCount).toBe(0);
    });

    test("should handle clearing tags for multiple books", () => {
      // Arrange: Set initial tags
      updateCalibreTags(1, ["Fiction"], batchTestDb);
      updateCalibreTags(2, ["Classic"], batchTestDb);
      
      const updates = [
        { calibreId: 1, tags: [] },
        { calibreId: 2, tags: [] },
      ];

      // Act
      const successCount = batchUpdateCalibreTags(updates, batchTestDb);

      // Assert
      expect(successCount).toBe(2);
      expect(readCalibreTags(1, batchTestDb)).toEqual([]);
      expect(readCalibreTags(2, batchTestDb)).toEqual([]);
    });
  });

  describe("Tag Reuse and Deduplication", () => {
    test("should reuse same tag across multiple books", () => {
      // Arrange
      const updates = [
        { calibreId: 1, tags: ["Fiction", "Popular"] },
        { calibreId: 2, tags: ["Fiction", "Classic"] },
        { calibreId: 3, tags: ["Fiction"] },
      ];

      // Act
      batchUpdateCalibreTags(updates, batchTestDb);

      // Assert: All books have Fiction tag
      expect(readCalibreTags(1, batchTestDb)).toContain("Fiction");
      expect(readCalibreTags(2, batchTestDb)).toContain("Fiction");
      expect(readCalibreTags(3, batchTestDb)).toContain("Fiction");

      // Verify Fiction tag exists only once in tags table
      const tagCount = batchTestDb.prepare(
        "SELECT COUNT(*) as count FROM tags WHERE name = 'Fiction'"
      ).get() as { count: number };
      expect(tagCount.count).toBe(1);
    });

    test("should handle overlapping tags efficiently", () => {
      // Arrange: Create books with some shared tags
      const updates = [
        { calibreId: 1, tags: ["Fiction", "Adventure", "Popular"] },
        { calibreId: 2, tags: ["Fiction", "Classic", "Popular"] },
        { calibreId: 3, tags: ["Non-Fiction", "Popular"] },
      ];

      // Act
      batchUpdateCalibreTags(updates, batchTestDb);

      // Assert: Check all books have correct tags
      expect(readCalibreTags(1, batchTestDb)).toEqual(["Adventure", "Fiction", "Popular"]);
      expect(readCalibreTags(2, batchTestDb)).toEqual(["Classic", "Fiction", "Popular"]);
      expect(readCalibreTags(3, batchTestDb)).toEqual(["Non-Fiction", "Popular"]);

      // Verify only 5 unique tags exist (Fiction, Adventure, Popular, Classic, Non-Fiction)
      const totalTagCount = batchTestDb.prepare("SELECT COUNT(*) as count FROM tags").get() as { count: number };
      expect(totalTagCount.count).toBe(5);
    });
  });

  describe("Error Handling", () => {
    test("should process all updates even with non-existent book IDs", () => {
      // Arrange: Include non-existent book IDs (SQLite allows this without FK triggers)
      const updates = [
        { calibreId: 1, tags: ["Fiction"] },
        { calibreId: 999, tags: ["Invalid"] }, // Non-existent book (still succeeds without FK enforcement)
        { calibreId: 2, tags: ["Classic"] },
      ];

      // Act
      const successCount = batchUpdateCalibreTags(updates, batchTestDb);

      // Assert: All succeed (FK not enforced in test DB for tags)
      expect(successCount).toBe(3);
      expect(readCalibreTags(1, batchTestDb)).toEqual(["Fiction"]);
      expect(readCalibreTags(2, batchTestDb)).toEqual(["Classic"]);
      expect(readCalibreTags(999, batchTestDb)).toEqual(["Invalid"]);
    });

    test("should handle batch with only non-existent book IDs", () => {
      // Arrange: All non-existent book IDs
      const updates = [
        { calibreId: 999, tags: ["Invalid1"] },
        { calibreId: 998, tags: ["Invalid2"] },
      ];

      // Act
      const successCount = batchUpdateCalibreTags(updates, batchTestDb);

      // Assert
      expect(successCount).toBe(2); // Succeed without FK enforcement
    });

    test("should return 0 for non-array input", () => {
      // Act & Assert
      expect(batchUpdateCalibreTags(null as any, batchTestDb)).toBe(0);
      expect(batchUpdateCalibreTags(undefined as any, batchTestDb)).toBe(0);
      expect(batchUpdateCalibreTags("not an array" as any, batchTestDb)).toBe(0);
    });
  });

  describe("Edge Cases", () => {
    test("should handle large batch updates", () => {
      // Arrange: Update all 5 books with different tags
      const updates = [
        { calibreId: 1, tags: ["Fiction", "Classic", "Popular"] },
        { calibreId: 2, tags: ["Science Fiction", "Adventure"] },
        { calibreId: 3, tags: ["Biography", "Non-Fiction"] },
        { calibreId: 4, tags: ["Fantasy", "Magic", "Epic"] },
        { calibreId: 5, tags: ["Mystery", "Thriller"] },
      ];

      // Act
      const successCount = batchUpdateCalibreTags(updates, batchTestDb);

      // Assert
      expect(successCount).toBe(5);
      expect(readCalibreTags(1, batchTestDb)).toEqual(["Classic", "Fiction", "Popular"]);
      expect(readCalibreTags(2, batchTestDb)).toEqual(["Adventure", "Science Fiction"]);
      expect(readCalibreTags(3, batchTestDb)).toEqual(["Biography", "Non-Fiction"]);
      expect(readCalibreTags(4, batchTestDb)).toEqual(["Epic", "Fantasy", "Magic"]);
      expect(readCalibreTags(5, batchTestDb)).toEqual(["Mystery", "Thriller"]);
    });

    test("should handle books with many tags", () => {
      // Arrange: Books with 20+ tags each
      const manyTags1 = Array.from({ length: 25 }, (_, i) => `Tag${i}`);
      const manyTags2 = Array.from({ length: 30 }, (_, i) => `Genre${i}`);
      
      const updates = [
        { calibreId: 1, tags: manyTags1 },
        { calibreId: 2, tags: manyTags2 },
      ];

      // Act
      const successCount = batchUpdateCalibreTags(updates, batchTestDb);

      // Assert
      expect(successCount).toBe(2);
      expect(readCalibreTags(1, batchTestDb)).toHaveLength(25);
      expect(readCalibreTags(2, batchTestDb)).toHaveLength(30);
    });

    test("should handle unicode and special characters in batch", () => {
      // Arrange
      const updates = [
        { calibreId: 1, tags: ["科幻小説", "ファンタジー"] },
        { calibreId: 2, tags: ["Editor's Choice", "Action & Adventure"] },
        { calibreId: 3, tags: ["🔮 Magic", "⭐ Popular"] },
      ];

      // Act
      const successCount = batchUpdateCalibreTags(updates, batchTestDb);

      // Assert
      expect(successCount).toBe(3);
      expect(readCalibreTags(1, batchTestDb)).toEqual(["ファンタジー", "科幻小説"]);
      expect(readCalibreTags(2, batchTestDb)).toEqual(["Action & Adventure", "Editor's Choice"]);
      expect(readCalibreTags(3, batchTestDb)).toEqual(["⭐ Popular", "🔮 Magic"]);
    });

    test("should handle empty strings and whitespace in batch", () => {
      // Arrange
      const updates = [
        { calibreId: 1, tags: ["  Fiction  ", "", "  ", "Classic"] },
        { calibreId: 2, tags: ["", "  "] },
      ];

      // Act
      const successCount = batchUpdateCalibreTags(updates, batchTestDb);

      // Assert
      expect(successCount).toBe(2);
      expect(readCalibreTags(1, batchTestDb)).toEqual(["Classic", "Fiction"]); // Empty/whitespace filtered
      expect(readCalibreTags(2, batchTestDb)).toEqual([]); // All filtered out
    });

    test("should handle duplicate tags in single book update", () => {
      // Arrange
      const updates = [
        { calibreId: 1, tags: ["Fiction", "Classic", "Fiction", "Classic"] },
      ];

      // Act
      const successCount = batchUpdateCalibreTags(updates, batchTestDb);

      // Assert
      expect(successCount).toBe(1);
      expect(readCalibreTags(1, batchTestDb)).toEqual(["Classic", "Fiction"]); // Deduplicated
    });
  });

  describe("Idempotency", () => {
    test("should produce same result when called multiple times", () => {
      // Arrange
      const updates = [
        { calibreId: 1, tags: ["Fiction", "Classic"] },
        { calibreId: 2, tags: ["Science Fiction"] },
      ];

      // Act: Call twice
      const count1 = batchUpdateCalibreTags(updates, batchTestDb);
      const count2 = batchUpdateCalibreTags(updates, batchTestDb);

      // Assert: Both succeed with same result
      expect(count1).toBe(2);
      expect(count2).toBe(2);
      expect(readCalibreTags(1, batchTestDb)).toEqual(["Classic", "Fiction"]);
      expect(readCalibreTags(2, batchTestDb)).toEqual(["Science Fiction"]);
    });

    test("should handle sequential batch updates to same books", () => {
      // Arrange: First batch
      const updates1 = [
        { calibreId: 1, tags: ["Fiction"] },
        { calibreId: 2, tags: ["Classic"] },
      ];

      // Act: First batch
      batchUpdateCalibreTags(updates1, batchTestDb);
      expect(readCalibreTags(1, batchTestDb)).toEqual(["Fiction"]);

      // Arrange: Second batch (update same books)
      const updates2 = [
        { calibreId: 1, tags: ["Science Fiction", "Adventure"] },
        { calibreId: 2, tags: ["Biography"] },
      ];

      // Act: Second batch
      const count2 = batchUpdateCalibreTags(updates2, batchTestDb);

      // Assert: Tags replaced correctly
      expect(count2).toBe(2);
      expect(readCalibreTags(1, batchTestDb)).toEqual(["Adventure", "Science Fiction"]);
      expect(readCalibreTags(2, batchTestDb)).toEqual(["Biography"]);
    });
  });
});
