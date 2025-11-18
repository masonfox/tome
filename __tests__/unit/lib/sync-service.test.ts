import { describe, test, expect, beforeAll, afterAll, beforeEach, mock } from "bun:test";
import { syncCalibreLibrary, getLastSyncTime, isSyncInProgress } from "@/lib/sync-service";
import Book from "@/models/Book";
import ReadingStatus from "@/models/ReadingStatus";
import { setupTestDatabase, teardownTestDatabase, clearTestDatabase } from "@/__tests__/helpers/db-setup";
import { mockCalibreBook } from "@/__tests__/fixtures/test-data";

/**
 * Sync Service Tests
 * Tests the complex orchestration logic for syncing Calibre library with MongoDB
 */

// Mock Calibre DB functions
let mockGetAllBooks: ReturnType<typeof mock>;
let mockGetBookTags: ReturnType<typeof mock>;

// Set up module mocks before imports
mock.module("@/lib/db/calibre", () => ({
  getAllBooks: () => mockGetAllBooks(),
  getBookTags: (id: number) => mockGetBookTags(id),
}));

describe("syncCalibreLibrary", () => {
  beforeAll(async () => {
    await setupTestDatabase();
  });

  afterAll(async () => {
    await teardownTestDatabase();
  });

  beforeEach(async () => {
    await clearTestDatabase();

    // Reset mocks with default implementations
    mockGetAllBooks = mock(() => []);
    mockGetBookTags = mock(() => []);
  });

  test("prevents concurrent syncs", async () => {
    // Arrange - Set up a slow sync
    mockGetAllBooks = mock(() => [mockCalibreBook]);
    mockGetBookTags = mock(() => ["fantasy"]);

    // Act - Start first sync (don't await)
    const firstSyncPromise = syncCalibreLibrary();

    // Start second sync immediately
    const secondSync = await syncCalibreLibrary();

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
    mockGetAllBooks = mock(() => [mockCalibreBook]);
    mockGetBookTags = mock(() => ["fantasy", "epic"]);

    // Act
    const result = await syncCalibreLibrary();

    // Assert - Sync result
    expect(result.success).toBe(true);
    expect(result.syncedCount).toBe(1);
    expect(result.updatedCount).toBe(0);
    expect(result.removedCount).toBe(0);
    expect(result.totalBooks).toBe(1);

    // Assert - Book was created
    const book = await Book.findOne({ calibreId: 1 });
    expect(book).toBeDefined();
    expect(book?.title).toBe("A Dance with Dragons");
    expect(book?.authors).toEqual(["George R. R. Martin"]);
    expect(book?.tags).toEqual(["fantasy", "epic"]);
    expect(book?.isbn).toBe("9780553801477");
    expect(book?.publisher).toBe("Bantam Books");
    expect(book?.series).toBe("A Song of Ice and Fire");
    expect(book?.orphaned).toBe(false);

    // Assert - Reading status was auto-created
    const status = await ReadingStatus.findOne({ bookId: book?._id });
    expect(status).toBeDefined();
    expect(status?.status).toBe("to-read");
  });

  test("updates existing books without creating duplicate status", async () => {
    // Arrange - Create existing book and status
    const existingBook = await Book.create({
      calibreId: 1,
      title: "Old Title",
      authors: ["Old Author"],
      tags: [],
      path: "Old/Path",
      orphaned: false,
    });

    await ReadingStatus.create({
      bookId: existingBook._id,
      status: "reading",
    });

    // Mock Calibre with updated data
    mockGetAllBooks = mock(() => [
      {
        ...mockCalibreBook,
        title: "Updated Title",
        publisher: "New Publisher",
      },
    ]);
    mockGetBookTags = mock(() => ["fantasy", "updated"]);

    // Act
    const result = await syncCalibreLibrary();

    // Assert - Sync result
    expect(result.success).toBe(true);
    expect(result.syncedCount).toBe(0); // Not a new book
    expect(result.updatedCount).toBe(1); // Existing book updated
    expect(result.removedCount).toBe(0);

    // Assert - Book was updated
    const updatedBook = await Book.findOne({ calibreId: 1 });
    expect(updatedBook?.title).toBe("Updated Title");
    expect(updatedBook?.publisher).toBe("New Publisher");
    expect(updatedBook?.tags).toEqual(["fantasy", "updated"]);

    // Assert - No duplicate status created
    const statusCount = await ReadingStatus.countDocuments({ bookId: existingBook._id });
    expect(statusCount).toBe(1);

    // Assert - Status still "reading" (not overwritten)
    const status = await ReadingStatus.findOne({ bookId: existingBook._id });
    expect(status?.status).toBe("reading");
  });

  test("detects and marks orphaned books", async () => {
    // Arrange - Create books in DB
    const book1 = await Book.create({
      calibreId: 1,
      title: "Book Still in Calibre",
      authors: ["Author 1"],
      tags: [],
      path: "Author1/Book1",
      orphaned: false,
    });

    const book2 = await Book.create({
      calibreId: 2,
      title: "Book Removed from Calibre",
      authors: ["Author 2"],
      tags: [],
      path: "Author2/Book2",
      orphaned: false,
    });

    // Mock Calibre with only book 1
    mockGetAllBooks = mock(() => [
      {
        ...mockCalibreBook,
        id: 1,
      },
    ]);
    mockGetBookTags = mock(() => []);

    // Act
    const result = await syncCalibreLibrary();

    // Assert - Sync result
    expect(result.success).toBe(true);
    expect(result.removedCount).toBe(1);
    expect(result.orphanedBooks).toBeDefined();
    expect(result.orphanedBooks).toHaveLength(1);

    // Assert - Book 1 still active
    const stillInCalibre = await Book.findOne({ calibreId: 1 });
    expect(stillInCalibre?.orphaned).toBe(false);

    // Assert - Book 2 marked orphaned (not deleted)
    const orphanedBook = await Book.findById(book2._id);
    expect(orphanedBook).toBeDefined();
    expect(orphanedBook?.orphaned).toBe(true);
    expect(orphanedBook?.orphanedAt).toBeDefined();
  });

  test("parses authors string correctly", async () => {
    // Arrange
    mockGetAllBooks = mock(() => [
      {
        ...mockCalibreBook,
        authors: "George R. R. Martin, Patrick Rothfuss, Brandon Sanderson",
      },
    ]);
    mockGetBookTags = mock(() => []);

    // Act
    await syncCalibreLibrary();

    // Assert
    const book = await Book.findOne({ calibreId: 1 });
    expect(book?.authors).toEqual([
      "George R. R. Martin",
      "Patrick Rothfuss",
      "Brandon Sanderson",
    ]);
  });

  test("parses pipe-delimited authors correctly", async () => {
    // Arrange
    mockGetAllBooks = mock(() => [
      {
        ...mockCalibreBook,
        authors: "Brian Herbert| Kevin J. Anderson",
      },
    ]);
    mockGetBookTags = mock(() => []);

    // Act
    await syncCalibreLibrary();

    // Assert
    const book = await Book.findOne({ calibreId: 1 });
    expect(book?.authors).toEqual([
      "Brian Herbert",
      "Kevin J. Anderson",
    ]);
  });

  test("handles mixed comma and pipe delimiters", async () => {
    // Arrange
    mockGetAllBooks = mock(() => [
      {
        ...mockCalibreBook,
        authors: "Author One, Author Two | Author Three",
      },
    ]);
    mockGetBookTags = mock(() => []);

    // Act
    await syncCalibreLibrary();

    // Assert
    const book = await Book.findOne({ calibreId: 1 });
    expect(book?.authors).toEqual([
      "Author One",
      "Author Two",
      "Author Three",
    ]);
  });

  test("handles books without optional fields", async () => {
    // Arrange
    mockGetAllBooks = mock(() => [
      {
        id: 1,
        title: "Minimal Book",
        authors: null,
        path: "Minimal/Book",
        has_cover: 0,
        isbn: null,
        pubdate: null,
        publisher: null,
        series: null,
        series_index: null,
        timestamp: null,
        description: null,
      },
    ]);
    mockGetBookTags = mock(() => []);

    // Act
    const result = await syncCalibreLibrary();

    // Assert
    expect(result.success).toBe(true);
    expect(result.syncedCount).toBe(1);

    const book = await Book.findOne({ calibreId: 1 });
    expect(book).toBeDefined();
    expect(book?.authors).toEqual([]);
    expect(book?.isbn).toBeUndefined();
    expect(book?.publisher).toBeUndefined();
    expect(book?.pubDate).toBeUndefined();
    expect(book?.series).toBeUndefined();
    expect(book?.seriesIndex).toBeUndefined();
    expect(book?.description).toBeUndefined();
  });

  test("converts dates correctly", async () => {
    // Arrange
    mockGetAllBooks = mock(() => [
      {
        ...mockCalibreBook,
        pubdate: "2011-07-12",
        timestamp: "2025-11-01 12:00:00",
      },
    ]);
    mockGetBookTags = mock(() => []);

    // Act
    await syncCalibreLibrary();

    // Assert
    const book = await Book.findOne({ calibreId: 1 });
    expect(book?.pubDate).toBeInstanceOf(Date);
    expect(book?.pubDate?.getFullYear()).toBe(2011);
    expect(book?.pubDate?.getMonth()).toBe(6); // July (0-indexed)
    expect(book?.pubDate?.getDate()).toBe(12);

    expect(book?.addedToLibrary).toBeInstanceOf(Date);
    expect(book?.lastSynced).toBeInstanceOf(Date);
  });

  test("updates lastSyncTime on successful sync", async () => {
    // Arrange
    mockGetAllBooks = mock(() => [mockCalibreBook]);
    mockGetBookTags = mock(() => []);

    const beforeSync = new Date();

    // Act
    await syncCalibreLibrary();

    // Assert
    const lastSync = getLastSyncTime();
    expect(lastSync).toBeDefined();
    expect(lastSync!.getTime()).toBeGreaterThanOrEqual(beforeSync.getTime());
  });

  test("handles sync errors gracefully", async () => {
    // Arrange - Mock getAllBooks to throw error
    mockGetAllBooks = mock(() => {
      throw new Error("Calibre database unavailable");
    });

    // Act
    const result = await syncCalibreLibrary();

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
    mockGetAllBooks = mock(() => [
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
    ]);
    mockGetBookTags = mock(() => []);

    // Act
    const result = await syncCalibreLibrary();

    // Assert
    expect(result.success).toBe(true);
    expect(result.syncedCount).toBe(3);
    expect(result.totalBooks).toBe(3);

    const bookCount = await Book.countDocuments();
    expect(bookCount).toBe(3);

    const statusCount = await ReadingStatus.countDocuments();
    expect(statusCount).toBe(3); // All should have auto-created status
  });

  test("doesn't re-orphan already orphaned books", async () => {
    // Arrange - Create already orphaned book
    const orphanedDate = new Date("2025-11-01");
    await Book.create({
      calibreId: 999,
      title: "Already Orphaned",
      authors: ["Author"],
      tags: [],
      path: "Author/Book",
      orphaned: true,
      orphanedAt: orphanedDate,
    });

    // Mock Calibre with different book
    mockGetAllBooks = mock(() => [
      {
        ...mockCalibreBook,
        id: 1,
      },
    ]);
    mockGetBookTags = mock(() => []);

    // Act
    const result = await syncCalibreLibrary();

    // Assert - Should not count already-orphaned book as "removed"
    expect(result.removedCount).toBe(0);
    expect(result.orphanedBooks).toBeUndefined();

    // Assert - Orphaned date unchanged
    const book = await Book.findOne({ calibreId: 999 });
    expect(book?.orphanedAt).toEqual(orphanedDate);
  });
});

describe("getLastSyncTime", () => {
  beforeAll(async () => {
    await setupTestDatabase();
  });

  afterAll(async () => {
    await teardownTestDatabase();
  });

  beforeEach(async () => {
    await clearTestDatabase();
    mockGetAllBooks = mock(() => []);
  });

  test("returns timestamp after successful sync", async () => {
    // Arrange
    mockGetAllBooks = mock(() => [mockCalibreBook]);
    mockGetBookTags = mock(() => []);

    const beforeSync = getLastSyncTime();

    // Act
    await syncCalibreLibrary();

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
    await setupTestDatabase();
  });

  afterAll(async () => {
    await teardownTestDatabase();
  });

  beforeEach(async () => {
    await clearTestDatabase();
    mockGetAllBooks = mock(() => []);
  });

  test("returns false when no sync is running", () => {
    expect(isSyncInProgress()).toBe(false);
  });

  test("returns false after sync completes", async () => {
    // Arrange
    mockGetAllBooks = mock(() => [mockCalibreBook]);
    mockGetBookTags = mock(() => []);

    // Act
    await syncCalibreLibrary();

    // Assert - Should be false after sync
    expect(isSyncInProgress()).toBe(false);
  });
});
