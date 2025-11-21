import { describe, test, expect, beforeAll, beforeEach, afterAll, mock } from "bun:test";
import { setupTestDatabase, teardownTestDatabase, clearTestDatabase } from "@/__tests__/helpers/db-setup";
import { bookRepository, sessionRepository, progressRepository } from "@/lib/repositories";
import { ProgressService } from "@/lib/services/progress.service";
import { mockBook1, mockSessionReading, mockProgressLog1 } from "@/__tests__/fixtures/test-data";
import type { Book } from "@/lib/db/schema/books";
import type { ReadingSession } from "@/lib/db/schema/reading-sessions";

// Mock the streak system
mock.module("@/lib/streaks", () => ({
  updateStreaks: mock(() => Promise.resolve({ currentStreak: 5, longestStreak: 10 })),
}));

// Mock cache revalidation
mock.module("next/cache", () => ({
  revalidatePath: mock(() => {}),
}));

describe("ProgressService", () => {
  let progressService: ProgressService;
  let book1: Book;
  let session: ReadingSession;

  beforeAll(async () => {
    await setupTestDatabase();
    progressService = new ProgressService();
  });

  afterAll(async () => {
    await teardownTestDatabase();
  });

  beforeEach(async () => {
    await clearTestDatabase();
    book1 = await bookRepository.create(mockBook1 as any);
    session = await sessionRepository.create({
      ...mockSessionReading,
      bookId: book1.id,
    } as any);
  });

  describe("getProgressForSession", () => {
    test("should return progress for specific session", async () => {
      const progress = await progressRepository.create({
        ...mockProgressLog1,
        bookId: book1.id,
        sessionId: session.id,
      } as any);

      const result = await progressService.getProgressForSession(session.id);

      expect(result.length).toBe(1);
      expect(result[0].id).toBe(progress.id);
    });

    test("should return empty array when no progress exists", async () => {
      const result = await progressService.getProgressForSession(session.id);

      expect(result).toEqual([]);
    });

    test("should return progress ordered by date descending", async () => {
      await progressRepository.create({
        bookId: book1.id,
        sessionId: session.id,
        currentPage: 50,
        currentPercentage: 5,
        pagesRead: 50,
        progressDate: new Date("2025-11-01"),
      } as any);

      await progressRepository.create({
        bookId: book1.id,
        sessionId: session.id,
        currentPage: 100,
        currentPercentage: 10,
        pagesRead: 50,
        progressDate: new Date("2025-11-15"),
      } as any);

      const result = await progressService.getProgressForSession(session.id);

      expect(result.length).toBe(2);
      expect(result[0].currentPage).toBe(100); // Most recent first
      expect(result[1].currentPage).toBe(50);
    });
  });

  describe("getProgressForActiveSession", () => {
    test("should return progress for active session", async () => {
      await progressRepository.create({
        ...mockProgressLog1,
        bookId: book1.id,
        sessionId: session.id,
      } as any);

      const result = await progressService.getProgressForActiveSession(book1.id);

      expect(result.length).toBe(1);
    });

    test("should return empty array when no active session exists", async () => {
      await clearTestDatabase();
      book1 = await bookRepository.create(mockBook1 as any);

      const result = await progressService.getProgressForActiveSession(book1.id);

      expect(result).toEqual([]);
    });
  });

  describe("logProgress - calculations", () => {
    test("should log first progress entry correctly", async () => {
      const result = await progressService.logProgress(book1.id, {
        currentPage: 100,
      });

      expect(result.currentPage).toBe(100);
      expect(result.currentPercentage).toBeCloseTo(9.62, 1); // 100/1040
      expect(result.pagesRead).toBe(100); // First entry, so pagesRead = currentPage
    });

    test("should calculate percentage from page number", async () => {
      const result = await progressService.logProgress(book1.id, {
        currentPage: 520, // Halfway through 1040-page book
      });

      expect(result.currentPercentage).toBe(50);
    });

    test("should calculate page from percentage", async () => {
      const result = await progressService.logProgress(book1.id, {
        currentPercentage: 50,
      });

      expect(result.currentPage).toBe(520); // 50% of 1040
    });

    test("should calculate pages read from last progress", async () => {
      // First progress
      await progressRepository.create({
        bookId: book1.id,
        sessionId: session.id,
        currentPage: 100,
        currentPercentage: 9.62,
        pagesRead: 100,
        progressDate: new Date("2025-11-10"),
      } as any);

      // Log second progress
      const result = await progressService.logProgress(book1.id, {
        currentPage: 250,
      });

      expect(result.pagesRead).toBe(150); // 250 - 100
    });

    test("should handle backdated progress entries", async () => {
      const backdatedDate = new Date("2025-11-10");

      const result = await progressService.logProgress(book1.id, {
        currentPage: 100,
        progressDate: backdatedDate,
      });

      expect(result.progressDate).toEqual(backdatedDate);
    });

    test("should save notes", async () => {
      const result = await progressService.logProgress(book1.id, {
        currentPage: 100,
        notes: "Great chapter!",
      });

      expect(result.notes).toBe("Great chapter!");
    });
  });

  describe("logProgress - validation", () => {
    test("should require active reading session", async () => {
      // Archive the session
      await sessionRepository.update(session.id, { isActive: false } as any);

      await expect(
        progressService.logProgress(book1.id, { currentPage: 100 })
      ).rejects.toThrow("No active reading session found");
    });

    test("should require 'reading' status", async () => {
      // Change status to something other than 'reading'
      await sessionRepository.update(session.id, { status: "to-read" } as any);

      await expect(
        progressService.logProgress(book1.id, { currentPage: 100 })
      ).rejects.toThrow("Can only log progress for books with 'reading' status");
    });

    test("should validate temporal consistency (progress must be >= previous entries)", async () => {
      // Create earlier progress entry at page 200
      await progressRepository.create({
        bookId: book1.id,
        sessionId: session.id,
        currentPage: 200,
        currentPercentage: 19.23,
        pagesRead: 200,
        progressDate: new Date("2025-11-10"),
      } as any);

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
      await progressRepository.create({
        bookId: book1.id,
        sessionId: session.id,
        currentPage: 200,
        currentPercentage: 19.23,
        pagesRead: 200,
        progressDate: new Date("2025-11-20"),
      } as any);

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
    test("should auto-complete session at 100% progress", async () => {
      await progressService.logProgress(book1.id, {
        currentPercentage: 100,
      });

      // Check session was updated to 'read' status
      const updatedSession = await sessionRepository.findById(session.id);
      expect(updatedSession?.status).toBe("read");
      expect(updatedSession?.completedDate).toBeDefined();
    });

    test("should not auto-complete below 100%", async () => {
      await progressService.logProgress(book1.id, {
        currentPercentage: 99.9,
      });

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
      const progress = await progressRepository.create({
        ...mockProgressLog1,
        bookId: book1.id,
        sessionId: session.id,
      } as any);

      const result = await progressService.updateProgress(progress.id, {
        currentPage: 200,
        notes: "Updated notes",
      });

      expect(result.currentPage).toBe(200);
      expect(result.notes).toBe("Updated notes");
    });

    test("should validate updated progress position in timeline", async () => {
      // Create three progress entries
      const p1 = await progressRepository.create({
        bookId: book1.id,
        sessionId: session.id,
        currentPage: 100,
        currentPercentage: 9.62,
        pagesRead: 100,
        progressDate: new Date("2025-11-10"),
      } as any);

      await progressRepository.create({
        bookId: book1.id,
        sessionId: session.id,
        currentPage: 200,
        currentPercentage: 19.23,
        pagesRead: 100,
        progressDate: new Date("2025-11-15"),
      } as any);

      await progressRepository.create({
        bookId: book1.id,
        sessionId: session.id,
        currentPage: 300,
        currentPercentage: 28.85,
        pagesRead: 100,
        progressDate: new Date("2025-11-20"),
      } as any);

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
      const progress = await progressRepository.create({
        ...mockProgressLog1,
        bookId: book1.id,
        sessionId: session.id,
      } as any);

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
