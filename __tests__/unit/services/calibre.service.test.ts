import { describe, test, expect, beforeEach, vi, beforeAll, afterAll } from 'vitest';
import Database from 'better-sqlite3';

/**
 * CalibreService Tests
 *
 * Tests the CalibreService wrapper and the underlying calibre-write functions.
 * Uses an in-memory SQLite database to simulate the Calibre database schema.
 *
 * Note: The CalibreService is a thin wrapper around calibre-write functions.
 * These tests focus on the database operations that would be covered by
 * testing the calibre-write module with an injected test database.
 */

// Create a test database that mimics Calibre's schema
let testDb: Database.Database;

function setupTestCalibreDb(): Database.Database {
  const db = new Database(':memory:');

  // Create Calibre schema for ratings
  db.exec(`
    CREATE TABLE ratings (
      id INTEGER PRIMARY KEY,
      rating INTEGER NOT NULL CHECK(rating > -1 AND rating < 11) UNIQUE,
      link TEXT NOT NULL DEFAULT ''
    );

    CREATE TABLE books_ratings_link (
      id INTEGER PRIMARY KEY,
      book INTEGER NOT NULL,
      rating INTEGER NOT NULL,
      UNIQUE(book, rating)
    );

    CREATE TABLE books (
      id INTEGER PRIMARY KEY,
      title TEXT NOT NULL
    );

    CREATE TABLE tags (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL COLLATE NOCASE UNIQUE
    );

    CREATE TABLE books_tags_link (
      id INTEGER PRIMARY KEY,
      book INTEGER NOT NULL,
      tag INTEGER NOT NULL,
      UNIQUE(book, tag)
    );
  `);

  // Insert some test books
  db.exec(`
    INSERT INTO books (id, title) VALUES (1, 'Test Book 1');
    INSERT INTO books (id, title) VALUES (2, 'Test Book 2');
    INSERT INTO books (id, title) VALUES (3, 'Test Book 3');
  `);

  return db;
}

// Import the functions we want to test (with injected db)
import {
  updateCalibreRating,
  readCalibreRating,
  updateCalibreTags,
  readCalibreTags,
  batchUpdateCalibreTags,
} from '@/lib/db/calibre-write';

