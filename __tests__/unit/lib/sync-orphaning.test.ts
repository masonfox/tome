import { describe, test, expect, beforeAll, afterAll, beforeEach, mock } from "bun:test";
import { syncCalibreLibrary } from "@/lib/sync-service";
import { bookRepository } from "@/lib/repositories";
import { setupTestDatabase, teardownTestDatabase, clearTestDatabase } from "@/__tests__/helpers/db-setup";

/**
 * Sync Service Orphaning Edge Cases Tests
 * 
 * These tests cover critical edge cases that caused the mass orphaning bug:
 * 1. Empty Calibre results (connection failure, DB locked, etc.)
 * 2. Mass orphaning threshold (>10% of library)
 * 3. findNotInCalibreIds with empty array
 */

// Mock Calibre DB functions
let mockGetAllBooks: any;
let mockGetBookTags: any;

// Set up module mocks - preserve actual module to avoid collision with calibre.test.ts
// The key difference: we spread ...actual to preserve getCalibreDB and other functions
mock.module("@/lib/db/calibre", () => {
  const actual = require("@/lib/db/calibre");
  return {
    ...actual,
    getAllBooks: () => mockGetAllBooks(),
    getBookTags: (id: number) => mockGetBookTags(id),
  };
});

describe("Sync Service - Orphaning Safety Checks", () => {
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

  test("CRITICAL: Empty Calibre results abort sync and prevent orphaning", async () => {
    // Arrange - Create books in DB
    await bookRepository.create({
      calibreId: 1,
      title: "Book 1",
      authors: ["Author 1"],
      tags: [],
      path: "Author1/Book1",
    } as any);

    await bookRepository.create({
      calibreId: 2,
      title: "Book 2",
      authors: ["Author 2"],
      tags: [],
      path: "Author2/Book2",
    } as any);

    // Mock Calibre returning empty array (simulating DB connection failure)
    mockGetAllBooks = mock(() => []);

    // Act
    const result = await syncCalibreLibrary();

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
      await bookRepository.create({
        calibreId: i,
        title: `Book ${i}`,
        authors: [`Author ${i}`],
        tags: [],
        path: `Author${i}/Book${i}`,
      } as any);
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
    
    mockGetAllBooks = mock(() => calibreBooks);
    mockGetBookTags = mock(() => []);

    // Act
    const result = await syncCalibreLibrary();

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
      await bookRepository.create({
        calibreId: i,
        title: `Book ${i}`,
        authors: [`Author ${i}`],
        tags: [],
        path: `Author${i}/Book${i}`,
      } as any);
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
    
    mockGetAllBooks = mock(() => calibreBooks);
    mockGetBookTags = mock(() => []);

    // Act
    const result = await syncCalibreLibrary();

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
    await bookRepository.create({
      calibreId: 1,
      title: "Book 1",
      authors: ["Author 1"],
      tags: [],
      path: "Author1/Book1",
    } as any);

    await bookRepository.create({
      calibreId: 2,
      title: "Book 2",
      authors: ["Author 2"],
      tags: [],
      path: "Author2/Book2",
    } as any);

    // Act - Call with empty array
    const result = await bookRepository.findNotInCalibreIds([]);

    // Assert - Should return empty array (not ALL books)
    expect(result).toEqual([]);
    expect(result.length).toBe(0);
  });

  test("findNotInCalibreIds correctly identifies missing books", async () => {
    // Arrange - Create 5 books
    for (let i = 1; i <= 5; i++) {
      await bookRepository.create({
        calibreId: i,
        title: `Book ${i}`,
        authors: [`Author ${i}`],
        tags: [],
        path: `Author${i}/Book${i}`,
      } as any);
    }

    // Act - Call with calibreIds [1, 2, 3] (books 4 and 5 are missing)
    const result = await bookRepository.findNotInCalibreIds([1, 2, 3]);

    // Assert - Should return books 4 and 5
    expect(result.length).toBe(2);
    expect(result.map(b => b.calibreId).sort()).toEqual([4, 5]);
  });

  test("findNotInCalibreIds ignores already orphaned books", async () => {
    // Arrange - Create books, one already orphaned
    await bookRepository.create({
      calibreId: 1,
      title: "Active Book",
      authors: ["Author 1"],
      tags: [],
      path: "Author1/Book1",
      orphaned: false,
    } as any);

    await bookRepository.create({
      calibreId: 2,
      title: "Already Orphaned Book",
      authors: ["Author 2"],
      tags: [],
      path: "Author2/Book2",
      orphaned: true,
      orphanedAt: new Date("2025-11-01"),
    } as any);

    // Act - Call with empty calibreIds (only book 1 is active)
    const result = await bookRepository.findNotInCalibreIds([]);

    // Assert - Should return empty (book 2 is already orphaned)
    expect(result).toEqual([]);
  });
});
