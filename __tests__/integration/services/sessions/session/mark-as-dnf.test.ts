// Import shared mock setup (must be first to properly mock modules)
import "./setup";

import { describe, test, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest';
import { setupTestDatabase, teardownTestDatabase, clearTestDatabase } from "@/__tests__/helpers/db-setup";
import { bookRepository, sessionRepository, progressRepository } from "@/lib/repositories";
import { SessionService } from "@/lib/services/session.service";
import { createTestBook, createTestSession, createTestProgress } from "@/__tests__/fixtures/test-data";
import type { Book } from "@/lib/db/schema/books";

/**
 * Comprehensive tests for SessionService.markAsDNF() workflow
 * 
 * This tests the DNF (Did Not Finish) marking flow which includes:
 * - Validation (must have active reading session)
 * - Session archival with completedDate
 * - Optional rating updates (best-effort)
 * - Optional review updates (best-effort)
 * - Last progress retrieval for UI prefilling
 */
describe("SessionService - markAsDNF", () => {
  let sessionService: SessionService;
  let book1: Book;

  beforeAll(async () => {
    await setupTestDatabase(__filename);
    sessionService = new SessionService();
  });

  afterAll(async () => {
    await teardownTestDatabase(__filename);
  });

  beforeEach(async () => {
    await clearTestDatabase(__filename);
    book1 = await bookRepository.create(createTestBook({
      calibreId: 1,
      title: "Test Book",
      totalPages: 300,
    }));
  });

  describe("validation", () => {
    test("should throw error if book not found", async () => {
      await expect(
        sessionService.markAsDNF({
          bookId: 99999,
        })
      ).rejects.toThrow("Book not found");
    });

    test("should throw error if no active reading session exists", async () => {
      await expect(
        sessionService.markAsDNF({
          bookId: book1.id,
        })
      ).rejects.toThrow("No active reading session found for this book");
    });

    test("should throw error if active session is not in 'reading' status", async () => {
      // Create session in to-read status
      await sessionRepository.create(createTestSession({
        bookId: book1.id,
        sessionNumber: 1,
        status: "to-read",
        isActive: true,
      }));

      await expect(
        sessionService.markAsDNF({
          bookId: book1.id,
        })
      ).rejects.toThrow('Cannot mark as DNF from status "to-read". Must be "reading".');
    });

    test("should throw error for read-next status", async () => {
      await sessionRepository.create(createTestSession({
        bookId: book1.id,
        sessionNumber: 1,
        status: "read-next",
        isActive: true,
      }));

      await expect(
        sessionService.markAsDNF({
          bookId: book1.id,
        })
      ).rejects.toThrow('Cannot mark as DNF from status "read-next". Must be "reading".');
    });
  });

  describe("basic DNF workflow", () => {
    test("should mark session as DNF with default date", async () => {
      const session = await sessionRepository.create(createTestSession({
        bookId: book1.id,
        sessionNumber: 1,
        status: "reading",
        startedDate: "2026-01-01",
        isActive: true,
      }));

      const result = await sessionService.markAsDNF({
        bookId: book1.id,
      });

      expect(result.session.status).toBe("dnf");
      expect(result.session.completedDate).toBeDefined();
      expect(result.session.id).toBe(session.id);
      expect(result.ratingUpdated).toBe(false);
      expect(result.reviewUpdated).toBe(false);
      expect(result.lastProgress).toBeUndefined();
    });

    test("should mark session as DNF with custom date", async () => {
      await sessionRepository.create(createTestSession({
        bookId: book1.id,
        sessionNumber: 1,
        status: "reading",
        startedDate: "2026-01-01",
        isActive: true,
      }));

      const customDate = "2026-01-10";
      const result = await sessionService.markAsDNF({
        bookId: book1.id,
        completedDate: customDate,
      });

      expect(result.session.status).toBe("dnf");
      expect(result.session.completedDate).toBe(customDate);
    });

    test("should use last progress date if no completedDate provided and progress exists", async () => {
      const session = await sessionRepository.create(createTestSession({
        bookId: book1.id,
        sessionNumber: 1,
        status: "reading",
        startedDate: "2026-01-01",
        isActive: true,
      }));

      // Add progress entries
      await progressRepository.create(createTestProgress({
        bookId: book1.id,
        sessionId: session.id,
        currentPage: 50,
        currentPercentage: 16.7,
        progressDate: "2026-01-05",
      }));

      await progressRepository.create(createTestProgress({
        bookId: book1.id,
        sessionId: session.id,
        currentPage: 100,
        currentPercentage: 33.3,
        progressDate: "2026-01-08",
      }));

      const result = await sessionService.markAsDNF({
        bookId: book1.id,
      });

      expect(result.session.completedDate).toBe("2026-01-08");
      expect(result.lastProgress).toBeDefined();
      expect(result.lastProgress?.currentPage).toBe(100);
      expect(result.lastProgress?.progressDate).toBe("2026-01-08");
    });
  });

  describe("rating updates", () => {
    test("should update rating when provided", async () => {
      await sessionRepository.create(createTestSession({
        bookId: book1.id,
        sessionNumber: 1,
        status: "reading",
        isActive: true,
      }));

      const result = await sessionService.markAsDNF({
        bookId: book1.id,
        rating: 2,
      });

      expect(result.ratingUpdated).toBe(true);

      const updatedBook = await bookRepository.findById(book1.id);
      expect(updatedBook?.rating).toBe(2);
    });

    test("should handle zero rating (not update)", async () => {
      await sessionRepository.create(createTestSession({
        bookId: book1.id,
        sessionNumber: 1,
        status: "reading",
        isActive: true,
      }));

      const result = await sessionService.markAsDNF({
        bookId: book1.id,
        rating: 0,
      });

      expect(result.ratingUpdated).toBe(false);
    });

    test("should handle rating update errors gracefully", async () => {
      const session = await sessionRepository.create(createTestSession({
        bookId: book1.id,
        sessionNumber: 1,
        status: "reading",
        isActive: true,
      }));

      // Mock rating update to fail
      const updateBookRating = vi.spyOn(sessionService as any, 'updateBookRating');
      updateBookRating.mockRejectedValueOnce(new Error("Rating update failed"));

      // Should not throw - best effort
      const result = await sessionService.markAsDNF({
        bookId: book1.id,
        rating: 3,
      });

      expect(result.session.status).toBe("dnf");
      expect(result.ratingUpdated).toBe(false);

      updateBookRating.mockRestore();
    });
  });

  describe("review updates", () => {
    test("should update review when provided", async () => {
      const session = await sessionRepository.create(createTestSession({
        bookId: book1.id,
        sessionNumber: 1,
        status: "reading",
        isActive: true,
      }));

      const result = await sessionService.markAsDNF({
        bookId: book1.id,
        review: "Started strong but couldn't finish",
      });

      expect(result.reviewUpdated).toBe(true);
      expect(result.session.review).toBe("Started strong but couldn't finish");
    });

    test("should handle review update errors gracefully", async () => {
      const session = await sessionRepository.create(createTestSession({
        bookId: book1.id,
        sessionNumber: 1,
        status: "reading",
        isActive: true,
      }));

      // Mock review update to fail
      const updateSessionReview = vi.spyOn(sessionService as any, 'updateSessionReview');
      updateSessionReview.mockRejectedValueOnce(new Error("Review update failed"));

      // Should not throw - best effort
      const result = await sessionService.markAsDNF({
        bookId: book1.id,
        review: "Test review",
      });

      expect(result.session.status).toBe("dnf");
      expect(result.reviewUpdated).toBe(false);

      updateSessionReview.mockRestore();
    });
  });

  describe("lastProgress retrieval", () => {
    test("should return lastProgress details with most recent entry", async () => {
      const session = await sessionRepository.create(createTestSession({
        bookId: book1.id,
        sessionNumber: 1,
        status: "reading",
        startedDate: "2026-01-01",
        isActive: true,
      }));

      // Add multiple progress entries
      await progressRepository.create(createTestProgress({
        bookId: book1.id,
        sessionId: session.id,
        currentPage: 50,
        currentPercentage: 16.7,
        progressDate: "2026-01-05",
      }));

      await progressRepository.create(createTestProgress({
        bookId: book1.id,
        sessionId: session.id,
        currentPage: 75,
        currentPercentage: 25.0,
        progressDate: "2026-01-06",
      }));

      await progressRepository.create(createTestProgress({
        bookId: book1.id,
        sessionId: session.id,
        currentPage: 120,
        currentPercentage: 40.0,
        progressDate: "2026-01-10",
      }));

      const result = await sessionService.markAsDNF({
        bookId: book1.id,
      });

      expect(result.lastProgress).toBeDefined();
      expect(result.lastProgress?.currentPage).toBe(120);
      expect(result.lastProgress?.currentPercentage).toBe(40.0);
      expect(result.lastProgress?.progressDate).toBe("2026-01-10");
    });

    test("should return undefined lastProgress when no progress exists", async () => {
      await sessionRepository.create(createTestSession({
        bookId: book1.id,
        sessionNumber: 1,
        status: "reading",
        isActive: true,
      }));

      const result = await sessionService.markAsDNF({
        bookId: book1.id,
      });

      expect(result.lastProgress).toBeUndefined();
    });
  });

  describe("combined updates", () => {
    test("should update rating, review, and return lastProgress", async () => {
      const session = await sessionRepository.create(createTestSession({
        bookId: book1.id,
        sessionNumber: 1,
        status: "reading",
        startedDate: "2026-01-01",
        isActive: true,
      }));

      await progressRepository.create(createTestProgress({
        bookId: book1.id,
        sessionId: session.id,
        currentPage: 80,
        currentPercentage: 26.7,
        progressDate: "2026-01-08",
      }));

      const result = await sessionService.markAsDNF({
        bookId: book1.id,
        rating: 2,
        review: "Not my cup of tea",
        completedDate: "2026-01-10",
      });

      expect(result.session.status).toBe("dnf");
      expect(result.session.completedDate).toBe("2026-01-10");
      expect(result.session.review).toBe("Not my cup of tea");
      expect(result.ratingUpdated).toBe(true);
      expect(result.reviewUpdated).toBe(true);
      expect(result.lastProgress?.currentPage).toBe(80);

      const updatedBook = await bookRepository.findById(book1.id);
      expect(updatedBook?.rating).toBe(2);
    });
  });

  describe("streak and cache updates", () => {
    test("should call updateStreakSystem (best effort)", async () => {
      await sessionRepository.create(createTestSession({
        bookId: book1.id,
        sessionNumber: 1,
        status: "reading",
        isActive: true,
      }));

      const updateStreakSystem = vi.spyOn(sessionService as any, 'updateStreakSystem');

      await sessionService.markAsDNF({
        bookId: book1.id,
      });

      expect(updateStreakSystem).toHaveBeenCalled();

      updateStreakSystem.mockRestore();
    });

    test("should handle streak update errors gracefully", async () => {
      await sessionRepository.create(createTestSession({
        bookId: book1.id,
        sessionNumber: 1,
        status: "reading",
        isActive: true,
      }));

      const updateStreakSystem = vi.spyOn(sessionService as any, 'updateStreakSystem');
      updateStreakSystem.mockRejectedValueOnce(new Error("Streak update failed"));

      // Should not throw
      const result = await sessionService.markAsDNF({
        bookId: book1.id,
      });

      expect(result.session.status).toBe("dnf");

      updateStreakSystem.mockRestore();
    });

    test("should call invalidateCache (best effort)", async () => {
      await sessionRepository.create(createTestSession({
        bookId: book1.id,
        sessionNumber: 1,
        status: "reading",
        isActive: true,
      }));

      const invalidateCache = vi.spyOn(sessionService as any, 'invalidateCache');

      await sessionService.markAsDNF({
        bookId: book1.id,
      });

      expect(invalidateCache).toHaveBeenCalledWith(book1.id);

      invalidateCache.mockRestore();
    });
  });
});
