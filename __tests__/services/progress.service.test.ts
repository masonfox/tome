import { describe, test, expect, beforeAll, beforeEach, afterAll, mock } from "bun:test";
import { setupTestDatabase, teardownTestDatabase, clearTestDatabase } from "@/__tests__/helpers/db-setup";
import { bookRepository, sessionRepository, progressRepository } from "@/lib/repositories";
import { ProgressService } from "@/lib/services/progress.service";
import { mockBook1, mockSessionReading, mockProgressLog1 , createTestBook, createTestSession, createTestProgress } from "@/__tests__/fixtures/test-data";
import type { Book } from "@/lib/db/schema/books";
import type { ReadingSession } from "@/lib/db/schema/reading-sessions";

/**
 * Mock Rationale: Isolate progress service tests from streak calculation complexity.
 * Streak logic involves complex date/time calculations and database queries that
 * aren't relevant to testing progress tracking. We mock with reasonable return
 * values to verify progress service integrates with streaks without testing streak logic.
 */
mock.module("@/lib/streaks", () => ({
  updateStreaks: mock(() => Promise.resolve({ currentStreak: 5, longestStreak: 10 })),
}));

/**
 * Mock Rationale: Prevent Next.js cache revalidation side effects during tests.
 * Progress operations may trigger cache invalidation, but we don't need to test
 * Next.js's caching behavior - just our business logic.
 */
mock.module("next/cache", () => ({
  revalidatePath: mock(() => {}),
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
        progressDate: new Date("2025-11-01"),
      }));

      await progressRepository.create(createTestProgress({
        bookId: book1.id,
        sessionId: session.id,
        currentPage: 100,
        currentPercentage: 10,
        pagesRead: 50,
        progressDate: new Date("2025-11-15"),
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
        progressDate: new Date("2025-11-10"),
      }));

      // Log second progress
      const result = await progressService.logProgress(book1.id, {
        currentPage: 250,
      });

      expect(result.progressLog.pagesRead).toBe(150); // 250 - 100
      expect(result.shouldShowCompletionModal).toBe(false);
    });

    test("should handle backdated progress entries", async () => {
      const backdatedDate = new Date("2025-11-10");

      const result = await progressService.logProgress(book1.id, {
        currentPage: 100,
        progressDate: backdatedDate,
      });

      expect(result.progressLog.progressDate).toEqual(backdatedDate);
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
        progressDate: new Date("2025-11-10"),
      }));

      // Try to log progress at page 100 (before page 200) with later date
      await expect(
        progressService.logProgress(book1.id, {
          currentPage: 100,
          progressDate: new Date("2025-11-15"),
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
        progressDate: new Date("2025-11-20"),
      }));

      // Try to log backdated progress at page 300 (after page 200)
      await expect(
        progressService.logProgress(book1.id, {
          currentPage: 300,
          progressDate: new Date("2025-11-15"),
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
    test("should return completion flag at 100% progress", async () => {
      const result = await progressService.logProgress(book1.id, {
        currentPercentage: 100,
      });

      // Check that completion flag is returned
      expect(result.shouldShowCompletionModal).toBe(true);
      
      // Session should NOT be auto-completed
      const updatedSession = await sessionRepository.findById(session.id);
      expect(updatedSession?.status).toBe("reading");
      expect(updatedSession?.completedDate).toBeNull();
    });

    test("should not return completion flag below 100%", async () => {
      const result = await progressService.logProgress(book1.id, {
        currentPercentage: 99.9,
      });

      expect(result.shouldShowCompletionModal).toBe(false);
      const updatedSession = await sessionRepository.findById(session.id);
      expect(updatedSession?.status).toBe("reading");
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
        progressDate: new Date("2025-11-10"),
      }));

      await progressRepository.create(createTestProgress({
        bookId: book1.id,
        sessionId: session.id,
        currentPage: 200,
        currentPercentage: 19.23,
        pagesRead: 100,
        progressDate: new Date("2025-11-15"),
      }));

      await progressRepository.create(createTestProgress({
        bookId: book1.id,
        sessionId: session.id,
        currentPage: 300,
        currentPercentage: 28.85,
        pagesRead: 100,
        progressDate: new Date("2025-11-20"),
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
