// Import shared mock setup (must be first to properly mock modules)
import "./setup";

import { describe, test, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest';
import { setupTestDatabase, teardownTestDatabase, clearTestDatabase } from "@/__tests__/helpers/db-setup";
import { bookRepository, sessionRepository, progressRepository } from "@/lib/repositories";
import { SessionService } from "@/lib/services/session.service";
import { mockBook1, mockSessionToRead, mockSessionReading, mockProgressLog1 , createTestBook, createTestSession, createTestProgress } from "@/__tests__/fixtures/test-data";
import { toSessionDate } from "@/__tests__/test-utils";
import type { Book } from "@/lib/db/schema/books";

/**
 * Additional mock for core tests: updateStreaks
 * The shared setup already mocks rebuildStreak, revalidatePath, and calibreService
 */
vi.mock("@/lib/services/streak.service", () => ({
  streakService: {
    rebuildStreak: vi.fn(() => Promise.resolve()),
    updateStreaks: vi.fn(() => Promise.resolve({ currentStreak: 5, longestStreak: 10 })),
  },
}));

describe("SessionService", () => {
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
    book1 = await bookRepository.create(createTestBook(mockBook1));
  });

  describe("getActiveSession", () => {
    test("should return active session when it exists", async () => {
      const session = await sessionRepository.create(createTestSession({
        ...mockSessionReading,
        bookId: book1.id,
      }));

      const result = await sessionService.getActiveSession(book1.id);

      expect(result).toBeDefined();
      expect(result?.id).toBe(session.id);
      expect(result?.status).toBe("reading");
    });

    test("should return null when no active session exists", async () => {
      const result = await sessionService.getActiveSession(book1.id);

      expect(result).toBeNull();
    });

    test("should not return archived sessions", async () => {
      await sessionRepository.create(createTestSession({
        bookId: book1.id,
        sessionNumber: 1,
        status: "read",
        isActive: false, // Archived
      }));

      const result = await sessionService.getActiveSession(book1.id);

      expect(result).toBeNull();
    });
  });

  describe("getAllSessionsForBook", () => {
    test("should return all sessions ordered by session number descending", async () => {
      await sessionRepository.create(createTestSession({
        bookId: book1.id,
        sessionNumber: 1,
        status: "read",
        isActive: false,
      }));

      await sessionRepository.create(createTestSession({
        bookId: book1.id,
        sessionNumber: 2,
        status: "reading",
        isActive: true,
      }));

      const result = await sessionService.getAllSessionsForBook(book1.id);

      expect(result.length).toBe(2);
      expect(result[0].sessionNumber).toBe(2); // Descending order
      expect(result[1].sessionNumber).toBe(1);
    });

    test("should return empty array when no sessions exist", async () => {
      const result = await sessionService.getAllSessionsForBook(book1.id);

      expect(result).toEqual([]);
    });
  });

  describe("updateStatus - creating first session", () => {
    test("should create first session with to-read status", async () => {
      const result = await sessionService.updateStatus(book1.id, {
        status: "to-read",
      });

      expect(result.session).toBeDefined();
      expect(result.session.status).toBe("to-read");
      expect(result.session.sessionNumber).toBe(1);
      expect(result.session.isActive).toBe(true);
      expect(result.sessionArchived).toBeUndefined();
    });

    test("should create session with read-next status", async () => {
      const result = await sessionService.updateStatus(book1.id, {
        status: "read-next",
      });

      expect(result.session.status).toBe("read-next");
      expect(result.session.sessionNumber).toBe(1);
    });

    test("should create session with reading status and set startedDate", async () => {
      const result = await sessionService.updateStatus(book1.id, {
        status: "reading",
      });

      expect(result.session.status).toBe("reading");
      expect(result.session.startedDate).toBeDefined();
    });

    test("should create session with custom startedDate", async () => {
      const customDate = "2025-01-01";
      
      const result = await sessionService.updateStatus(book1.id, {
        status: "reading",
        startedDate: customDate,
      });

      expect(result.session.startedDate).toEqual(customDate);
    });
  });

  describe("updateStatus - updating existing session", () => {
    test("should update existing session status (forward movement)", async () => {
      // Create to-read session
      await sessionRepository.create(createTestSession({
        bookId: book1.id,
        sessionNumber: 1,
        status: "to-read",
        isActive: true,
      }));

      // Update to read-next
      const result = await sessionService.updateStatus(book1.id, {
        status: "read-next",
      });

      expect(result.session.status).toBe("read-next");
      expect(result.session.sessionNumber).toBe(1); // Same session
      expect(result.sessionArchived).toBeUndefined();
    });

    test("should set startedDate when moving to reading", async () => {
      await sessionRepository.create(createTestSession({
        bookId: book1.id,
        sessionNumber: 1,
        status: "read-next",
        isActive: true,
      }));

      const result = await sessionService.updateStatus(book1.id, {
        status: "reading",
      });

      expect(result.session.status).toBe("reading");
      expect(result.session.startedDate).toBeDefined();
    });

    test("should not override existing startedDate", async () => {
      const existingDate = "2025-01-01";
      
      await sessionRepository.create(createTestSession({
        bookId: book1.id,
        sessionNumber: 1,
        status: "reading",
        startedDate: existingDate,
        isActive: true,
      }));

      const result = await sessionService.updateStatus(book1.id, {
        status: "reading",
      });

      expect(result.session.startedDate).toEqual(existingDate);
    });
  });

  describe("updateStatus - completion (read status)", () => {
    test("should archive session and set completedDate when marking as read", async () => {
      await sessionRepository.create(createTestSession({
        bookId: book1.id,
        sessionNumber: 1,
        status: "reading",
        startedDate: "2025-11-01",
        isActive: true,
      }));

      const result = await sessionService.updateStatus(book1.id, {
        status: "read",
      });

      expect(result.session.status).toBe("read");
      expect(result.session.completedDate).toBeDefined();
      expect(result.session.isActive).toBe(true); // Kept active for terminal state
    });

    test("should use custom completedDate", async () => {
      const customDate = "2025-11-20";
      
      await sessionRepository.create(createTestSession({
        bookId: book1.id,
        sessionNumber: 1,
        status: "reading",
        isActive: true,
      }));

      const result = await sessionService.updateStatus(book1.id, {
        status: "read",
        completedDate: customDate,
      });

      expect(result.session.completedDate).toEqual(customDate);
    });

    test("should set startedDate if not present when marking as read", async () => {
      await sessionRepository.create(createTestSession({
        bookId: book1.id,
        sessionNumber: 1,
        status: "to-read",
        isActive: true,
      }));

      const result = await sessionService.updateStatus(book1.id, {
        status: "read",
      });

      expect(result.session.startedDate).toBeDefined();
      expect(result.session.completedDate).toBeDefined();
    });
  });

  describe("updateStatus - backward movement", () => {
    test("should allow backward movement without progress (no archival)", async () => {
      // Create reading session without progress
      await sessionRepository.create(createTestSession({
        bookId: book1.id,
        sessionNumber: 1,
        status: "reading",
        startedDate: "2025-11-01",
        isActive: true,
      }));

      // Move back to read-next
      const result = await sessionService.updateStatus(book1.id, {
        status: "read-next",
      });

      expect(result.session.status).toBe("read-next");
      expect(result.session.sessionNumber).toBe(1); // Same session
      expect(result.sessionArchived).toBeUndefined();
    });

    test("should archive session and create new one when moving backward with progress", async () => {
      // Create reading session
      const session = await sessionRepository.create(createTestSession({
        bookId: book1.id,
        sessionNumber: 1,
        status: "reading",
        startedDate: "2025-11-01",
        isActive: true,
      }));

      // Add progress
      await progressRepository.create(createTestProgress({
        ...mockProgressLog1,
        bookId: book1.id,
        sessionId: session.id,
      }));

      // Move back to read-next
      const result = await sessionService.updateStatus(book1.id, {
        status: "read-next",
      });

      expect(result.session.status).toBe("read-next");
      expect(result.session.sessionNumber).toBe(2); // New session
      expect(result.session.isActive).toBe(true);
      expect(result.sessionArchived).toBe(true);
      expect(result.archivedSessionNumber).toBe(1);

      // Verify old session is archived
      const oldSession = await sessionRepository.findById(session.id);
      expect(oldSession?.isActive).toBe(false);
    });

    test("should also archive on backward movement to to-read with progress", async () => {
      const session = await sessionRepository.create(createTestSession({
        bookId: book1.id,
        sessionNumber: 1,
        status: "reading",
        isActive: true,
      }));

      await progressRepository.create(createTestProgress({
        ...mockProgressLog1,
        bookId: book1.id,
        sessionId: session.id,
      }));

      const result = await sessionService.updateStatus(book1.id, {
        status: "to-read",
      });

      expect(result.sessionArchived).toBe(true);
      expect(result.session.sessionNumber).toBe(2);
    });
  });

  describe("updateStatus - DNF transitions", () => {
    test("should archive DNF session when transitioning to read-next", async () => {
      // ARRANGE: Book with DNF session
      const dnfSession = await sessionRepository.create(createTestSession({
        bookId: book1.id,
        sessionNumber: 1,
        status: "dnf",
        isActive: false,
        startedDate: "2026-01-01",
        completedDate: "2026-01-15",
      }));

      // ACT: Transition to read-next
      const result = await sessionService.updateStatus(book1.id, {
        status: "read-next",
      });

      // ASSERT: New session created
      expect(result.session.id).not.toBe(dnfSession.id);
      expect(result.session.sessionNumber).toBe(2);
      expect(result.session.status).toBe("read-next");
      expect(result.session.isActive).toBe(true);
      expect(result.sessionArchived).toBe(true);
      expect(result.archivedSessionNumber).toBe(1);

      // Verify DNF session preserved
      const archived = await sessionRepository.findById(dnfSession.id);
      expect(archived?.status).toBe("dnf");
      expect(archived?.completedDate).toBe("2026-01-15");
      expect(archived?.isActive).toBe(false);
    });

    test("should archive DNF session when transitioning to to-read", async () => {
      // ARRANGE: Book with DNF session
      const dnfSession = await sessionRepository.create(createTestSession({
        bookId: book1.id,
        sessionNumber: 1,
        status: "dnf",
        isActive: false,
        startedDate: "2026-01-01",
        completedDate: "2026-01-15",
      }));

      // ACT: Transition to to-read
      const result = await sessionService.updateStatus(book1.id, {
        status: "to-read",
      });

      // ASSERT: New session created
      expect(result.session.id).not.toBe(dnfSession.id);
      expect(result.session.sessionNumber).toBe(2);
      expect(result.session.status).toBe("to-read");
      expect(result.session.isActive).toBe(true);
      expect(result.sessionArchived).toBe(true);
      expect(result.archivedSessionNumber).toBe(1);

      // Verify DNF session preserved
      const archived = await sessionRepository.findById(dnfSession.id);
      expect(archived?.status).toBe("dnf");
      expect(archived?.isActive).toBe(false);
    });

    test("should archive DNF session when transitioning to reading (like re-read)", async () => {
      // ARRANGE: Book with DNF session
      const dnfSession = await sessionRepository.create(createTestSession({
        bookId: book1.id,
        sessionNumber: 1,
        status: "dnf",
        isActive: false,
        startedDate: "2026-01-01",
        completedDate: "2026-01-10",
      }));

      // ACT: Transition to reading
      const result = await sessionService.updateStatus(book1.id, {
        status: "reading",
      });

      // ASSERT: New session created (like re-read)
      expect(result.session.id).not.toBe(dnfSession.id);
      expect(result.session.sessionNumber).toBe(2);
      expect(result.session.status).toBe("reading");
      expect(result.session.isActive).toBe(true);
      expect(result.session.startedDate).toBeTruthy(); // Auto-set today
      expect(result.sessionArchived).toBe(true);

      // Verify DNF session preserved
      const archived = await sessionRepository.findById(dnfSession.id);
      expect(archived?.status).toBe("dnf");
      expect(archived?.isActive).toBe(false);
    });

    test("should throw error when transitioning DNF to read directly", async () => {
      // ARRANGE: Book with DNF session
      await sessionRepository.create(createTestSession({
        bookId: book1.id,
        sessionNumber: 1,
        status: "dnf",
        isActive: false,
        startedDate: "2026-01-01",
        completedDate: "2026-01-15",
      }));

      // ACT & ASSERT: Should throw validation error
      await expect(
        sessionService.updateStatus(book1.id, { status: "read" })
      ).rejects.toThrow("Cannot mark DNF book as read directly");
    });

    test("should preserve DNF completedDate when archiving", async () => {
      // ARRANGE: Book with DNF session with specific completedDate
      const originalCompletedDate = "2026-01-20";
      const dnfSession = await sessionRepository.create(createTestSession({
        bookId: book1.id,
        sessionNumber: 1,
        status: "dnf",
        isActive: false,
        startedDate: "2026-01-10",
        completedDate: originalCompletedDate,
      }));

      // ACT: Transition to read-next
      await sessionService.updateStatus(book1.id, { status: "read-next" });

      // ASSERT: Original completedDate preserved
      const archived = await sessionRepository.findById(dnfSession.id);
      expect(archived?.completedDate).toBe(originalCompletedDate);
      expect(archived?.status).toBe("dnf");
    });
  });

  describe("updateStatus - with rating", () => {
    test("should update book rating when provided", async () => {
      await sessionRepository.create(createTestSession({
        bookId: book1.id,
        sessionNumber: 1,
        status: "reading",
        isActive: true,
      }));

      await sessionService.updateStatus(book1.id, {
        status: "read",
        rating: 5,
      });

      const updatedBook = await bookRepository.findById(book1.id);
      expect(updatedBook?.rating).toBe(5);
    });

    test("should handle null rating (remove rating)", async () => {
      // Set initial rating
      await bookRepository.update(book1.id, { rating: 4 });

      await sessionRepository.create(createTestSession({
        bookId: book1.id,
        sessionNumber: 1,
        status: "reading",
        isActive: true,
      }));

      await sessionService.updateStatus(book1.id, {
        status: "read",
        rating: null,
      });

      const updatedBook = await bookRepository.findById(book1.id);
      expect(updatedBook?.rating).toBeNull();
    });
  });

  describe("updateStatus - with review", () => {
    test("should save review when provided", async () => {
      await sessionRepository.create(createTestSession({
        bookId: book1.id,
        sessionNumber: 1,
        status: "reading",
        isActive: true,
      }));

      const result = await sessionService.updateStatus(book1.id, {
        status: "read",
        review: "Amazing book!",
      });

      expect(result.session.review).toBe("Amazing book!");
    });
  });

  describe("startReread", () => {
    test("should create new session for re-reading", async () => {
      // Create completed session
      await sessionRepository.create(createTestSession({
        bookId: book1.id,
        sessionNumber: 1,
        status: "read",
        isActive: false,
        completedDate: "2025-10-01",
      }));

      const result = await sessionService.startReread(book1.id);

      expect(result.sessionNumber).toBe(2);
      expect(result.status).toBe("reading");
      expect(result.isActive).toBe(true);
      expect(result.startedDate).toBeDefined();
    });

    test("should throw error if no completed reads exist", async () => {
      await expect(sessionService.startReread(book1.id)).rejects.toThrow(
        "Cannot start re-read: book has not been finished"
      );
    });

    test("should increment session number correctly", async () => {
      // Create multiple completed sessions
      await sessionRepository.create(createTestSession({
        bookId: book1.id,
        sessionNumber: 1,
        status: "read",
        isActive: false,
      }));

      await sessionRepository.create(createTestSession({
        bookId: book1.id,
        sessionNumber: 2,
        status: "read",
        isActive: false,
      }));

      const result = await sessionService.startReread(book1.id);

      expect(result.sessionNumber).toBe(3);
    });
  });

  describe("updateSessionDate", () => {
    test("should update startedDate", async () => {
      const session = await sessionRepository.create(createTestSession({
        bookId: book1.id,
        sessionNumber: 1,
        status: "reading",
        isActive: true,
      }));

      const newDate = "2025-01-15";
      const result = await sessionService.updateSessionDate(session.id, "startedDate", newDate);

      expect(result.startedDate).toEqual(newDate);
    });

    test("should update completedDate", async () => {
      const session = await sessionRepository.create(createTestSession({
        bookId: book1.id,
        sessionNumber: 1,
        status: "read",
        isActive: false,
        completedDate: "2025-11-01",
      }));

      const newDate = "2025-11-20";
      const result = await sessionService.updateSessionDate(session.id, "completedDate", newDate);

      expect(result.completedDate).toEqual(newDate);
    });

    test("should throw error for non-existent session", async () => {
      await expect(
        sessionService.updateSessionDate(99999, "startedDate", toSessionDate(new Date()))
      ).rejects.toThrow("Session not found");
    });
  });

  describe("validation", () => {
    test("should throw error for invalid book ID", async () => {
      await expect(
        sessionService.updateStatus(99999, { status: "reading" })
      ).rejects.toThrow("Book not found");
    });

    test("should throw error for invalid status", async () => {
      await expect(
        sessionService.updateStatus(book1.id, { status: "invalid" as any })
      ).rejects.toThrow("Invalid status");
    });
  });
});