describe('CalibreService / calibre-write', () => {
  beforeEach(() => {
    // Create fresh database for each test
    testDb = setupTestCalibreDb();
  });

  afterAll(() => {
    if (testDb) {
      testDb.close();
    }
  });

  // ============================================================================
  // updateRating
  // ============================================================================

  describe('updateRating()', () => {
    test('should set rating 1 star (converts to 2)', () => {
      updateCalibreRating(1, 1, testDb);
      const rating = readCalibreRating(1, testDb);
      expect(rating).toBe(1);
    });

    test('should set rating 2 stars (converts to 4)', () => {
      updateCalibreRating(1, 2, testDb);
      const rating = readCalibreRating(1, testDb);
      expect(rating).toBe(2);
    });

    test('should set rating 3 stars (converts to 6)', () => {
      updateCalibreRating(1, 3, testDb);
      const rating = readCalibreRating(1, testDb);
      expect(rating).toBe(3);
    });

    test('should set rating 4 stars (converts to 8)', () => {
      updateCalibreRating(1, 4, testDb);
      const rating = readCalibreRating(1, testDb);
      expect(rating).toBe(4);
    });

    test('should set rating 5 stars (converts to 10)', () => {
      updateCalibreRating(1, 5, testDb);
      const rating = readCalibreRating(1, testDb);
      expect(rating).toBe(5);
    });

    test('should clear rating when set to null', () => {
      // First set a rating
      updateCalibreRating(1, 5, testDb);
      expect(readCalibreRating(1, testDb)).toBe(5);

      // Then clear it
      updateCalibreRating(1, null, testDb);
      expect(readCalibreRating(1, testDb)).toBeNull();
    });

    test('should update existing rating', () => {
      updateCalibreRating(1, 3, testDb);
      expect(readCalibreRating(1, testDb)).toBe(3);

      updateCalibreRating(1, 5, testDb);
      expect(readCalibreRating(1, testDb)).toBe(5);
    });

    test('should throw error for rating less than 1', () => {
      expect(() => updateCalibreRating(1, 0, testDb)).toThrow('Rating must be between 1 and 5');
    });

    test('should throw error for rating greater than 5', () => {
      expect(() => updateCalibreRating(1, 6, testDb)).toThrow('Rating must be between 1 and 5');
    });

    test('should throw error for negative rating', () => {
      expect(() => updateCalibreRating(1, -1, testDb)).toThrow('Rating must be between 1 and 5');
    });

    test('should reuse existing rating lookup entry', () => {
      // Rate two books with same rating
      updateCalibreRating(1, 5, testDb);
      updateCalibreRating(2, 5, testDb);

      // Should only have one rating=10 entry in ratings table
      const ratingsCount = testDb.prepare('SELECT COUNT(*) as count FROM ratings WHERE rating = 10').get() as { count: number };
      expect(ratingsCount.count).toBe(1);
    });
  });

  // ============================================================================
  // readRating
  // ============================================================================

  describe('readRating()', () => {
    test('should return null for book with no rating', () => {
      const rating = readCalibreRating(1, testDb);
      expect(rating).toBeNull();
    });

    test('should return correct rating (1-5 scale)', () => {
      // Insert rating directly (calibre stores as 2,4,6,8,10)
      testDb.exec(`
        INSERT INTO ratings (rating) VALUES (8);
        INSERT INTO books_ratings_link (book, rating) VALUES (1, 1);
      `);

      const rating = readCalibreRating(1, testDb);
      expect(rating).toBe(4); // 8/2 = 4 stars
    });

    test('should return null for non-existent book', () => {
      const rating = readCalibreRating(999, testDb);
      expect(rating).toBeNull();
    });
  });

  // ============================================================================
  // updateTags
  // ============================================================================

  describe('updateTags()', () => {
    test('should add tags to book', () => {
      updateCalibreTags(1, ['Fiction', 'Fantasy'], testDb);
      const tags = readCalibreTags(1, testDb);
      expect(tags).toHaveLength(2);
      expect(tags).toContain('Fiction');
      expect(tags).toContain('Fantasy');
    });

    test('should replace existing tags', () => {
      updateCalibreTags(1, ['Fiction', 'Fantasy'], testDb);
      updateCalibreTags(1, ['Sci-Fi', 'Adventure'], testDb);

      const tags = readCalibreTags(1, testDb);
      expect(tags).toHaveLength(2);
      expect(tags).toContain('Sci-Fi');
      expect(tags).toContain('Adventure');
      expect(tags).not.toContain('Fiction');
      expect(tags).not.toContain('Fantasy');
    });

    test('should clear all tags with empty array', () => {
      updateCalibreTags(1, ['Fiction'], testDb);
      expect(readCalibreTags(1, testDb)).toHaveLength(1);

      updateCalibreTags(1, [], testDb);
      expect(readCalibreTags(1, testDb)).toHaveLength(0);
    });

    test('should handle duplicate tags (case-insensitive)', () => {
      updateCalibreTags(1, ['Fiction', 'FICTION', 'fiction'], testDb);
      const tags = readCalibreTags(1, testDb);
      expect(tags).toHaveLength(1);
    });

    test('should filter out empty strings', () => {
      updateCalibreTags(1, ['Fiction', '', '   ', 'Fantasy'], testDb);
      const tags = readCalibreTags(1, testDb);
      expect(tags).toHaveLength(2);
      expect(tags).toContain('Fiction');
      expect(tags).toContain('Fantasy');
    });

    test('should reuse existing tags', () => {
      updateCalibreTags(1, ['Fiction'], testDb);
      updateCalibreTags(2, ['Fiction'], testDb);

      // Should only have one 'Fiction' entry in tags table
      const tagsCount = testDb.prepare("SELECT COUNT(*) as count FROM tags WHERE name = 'Fiction'").get() as { count: number };
      expect(tagsCount.count).toBe(1);
    });

    test('should throw error when tags is not an array', () => {
      expect(() => updateCalibreTags(1, 'not-an-array' as any, testDb)).toThrow('Tags must be an array');
    });
  });

  // ============================================================================
  // readTags
  // ============================================================================

  describe('readTags()', () => {
    test('should return empty array for book with no tags', () => {
      const tags = readCalibreTags(1, testDb);
      expect(tags).toEqual([]);
    });

    test('should return tags in alphabetical order', () => {
      // Insert tags in non-alphabetical order
      testDb.exec(`
        INSERT INTO tags (name) VALUES ('Zebra');
        INSERT INTO tags (name) VALUES ('Apple');
        INSERT INTO tags (name) VALUES ('Mango');
        INSERT INTO books_tags_link (book, tag) VALUES (1, 1);
        INSERT INTO books_tags_link (book, tag) VALUES (1, 2);
        INSERT INTO books_tags_link (book, tag) VALUES (1, 3);
      `);

      const tags = readCalibreTags(1, testDb);
      expect(tags).toEqual(['Apple', 'Mango', 'Zebra']);
    });

    test('should return empty array for non-existent book', () => {
      const tags = readCalibreTags(999, testDb);
      expect(tags).toEqual([]);
    });
  });

  // ============================================================================
  // batchUpdateTags
  // ============================================================================

  describe('batchUpdateTags()', () => {
    test('should update tags for multiple books', () => {
      const result = batchUpdateCalibreTags([
        { calibreId: 1, tags: ['Fiction', 'Fantasy'] },
        { calibreId: 2, tags: ['Sci-Fi'] },
        { calibreId: 3, tags: ['Mystery', 'Thriller'] },
      ], testDb);

      expect(result.totalAttempted).toBe(3);
      expect(result.successCount).toBe(3);
      expect(result.failures).toHaveLength(0);

      expect(readCalibreTags(1, testDb)).toContain('Fiction');
      expect(readCalibreTags(2, testDb)).toContain('Sci-Fi');
      expect(readCalibreTags(3, testDb)).toContain('Mystery');
    });

    test('should handle empty updates array', () => {
      const result = batchUpdateCalibreTags([], testDb);

      expect(result.totalAttempted).toBe(0);
      expect(result.successCount).toBe(0);
      expect(result.failures).toHaveLength(0);
    });

    test('should track partial failures', () => {
      // Create a scenario where one update fails
      // We'll inject an invalid tags type for one book
      const updates = [
        { calibreId: 1, tags: ['Fiction'] },
        { calibreId: 2, tags: 'not-an-array' as any }, // This should fail
        { calibreId: 3, tags: ['Mystery'] },
      ];

      const result = batchUpdateCalibreTags(updates, testDb);

      expect(result.totalAttempted).toBe(3);
      expect(result.successCount).toBe(2);
      expect(result.failures).toHaveLength(1);
      expect(result.failures[0].calibreId).toBe(2);
      expect(result.failures[0].error).toContain('array');
    });

    test('should continue after individual failures', () => {
      const updates = [
        { calibreId: 1, tags: ['Fiction'] },
        { calibreId: 2, tags: 'invalid' as any }, // Fails
        { calibreId: 3, tags: ['Mystery'] }, // Should still succeed
      ];

      const result = batchUpdateCalibreTags(updates, testDb);

      // Book 3 should still have its tags
      expect(readCalibreTags(3, testDb)).toContain('Mystery');
      expect(result.successCount).toBe(2);
    });
  });

  // ============================================================================
  // Error scenarios
  // ============================================================================

  describe('Error handling', () => {
    test('updateRating should handle database errors gracefully', () => {
      // Close the database to simulate an error
      const closedDb = new Database(':memory:');
      closedDb.close();

      expect(() => updateCalibreRating(1, 5, closedDb)).toThrow();
    });

    test('readRating should return null on database error', () => {
      const closedDb = new Database(':memory:');
      closedDb.close();

      // readCalibreRating catches errors and returns null
      const result = readCalibreRating(1, closedDb);
      expect(result).toBeNull();
    });

    test('readTags should return empty array on database error', () => {
      const closedDb = new Database(':memory:');
      closedDb.close();

      // readCalibreTags catches errors and returns []
      const result = readCalibreTags(1, closedDb);
      expect(result).toEqual([]);
    });
  });
});
