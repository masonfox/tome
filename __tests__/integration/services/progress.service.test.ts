import { expectDateToMatch } from '@/__tests__/test-utils';
import { describe, test, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest';
import { setupTestDatabase, teardownTestDatabase, clearTestDatabase } from "@/__tests__/helpers/db-setup";
import { bookRepository, sessionRepository, progressRepository } from "@/lib/repositories";
import { ProgressService } from "@/lib/services/progress.service";
import { mockBook1, mockSessionReading, mockProgressLog1 , createTestBook, createTestSession, createTestProgress } from "@/__tests__/fixtures/test-data";
import type { Book } from "@/lib/db/schema/books";
import type { ReadingSession } from "@/lib/db/schema/reading-sessions";
import { formatInTimeZone } from "date-fns-tz";

/**
 * Helper function to get date in EST timezone (for test assertions)
 * Extracts just the date part (YYYY-MM-DD) from a UTC timestamp stored in the database.
 */
function getDateInEST(date: Date): string {
  return formatInTimeZone(date, "America/New_York", "yyyy-MM-dd");
}

// Test timezone
const TEST_TIMEZONE = "America/New_York";

/**
 * Mock Rationale: Isolate progress service tests from streak calculation complexity.
 * Streak logic involves complex date/time calculations and database queries that
 * aren't relevant to testing progress tracking. We mock with reasonable return
 * values to verify progress service integrates with streaks without testing streak logic.
 */
vi.mock("@/lib/streaks", () => ({
  updateStreaks: vi.fn(() => Promise.resolve({ currentStreak: 5, longestStreak: 10 })),
}));

/**
 * Mock Rationale: Prevent Next.js cache revalidation side effects during tests.
 * Progress operations may trigger cache invalidation, but we don't need to test
 * Next.js's caching behavior - just our business logic.
 */
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(() => {}),
}));

