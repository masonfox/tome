import { describe, test, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { syncCalibreLibrary, getLastSyncTime, isSyncInProgress, CalibreDataSource } from "@/lib/sync-service";
import { bookRepository, sessionRepository } from "@/lib/repositories";
import { setupTestDatabase, teardownTestDatabase, clearTestDatabase } from "@/__tests__/helpers/db-setup";
import { mockCalibreBook , createTestBook, createTestSession, createTestProgress } from "@/__tests__/fixtures/test-data";
import { CalibreBook } from "@/lib/db/calibre";

/**
 * Sync Service Tests
 * Tests the complex orchestration logic for syncing Calibre library with SQLite
 * 
 * Uses dependency injection instead of module mocks for better test isolation
 */

describe("syncCalibreLibrary", () => {
  beforeAll(async () => {
    await setupTestDatabase(__filename);
  });

  afterAll(async () => {
    await teardownTestDatabase(__filename);
  });

  beforeEach(async () => {
    await clearTestDatabase(__filename);
  });

  test("prevents concurrent syncs", async () => {
    // Arrange - Set up a slow sync
    const testCalibreSource: CalibreDataSource = {
      getAllBooks: () => [mockCalibreBook],
      getBookTags: () => ["fantasy"],
    };

    // Act - Start first sync (don't await)
    const firstSyncPromise = syncCalibreLibrary(testCalibreSource);

    // Start second sync immediately
    const secondSync = await syncCalibreLibrary(testCalibreSource);

    // Assert - Second sync should be rejected
    expect(secondSync.success).toBe(false);
    expect(secondSync.error).toBe("Sync already in progress");
    expect(secondSync.syncedCount).toBe(0);

    // Wait for first sync to complete
    const firstSync = await firstSyncPromise;
    expect(firstSync.success).toBe(true);
  });

  test("creates new books and auto-creates to-read status", async () => {
    // Arrange
    const testCalibreSource: CalibreDataSource = {
      getAllBooks: () => [mockCalibreBook],
      getBookTags: () => ["fantasy", "epic"],
    };

    // Act
    const result = await syncCalibreLibrary(testCalibreSource);

    // Assert - Sync result
    expect(result.success).toBe(true);
    expect(result.syncedCount).toBe(1);
    expect(result.updatedCount).toBe(0);
    expect(result.removedCount).toBe(0);
    expect(result.totalBooks).toBe(1);

    // Assert - Book was created
    const book = await bookRepository.findByCalibreId(1);
    expect(book).toBeDefined();
    expect(book?.title).toBe("A Dance with Dragons");
    expect(book?.authors).toEqual(["George R. R. Martin"]);
    expect(book?.tags).toEqual(["fantasy", "epic"]);
    expect(book?.isbn).toBe("9780553801477");
    expect(book?.publisher).toBe("Bantam Books");
    expect(book?.series).toBe("A Song of Ice and Fire");
    expect(book?.orphaned).toBe(false);

    // Assert - Reading session was auto-created
    const session = await sessionRepository.findActiveByBookId(book!.id);
    expect(session).toBeDefined();
    expect(session?.status).toBe("to-read");
    expect(session?.sessionNumber).toBe(1);
    expect(session?.isActive).toBe(true);
  });

  test("updates existing books without creating duplicate status", async () => {
    // Arrange - Create existing book and status
    const existingBook = await bookRepository.create(createTestBook({
      calibreId: 1,
      title: "Old Title",
      authors: ["Old Author"],
      tags: [],
      path: "Old/Path",
      orphaned: false,
    }));

    await sessionRepository.create({
      bookId: existingBook.id,
      status: "reading",
      sessionNumber: 1,
      isActive: true,
    });

    // Mock Calibre with updated data
    const testCalibreSource: CalibreDataSource = {
      getAllBooks: () => [
        {
          ...mockCalibreBook,
          title: "Updated Title",
          publisher: "New Publisher",
        },
      ],
      getBookTags: () => ["fantasy", "updated"],
    };

    // Act
    const result = await syncCalibreLibrary(testCalibreSource);

    // Assert - Sync result
    expect(result.success).toBe(true);
    expect(result.syncedCount).toBe(0); // Not a new book
    expect(result.updatedCount).toBe(1); // Existing book updated
    expect(result.removedCount).toBe(0);

    // Assert - Book was updated
    const updatedBook = await bookRepository.findByCalibreId(1);
    expect(updatedBook?.title).toBe("Updated Title");
    expect(updatedBook?.publisher).toBe("New Publisher");
    expect(updatedBook?.tags).toEqual(["fantasy", "updated"]);

    // Assert - No duplicate session created
    const sessionCount = await sessionRepository.countByBookId(existingBook.id);
    expect(sessionCount).toBe(1);

    // Assert - Session still "reading" (not overwritten)
    const session = await sessionRepository.findActiveByBookId(existingBook.id);
    expect(session?.status).toBe("reading");
  });

  test("detects and marks orphaned books", async () => {
    // Arrange - Create multiple books in DB (need 11+ for 10% threshold)
    const book1 = await bookRepository.create(createTestBook({
      calibreId: 1,
      title: "Book Still in Calibre",
      authors: ["Author 1"],
      tags: [],
      path: "Author1/Book1",
      orphaned: false,
    }));

    const book2 = await bookRepository.create(createTestBook({
      calibreId: 2,
      title: "Book Removed from Calibre",
      authors: ["Author 2"],
      tags: [],
      path: "Author2/Book2",
      orphaned: false,
    }));

    // Create 10 more books to stay under 10% threshold (1/12 = 8.3%)
    for (let i = 3; i <= 12; i++) {
      await bookRepository.create(createTestBook({
        calibreId: i,
        title: `Book ${i}`,
        authors: [`Author ${i}`],
        tags: [],
        path: `Author${i}/Book${i}`,
        orphaned: false,
      }));
    }

    // Mock Calibre with all books except book 2
    const testCalibreSource: CalibreDataSource = {
      getAllBooks: () => [
        {
          ...mockCalibreBook,
          id: 1,
        },
        ...Array.from({ length: 10 }, (_, i) => ({
          ...mockCalibreBook,
          id: i + 3,
          title: `Book ${i + 3}`,
          authors: `Author ${i + 3}`,
        })),
      ],
      getBookTags: () => [],
    };

    // Act
    const result = await syncCalibreLibrary(testCalibreSource);

    // Assert - Sync result
    expect(result.success).toBe(true);
    expect(result.removedCount).toBe(1);
    expect(result.orphanedBooks).toBeDefined();
    expect(result.orphanedBooks).toHaveLength(1);

    // Assert - Book 1 still active
    const stillInCalibre = await bookRepository.findByCalibreId(1);
    expect(stillInCalibre?.orphaned).toBe(false);

    // Assert - Book 2 marked orphaned (not deleted)
    const orphanedBook = await bookRepository.findById(book2.id);
    expect(orphanedBook).toBeDefined();
    expect(orphanedBook?.orphaned).toBe(true);
    expect(orphanedBook?.orphanedAt).toBeDefined();
  });

  test("parses authors string correctly", async () => {
    // Arrange
    const testCalibreSource: CalibreDataSource = {
      getAllBooks: () => [
        {
          ...mockCalibreBook,
          authors: "George R. R. Martin, Patrick Rothfuss, Brandon Sanderson",
        },
      ],
      getBookTags: () => [],
    };

    // Act
    await syncCalibreLibrary(testCalibreSource);

    // Assert
    const book = await bookRepository.findByCalibreId(1);
    expect(book?.authors).toEqual([
      "George R. R. Martin",
      "Patrick Rothfuss",
      "Brandon Sanderson",
    ]);
  });

  test("parses pipe-delimited authors correctly", async () => {
    // Arrange
    const testCalibreSource: CalibreDataSource = {
      getAllBooks: () => [
        {
          ...mockCalibreBook,
          authors: "Brian Herbert| Kevin J. Anderson",
        },
      ],
      getBookTags: () => [],
    };

    // Act
    await syncCalibreLibrary(testCalibreSource);

    // Assert
    const book = await bookRepository.findByCalibreId(1);
    expect(book?.authors).toEqual([
      "Brian Herbert",
      "Kevin J. Anderson",
    ]);
  });

  test("handles mixed comma and pipe delimiters", async () => {
    // Arrange
    const testCalibreSource: CalibreDataSource = {
      getAllBooks: () => [
        {
          ...mockCalibreBook,
          authors: "Author One, Author Two | Author Three",
        },
      ],
      getBookTags: () => [],
    };

    // Act
    await syncCalibreLibrary(testCalibreSource);

    // Assert
    const book = await bookRepository.findByCalibreId(1);
    expect(book?.authors).toEqual([
      "Author One",
      "Author Two",
      "Author Three",
    ]);
  });

  test("handles books without optional fields", async () => {
    // Arrange
    const testCalibreSource: CalibreDataSource = {
      getAllBooks: () => [
        {
          id: 1,
          title: "Minimal Book",
          authors: null as any,
          path: "Minimal/Book",
          has_cover: 0,
          isbn: null,
          pubdate: null,
          publisher: null,
          series: null,
          series_index: null,
          timestamp: null as any,
          description: null,
          rating: null,
        },
      ],
      getBookTags: () => [],
    };

    // Act
    const result = await syncCalibreLibrary(testCalibreSource);

    // Assert
    expect(result.success).toBe(true);
    expect(result.syncedCount).toBe(1);

    const book = await bookRepository.findByCalibreId(1);
    expect(book).toBeDefined();
    expect(book?.authors).toEqual([]);
    // In SQLite, null values are stored as null, not undefined
    expect(book?.isbn).toBeNull();
    expect(book?.publisher).toBeNull();
    expect(book?.pubDate).toBeNull();
    expect(book?.series).toBeNull();
    expect(book?.seriesIndex).toBeNull();
    expect(book?.description).toBeNull();
  });

  test("converts dates correctly", async () => {
    // Arrange
    const testCalibreSource: CalibreDataSource = {
      getAllBooks: () => [
        {
          ...mockCalibreBook,
          pubdate: "2011-07-12",
          timestamp: "2025-11-01 12:00:00",
        },
      ],
      getBookTags: () => [],
    };

    // Act
    await syncCalibreLibrary(testCalibreSource);

    // Assert
    const book = await bookRepository.findByCalibreId(1);
    expect(book?.pubDate).toBeInstanceOf(Date);
    expect(book?.pubDate?.getFullYear()).toBe(2011);
    expect(book?.pubDate?.getMonth()).toBe(6); // July (0-indexed)
    expect(book?.pubDate?.getDate()).toBe(12);

    expect(book?.addedToLibrary).toBeInstanceOf(Date);
    expect(book?.lastSynced).toBeInstanceOf(Date);
  });

  test("updates lastSyncTime on successful sync", async () => {
    // Arrange
    const testCalibreSource: CalibreDataSource = {
      getAllBooks: () => [mockCalibreBook],
      getBookTags: () => [],
    };

    const beforeSync = new Date();

    // Act
    await syncCalibreLibrary(testCalibreSource);

    // Assert
    const lastSync = getLastSyncTime();
    expect(lastSync).toBeDefined();
    expect(lastSync!.getTime()).toBeGreaterThanOrEqual(beforeSync.getTime());
  });

  test("handles sync errors gracefully", async () => {
    // Arrange - Mock getAllBooks to throw error
    const testCalibreSource: CalibreDataSource = {
      getAllBooks: () => {
        throw new Error("Calibre database unavailable");
      },
      getBookTags: () => [],
    };

    // Act
    const result = await syncCalibreLibrary(testCalibreSource);

    // Assert
    expect(result.success).toBe(false);
    expect(result.error).toBe("Calibre database unavailable");
    expect(result.syncedCount).toBe(0);
    expect(result.updatedCount).toBe(0);
    expect(result.removedCount).toBe(0);
    expect(result.totalBooks).toBe(0);

    // Assert - isSyncing flag is reset
    expect(isSyncInProgress()).toBe(false);
  });

  test("syncs multiple books in one operation", async () => {
    // Arrange
    const testCalibreSource: CalibreDataSource = {
      getAllBooks: () => [
        {
          ...mockCalibreBook,
          id: 1,
          title: "Book 1",
        },
        {
          ...mockCalibreBook,
          id: 2,
          title: "Book 2",
          authors: "Author 2",
        },
        {
          ...mockCalibreBook,
          id: 3,
          title: "Book 3",
          authors: "Author 3",
        },
      ],
      getBookTags: () => [],
    };

    // Act
    const result = await syncCalibreLibrary(testCalibreSource);

    // Assert
    expect(result.success).toBe(true);
    expect(result.syncedCount).toBe(3);
    expect(result.totalBooks).toBe(3);

    const bookCount = await bookRepository.count();
    expect(bookCount).toBe(3);

    const sessionCount = await sessionRepository.count();
    expect(sessionCount).toBe(3); // All should have auto-created session
  });

  test("doesn't re-orphan already orphaned books", async () => {
    // Arrange - Create already orphaned book
    const orphanedDate = new Date("2025-11-01");
    await bookRepository.create(createTestBook({
      calibreId: 999,
      title: "Already Orphaned",
      authors: ["Author"],
      tags: [],
      path: "Author/Book",
      orphaned: true,
      orphanedAt: orphanedDate,
    }));

    // Mock Calibre with different book
    const testCalibreSource: CalibreDataSource = {
      getAllBooks: () => [
        {
          ...mockCalibreBook,
          id: 1,
        },
      ],
      getBookTags: () => [],
    };

    // Act
    const result = await syncCalibreLibrary(testCalibreSource);

    // Assert - Should not count already-orphaned book as "removed"
    expect(result.removedCount).toBe(0);
    expect(result.orphanedBooks).toBeUndefined();

    // Assert - Orphaned date unchanged
    const book = await bookRepository.findByCalibreId(999);
    expect(book?.orphanedAt).toEqual(orphanedDate);
  });

  test("syncs ratings from Calibre to Tome", async () => {
    // Arrange - Mock Calibre book with rating
    const testCalibreSource: CalibreDataSource = {
      getAllBooks: () => [
        {
          ...mockCalibreBook,
          rating: 4, // 4 stars (already converted from Calibre's 8)
        },
      ],
      getBookTags: () => [],
    };

    // Act
    const result = await syncCalibreLibrary(testCalibreSource);

    // Assert
    expect(result.success).toBe(true);
    expect(result.syncedCount).toBe(1);

    const book = await bookRepository.findByCalibreId(1);
    expect(book).toBeDefined();
    expect(book?.rating).toBe(4);
  });

  test("syncs null ratings from Calibre to Tome", async () => {
    // Arrange - Create book with rating
    await bookRepository.create(createTestBook({
      calibreId: 1,
      title: "Book with Rating",
      authors: ["Author"],
      tags: [],
      path: "Author/Book",
      orphaned: false,
      rating: 5,
    }));

    // Mock Calibre with no rating
    const testCalibreSource: CalibreDataSource = {
      getAllBooks: () => [
        {
          ...mockCalibreBook,
          rating: null,
        },
      ],
      getBookTags: () => [],
    };

    // Act
    const result = await syncCalibreLibrary(testCalibreSource);

    // Assert
    expect(result.success).toBe(true);
    expect(result.updatedCount).toBe(1);

    const book = await bookRepository.findByCalibreId(1);
    expect(book).toBeDefined();
    expect(book?.rating).toBeNull();
  });
});

describe("getLastSyncTime", () => {
  beforeAll(async () => {
    await setupTestDatabase(__filename);
  });

  afterAll(async () => {
    await teardownTestDatabase(__filename);
  });

  beforeEach(async () => {
    await clearTestDatabase(__filename);
  });

  test("returns timestamp after successful sync", async () => {
    // Arrange
    const testCalibreSource: CalibreDataSource = {
      getAllBooks: () => [mockCalibreBook],
      getBookTags: () => [],
    };

    const beforeSync = getLastSyncTime();

    // Act
    await syncCalibreLibrary(testCalibreSource);

    // Assert
    const afterSync = getLastSyncTime();
    expect(afterSync).toBeInstanceOf(Date);
    // Should be different from before (either null or earlier)
    if (beforeSync) {
      expect(afterSync!.getTime()).toBeGreaterThanOrEqual(beforeSync.getTime());
    }
  });
});

describe("isSyncInProgress", () => {
  beforeAll(async () => {
    await setupTestDatabase(__filename);
  });

  afterAll(async () => {
    await teardownTestDatabase(__filename);
  });

  beforeEach(async () => {
    await clearTestDatabase(__filename);
  });

  test("returns false when no sync is running", () => {
    expect(isSyncInProgress()).toBe(false);
  });

  test("returns false after sync completes", async () => {
    // Arrange
    const testCalibreSource: CalibreDataSource = {
      getAllBooks: () => [mockCalibreBook],
      getBookTags: () => [],
    };

    // Act
    await syncCalibreLibrary(testCalibreSource);

    // Assert - Should be false after sync
    expect(isSyncInProgress()).toBe(false);
  });
});

describe("Sync Service - Orphaning Safety Checks", () => {
  beforeAll(async () => {
    await setupTestDatabase(__filename);
  });

  afterAll(async () => {
    await teardownTestDatabase(__filename);
  });

  beforeEach(async () => {
    await clearTestDatabase(__filename);
  });

  test("CRITICAL: Empty Calibre results abort sync and prevent orphaning", async () => {
    // Arrange - Create books in DB
    await bookRepository.create(createTestBook({
      calibreId: 1,
      title: "Book 1",
      authors: ["Author 1"],
      tags: [],
      path: "Author1/Book1",
    }));

    await bookRepository.create(createTestBook({
      calibreId: 2,
      title: "Book 2",
      authors: ["Author 2"],
      tags: [],
      path: "Author2/Book2",
    }));

    // Mock Calibre returning empty array (simulating DB connection failure)
    const testCalibreSource: CalibreDataSource = {
      getAllBooks: () => [],
      getBookTags: () => [],
    };

    // Act
    const result = await syncCalibreLibrary(testCalibreSource);

    // Assert - Sync should fail
    expect(result.success).toBe(false);
    expect(result.error).toContain("No books found in Calibre database");
    expect(result.syncedCount).toBe(0);
    expect(result.updatedCount).toBe(0);
    expect(result.removedCount).toBe(0);

    // Assert - NO BOOKS should be orphaned
    const book1 = await bookRepository.findByCalibreId(1);
    const book2 = await bookRepository.findByCalibreId(2);
    
    expect(book1?.orphaned).toBeFalsy();
    expect(book2?.orphaned).toBeFalsy();
  });

  test("CRITICAL: Mass orphaning (>10%) aborts sync with error", async () => {
    // Arrange - Create 100 books in DB
    for (let i = 1; i <= 100; i++) {
      await bookRepository.create(createTestBook({
        calibreId: i,
        title: `Book ${i}`,
        authors: [`Author ${i}`],
        tags: [],
        path: `Author${i}/Book${i}`,
      }));
    }

    // Mock Calibre with only 85 books (15 books would be orphaned = 15%)
    const calibreBooks: any[] = [];
    for (let i = 1; i <= 85; i++) {
      calibreBooks.push({
        id: i,
        title: `Book ${i}`,
        authors: `Author ${i}`,
        path: `Author${i}/Book${i}`,
        has_cover: 0,
        isbn: null,
        pubdate: null,
        publisher: null,
        series: null,
        series_index: null,
        timestamp: new Date().toISOString(),
        description: null,
        rating: null,
      });
    }
    
    const testCalibreSource: CalibreDataSource = {
      getAllBooks: () => calibreBooks,
      getBookTags: () => [],
    };

    // Act
    const result = await syncCalibreLibrary(testCalibreSource);

    // Assert - Sync should fail with mass orphaning error
    expect(result.success).toBe(false);
    expect(result.error).toContain("would orphan 15 books");
    expect(result.error).toContain("15.0%");
    expect(result.removedCount).toBe(0); // Should not orphan anything

    // Assert - NO BOOKS should be orphaned
    const totalBooks = await bookRepository.count();
    expect(totalBooks).toBe(100);
    
    // Check a few random books are not orphaned
    const book50 = await bookRepository.findByCalibreId(50);
    const book90 = await bookRepository.findByCalibreId(90);
    const book100 = await bookRepository.findByCalibreId(100);
    
    expect(book50?.orphaned).toBeFalsy();
    expect(book90?.orphaned).toBeFalsy();
    expect(book100?.orphaned).toBeFalsy();
  });

  test("Allows orphaning under 10% threshold", async () => {
    // Arrange - Create 100 books in DB
    for (let i = 1; i <= 100; i++) {
      await bookRepository.create(createTestBook({
        calibreId: i,
        title: `Book ${i}`,
        authors: [`Author ${i}`],
        tags: [],
        path: `Author${i}/Book${i}`,
      }));
    }

    // Mock Calibre with 95 books (5 books would be orphaned = 5%)
    const calibreBooks: any[] = [];
    for (let i = 1; i <= 95; i++) {
      calibreBooks.push({
        id: i,
        title: `Book ${i}`,
        authors: `Author ${i}`,
        path: `Author${i}/Book${i}`,
        has_cover: 0,
        isbn: null,
        pubdate: null,
        publisher: null,
        series: null,
        series_index: null,
        timestamp: new Date().toISOString(),
        description: null,
        rating: null,
      });
    }
    
    const testCalibreSource: CalibreDataSource = {
      getAllBooks: () => calibreBooks,
      getBookTags: () => [],
    };

    // Act
    const result = await syncCalibreLibrary(testCalibreSource);

    // Assert - Sync should succeed
    expect(result.success).toBe(true);
    expect(result.removedCount).toBe(5);
    expect(result.orphanedBooks).toHaveLength(5);

    // Assert - Only 5 books should be orphaned
    const book96 = await bookRepository.findByCalibreId(96);
    const book97 = await bookRepository.findByCalibreId(97);
    const book98 = await bookRepository.findByCalibreId(98);
    const book99 = await bookRepository.findByCalibreId(99);
    const book100 = await bookRepository.findByCalibreId(100);
    
    expect(book96?.orphaned).toBe(true);
    expect(book97?.orphaned).toBe(true);
    expect(book98?.orphaned).toBe(true);
    expect(book99?.orphaned).toBe(true);
    expect(book100?.orphaned).toBe(true);

    // Assert - Books 1-95 should NOT be orphaned
    const book1 = await bookRepository.findByCalibreId(1);
    const book50 = await bookRepository.findByCalibreId(50);
    const book95 = await bookRepository.findByCalibreId(95);
    
    expect(book1?.orphaned).toBeFalsy();
    expect(book50?.orphaned).toBeFalsy();
    expect(book95?.orphaned).toBeFalsy();
  });

  test("findNotInCalibreIds returns empty array for empty input", async () => {
    // Arrange - Create books in DB
    await bookRepository.create(createTestBook({
      calibreId: 1,
      title: "Book 1",
      authors: ["Author 1"],
      tags: [],
      path: "Author1/Book1",
    }));

    await bookRepository.create(createTestBook({
      calibreId: 2,
      title: "Book 2",
      authors: ["Author 2"],
      tags: [],
      path: "Author2/Book2",
    }));

    // Act - Call with empty array
    const result = await bookRepository.findNotInCalibreIds([]);

    // Assert - Should return empty array (not ALL books)
    expect(result).toEqual([]);
    expect(result.length).toBe(0);
  });

  test("findNotInCalibreIds correctly identifies missing books", async () => {
    // Arrange - Create 5 books
    for (let i = 1; i <= 5; i++) {
      await bookRepository.create(createTestBook({
        calibreId: i,
        title: `Book ${i}`,
        authors: [`Author ${i}`],
        tags: [],
        path: `Author${i}/Book${i}`,
      }));
    }

    // Act - Call with calibreIds [1, 2, 3] (books 4 and 5 are missing)
    const result = await bookRepository.findNotInCalibreIds([1, 2, 3]);

    // Assert - Should return books 4 and 5
    expect(result.length).toBe(2);
    expect(result.map(b => b.calibreId).sort()).toEqual([4, 5]);
  });

  test("findNotInCalibreIds ignores already orphaned books", async () => {
    // Arrange - Create books, one already orphaned
    await bookRepository.create(createTestBook({
      calibreId: 1,
      title: "Active Book",
      authors: ["Author 1"],
      tags: [],
      path: "Author1/Book1",
      orphaned: false,
    }));

    await bookRepository.create(createTestBook({
      calibreId: 2,
      title: "Already Orphaned Book",
      authors: ["Author 2"],
      tags: [],
      path: "Author2/Book2",
      orphaned: true,
      orphanedAt: new Date("2025-11-01"),
    }));

    // Act - Call with empty calibreIds (only book 1 is active)
    const result = await bookRepository.findNotInCalibreIds([]);

    // Assert - Should return empty (book 2 is already orphaned)
    expect(result).toEqual([]);
  });

  test("skips orphan detection when detectOrphans option is false", async () => {
    // Arrange - Create an existing book
    const existingBook = await bookRepository.create(createTestBook({
      calibreId: 1,
      title: "Existing Book",
      authors: ["Author 1"],
      tags: [],
      path: "Author1/Book1",
      orphaned: false,
    }));

    // Mock Calibre source that doesn't include the existing book (simulating removal)
    const testCalibreSource: CalibreDataSource = {
      getAllBooks: () => [
        {
          ...mockCalibreBook,
          id: 2, // Different book, not book 1
          title: "New Book",
        },
      ],
      getBookTags: () => ["fantasy"],
    };

    // Act - Sync with detectOrphans = false
    const result = await syncCalibreLibrary(testCalibreSource, { detectOrphans: false });

    // Assert - Sync should succeed
    expect(result.success).toBe(true);
    expect(result.syncedCount).toBe(1); // New book created
    expect(result.removedCount).toBe(0); // No orphan detection

    // Assert - Existing book should NOT be marked as orphaned
    const book = await bookRepository.findById(existingBook.id);
    expect(book?.orphaned).toBe(false);
  });

  test("uses getAllBookTags for batch tag fetching when available", async () => {
    // Arrange - Track which method was called
    let getAllBookTagsCalled = false;
    let getBookTagsCallCount = 0;

    const testCalibreSource: CalibreDataSource = {
      getAllBooks: () => [
        { ...mockCalibreBook, id: 1, title: "Book 1" },
        { ...mockCalibreBook, id: 2, title: "Book 2" },
        { ...mockCalibreBook, id: 3, title: "Book 3" },
      ],
      getBookTags: (bookId: number) => {
        getBookTagsCallCount++;
        return ["tag1", "tag2"];
      },
      getAllBookTags: () => {
        getAllBookTagsCalled = true;
        return new Map([
          [1, ["tag1", "tag2"]],
          [2, ["tag3"]],
          [3, ["tag4", "tag5"]],
        ]);
      },
    };

    // Act
    const result = await syncCalibreLibrary(testCalibreSource);

    // Assert - getAllBookTags should be called, not individual getBookTags
    expect(getAllBookTagsCalled).toBe(true);
    expect(getBookTagsCallCount).toBe(0); // Should not be called when getAllBookTags exists
    expect(result.success).toBe(true);
    expect(result.syncedCount).toBe(3);

    // Verify books have correct tags
    const book1 = await bookRepository.findByCalibreId(1);
    const book2 = await bookRepository.findByCalibreId(2);
    const book3 = await bookRepository.findByCalibreId(3);
    
    expect(book1?.tags).toEqual(["tag1", "tag2"]);
    expect(book2?.tags).toEqual(["tag3"]);
    expect(book3?.tags).toEqual(["tag4", "tag5"]);
  });

  test("falls back to individual getBookTags when getAllBookTags is not available", async () => {
    // Arrange - Track getBookTags calls
    let getBookTagsCallCount = 0;

    const testCalibreSource: CalibreDataSource = {
      getAllBooks: () => [
        { ...mockCalibreBook, id: 1, title: "Book 1" },
        { ...mockCalibreBook, id: 2, title: "Book 2" },
      ],
      getBookTags: (bookId: number) => {
        getBookTagsCallCount++;
        return bookId === 1 ? ["tag1"] : ["tag2"];
      },
      // No getAllBookTags provided
    };

    // Act
    const result = await syncCalibreLibrary(testCalibreSource);

    // Assert - getBookTags should be called for each book
    expect(getBookTagsCallCount).toBe(2);
    expect(result.success).toBe(true);
    expect(result.syncedCount).toBe(2);

    // Verify books have correct tags
    const book1 = await bookRepository.findByCalibreId(1);
    const book2 = await bookRepository.findByCalibreId(2);
    
    expect(book1?.tags).toEqual(["tag1"]);
    expect(book2?.tags).toEqual(["tag2"]);
  });

  describe("Phase 2: Chunked Processing", () => {
    test("processes books in chunks when getBooksCount and pagination are available", async () => {
      // Arrange - Create 10 books, chunk size of 3 = 4 chunks (3+3+3+1)
      const books: any[] = [];
      for (let i = 1; i <= 10; i++) {
        books.push({
          ...mockCalibreBook,
          id: i,
          title: `Book ${i}`,
        });
      }

      // Track which methods are called and with what parameters
      let getBooksCountCalled = false;
      let getAllBooksCallCount = 0;
      const getAllBooksParams: any[] = [];
      let getAllBookTagsCallCount = 0;
      const getAllBookTagsParams: any[] = [];

      const testCalibreSource: CalibreDataSource = {
        getBooksCount: () => {
          getBooksCountCalled = true;
          return books.length; // 10 books
        },
        getAllBooks: (options?: any) => {
          getAllBooksCallCount++;
          getAllBooksParams.push(options);
          
          // Simulate pagination
          const limit = options?.limit || books.length;
          const offset = options?.offset || 0;
          return books.slice(offset, offset + limit);
        },
        getBookTags: () => ["tag"],
        getAllBookTags: (bookIds?: number[]) => {
          getAllBookTagsCallCount++;
          getAllBookTagsParams.push(bookIds);
          
          // Return tags only for the requested book IDs
          const map = new Map<number, string[]>();
          if (bookIds) {
            bookIds.forEach(id => map.set(id, [`tag${id}`]));
          }
          return map;
        },
      };

      // Act - Sync with chunk size of 3
      const result = await syncCalibreLibrary(testCalibreSource, { chunkSize: 3 });

      // Assert - Sync should succeed
      expect(result.success).toBe(true);
      expect(result.syncedCount).toBe(10);
      expect(result.totalBooks).toBe(10);

      // Assert - getBooksCount should be called
      expect(getBooksCountCalled).toBe(true);

      // Assert - getAllBooks should be called 4 times (4 chunks)
      expect(getAllBooksCallCount).toBe(4);
      expect(getAllBooksParams[0]).toEqual({ limit: 3, offset: 0 });  // Chunk 1
      expect(getAllBooksParams[1]).toEqual({ limit: 3, offset: 3 });  // Chunk 2
      expect(getAllBooksParams[2]).toEqual({ limit: 3, offset: 6 });  // Chunk 3
      expect(getAllBooksParams[3]).toEqual({ limit: 3, offset: 9 });  // Chunk 4

      // Assert - getAllBookTags should be called 4 times with book IDs for each chunk
      expect(getAllBookTagsCallCount).toBe(4);
      expect(getAllBookTagsParams[0]).toEqual([1, 2, 3]);     // Chunk 1 book IDs
      expect(getAllBookTagsParams[1]).toEqual([4, 5, 6]);     // Chunk 2 book IDs
      expect(getAllBookTagsParams[2]).toEqual([7, 8, 9]);     // Chunk 3 book IDs
      expect(getAllBookTagsParams[3]).toEqual([10]);          // Chunk 4 book IDs (last chunk with 1 book)

      // Verify all books were created with correct tags
      for (let i = 1; i <= 10; i++) {
        const book = await bookRepository.findByCalibreId(i);
        expect(book).toBeDefined();
        expect(book?.title).toBe(`Book ${i}`);
        expect(book?.tags).toEqual([`tag${i}`]);
      }
    });

    test("handles last chunk with fewer books than chunkSize", async () => {
      // Arrange - 7 books with chunk size 3 = 3 chunks (3+3+1)
      const books: any[] = [];
      for (let i = 1; i <= 7; i++) {
        books.push({
          ...mockCalibreBook,
          id: i,
          title: `Book ${i}`,
        });
      }

      let getAllBooksCallCount = 0;

      const testCalibreSource: CalibreDataSource = {
        getBooksCount: () => books.length,
        getAllBooks: (options?: any) => {
          getAllBooksCallCount++;
          const limit = options?.limit || books.length;
          const offset = options?.offset || 0;
          return books.slice(offset, offset + limit);
        },
        getBookTags: () => [],
        getAllBookTags: (bookIds?: number[]) => {
          const map = new Map<number, string[]>();
          if (bookIds) {
            bookIds.forEach(id => map.set(id, []));
          }
          return map;
        },
      };

      // Act
      const result = await syncCalibreLibrary(testCalibreSource, { chunkSize: 3 });

      // Assert
      expect(result.success).toBe(true);
      expect(result.syncedCount).toBe(7);
      expect(getAllBooksCallCount).toBe(3); // 3 chunks

      // Verify all 7 books were created
      for (let i = 1; i <= 7; i++) {
        const book = await bookRepository.findByCalibreId(i);
        expect(book).toBeDefined();
      }
    });

    test("verifies getAllBookTags receives only book IDs from current chunk", async () => {
      // Arrange - 5 books, chunk size 2 = 3 chunks (2+2+1)
      const books: any[] = [];
      for (let i = 1; i <= 5; i++) {
        books.push({
          ...mockCalibreBook,
          id: i * 10, // Use non-sequential IDs to verify exact IDs passed
          title: `Book ${i}`,
        });
      }

      const receivedBookIds: number[][] = [];

      const testCalibreSource: CalibreDataSource = {
        getBooksCount: () => books.length,
        getAllBooks: (options?: any) => {
          const limit = options?.limit || books.length;
          const offset = options?.offset || 0;
          return books.slice(offset, offset + limit);
        },
        getBookTags: () => [],
        getAllBookTags: (bookIds?: number[]) => {
          if (bookIds) {
            receivedBookIds.push([...bookIds]);
          }
          const map = new Map<number, string[]>();
          if (bookIds) {
            bookIds.forEach(id => map.set(id, [`tag-${id}`]));
          }
          return map;
        },
      };

      // Act
      const result = await syncCalibreLibrary(testCalibreSource, { chunkSize: 2 });

      // Assert
      expect(result.success).toBe(true);
      expect(receivedBookIds.length).toBe(3); // 3 chunks

      // Verify exact book IDs passed to each chunk
      expect(receivedBookIds[0]).toEqual([10, 20]);  // Chunk 1
      expect(receivedBookIds[1]).toEqual([30, 40]);  // Chunk 2
      expect(receivedBookIds[2]).toEqual([50]);      // Chunk 3

      // Verify books have correct tags based on their IDs
      const book1 = await bookRepository.findByCalibreId(10);
      const book5 = await bookRepository.findByCalibreId(50);
      expect(book1?.tags).toEqual(["tag-10"]);
      expect(book5?.tags).toEqual(["tag-50"]);
    });

    test("handles empty chunks gracefully (edge case)", async () => {
      // Arrange - Test with exact multiple of chunk size
      const books: any[] = [];
      for (let i = 1; i <= 6; i++) {
        books.push({
          ...mockCalibreBook,
          id: i,
          title: `Book ${i}`,
        });
      }

      const testCalibreSource: CalibreDataSource = {
        getBooksCount: () => books.length,
        getAllBooks: (options?: any) => {
          const limit = options?.limit || books.length;
          const offset = options?.offset || 0;
          const chunk = books.slice(offset, offset + limit);
          return chunk; // May return empty array if offset >= books.length
        },
        getBookTags: () => [],
        getAllBookTags: (bookIds?: number[]) => {
          const map = new Map<number, string[]>();
          if (bookIds) {
            bookIds.forEach(id => map.set(id, []));
          }
          return map;
        },
      };

      // Act - 6 books with chunk size 3 = exactly 2 chunks, no partial chunk
      const result = await syncCalibreLibrary(testCalibreSource, { chunkSize: 3 });

      // Assert
      expect(result.success).toBe(true);
      expect(result.syncedCount).toBe(6);

      // Verify all books created
      for (let i = 1; i <= 6; i++) {
        const book = await bookRepository.findByCalibreId(i);
        expect(book).toBeDefined();
      }
    });

    test("falls back to non-paginated method when getBooksCount is not available", async () => {
      // Arrange - Source without getBooksCount (backward compatibility)
      const books: any[] = [];
      for (let i = 1; i <= 5; i++) {
        books.push({
          ...mockCalibreBook,
          id: i,
          title: `Book ${i}`,
        });
      }

      let getAllBooksCalledWithOptions = false;

      const testCalibreSource: CalibreDataSource = {
        // No getBooksCount provided
        getAllBooks: (options?: any) => {
          if (options) {
            getAllBooksCalledWithOptions = true;
          }
          // Fallback behavior: return all books, ignore pagination
          return books;
        },
        getBookTags: () => [],
        getAllBookTags: (bookIds?: number[]) => {
          const map = new Map<number, string[]>();
          if (bookIds) {
            bookIds.forEach(id => map.set(id, []));
          }
          return map;
        },
      };

      // Act
      const result = await syncCalibreLibrary(testCalibreSource, { chunkSize: 2 });

      // Assert - Should still succeed using fallback
      expect(result.success).toBe(true);
      expect(result.syncedCount).toBe(5);

      // Verify all books created
      for (let i = 1; i <= 5; i++) {
        const book = await bookRepository.findByCalibreId(i);
        expect(book).toBeDefined();
      }
    });
  });
});
