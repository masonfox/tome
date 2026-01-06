// Import shared mock setup (must be first to properly mock modules)
import "./setup";

import { describe, expect, test, beforeEach, afterAll, vi } from 'vitest';
import { SessionService } from "@/lib/services/session.service";
import { bookRepository, sessionRepository, progressRepository } from "@/lib/repositories";
import { setupTestDatabase, clearTestDatabase, teardownTestDatabase } from "../../helpers/db-setup";
import { createTestBook } from "../../fixtures/test-data";

let instance: any;

describe("SessionService - Mark as Read", () => {
  let sessionService: SessionService;

  beforeEach(async () => {
    instance = await setupTestDatabase(__filename);
    await clearTestDatabase(instance);
    sessionService = new SessionService();
  });

  afterAll(async () => {
    await teardownTestDatabase(instance);
  });

  describe("ensureReadingStatus", () => {
    test("returns existing session when already in reading status", async () => {
      const book = await bookRepository.create(createTestBook({ totalPages: 300 }));

      // Create a reading session
      const session = await sessionRepository.create({
        bookId: book.id,
        sessionNumber: 1,
        status: "reading",
        isActive: true,
        startedDate: new Date(),
      });

      const result = await sessionService.ensureReadingStatus(book.id);

      expect(result.id).toBe(session.id);
      expect(result.status).toBe("reading");
    });

    test("transitions from to-read to reading", async () => {
      const book = await bookRepository.create(createTestBook({ totalPages: 300 }));

      // Create a to-read session
      await sessionRepository.create({
        bookId: book.id,
        sessionNumber: 1,
        status: "to-read",
        isActive: true,
      });

      const result = await sessionService.ensureReadingStatus(book.id);

      expect(result.status).toBe("reading");
      expect(result.startedDate).not.toBeNull();
    });

    test("transitions from read-next to reading", async () => {
      const book = await bookRepository.create(createTestBook({ totalPages: 300 }));

      // Create a read-next session
      await sessionRepository.create({
        bookId: book.id,
        sessionNumber: 1,
        status: "read-next",
        isActive: true,
      });

      const result = await sessionService.ensureReadingStatus(book.id);

      expect(result.status).toBe("reading");
      expect(result.startedDate).not.toBeNull();
    });

    test("throws error if book not found", async () => {
      await expect(sessionService.ensureReadingStatus(99999)).rejects.toThrow("Book not found");
    });
  });

  describe("updateBookRating", () => {
    test("updates rating successfully", async () => {
      const book = await bookRepository.create(createTestBook({ totalPages: 300 }));

      await sessionService.updateBookRating(book.id, 5);

      const updated = await bookRepository.findById(book.id);
      expect(updated?.rating).toBe(5);
    });

    test("removes rating when set to null", async () => {
      const book = await bookRepository.create(createTestBook({ totalPages: 300, rating: 4 }));

      await sessionService.updateBookRating(book.id, null);

      const updated = await bookRepository.findById(book.id);
      expect(updated?.rating).toBeNull();
    });

    test("throws error if book not found", async () => {
      await expect(sessionService.updateBookRating(99999, 5)).rejects.toThrow("Book not found");
    });
  });

  describe("updateSessionReview", () => {
    test("updates review on session", async () => {
      const book = await bookRepository.create(createTestBook({ totalPages: 300 }));
      const session = await sessionRepository.create({
        bookId: book.id,
        sessionNumber: 1,
        status: "read",
        isActive: false,
        completedDate: new Date(),
      });

      const result = await sessionService.updateSessionReview(session.id, "Great book!");

      expect(result.review).toBe("Great book!");
    });

    test("throws error if session not found", async () => {
      await expect(sessionService.updateSessionReview(99999, "Review")).rejects.toThrow("Session not found");
    });
  });

  describe("findMostRecentCompletedSession", () => {
    test("returns most recent completed session", async () => {
      const book = await bookRepository.create(createTestBook({ totalPages: 300 }));

      // Create multiple completed sessions
      const session1 = await sessionRepository.create({
        bookId: book.id,
        sessionNumber: 1,
        status: "read",
        isActive: false,
        completedDate: new Date("2023-01-01"),
      });

      const session2 = await sessionRepository.create({
        bookId: book.id,
        sessionNumber: 2,
        status: "read",
        isActive: false,
        completedDate: new Date("2023-06-01"),
      });

      const result = await sessionService.findMostRecentCompletedSession(book.id);

      expect(result?.id).toBe(session2.id);
    });

    test("returns null when no completed sessions", async () => {
      const book = await bookRepository.create(createTestBook({ totalPages: 300 }));

      // Create only an active session
      await sessionRepository.create({
        bookId: book.id,
        sessionNumber: 1,
        status: "reading",
        isActive: true,
      });

      const result = await sessionService.findMostRecentCompletedSession(book.id);

      expect(result).toBeNull();
    });

    test("ignores active sessions", async () => {
      const book = await bookRepository.create(createTestBook({ totalPages: 300 }));

      // Create a completed session
      const completedSession = await sessionRepository.create({
        bookId: book.id,
        sessionNumber: 1,
        status: "read",
        isActive: false,
        completedDate: new Date("2023-01-01"),
      });

      // Create an active reading session (more recent but should be ignored)
      await sessionRepository.create({
        bookId: book.id,
        sessionNumber: 2,
        status: "reading",
        isActive: true,
        startedDate: new Date(),
      });

      const result = await sessionService.findMostRecentCompletedSession(book.id);

      expect(result?.id).toBe(completedSession.id);
    });
  });

  describe("markAsRead - Basic Scenarios", () => {
    test("marks book as read with no progress (direct status change)", async () => {
      const book = await bookRepository.create(createTestBook({ totalPages: null })); // No pages

      const result = await sessionService.markAsRead({ bookId: book.id });

      expect(result.session.status).toBe("read");
      expect(result.progressCreated).toBe(false);
      expect(result.ratingUpdated).toBe(false);
      expect(result.reviewUpdated).toBe(false);
    });

    test("marks book as read with pages but no 100% progress (creates progress)", async () => {
      const book = await bookRepository.create(createTestBook({ totalPages: 350 }));

      // Create a reading session
      await sessionRepository.create({
        bookId: book.id,
        sessionNumber: 1,
        status: "reading",
        isActive: true,
        startedDate: new Date(),
      });

      const result = await sessionService.markAsRead({ bookId: book.id });

      expect(result.progressCreated).toBe(true);
      // Note: In the real flow, ProgressService would auto-complete the book
      // In our mocked version, we're verifying the intent to create progress
    });

    test("marks book as read when already has 100% progress (direct status change)", async () => {
      const book = await bookRepository.create(createTestBook({ totalPages: 350 }));

      // Create a reading session with 100% progress
      const session = await sessionRepository.create({
        bookId: book.id,
        sessionNumber: 1,
        status: "reading",
        isActive: true,
        startedDate: new Date(),
      });

      await progressRepository.create({
        bookId: book.id,
        sessionId: session.id,
        currentPage: 350,
        currentPercentage: 100,
        progressDate: new Date(),
        notes: "Finished",
        pagesRead: 350,
      });

      const result = await sessionService.markAsRead({ bookId: book.id });

      expect(result.session.status).toBe("read");
      expect(result.progressCreated).toBe(false);
    });

    test("marks already-read book (finds archived session)", async () => {
      const book = await bookRepository.create(createTestBook({ totalPages: 350 }));

      // Create a completed session
      const completedSession = await sessionRepository.create({
        bookId: book.id,
        sessionNumber: 1,
        status: "read",
        isActive: false,
        completedDate: new Date(),
      });

      const result = await sessionService.markAsRead({ bookId: book.id });

      expect(result.session.id).toBe(completedSession.id);
      expect(result.progressCreated).toBe(false);
    });

    test("marks book with rating", async () => {
      const book = await bookRepository.create(createTestBook({ totalPages: null }));

      const result = await sessionService.markAsRead({
        bookId: book.id,
        rating: 5,
      });

      expect(result.ratingUpdated).toBe(true);

      const updated = await bookRepository.findById(book.id);
      expect(updated?.rating).toBe(5);
    });

    test("marks book with review", async () => {
      const book = await bookRepository.create(createTestBook({ totalPages: null }));

      const result = await sessionService.markAsRead({
        bookId: book.id,
        review: "Excellent read!",
      });

      expect(result.reviewUpdated).toBe(true);
    });
  });

  describe("markAsRead - Complex Scenarios", () => {
    test("marks with both rating and review", async () => {
      const book = await bookRepository.create(createTestBook({ totalPages: null }));

      const result = await sessionService.markAsRead({
        bookId: book.id,
        rating: 5,
        review: "Amazing book!",
      });

      expect(result.ratingUpdated).toBe(true);
      expect(result.reviewUpdated).toBe(true);

      const updated = await bookRepository.findById(book.id);
      expect(updated?.rating).toBe(5);
    });

    test("marks book from to-read status (transitions through reading)", async () => {
      const book = await bookRepository.create(createTestBook({ totalPages: 350 }));

      // Create a to-read session
      await sessionRepository.create({
        bookId: book.id,
        sessionNumber: 1,
        status: "to-read",
        isActive: true,
      });

      const result = await sessionService.markAsRead({ bookId: book.id });

      // Should have transitioned through reading to read
      expect(result.progressCreated).toBe(true);
    });

    test("marks book from read-next status (transitions through reading)", async () => {
      const book = await bookRepository.create(createTestBook({ totalPages: 350 }));

      // Create a read-next session
      await sessionRepository.create({
        bookId: book.id,
        sessionNumber: 1,
        status: "read-next",
        isActive: true,
      });

      const result = await sessionService.markAsRead({ bookId: book.id });

      expect(result.progressCreated).toBe(true);
    });

    test("marks already-read book with new review (attaches to most recent session)", async () => {
      const book = await bookRepository.create(createTestBook({ totalPages: 350 }));

      // Create multiple completed sessions
      const oldSession = await sessionRepository.create({
        bookId: book.id,
        sessionNumber: 1,
        status: "read",
        isActive: false,
        completedDate: new Date("2023-01-01"),
      });

      const recentSession = await sessionRepository.create({
        bookId: book.id,
        sessionNumber: 2,
        status: "read",
        isActive: false,
        completedDate: new Date("2023-06-01"),
      });

      const result = await sessionService.markAsRead({
        bookId: book.id,
        review: "Still love it on re-read!",
      });

      expect(result.reviewUpdated).toBe(true);
      expect(result.session.id).toBe(recentSession.id);

      // Verify review was added to the most recent session
      const updated = await sessionRepository.findById(recentSession.id);
      expect(updated?.review).toBe("Still love it on re-read!");
    });

    test("uses custom completedDate when provided", async () => {
      const book = await bookRepository.create(createTestBook({ totalPages: null }));
      const customDate = new Date("2023-05-15");

      const result = await sessionService.markAsRead({
        bookId: book.id,
        completedDate: customDate,
      });

      expect(result.session.status).toBe("read");
      expect(result.session.completedDate).toEqual(customDate);
    });
  });

  describe("markAsRead - Error Scenarios", () => {
    test("throws error if book not found", async () => {
      await expect(
        sessionService.markAsRead({ bookId: 99999 })
      ).rejects.toThrow("Book not found");
    });

    test("continues if rating update fails (best-effort)", async () => {
      const book = await bookRepository.create(createTestBook({ totalPages: null }));

      // Mock rating update to fail
      const originalUpdateRating = sessionService.updateBookRating;
      sessionService.updateBookRating = vi.fn(() => Promise.reject(new Error("Rating sync failed")));

      const result = await sessionService.markAsRead({
        bookId: book.id,
        rating: 5,
      });

      // Book should still be marked as read
      expect(result.session.status).toBe("read");
      expect(result.ratingUpdated).toBe(false); // But flag indicates failure

      // Restore original method
      sessionService.updateBookRating = originalUpdateRating;
    });

    test("continues if review update fails (best-effort)", async () => {
      const book = await bookRepository.create(createTestBook({ totalPages: null }));

      // Mock review update to fail
      const originalUpdateReview = sessionService.updateSessionReview;
      sessionService.updateSessionReview = vi.fn(() => Promise.reject(new Error("Review update failed")));

      const result = await sessionService.markAsRead({
        bookId: book.id,
        review: "Great!",
      });

      // Book should still be marked as read
      expect(result.session.status).toBe("read");
      expect(result.reviewUpdated).toBe(false); // But flag indicates failure

      // Restore original method
      sessionService.updateSessionReview = originalUpdateReview;
    });
  });

  describe("markAsRead - Edge Cases", () => {
    test("handles book with 0 totalPages", async () => {
      const book = await bookRepository.create(createTestBook({ totalPages: 0 }));

      const result = await sessionService.markAsRead({ bookId: book.id });

      expect(result.session.status).toBe("read");
      expect(result.progressCreated).toBe(false);
    });

    test("handles book with multiple completed sessions (finds most recent)", async () => {
      const book = await bookRepository.create(createTestBook({ totalPages: 350 }));

      // Create 3 completed sessions
      await sessionRepository.create({
        bookId: book.id,
        sessionNumber: 1,
        status: "read",
        isActive: false,
        completedDate: new Date("2022-01-01"),
      });

      await sessionRepository.create({
        bookId: book.id,
        sessionNumber: 2,
        status: "read",
        isActive: false,
        completedDate: new Date("2023-01-01"),
      });

      const mostRecent = await sessionRepository.create({
        bookId: book.id,
        sessionNumber: 3,
        status: "read",
        isActive: false,
        completedDate: new Date("2024-01-01"),
      });

      const result = await sessionService.markAsRead({
        bookId: book.id,
        review: "Third time's a charm!",
      });

      expect(result.session.id).toBe(mostRecent.id);
    });

    test("skips rating update if rating is 0", async () => {
      const book = await bookRepository.create(createTestBook({ totalPages: null }));

      const result = await sessionService.markAsRead({
        bookId: book.id,
        rating: 0, // Invalid rating, should be skipped
      });

      expect(result.ratingUpdated).toBe(false);

      const updated = await bookRepository.findById(book.id);
      expect(updated?.rating).toBeNull();
    });

    test("skips review update if review is empty string", async () => {
      const book = await bookRepository.create(createTestBook({ totalPages: null }));

      const result = await sessionService.markAsRead({
        bookId: book.id,
        review: "", // Empty review, should be skipped
      });

      expect(result.reviewUpdated).toBe(false);
    });
  });
});