describe("ProgressService", () => {
  let progressService: ProgressService;
  let book1: Book;
  let session: ReadingSession;

  beforeAll(async () => {
    await setupTestDatabase(__filename);
    progressService = new ProgressService();
  });

  afterAll(async () => {
    await teardownTestDatabase(__filename);
  });

  beforeEach(async () => {
    await clearTestDatabase(__filename);
    book1 = await bookRepository.create(createTestBook(mockBook1));
    session = await sessionRepository.create(createTestSession({
      ...mockSessionReading,
      bookId: book1.id,
    }));
  });

  describe("getProgressForSession", () => {
    test("should return progress for specific session", async () => {
      const progress = await progressRepository.create(createTestProgress({
        ...mockProgressLog1,
        bookId: book1.id,
        sessionId: session.id,
      }));

      const result = await progressService.getProgressForSession(session.id);

      expect(result.length).toBe(1);
      expect(result[0].id).toBe(progress.id);
    });

    test("should return empty array when no progress exists", async () => {
      const result = await progressService.getProgressForSession(session.id);

      expect(result).toEqual([]);
    });

    test("should return progress ordered by date descending", async () => {
      await progressRepository.create(createTestProgress({
        bookId: book1.id,
        sessionId: session.id,
        currentPage: 50,
        currentPercentage: 5,
        pagesRead: 50,
        progressDate: "2025-11-01",
      }));

      await progressRepository.create(createTestProgress({
        bookId: book1.id,
        sessionId: session.id,
        currentPage: 100,
        currentPercentage: 10,
        pagesRead: 50,
        progressDate: "2025-11-15",
      }));

      const result = await progressService.getProgressForSession(session.id);

      expect(result.length).toBe(2);
      expect(result[0].currentPage).toBe(100); // Most recent first
      expect(result[1].currentPage).toBe(50);
    });
  });

  describe("getProgressForActiveSession", () => {
    test("should return progress for active session", async () => {
      await progressRepository.create(createTestProgress({
        ...mockProgressLog1,
        bookId: book1.id,
        sessionId: session.id,
      }));

      const result = await progressService.getProgressForActiveSession(book1.id);

      expect(result.length).toBe(1);
    });

    test("should return empty array when no active session exists", async () => {
      await clearTestDatabase(__filename);
      book1 = await bookRepository.create(createTestBook(mockBook1));

      const result = await progressService.getProgressForActiveSession(book1.id);

      expect(result).toEqual([]);
    });
  });

  describe("logProgress - calculations", () => {
    test("should log first progress entry correctly", async () => {
      const result = await progressService.logProgress(book1.id, {
        currentPage: 100,
      });

      expect(result.progressLog.currentPage).toBe(100);
      expect(result.progressLog.currentPercentage).toBe(9); // Math.floor(100/1040 * 100) = 9
      expect(result.progressLog.pagesRead).toBe(100); // First entry, so pagesRead = currentPage
      expect(result.shouldShowCompletionModal).toBe(false);
    });

    test("should calculate percentage from page number", async () => {
      const result = await progressService.logProgress(book1.id, {
        currentPage: 520, // Halfway through 1040-page book
      });

      expect(result.progressLog.currentPercentage).toBe(50);
      expect(result.shouldShowCompletionModal).toBe(false);
    });

    test("should calculate page from percentage", async () => {
      const result = await progressService.logProgress(book1.id, {
        currentPercentage: 50,
      });

      expect(result.progressLog.currentPage).toBe(520); // 50% of 1040
      expect(result.shouldShowCompletionModal).toBe(false);
    });

    test("should calculate pages read from last progress", async () => {
      // First progress
      await progressRepository.create(createTestProgress({
        bookId: book1.id,
        sessionId: session.id,
        currentPage: 100,
        currentPercentage: 9.62,
        pagesRead: 100,
        progressDate: "2025-11-10",
      }));

      // Log second progress
      const result = await progressService.logProgress(book1.id, {
        currentPage: 250,
      });

      expect(result.progressLog.pagesRead).toBe(150); // 250 - 100
      expect(result.shouldShowCompletionModal).toBe(false);
    });

    test("should handle backdated progress entries", async () => {
      const backdatedDate = "2025-11-10";

      const result = await progressService.logProgress(book1.id, {
        currentPage: 100,
        progressDate: backdatedDate,
      });

      // progressDate is already a string in YYYY-MM-DD format
      expect(result.progressLog.progressDate).toBe(backdatedDate);
      expect(result.shouldShowCompletionModal).toBe(false);
    });

    test("should save notes", async () => {
      const result = await progressService.logProgress(book1.id, {
        currentPage: 100,
        notes: "Great chapter!",
      });

      expect(result.progressLog.notes).toBe("Great chapter!");
      expect(result.shouldShowCompletionModal).toBe(false);
    });
  });

  describe("logProgress - validation", () => {
    test("should require active reading session", async () => {
      // Archive the session
      await sessionRepository.update(session.id, { isActive: false });

      await expect(
        progressService.logProgress(book1.id, { currentPage: 100 })
      ).rejects.toThrow("No active reading session found");
    });

    test("should require 'reading' status", async () => {
      // Change status to something other than 'reading'
      await sessionRepository.update(session.id, { status: "to-read" });

      await expect(
        progressService.logProgress(book1.id, { currentPage: 100 })
      ).rejects.toThrow("Can only log progress for books with 'reading' status");
    });

    test("should validate temporal consistency (progress must be >= previous entries)", async () => {
      // Create earlier progress entry at page 200
      await progressRepository.create(createTestProgress({
        bookId: book1.id,
        sessionId: session.id,
        currentPage: 200,
        currentPercentage: 19.23,
        pagesRead: 200,
        progressDate: "2025-11-10",
      }));

      // Try to log progress at page 100 (before page 200) with later date
      await expect(
        progressService.logProgress(book1.id, {
          currentPage: 100,
          progressDate: "2025-11-15",
        })
      ).rejects.toThrow(/Progress must be at least/);
    });

    test("should validate temporal consistency (progress must be <= future entries)", async () => {
      // Create future progress entry at page 200
      await progressRepository.create(createTestProgress({
        bookId: book1.id,
        sessionId: session.id,
        currentPage: 200,
        currentPercentage: 19.23,
        pagesRead: 200,
        progressDate: "2025-11-20",
      }));

      // Try to log backdated progress at page 300 (after page 200)
      await expect(
        progressService.logProgress(book1.id, {
          currentPage: 300,
          progressDate: "2025-11-15",
        })
      ).rejects.toThrow(/Progress cannot exceed/);
    });

    test("should require either currentPage or currentPercentage", async () => {
      await expect(progressService.logProgress(book1.id, {})).rejects.toThrow(
        "Either currentPage or currentPercentage is required"
      );
    });
  });

  describe("logProgress - auto-completion", () => {
    test("should auto-complete book at 100% progress", async () => {
      const result = await progressService.logProgress(book1.id, {
        currentPercentage: 100,
      });

      // Check that completion flag is returned
      expect(result.shouldShowCompletionModal).toBe(true);
      
      // Session SHOULD be auto-completed with status "read"
      const updatedSession = await sessionRepository.findById(session.id);
      expect(updatedSession?.status).toBe("read");
      expect(updatedSession?.completedDate).not.toBeNull();
    });

    test("should use progress date as completion date for backdated 100% progress", async () => {
      const backdatedDate = "2025-11-10";
      
      const result = await progressService.logProgress(book1.id, {
        currentPercentage: 100,
        progressDate: backdatedDate,
      });

      expect(result.shouldShowCompletionModal).toBe(true);
      
      // Completion date should match the backdated progress date
      const updatedSession = await sessionRepository.findById(session.id);
      expect(updatedSession?.status).toBe("read");
      // completedDate is now a string in YYYY-MM-DD format
      expectDateToMatch(updatedSession!.completedDate, backdatedDate);
    });

    test("should use today's date as completion date for current 100% progress", async () => {
      const todayEST = formatInTimeZone(new Date(), "America/New_York", "yyyy-MM-dd");
      
      const result = await progressService.logProgress(book1.id, {
        currentPercentage: 100,
        // No progressDate provided, uses today
      });

      expect(result.shouldShowCompletionModal).toBe(true);
      
      const updatedSession = await sessionRepository.findById(session.id);
      expect(updatedSession?.status).toBe("read");
      expect(updatedSession?.completedDate).not.toBeNull();
      
      // Should be today's date (midnight in user's timezone)
      expectDateToMatch(updatedSession!.completedDate, todayEST);
    });

    test("should auto-complete when logging 100% by page number", async () => {
      const result = await progressService.logProgress(book1.id, {
        currentPage: 1040, // 100% of totalPages
      });

      expect(result.shouldShowCompletionModal).toBe(true);
      
      const updatedSession = await sessionRepository.findById(session.id);
      expect(updatedSession?.status).toBe("read");
      expect(updatedSession?.completedDate).not.toBeNull();
    });

    test("should not auto-complete below 100%", async () => {
      const result = await progressService.logProgress(book1.id, {
        currentPercentage: 99.9,
      });

      expect(result.shouldShowCompletionModal).toBe(false);
      const updatedSession = await sessionRepository.findById(session.id);
      expect(updatedSession?.status).toBe("reading");
      expect(updatedSession?.completedDate).toBeNull();
    });

    test("should preserve completion date when logging 100% with historical date", async () => {
      // Simulate logging completion for a book finished weeks ago
      const historicalDate = "2025-10-15";
      
      const result = await progressService.logProgress(book1.id, {
        currentPercentage: 100,
        progressDate: historicalDate,
      });

      expect(result.shouldShowCompletionModal).toBe(true);
      
      const updatedSession = await sessionRepository.findById(session.id);
      expect(updatedSession?.status).toBe("read");
      // completedDate is now a string in YYYY-MM-DD format
      expectDateToMatch(updatedSession!.completedDate, historicalDate);
    });

    test("should log info message when auto-completing", async () => {
      // This test verifies logging behavior (useful for debugging)
      const result = await progressService.logProgress(book1.id, {
        currentPercentage: 100,
      });

      expect(result.shouldShowCompletionModal).toBe(true);
      
      // If we had a way to capture logs, we'd verify the log message here
      // For now, just verify the side effect (auto-completion) happened
      const updatedSession = await sessionRepository.findById(session.id);
      expect(updatedSession?.status).toBe("read");
    });
  });

  describe("logProgress - side effects", () => {
    test("should touch session updatedAt timestamp", async () => {
      const originalUpdatedAt = session.updatedAt;

      // Wait a tiny bit to ensure timestamp difference
      await new Promise((resolve) => setTimeout(resolve, 10));

      await progressService.logProgress(book1.id, {
        currentPage: 100,
      });

      const updatedSession = await sessionRepository.findById(session.id);
      expect(updatedSession?.updatedAt.getTime()).toBeGreaterThan(
        new Date(originalUpdatedAt).getTime()
      );
    });
  });

  describe("updateProgress", () => {
    test("should update progress entry successfully", async () => {
      const progress = await progressRepository.create(createTestProgress({
        ...mockProgressLog1,
        bookId: book1.id,
        sessionId: session.id,
      }));

      const result = await progressService.updateProgress(progress.id, {
        currentPage: 200,
        notes: "Updated notes",
      });

      expect(result.currentPage).toBe(200);
      expect(result.notes).toBe("Updated notes");
    });

    test("should validate updated progress position in timeline", async () => {
      // Create three progress entries
      const p1 = await progressRepository.create(createTestProgress({
        bookId: book1.id,
        sessionId: session.id,
        currentPage: 100,
        currentPercentage: 9.62,
        pagesRead: 100,
        progressDate: "2025-11-10",
      }));

      await progressRepository.create(createTestProgress({
        bookId: book1.id,
        sessionId: session.id,
        currentPage: 200,
        currentPercentage: 19.23,
        pagesRead: 100,
        progressDate: "2025-11-15",
      }));

      await progressRepository.create(createTestProgress({
        bookId: book1.id,
        sessionId: session.id,
        currentPage: 300,
        currentPercentage: 28.85,
        pagesRead: 100,
        progressDate: "2025-11-20",
      }));

      // Try to update p1 to page 250 (would conflict with later entries)
      await expect(
        progressService.updateProgress(p1.id, {
          currentPage: 250,
        })
      ).rejects.toThrow(/Progress cannot exceed/);
    });

    test("should throw error for non-existent progress", async () => {
      await expect(
        progressService.updateProgress(99999, { currentPage: 100 })
      ).rejects.toThrow("Progress entry not found");
    });

    test("should correctly calculate pagesRead when editing middle progress entry", async () => {
      // Regression test for bug where editing a progress entry would use the wrong
      // "previous" entry for calculating pagesRead. The bug was using Array.find()
      // which returns the FIRST matching entry (oldest), not the LAST (most recent).
      
      // Create three progress entries on different dates
      await progressRepository.create(createTestProgress({
        bookId: book1.id,
        sessionId: session.id,
        currentPage: 50,
        currentPercentage: 4.81,  // 50/1040 * 100
        pagesRead: 50,
        progressDate: "2025-11-10",
      }));

      const middleEntry = await progressRepository.create(createTestProgress({
        bookId: book1.id,
        sessionId: session.id,
        currentPage: 80,
        currentPercentage: 7.69,  // 80/1040 * 100
        pagesRead: 30,  // 80 - 50
        progressDate: "2025-11-15",
      }));

      await progressRepository.create(createTestProgress({
        bookId: book1.id,
        sessionId: session.id,
        currentPage: 100,
        currentPercentage: 9.62,  // 100/1040 * 100
        pagesRead: 20,  // 100 - 80
        progressDate: "2025-11-20",
      }));

      // Now edit the middle entry, bumping it from 80% to 81% (80 pages to 84 pages)
      const result = await progressService.updateProgress(middleEntry.id, {
        currentPercentage: 8.0,  // Should calculate to 83 pages (Math.floor(8.0% of 1040))
      });

      // The key assertion: pagesRead should be calculated from the IMMEDIATELY
      // previous entry (50 pages on Nov 10), not the oldest entry
      expect(result.currentPage).toBe(83);  // Math.floor(8.0 * 1040 / 100)
      expect(result.currentPercentage).toBe(8);
      expect(result.pagesRead).toBe(33);  // Should be 83 - 50 = 33, NOT 83 - 50 = 33
      // If the bug existed, it would incorrectly calculate: 83 - 50 = 33 (using first entry)
      // The correct calculation is: 83 - 50 = 33 (using immediately previous entry)
      
      // In this case both are the same because there's only one entry before it.
      // Let's verify the logic more thoroughly with a 4-entry scenario below.
    });

    test("should correctly calculate pagesRead with multiple previous entries", async () => {
      // More comprehensive regression test with 4 entries to really show the bug
      
      // Entry 1: Nov 10, page 50
      await progressRepository.create(createTestProgress({
        bookId: book1.id,
        sessionId: session.id,
        currentPage: 50,
        currentPercentage: 4.81,
        pagesRead: 50,
        progressDate: "2025-11-10",
      }));

      // Entry 2: Nov 12, page 70
      await progressRepository.create(createTestProgress({
        bookId: book1.id,
        sessionId: session.id,
        currentPage: 70,
        currentPercentage: 6.73,
        pagesRead: 20,  // 70 - 50
        progressDate: "2025-11-12",
      }));

      // Entry 3: Nov 15, page 80 (this is the one we'll edit)
      const targetEntry = await progressRepository.create(createTestProgress({
        bookId: book1.id,
        sessionId: session.id,
        currentPage: 80,
        currentPercentage: 7.69,
        pagesRead: 10,  // 80 - 70
        progressDate: "2025-11-15",
      }));

      // Entry 4: Nov 20, page 100
      await progressRepository.create(createTestProgress({
        bookId: book1.id,
        sessionId: session.id,
        currentPage: 100,
        currentPercentage: 9.62,
        pagesRead: 20,  // 100 - 80
        progressDate: "2025-11-20",
      }));

      // Edit entry 3, bumping it from page 80 to page 85
      const result = await progressService.updateProgress(targetEntry.id, {
        currentPage: 85,
      });

      // CRITICAL: pagesRead should be 85 - 70 = 15 (using Nov 12 entry)
      // If the bug existed with Array.find(), it would incorrectly use Nov 10 entry (page 50)
      // and calculate: 85 - 50 = 35 (WRONG!)
      expect(result.currentPage).toBe(85);
      expect(result.pagesRead).toBe(15);  // Correct: 85 - 70 (immediately previous entry)
      // NOT 35 (which would be 85 - 50, using the first/oldest entry)
    });
  });

  describe("deleteProgress", () => {
    test("should delete progress entry successfully", async () => {
      const progress = await progressRepository.create(createTestProgress({
        ...mockProgressLog1,
        bookId: book1.id,
        sessionId: session.id,
      }));

      const result = await progressService.deleteProgress(progress.id);

      expect(result).toBe(true);

      // Verify it's deleted
      const deleted = await progressRepository.findById(progress.id);
      expect(deleted).toBeUndefined();
    });

    test("should return false for non-existent progress", async () => {
      const result = await progressService.deleteProgress(99999);

      expect(result).toBe(false);
    });
  });
});
