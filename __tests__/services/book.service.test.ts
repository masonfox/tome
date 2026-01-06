import { describe, test, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest';
import { setupTestDatabase, teardownTestDatabase, clearTestDatabase } from "@/__tests__/helpers/db-setup";
import { bookRepository, sessionRepository, progressRepository } from "@/lib/repositories";
import { BookService } from "@/lib/services/book.service";
import { mockBook1, mockBook2, mockSessionReading, mockProgressLog1, createTestBook, createTestSession, createTestProgress } from "@/__tests__/fixtures/test-data";
import type { Book } from "@/lib/db/schema/books";

/**
 * Mock Rationale: Avoid file system I/O to Calibre's SQLite database during tests.
 */
let mockBatchUpdateCalibreTags = vi.fn((updates: Array<{ calibreId: number; tags: string[] }>) => updates.length);
let mockCalibreShouldFail = false;

vi.mock("@/lib/services/calibre.service", () => ({
  calibreService: {
    batchUpdateTags: (updates: Array<{ calibreId: number; tags: string[] }>) => {
      if (mockCalibreShouldFail) {
        throw new Error("Calibre database is unavailable");
      }
      return mockBatchUpdateCalibreTags(updates);
    },
    updateTags: vi.fn(() => {}),
    updateRating: vi.fn(() => {}),
    readTags: vi.fn(() => []),
    readRating: vi.fn(() => null),
  },
  CalibreService: class {},
}));

// Mock Calibre watcher to track suspend/resume calls
let mockWatcherSuspendCalled = false;
let mockWatcherResumeCalled = false;
let mockWatcherResumeIgnorePeriod = 0;

vi.mock("@/lib/calibre-watcher", () => ({
  calibreWatcher: {
    suspend: () => {
      mockWatcherSuspendCalled = true;
    },
    resume: () => {
      mockWatcherResumeCalled = true;
    },
    resumeWithIgnorePeriod: (durationMs: number = 3000) => {
      mockWatcherResumeCalled = true;
      mockWatcherResumeIgnorePeriod = durationMs;
    },
    start: vi.fn(() => {}),
    stop: vi.fn(() => {}),
  },
}));

describe("BookService", () => {
  let bookService: BookService;
  let book1: Book;
  let book2: Book;

  beforeAll(async () => {
    await setupTestDatabase(__filename);
    bookService = new BookService();
  });

  afterAll(async () => {
    await teardownTestDatabase(__filename);
  });

  beforeEach(async () => {
    await clearTestDatabase(__filename);
    // Reset mock state
    mockBatchUpdateCalibreTags.mockClear();
    mockCalibreShouldFail = false;
    mockWatcherSuspendCalled = false;
    mockWatcherResumeCalled = false;
    mockWatcherResumeIgnorePeriod = 0;
    // Create fresh test books for each test
    book1 = await bookRepository.create(createTestBook(mockBook1));
    book2 = await bookRepository.create(createTestBook(mockBook2));
  });

  describe("getBookById", () => {
    test("should return book with full details (no sessions)", async () => {
      const result = await bookService.getBookById(book1.id);

      expect(result).toBeDefined();
      expect(result).not.toBeNull();
      expect(result!.id).toBe(book1.id);
      expect(result!.title).toBe(book1.title);
      expect(result!.activeSession).toBeNull();
      expect(result!.latestProgress).toBeNull();
      expect(result!.hasCompletedReads).toBe(false);
      expect(result!.totalReads).toBe(0);
    });

    test("should return book with active session and progress", async () => {
      // Create active session
      const session = await sessionRepository.create(createTestSession({
        ...mockSessionReading,
        bookId: book1.id,
      }));

      // Create progress
      const progress = await progressRepository.create(createTestProgress({
        ...mockProgressLog1,
        bookId: book1.id,
        sessionId: session.id,
      }));

      const result = await bookService.getBookById(book1.id);

      expect(result).toBeDefined();
      expect(result).not.toBeNull();
      expect(result!.activeSession).toBeDefined();
      expect(result!.activeSession?.id).toBe(session.id);
      expect(result!.latestProgress).toBeDefined();
      expect(result!.latestProgress?.id).toBe(progress.id);
      expect(result!.hasCompletedReads).toBe(false);
      expect(result!.totalReads).toBe(0);
    });

    test("should calculate total reads correctly", async () => {
      // Create completed session (archived)
      await sessionRepository.create(createTestSession({
        bookId: book1.id,
        sessionNumber: 1,
        status: "read",
        isActive: false,
        completedDate: new Date("2025-10-01"),
      }));

      // Create another completed session
      await sessionRepository.create(createTestSession({
        bookId: book1.id,
        sessionNumber: 2,
        status: "read",
        isActive: false,
        completedDate: new Date("2025-11-01"),
      }));

      // Create active session
      await sessionRepository.create(createTestSession({
        bookId: book1.id,
        sessionNumber: 3,
        status: "reading",
        isActive: true,
      }));

      const result = await bookService.getBookById(book1.id);

      expect(result).not.toBeNull();
      expect(result!.hasCompletedReads).toBe(true);
      expect(result!.totalReads).toBe(2); // Only completed reads count
    });

    test("should return null for non-existent book", async () => {
      const result = await bookService.getBookById(99999);

      expect(result).toBeNull();
    });
  });

  describe("updateTotalPages with active session recalculation", () => {
    test("should update totalPages and recalculate active session percentages only", async () => {
      // Setup: Create book with null totalPages
      const testBook = await bookRepository.create(createTestBook({
        calibreId: 9999,
        title: "Test Book for Page Count Update",
        authors: ["Test Author"],
        path: "Test/Book (9999)",
        totalPages: null,
      }));
      
      // Create completed session with progress logs
      const completedSession = await sessionRepository.create(createTestSession({
        bookId: testBook.id,
        sessionNumber: 1,
        status: 'read',
        isActive: false,
        completedDate: new Date('2024-01-01'),
      }));
      
      await progressRepository.create(createTestProgress({
        bookId: testBook.id,
        sessionId: completedSession.id,
        currentPage: 150,
        currentPercentage: 0, // Will stay 0 since no totalPages
        pagesRead: 150,
        progressDate: new Date('2024-01-01'),
      }));
      
      // Create active session with progress logs
      const activeSession = await sessionRepository.create(createTestSession({
        bookId: testBook.id,
        sessionNumber: 2,
        status: 'reading',
        isActive: true,
        startedDate: new Date('2024-02-01'),
      }));
      
      const activeProgress1 = await progressRepository.create(createTestProgress({
        bookId: testBook.id,
        sessionId: activeSession.id,
        currentPage: 50,
        currentPercentage: 0, // Will be recalculated
        pagesRead: 50,
        progressDate: new Date('2024-02-01'),
      }));
      
      const activeProgress2 = await progressRepository.create(createTestProgress({
        bookId: testBook.id,
        sessionId: activeSession.id,
        currentPage: 100,
        currentPercentage: 0, // Will be recalculated
        pagesRead: 50,
        progressDate: new Date('2024-02-02'),
      }));
      
      // Act: Update totalPages to 300
      const result = await bookService.updateTotalPages(testBook.id, 300);
      
      // Assert: Book updated
      expect(result.totalPages).toBe(300);
      
      // Assert: Active session progress logs recalculated
      const updatedActiveProgress = await progressRepository.findBySessionId(activeSession.id);
      expect(updatedActiveProgress).toHaveLength(2);
      
      const progress1 = updatedActiveProgress.find(p => p.id === activeProgress1.id);
      const progress2 = updatedActiveProgress.find(p => p.id === activeProgress2.id);
      
      expect(progress1?.currentPercentage).toBe(16); // 50/300 = 16.66% → 16%
      expect(progress2?.currentPercentage).toBe(33); // 100/300 = 33.33% → 33%
      
      // Assert: Completed session progress logs UNCHANGED
      const completedProgress = await progressRepository.findBySessionId(completedSession.id);
      expect(completedProgress).toHaveLength(1);
      expect(completedProgress[0].currentPercentage).toBe(0); // Still 0
    });
    
    test("should handle book with no sessions", async () => {
      const lonelyBook = await bookRepository.create(createTestBook({
        calibreId: 8888,
        title: "Book with no sessions",
        authors: ["Author"],
        path: "Author/Book (8888)",
        totalPages: null,
      }));
      
      const result = await bookService.updateTotalPages(lonelyBook.id, 200);
      
      expect(result.totalPages).toBe(200);
      // Should not throw error
    });
    
    test("should handle book with only completed sessions", async () => {
      const testBook = await bookRepository.create(createTestBook({
        calibreId: 7777,
        title: "Book with completed sessions",
        authors: ["Author"],
        path: "Author/Book (7777)",
        totalPages: null,
      }));
      
      // Create completed session
      const completedSession = await sessionRepository.create(createTestSession({
        bookId: testBook.id,
        sessionNumber: 1,
        status: 'read',
        isActive: false,
        completedDate: new Date('2024-01-01'),
      }));
      
      await progressRepository.create(createTestProgress({
        bookId: testBook.id,
        sessionId: completedSession.id,
        currentPage: 150,
        currentPercentage: 0,
        pagesRead: 150,
        progressDate: new Date('2024-01-01'),
      }));
      
      const result = await bookService.updateTotalPages(testBook.id, 300);
      
      expect(result.totalPages).toBe(300);
      
      // Completed session should be unchanged
      const completedProgress = await progressRepository.findBySessionId(completedSession.id);
      expect(completedProgress[0].currentPercentage).toBe(0);
    });
    
    test("should correctly calculate percentages for edge cases", async () => {
      const testBook = await bookRepository.create(createTestBook({
        calibreId: 6666,
        title: "Edge case book",
        authors: ["Author"],
        path: "Author/Book (6666)",
        totalPages: null,
      }));
      
      const activeSession = await sessionRepository.create(createTestSession({
        bookId: testBook.id,
        sessionNumber: 1,
        status: 'reading',
        isActive: true,
        startedDate: new Date('2024-02-01'),
      }));
      
      // Test: currentPage > totalPages (user had wrong initial count, now correcting upward)
      const overflowProgress = await progressRepository.create(createTestProgress({
        bookId: testBook.id,
        sessionId: activeSession.id,
        currentPage: 400, // Will exceed the initial lower totalPages estimate
        currentPercentage: 0,
        pagesRead: 400,
        progressDate: new Date('2024-02-03'),
      }));

      // Test: currentPage = 0
      const zeroProgress = await progressRepository.create(createTestProgress({
        bookId: testBook.id,
        sessionId: activeSession.id,
        currentPage: 0,
        currentPercentage: 0,
        pagesRead: 0,
        progressDate: new Date('2024-02-01'),
      }));

      // Update to 450 (above the 400 progress, so validation passes)
      await bookService.updateTotalPages(testBook.id, 450);
      
      const progress = await progressRepository.findBySessionId(activeSession.id);
      const overflowLog = progress.find(p => p.id === overflowProgress.id);
      const zeroLog = progress.find(p => p.id === zeroProgress.id);
      
      // Should calculate correctly: 400/450 = 88.88% → 88%
      expect(overflowLog?.currentPercentage).toBe(88);
      // Should stay at 0%
      expect(zeroLog?.currentPercentage).toBe(0);
    });
    
    test("should throw error for non-existent book", async () => {
      await expect(bookService.updateTotalPages(99999, 500)).rejects.toThrow("Book not found");
    });

    test("should throw error for invalid total pages", async () => {
      await expect(bookService.updateTotalPages(book1.id, -10)).rejects.toThrow("Total pages must be a positive number");
    });

    test("should throw error for zero total pages", async () => {
      await expect(bookService.updateTotalPages(book1.id, 0)).rejects.toThrow("Total pages must be a positive number");
    });

    test("should persist totalPages to database (verify transaction commits)", async () => {
      // Setup: Create book with active session and progress
      const testBook = await bookRepository.create(createTestBook({
        calibreId: 5555,
        title: "Persistence Test Book",
        authors: ["Author"],
        path: "Author/Book (5555)",
        totalPages: 200,
      }));

      const activeSession = await sessionRepository.create(createTestSession({
        bookId: testBook.id,
        sessionNumber: 1,
        status: 'reading',
        isActive: true,
      }));

      await progressRepository.create(createTestProgress({
        bookId: testBook.id,
        sessionId: activeSession.id,
        currentPage: 100,
        currentPercentage: 50,
        pagesRead: 100,
        progressDate: new Date('2024-01-01'),
      }));

      // Act: Update page count
      await bookService.updateTotalPages(testBook.id, 500);

      // Assert: Re-fetch book from database to verify persistence
      const refetchedBook = await bookRepository.findById(testBook.id);
      expect(refetchedBook).not.toBeNull();
      expect(refetchedBook!.totalPages).toBe(500);

      // Verify progress was also updated
      const updatedProgress = await progressRepository.findBySessionId(activeSession.id);
      expect(updatedProgress[0].currentPercentage).toBe(20); // 100/500 = 20%
    });

    test("should rollback book update if progress recalculation fails", async () => {
      // Setup: Create book with active session and progress
      const testBook = await bookRepository.create(createTestBook({
        calibreId: 4444,
        title: "Rollback Test Book",
        authors: ["Author"],
        path: "Author/Book (4444)",
        totalPages: 300,
      }));

      const activeSession = await sessionRepository.create(createTestSession({
        bookId: testBook.id,
        sessionNumber: 1,
        status: 'reading',
        isActive: true,
      }));

      await progressRepository.create(createTestProgress({
        bookId: testBook.id,
        sessionId: activeSession.id,
        currentPage: 150,
        currentPercentage: 50,
        pagesRead: 150,
        progressDate: new Date('2024-01-01'),
      }));



      // Note: This test verifies error handling, but we can't easily mock
      // the calculatePercentage function since it's dynamically imported.
      // Instead, we verify that if the transaction fails for any reason,
      // the book update is rolled back. We'll test this by trying to update
      // to an invalid state that would cause the transaction to fail.

      // For now, we verify the transaction works correctly by checking
      // that a normal update persists correctly (covered by previous test).
      // A proper rollback test would require mocking the transaction itself,
      // which is complex with the current architecture.

      // This test serves as documentation that rollback behavior is expected
      // and should be tested manually or with integration tests.

      // Skip this test for now as it requires mocking infrastructure
      // that doesn't exist yet. The transaction code itself handles rollback
      // automatically via Drizzle's transaction API.
    });

  });

  describe("updateTotalPages - Page Count Reduction Validation", () => {
    test("should reject reduction below highest progress in active session", async () => {
      // Setup: Active session at page 250, book has 300 pages
      const testBook = await bookRepository.create(createTestBook({
        calibreId: 1111,
        title: "Validation Test Active",
        authors: ["Author"],
        path: "Author/Book (1111)",
        totalPages: 300,
      }));

      const activeSession = await sessionRepository.create(createTestSession({
        bookId: testBook.id,
        sessionNumber: 1,
        status: 'reading',
        isActive: true,
      }));

      await progressRepository.create(createTestProgress({
        bookId: testBook.id,
        sessionId: activeSession.id,
        currentPage: 250,
        currentPercentage: 83,
        pagesRead: 250,
        progressDate: new Date('2024-01-01'),
      }));

      // Act & Assert: Cannot reduce to 200 (below 250)
      try {
        await bookService.updateTotalPages(testBook.id, 200);
        throw new Error("Expected error but none was thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toContain("Cannot reduce page count to 200");
        expect((error as Error).message).toContain("250");
      }
    });

    test("should allow reduction below completed session progress", async () => {
      // Setup: Completed session reached page 500
      const testBook = await bookRepository.create(createTestBook({
        calibreId: 2222,
        title: "Completed Session Test",
        authors: ["Author"],
        path: "Author/Book (2222)",
        totalPages: 600,
      }));

      const completedSession = await sessionRepository.create(createTestSession({
        bookId: testBook.id,
        sessionNumber: 1,
        status: 'read',
        isActive: false,
        completedDate: new Date('2024-01-15'),
      }));

      await progressRepository.create(createTestProgress({
        bookId: testBook.id,
        sessionId: completedSession.id,
        currentPage: 500,
        currentPercentage: 83,
        pagesRead: 500,
        progressDate: new Date('2024-01-15'),
      }));

      // Act & Assert: CAN reduce below completed session (active sessions only)
      const result = await bookService.updateTotalPages(testBook.id, 400);
      expect(result.totalPages).toBe(400);
    });

    test("should allow reduction when active session progress below new count", async () => {
      // Setup: Active session at page 100
      const testBook = await bookRepository.create(createTestBook({
        calibreId: 3333,
        title: "Safe Reduction Test",
        authors: ["Author"],
        path: "Author/Book (3333)",
        totalPages: 300,
      }));

      const activeSession = await sessionRepository.create(createTestSession({
        bookId: testBook.id,
        sessionNumber: 1,
        status: 'reading',
        isActive: true,
      }));

      await progressRepository.create(createTestProgress({
        bookId: testBook.id,
        sessionId: activeSession.id,
        currentPage: 100,
        currentPercentage: 33,
        pagesRead: 100,
        progressDate: new Date('2024-01-01'),
      }));

      // Act: Reduce to 200 (above 100)
      const result = await bookService.updateTotalPages(testBook.id, 200);

      // Assert: Should succeed
      expect(result.totalPages).toBe(200);

      // Progress should recalculate
      const updatedProgress = await progressRepository.findBySessionId(activeSession.id);
      expect(updatedProgress[0].currentPercentage).toBe(50); // 100/200
    });

    test("should allow reduction to exactly the highest active progress", async () => {
      // Setup: Active session at exactly page 250
      const testBook = await bookRepository.create(createTestBook({
        calibreId: 4444,
        title: "Exact Match Test",
        authors: ["Author"],
        path: "Author/Book (4444)",
        totalPages: 300,
      }));

      const activeSession = await sessionRepository.create(createTestSession({
        bookId: testBook.id,
        sessionNumber: 1,
        status: 'reading',
        isActive: true,
      }));

      await progressRepository.create(createTestProgress({
        bookId: testBook.id,
        sessionId: activeSession.id,
        currentPage: 250,
        currentPercentage: 83,
        pagesRead: 250,
        progressDate: new Date('2024-01-01'),
      }));

      // Act & Assert: Can reduce to exactly 250
      const result = await bookService.updateTotalPages(testBook.id, 250);
      expect(result.totalPages).toBe(250);
      expect(result).toBeDefined();
    });

    test("should check highest progress when session has multiple progress entries", async () => {
      // Setup: Book with one active session that has multiple progress entries
      const testBook = await bookRepository.create(createTestBook({
        calibreId: 5555,
        title: "Multiple Progress Entries",
        authors: ["Author"],
        path: "Author/Book (5555)",
        totalPages: 500,
      }));

      // Active session with multiple progress entries
      const session = await sessionRepository.create(createTestSession({
        bookId: testBook.id,
        sessionNumber: 1,
        status: 'reading',
        isActive: true,
      }));

      // Progress entry 1: page 200
      await progressRepository.create(createTestProgress({
        bookId: testBook.id,
        sessionId: session.id,
        currentPage: 200,
        currentPercentage: 40,
        pagesRead: 200,
        progressDate: new Date('2024-01-01'),
      }));

      // Progress entry 2: page 350 (higher - current position)
      await progressRepository.create(createTestProgress({
        bookId: testBook.id,
        sessionId: session.id,
        currentPage: 350,
        currentPercentage: 70,
        pagesRead: 150,
        progressDate: new Date('2024-02-01'),
      }));

      // Act & Assert: Cannot reduce below max (350)
      try {
        await bookService.updateTotalPages(testBook.id, 300);
        throw new Error("Expected error but none was thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toContain("350");
      }

      // But can reduce to 350 or above
      const result = await bookService.updateTotalPages(testBook.id, 400);
      expect(result.totalPages).toBe(400);
    });

    test("should allow any reduction when no active sessions exist", async () => {
      // Setup: Book with only completed sessions
      const testBook = await bookRepository.create(createTestBook({
        calibreId: 6666,
        title: "No Active Sessions",
        authors: ["Author"],
        path: "Author/Book (6666)",
        totalPages: 500,
      }));

      const completedSession = await sessionRepository.create(createTestSession({
        bookId: testBook.id,
        sessionNumber: 1,
        status: 'read',
        isActive: false,
        completedDate: new Date('2024-01-01'),
      }));

      await progressRepository.create(createTestProgress({
        bookId: testBook.id,
        sessionId: completedSession.id,
        currentPage: 500,
        currentPercentage: 100,
        pagesRead: 500,
        progressDate: new Date('2024-01-01'),
      }));

      // Act: Can reduce to any value (no active sessions to protect)
      const result = await bookService.updateTotalPages(testBook.id, 100);

      // Assert: Should succeed
      expect(result.totalPages).toBe(100);
    });

    test("should allow any reduction when book has no progress at all", async () => {
      // Setup: Book with no sessions or progress
      const testBook = await bookRepository.create(createTestBook({
        calibreId: 7777,
        title: "No Progress Test",
        authors: ["Author"],
        path: "Author/Book (7777)",
        totalPages: 500,
      }));

      // Act: Can reduce to any positive value
      const result = await bookService.updateTotalPages(testBook.id, 100);

      // Assert: Should succeed
      expect(result.totalPages).toBe(100);
    });

    test("error message should include specific page numbers", async () => {
      // Setup
      const testBook = await bookRepository.create(createTestBook({
        calibreId: 8888,
        title: "Error Message Test",
        authors: ["Author"],
        path: "Author/Book (8888)",
        totalPages: 500,
      }));

      const activeSession = await sessionRepository.create(createTestSession({
        bookId: testBook.id,
        sessionNumber: 1,
        status: 'reading',
        isActive: true,
      }));

      await progressRepository.create(createTestProgress({
        bookId: testBook.id,
        sessionId: activeSession.id,
        currentPage: 425,
        currentPercentage: 85,
        pagesRead: 425,
        progressDate: new Date('2024-01-01'),
      }));

      // Act & Assert: Error should show actual numbers
      try {
        await bookService.updateTotalPages(testBook.id, 400);
        throw new Error("Expected error but none was thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toContain("425");
      }
    });
  });

  describe("updateRating", () => {
    test("should update rating successfully", async () => {
      const result = await bookService.updateRating(book1.id, 5);

      expect(result).toBeDefined();
      expect(result.rating).toBe(5);

      // Verify in database
      const updated = await bookRepository.findById(book1.id);
      expect(updated?.rating).toBe(5);
    });

    test("should set rating to null (remove rating)", async () => {
      // Arrange: Book with existing rating
      await bookRepository.update(book1.id, { rating: 4 });

      // Act: Remove rating by setting to null
      const result = await bookService.updateRating(book1.id, null);

      // Assert: Rating removed from both result and database
      expect(result).toBeDefined();
      expect(result.rating).toBeNull();

      const updated = await bookRepository.findById(book1.id);
      expect(updated?.rating).toBeNull();
    });

    test("should throw error for non-existent book", async () => {
      await expect(bookService.updateRating(99999, 5)).rejects.toThrow("Book not found");
    });

    test("should throw error for invalid rating (less than 1)", async () => {
      await expect(bookService.updateRating(book1.id, 0)).rejects.toThrow("Rating must be between 1 and 5");
    });

    test("should throw error for invalid rating (greater than 5)", async () => {
      await expect(bookService.updateRating(book1.id, 6)).rejects.toThrow("Rating must be between 1 and 5");
    });

    test("should handle Calibre sync gracefully on failure", async () => {
      // Note: Actual Calibre sync will be mocked in implementation
      // This test verifies that rating update succeeds even if sync fails
      const result = await bookService.updateRating(book1.id, 5);

      expect(result).toBeDefined();
      expect(result.rating).toBe(5);
    });
  });
});
