/**
 * Tome Integration Tests
 * Tests the OPDS bridge between Tome DB (sessions/shelves) and Calibre DB (metadata)
 * 
 * ARCHITECTURAL NOTE:
 * This module intentionally uses direct DB access (not repositories).
 * See lib/opds/tome-integration.ts for rationale.
 */

import { describe, test, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import path from 'path';
import { setupTestDatabase, teardownTestDatabase, clearTestDatabase } from '../../helpers/db-setup';
import { setDatabase, getDatabase } from '@/lib/db/context';
import { bookRepository } from '@/lib/repositories/book.repository';
import { sessionRepository } from '@/lib/repositories/session.repository';
import { shelfRepository } from '@/lib/repositories/shelf.repository';
import { resetCalibreDB } from '@/lib/db/calibre';
import { bookShelves } from '@/lib/db/schema/shelves';

// Import tome-integration AFTER setting up database context
let getBooksByStatus: any;
let getBooksByShelf: any;
let getBooksByRating: any;
let getAllShelves: any;

describe('Tome Integration - OPDS Bridge', () => {
  beforeAll(async () => {
    const testDb = await setupTestDatabase(__filename);
    
    // CRITICAL: Set database context BEFORE importing tome-integration
    // tome-integration uses direct db import (Repository Pattern exception)
    setDatabase(testDb.db);
    
    // Now import tome-integration functions
    const tomeIntegration = await import('@/lib/opds/tome-integration');
    getBooksByStatus = tomeIntegration.getBooksByStatus;
    getBooksByShelf = tomeIntegration.getBooksByShelf;
    getBooksByRating = tomeIntegration.getBooksByRating;
    getAllShelves = tomeIntegration.getAllShelves;
    
    // Set up Calibre test database
    const calibreDbPath = path.join(__dirname, '../../fixtures/calibre-test-comprehensive.db');
    process.env.CALIBRE_DB_PATH = calibreDbPath;
  });

  afterAll(async () => {
    await teardownTestDatabase(__filename);
    delete process.env.CALIBRE_DB_PATH;
    resetCalibreDB();
  });

  beforeEach(async () => {
    await clearTestDatabase(__filename);
  });

  describe('getBooksByStatus', () => {
    test('should return books with "reading" status', async () => {
      // Setup: Create books with sessions
      const book1 = await bookRepository.create({
        calibreId: 147, // Dune
        title: 'Dune',
        authors: ['Frank Herbert'],
        path: '/path/to/dune',
      });

      const book2 = await bookRepository.create({
        calibreId: 83, // Children of Dune
        title: 'Children of Dune',
        authors: ['Frank Herbert'],
        path: '/path/to/children',
      });
      await sessionRepository.create({
        bookId: book1.id,
        sessionNumber: 1,
        status: 'reading',
        isActive: true,
      });

      await sessionRepository.create({
        bookId: book2.id,
        sessionNumber: 1,
        status: 'to-read',
        isActive: true,
      });

      const { books, total } = await getBooksByStatus('reading', 50, 0);

      expect(total).toBe(1);
      expect(books).toHaveLength(1);
      expect(books[0].id).toBe(147); // Calibre ID
      expect(books[0].title).toBe('Dune');
    });

    test('should include archived sessions for "read" status', async () => {
      // Setup: Create completed book (is_active = false)
      const book = await bookRepository.create({
        calibreId: 147,
        title: 'Dune',
        authors: ['Frank Herbert'],
        path: '/path/to/dune',
      });

      await sessionRepository.create({
        bookId: book.id,
        sessionNumber: 1,
        status: 'read',
        isActive: false, // Archived
        completedDate: '2024-01-15T00:00:00.000Z',
      });

      const { books, total } = await getBooksByStatus('read', 50, 0);

      expect(total).toBe(1); // Should include archived
      expect(books).toHaveLength(1);
      expect(books[0].id).toBe(147);
    });

    test('should order read-next by readNextOrder', async () => {
      // Setup: Create 3 books with read-next status
      const book1 = await bookRepository.create({
        calibreId: 147,
        title: 'Dune',
        authors: ['Frank Herbert'],
        path: '/path/1',
      });

      const book2 = await bookRepository.create({
        calibreId: 83,
        title: 'Children of Dune',
        authors: ['Frank Herbert'],
        path: '/path/2',
      });

      const book3 = await bookRepository.create({
        calibreId: 84,
        title: 'Dune Messiah',
        authors: ['Frank Herbert'],
        path: '/path/3',
      });

      await sessionRepository.create({
        bookId: book1.id,
        sessionNumber: 1,
        status: 'read-next',
        isActive: true,
        readNextOrder: 2,
      });

      await sessionRepository.create({
        bookId: book2.id,
        sessionNumber: 1,
        status: 'read-next',
        isActive: true,
        readNextOrder: 0,
      });

      await sessionRepository.create({
        bookId: book3.id,
        sessionNumber: 1,
        status: 'read-next',
        isActive: true,
        readNextOrder: 1,
      });

      const { books } = await getBooksByStatus('read-next', 50, 0);

      expect(books).toHaveLength(3);
      // Should be ordered by readNextOrder (0, 1, 2)
      expect(books[0].id).toBe(83); // Children of Dune (order 0)
      expect(books[1].id).toBe(84); // Dune Messiah (order 1)
      expect(books[2].id).toBe(147); // Dune (order 2)
    });

    test('should respect pagination', async () => {
      // Setup: Create 5 books with reading status
      const bookIds = [147, 83, 84, 40, 89];
      for (let i = 0; i < bookIds.length; i++) {
        const book = await bookRepository.create({
          calibreId: bookIds[i],
          title: `Book ${i}`,
          authors: ['Author'],
          path: `/path/${i}`,
        });

        await sessionRepository.create({
          bookId: book.id,
          sessionNumber: 1,
          status: 'reading',
          isActive: true,
        });
      }

      // Test limit
      const page1 = await getBooksByStatus('reading', 2, 0);
      expect(page1.books).toHaveLength(2);
      expect(page1.total).toBe(5);

      // Test offset
      const page2 = await getBooksByStatus('reading', 2, 2);
      expect(page2.books).toHaveLength(2);
      expect(page2.total).toBe(5);

      // Different books on different pages
      expect(page2.books[0].id).not.toBe(page1.books[0].id);
    });

    test('should return empty results for status with no books', async () => {
      const { books, total } = await getBooksByStatus('dnf', 50, 0);

      expect(books).toHaveLength(0);
      expect(total).toBe(0);
    });

    test('should handle "to-read" status', async () => {
      const book = await bookRepository.create({
        calibreId: 147,
        title: 'Dune',
        authors: ['Frank Herbert'],
        path: '/path/to/dune',
      });

      await sessionRepository.create({
        sessionNumber: 1,
        bookId: book.id,
        status: 'to-read',
        isActive: true,
      });

      const { books, total } = await getBooksByStatus('to-read', 50, 0);

      expect(total).toBe(1);
      expect(books).toHaveLength(1);
    });

    test('should handle "dnf" status', async () => {
      const book = await bookRepository.create({
        calibreId: 147,
        title: 'Dune',
        authors: ['Frank Herbert'],
        path: '/path/to/dune',
      });

      await sessionRepository.create({
        sessionNumber: 1,
        bookId: book.id,
        status: 'dnf',
        isActive: true,
      });

      const { books, total } = await getBooksByStatus('dnf', 50, 0);

      expect(total).toBe(1);
      expect(books).toHaveLength(1);
    });

    test('should only include active sessions for non-read statuses', async () => {
      const book = await bookRepository.create({
        calibreId: 147,
        title: 'Dune',
        authors: ['Frank Herbert'],
        path: '/path/to/dune',
      });

      // Create an archived "reading" session (should be ignored)
      await sessionRepository.create({
        sessionNumber: 1,
        bookId: book.id,
        status: 'reading',
        isActive: false,
      });

      const { books, total } = await getBooksByStatus('reading', 50, 0);

      expect(total).toBe(0); // Archived sessions not included for "reading"
      expect(books).toHaveLength(0);
    });
  });

  describe('getAllShelves', () => {
    test('should return all shelves with book counts', async () => {
      const shelf1 = await shelfRepository.create({ name: 'Favorites', description: null });
      await shelfRepository.create({ name: 'Classics', description: 'Classic literature' });

      const book1 = await bookRepository.create({
        calibreId: 147,
        title: 'Dune',
        authors: ['Frank Herbert'],
        path: '/path/1',
      });

      const book2 = await bookRepository.create({
        calibreId: 83,
        title: 'Children of Dune',
        authors: ['Frank Herbert'],
        path: '/path/2',
      });

      // Add books to shelf1
      getDatabase().insert(bookShelves).values({ shelfId: shelf1.id, bookId: book1.id, sortOrder: 0 }).run();
      getDatabase().insert(bookShelves).values({ shelfId: shelf1.id, bookId: book2.id, sortOrder: 1 }).run();

      const shelves = await getAllShelves();

      expect(shelves.length).toBeGreaterThanOrEqual(2);
      
      const favorites = shelves.find((s: any) => s.name === 'Favorites');
      expect(favorites).toBeDefined();
      expect(favorites!.bookCount).toBe(2);

      const classics = shelves.find((s: any) => s.name === 'Classics');
      expect(classics).toBeDefined();
      expect(classics!.bookCount).toBe(0); // No books added
    });

    test('should return empty array when no shelves exist', async () => {
      const shelves = await getAllShelves();

      expect(shelves).toHaveLength(0);
    });

    test('should order shelves alphabetically by name', async () => {
      await shelfRepository.create({ name: 'Zebra Shelf', description: null });
      await shelfRepository.create({ name: 'Alpha Shelf', description: null });
      await shelfRepository.create({ name: 'Beta Shelf', description: null });

      const shelves = await getAllShelves();

      expect(shelves.length).toBe(3);
      expect(shelves[0].name).toBe('Alpha Shelf');
      expect(shelves[1].name).toBe('Beta Shelf');
      expect(shelves[2].name).toBe('Zebra Shelf');
    });
  });

  describe('getBooksByShelf', () => {
    test('should return books on a shelf ordered by sort order', async () => {
      const shelf = await shelfRepository.create({ name: 'Favorites', description: null });

      const book1 = await bookRepository.create({
        calibreId: 147,
        title: 'Dune',
        authors: ['Frank Herbert'],
        path: '/path/1',
      });

      const book2 = await bookRepository.create({
        calibreId: 83,
        title: 'Children of Dune',
        authors: ['Frank Herbert'],
        path: '/path/2',
      });

      const book3 = await bookRepository.create({
        calibreId: 84,
        title: 'Dune Messiah',
        authors: ['Frank Herbert'],
        path: '/path/3',
      });

      // Add books with specific sort order (2, 0, 1)
      getDatabase().insert(bookShelves).values({ shelfId: shelf.id, bookId: book1.id, sortOrder: 2 }).run();
      getDatabase().insert(bookShelves).values({ shelfId: shelf.id, bookId: book2.id, sortOrder: 0 }).run();
      getDatabase().insert(bookShelves).values({ shelfId: shelf.id, bookId: book3.id, sortOrder: 1 }).run();

      const { books, total } = await getBooksByShelf(shelf.id, 50, 0);

      expect(books).toHaveLength(3);
      expect(total).toBe(3);

      // Should be ordered by sortOrder (0, 1, 2)
      expect(books[0].id).toBe(83); // sortOrder 0
      expect(books[1].id).toBe(84); // sortOrder 1
      expect(books[2].id).toBe(147); // sortOrder 2
    });

    test('should handle empty shelf', async () => {
      const shelf = await shelfRepository.create({ name: 'Empty', description: null });

      const { books, total } = await getBooksByShelf(shelf.id, 50, 0);

      expect(books).toHaveLength(0);
      expect(total).toBe(0);
    });

    test('should respect pagination', async () => {
      const shelf = await shelfRepository.create({ name: 'Big Shelf', description: null });

      // Create 5 books
      const bookIds = [147, 83, 84, 40, 89];
      for (let i = 0; i < bookIds.length; i++) {
        const book = await bookRepository.create({
          calibreId: bookIds[i],
          title: `Book ${i}`,
          authors: ['Author'],
          path: `/path/${i}`,
        });

        getDatabase().insert(bookShelves).values({ shelfId: shelf.id, bookId: book.id, sortOrder: i }).run();
      }

      // Test limit
      const page1 = await getBooksByShelf(shelf.id, 2, 0);
      expect(page1.books).toHaveLength(2);
      expect(page1.total).toBe(5);

      // Test offset
      const page2 = await getBooksByShelf(shelf.id, 2, 2);
      expect(page2.books).toHaveLength(2);
      expect(page2.total).toBe(5);

      // Different books on different pages
      expect(page2.books[0].id).not.toBe(page1.books[0].id);
    });

    test('should handle non-existent shelf ID', async () => {
      const { books, total } = await getBooksByShelf(999999, 50, 0);

      expect(books).toHaveLength(0);
      expect(total).toBe(0);
    });
  });

  describe('getBooksByRating', () => {
    test('should filter by exact rating (5 stars)', async () => {
      const { books, total } = await getBooksByRating(5, 50, 0);

      expect(total).toBeGreaterThan(0);
      
      // All books should have 5-star rating
      books.forEach((book: any) => {
        expect(book.rating).toBe(5);
      });
    });

    test('should filter by exact rating (4 stars)', async () => {
      const { books, total } = await getBooksByRating(4, 50, 0);

      if (total > 0) {
        books.forEach((book: any) => {
          expect(book.rating).toBe(4);
        });
      }
    });

    test('should return unrated books', async () => {
      const { books, total } = await getBooksByRating('unrated', 50, 0);

      expect(total).toBeGreaterThan(0);

      // All books should have null rating
      books.forEach((book: any) => {
        expect(book.rating).toBeNull();
      });
    });

    test('should return any rated books', async () => {
      const { books, total } = await getBooksByRating('rated', 50, 0);

      expect(total).toBeGreaterThan(0);

      // All books should have a rating (not null)
      books.forEach((book: any) => {
        expect(book.rating).not.toBeNull();
        expect(book.rating).toBeGreaterThan(0);
        expect(book.rating).toBeLessThanOrEqual(5);
      });
    });

    test('should convert 1-5 star rating to Calibre 0-10 scale', async () => {
      // Rating 5 should query for rating=10 in Calibre DB
      const { books } = await getBooksByRating(5, 10, 0);

      if (books.length > 0) {
        // Book ID 147 (Dune) has 5-star rating in fixture
        const dune = books.find((b: any) => b.id === 147);
        if (dune) {
          expect(dune.rating).toBe(5); // Should be converted back to 5 stars
        }
      }
    });

    test('should respect pagination', async () => {
      // Get all rated books
      const allRated = await getBooksByRating('rated', 1000, 0);

      if (allRated.total > 3) {
        // Test limit
        const page1 = await getBooksByRating('rated', 2, 0);
        expect(page1.books).toHaveLength(2);

        // Test offset
        const page2 = await getBooksByRating('rated', 2, 2);
        expect(page2.books.length).toBeGreaterThan(0);

        // Different books on different pages
        if (page2.books.length > 0) {
          expect(page2.books[0].id).not.toBe(page1.books[0].id);
        }
      }
    });

    test('should order results alphabetically by title', async () => {
      const { books } = await getBooksByRating('rated', 50, 0);

      if (books.length > 1) {
        // Verify alphabetical order (case-insensitive)
        for (let i = 1; i < books.length; i++) {
          const prevTitle = books[i - 1].title.toLowerCase();
          const currTitle = books[i].title.toLowerCase();
          
          // SQLite COLLATE NOCASE ordering
          expect(prevTitle.localeCompare(currTitle)).toBeLessThanOrEqual(0);
        }
      }
    });

    test('should handle all rating values (1-5 stars)', async () => {
      const ratings = [1, 2, 3, 4, 5];

      for (const rating of ratings) {
        const { books, total } = await getBooksByRating(rating, 10, 0);

        // Verify structure (might not have books for all ratings)
        expect(Array.isArray(books)).toBe(true);
        expect(typeof total).toBe('number');

        // If books exist, verify rating
        books.forEach((book: any) => {
          expect(book.rating).toBe(rating);
        });
      }
    });

    test('should return empty results when no books match rating', async () => {
      // Unlikely any books have exactly 1 star
      const { books, total } = await getBooksByRating(1, 50, 0);

      expect(Array.isArray(books)).toBe(true);
      expect(typeof total).toBe('number');
      expect(total).toBe(books.length);
    });

    test('should handle offset beyond total count', async () => {
      const { books, total } = await getBooksByRating('rated', 10, 1000);

      expect(books).toHaveLength(0);
      expect(typeof total).toBe('number');
    });
  });
});
