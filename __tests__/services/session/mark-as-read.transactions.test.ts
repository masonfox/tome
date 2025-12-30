import { describe, expect, test, beforeEach, afterEach, afterAll, mock } from "bun:test";
import { SessionService } from "@/lib/services/session.service";
import { bookRepository, sessionRepository, progressRepository } from "@/lib/repositories";
import { setupTestDatabase, clearTestDatabase, teardownTestDatabase } from "../../helpers/db-setup";
import { createTestBook } from "../../fixtures/test-data";
import "./setup"; // Use shared mock setup now that ProgressService mock is removed

let instance: any;

describe("SessionService - Mark as Read Transactions", () => {
  let sessionService: SessionService;
  let originalProgressCreate: any;
  let originalSessionCreate: any;
  let originalSessionUpdate: any;
  let originalBookUpdate: any;

  beforeEach(async () => {
    instance = await setupTestDatabase(__filename);
    await clearTestDatabase(instance);
    sessionService = new SessionService();

    // Store original methods
    originalProgressCreate = progressRepository.create;
    originalSessionCreate = sessionRepository.create;
    originalSessionUpdate = sessionRepository.update;
    originalBookUpdate = bookRepository.update;
  });

  afterEach(() => {
    // Restore original methods after each test
    progressRepository.create = originalProgressCreate;
    sessionRepository.create = originalSessionCreate;
    sessionRepository.update = originalSessionUpdate;
    bookRepository.update = originalBookUpdate;
  });

  afterAll(async () => {
    await teardownTestDatabase(instance);
  });

  describe("Transaction Rollback Scenarios", () => {
    test("rolls back on session update failure during status change", async () => {
      // Setup: Book with pages and existing to-read session
      const book = await bookRepository.create(createTestBook({ totalPages: 300 }));
      const initialSession = await sessionRepository.create({
        bookId: book.id,
        sessionNumber: 1,
        status: "to-read",
        isActive: true,
      });

      // Mock sessionRepository.update to fail during transaction
      let updateCallCount = 0;
      sessionRepository.update = mock(async (id: number, data: any, tx?: any) => {
        updateCallCount++;
        // Fail on first update within transaction (status change to "reading")
        if (tx && updateCallCount === 1) {
          throw new Error("Simulated session update failure");
        }
        return originalSessionUpdate.call(sessionRepository, id, data, tx);
      }) as any;

      // Attempt to mark as read - should fail and rollback
      await expect(
        sessionService.markAsRead({ bookId: book.id })
      ).rejects.toThrow("Simulated session update failure");

      // Verify rollback: Session should still be in original state
      const currentSession = await sessionRepository.findById(initialSession.id);
      expect(currentSession?.status).toBe("to-read");
      expect(currentSession?.isActive).toBe(true);

      // Verify rollback: No progress should be created
      const progressLogs = await progressRepository.findByBookId(book.id);
      expect(progressLogs.length).toBe(0);
    });

    test("rolls back on session creation failure (ManualSessionUpdateStrategy)", async () => {
      // Setup: Book without pages, no existing session
      const book = await bookRepository.create(createTestBook({ totalPages: null }));

      // Mock sessionRepository.create to fail during transaction
      sessionRepository.create = mock(async (data: any, tx?: any) => {
        // Only fail when called within transaction
        if (tx) {
          throw new Error("Simulated session creation failure");
        }
        return originalSessionCreate.call(sessionRepository, data, tx);
      }) as any;

      // Attempt to mark as read - should fail and rollback
      await expect(
        sessionService.markAsRead({ bookId: book.id })
      ).rejects.toThrow("Simulated session creation failure");

      // Verify rollback: No session should exist
      const sessions = await sessionRepository.findAllByBookId(book.id);
      expect(sessions.length).toBe(0);
    });

    test("rolls back on getNextSessionNumber failure", async () => {
      // Setup: Book without pages
      const book = await bookRepository.create(createTestBook({ totalPages: null }));

      // Mock sessionRepository.getNextSessionNumber to fail
      const originalGetNext = sessionRepository.getNextSessionNumber;
      sessionRepository.getNextSessionNumber = mock(async (bookId: number, tx?: any) => {
        if (tx) {
          throw new Error("Simulated getNextSessionNumber failure");
        }
        return originalGetNext.call(sessionRepository, bookId, tx);
      }) as any;

      // Attempt to mark as read - should fail and rollback
      await expect(
        sessionService.markAsRead({ bookId: book.id })
      ).rejects.toThrow("Simulated getNextSessionNumber failure");

      // Verify rollback: No session created
      const sessions = await sessionRepository.findAllByBookId(book.id);
      expect(sessions.length).toBe(0);

      // Cleanup
      sessionRepository.getNextSessionNumber = originalGetNext;
    });
  });

  describe("Best-Effort Operations", () => {
    test("completes successfully even if rating update fails", async () => {
      // Setup: Book with pages
      const book = await bookRepository.create(createTestBook({ totalPages: 300 }));

      // Mock bookRepository.update to fail (used by updateBookRating)
      const originalBookUpdate = bookRepository.update;
      bookRepository.update = mock(async () => {
        throw new Error("Simulated rating update failure");
      }) as any;

      // Mark as read with rating - should succeed despite rating failure
      const result = await sessionService.markAsRead({
        bookId: book.id,
        rating: 5,
      });

      // Verify: Book IS marked as read
      expect(result.session.status).toBe("read");
      expect(result.session.isActive).toBe(false);
      expect(result.session.completedDate).not.toBeNull();

      // Verify: Rating update failed (best-effort)
      expect(result.ratingUpdated).toBe(false);

      // Verify: Session still exists and is completed
      const session = await sessionRepository.findById(result.session.id);
      expect(session).not.toBeNull();
      expect(session?.status).toBe("read");

      // Cleanup
      bookRepository.update = originalBookUpdate;
    });

    test("completes successfully even if review update fails", async () => {
      // Setup: Book with pages
      const book = await bookRepository.create(createTestBook({ totalPages: 300 }));

      // Mock sessionRepository.update to fail when updating review (outside transaction)
      const originalUpdate = sessionRepository.update;
      sessionRepository.update = mock(async (id: number, data: any, tx?: any) => {
        // Fail review updates (no tx, has review field)
        if (!tx && data.review !== undefined) {
          throw new Error("Simulated review update failure");
        }
        return originalSessionUpdate.call(sessionRepository, id, data, tx);
      }) as any;

      // Mark as read with review - should succeed despite review failure
      const result = await sessionService.markAsRead({
        bookId: book.id,
        review: "Great book!",
      });

      // Verify: Book IS marked as read
      expect(result.session.status).toBe("read");
      expect(result.session.isActive).toBe(false);

      // Verify: Review update failed (best-effort)
      expect(result.reviewUpdated).toBe(false);

      // Verify: Session exists without review
      const session = await sessionRepository.findById(result.session.id);
      expect(session).not.toBeNull();
      expect(session?.status).toBe("read");
      expect(session?.review).not.toBe("Great book!");

      // Cleanup
      sessionRepository.update = originalUpdate;
    });

    test("completes successfully with both rating and review failures", async () => {
      // Setup: Book with pages
      const book = await bookRepository.create(createTestBook({ totalPages: 300 }));

      // Mock both rating and review updates to fail
      const originalBookUpdate = bookRepository.update;
      const originalSessionUpdate = sessionRepository.update;

      bookRepository.update = mock(async () => {
        throw new Error("Simulated rating failure");
      }) as any;

      sessionRepository.update = mock(async (id: number, data: any, tx?: any) => {
        if (!tx && data.review !== undefined) {
          throw new Error("Simulated review failure");
        }
        return originalSessionUpdate.call(sessionRepository, id, data, tx);
      }) as any;

      // Mark as read with both rating and review
      const result = await sessionService.markAsRead({
        bookId: book.id,
        rating: 5,
        review: "Excellent!",
      });

      // Verify: Book IS marked as read despite both failures
      expect(result.session.status).toBe("read");
      expect(result.session.isActive).toBe(false);

      // Verify: Both best-effort operations failed
      expect(result.ratingUpdated).toBe(false);
      expect(result.reviewUpdated).toBe(false);

      // Verify: Core operation succeeded
      const session = await sessionRepository.findById(result.session.id);
      expect(session).not.toBeNull();
      expect(session?.status).toBe("read");

      // Cleanup
      bookRepository.update = originalBookUpdate;
      sessionRepository.update = originalSessionUpdate;
    });

    test("rating failure does not affect progress creation", async () => {
      // Setup: Book with pages
      const book = await bookRepository.create(createTestBook({ totalPages: 300 }));

      // Mock bookRepository.update to fail
      const originalBookUpdate = bookRepository.update;
      bookRepository.update = mock(async () => {
        throw new Error("Rating update failed");
      }) as any;

      // Mark as read with rating
      const result = await sessionService.markAsRead({
        bookId: book.id,
        rating: 4,
      });

      // Verify: Progress was created despite rating failure
      expect(result.progressCreated).toBe(true);
      expect(result.ratingUpdated).toBe(false);

      // Verify: Progress exists in database
      const progressLogs = await progressRepository.findByBookId(book.id);
      expect(progressLogs.length).toBe(1);
      expect(progressLogs[0].currentPercentage).toBe(100);

      // Cleanup
      bookRepository.update = originalBookUpdate;
    });

    test("review failure does not affect session completion", async () => {
      // Setup: Book with pages
      const book = await bookRepository.create(createTestBook({ totalPages: 300 }));

      // Mock sessionRepository.update to fail on review update
      const originalUpdate = sessionRepository.update;
      sessionRepository.update = mock(async (id: number, data: any, tx?: any) => {
        if (!tx && data.review !== undefined) {
          throw new Error("Review update failed");
        }
        return originalSessionUpdate.call(sessionRepository, id, data, tx);
      }) as any;

      // Mark as read with review
      const result = await sessionService.markAsRead({
        bookId: book.id,
        review: "Amazing read!",
      });

      // Verify: Session is completed despite review failure
      expect(result.session.status).toBe("read");
      expect(result.session.isActive).toBe(false);
      expect(result.reviewUpdated).toBe(false);

      // Verify: Session is archived
      const archivedSession = await sessionRepository.findById(result.session.id);
      expect(archivedSession).not.toBeNull();
      expect(archivedSession?.isActive).toBe(false);

      // Cleanup
      sessionRepository.update = originalUpdate;
    });
  });

  describe("Transaction Atomicity Guarantees", () => {
    test("DirectStatusChangeStrategy: status update is atomic", async () => {
      // Setup: Book with 100% progress already
      const book = await bookRepository.create(createTestBook({ totalPages: 300 }));
      const session = await sessionRepository.create({
        bookId: book.id,
        sessionNumber: 1,
        status: "reading",
        isActive: true,
        startedDate: new Date(),
      });

      // Create 100% progress
      await progressRepository.create({
        bookId: book.id,
        sessionId: session.id,
        currentPage: 300,
        currentPercentage: 100,
        progressDate: new Date(),
        pagesRead: 300,
      });

      // Mock to fail during status update
      const originalUpdate = sessionRepository.update;
      sessionRepository.update = mock(async (id: number, data: any, tx?: any) => {
        if (tx && data.status === "read") {
          throw new Error("Status update failed");
        }
        return originalSessionUpdate.call(sessionRepository, id, data, tx);
      }) as any;

      // Attempt to mark as read
      await expect(
        sessionService.markAsRead({ bookId: book.id })
      ).rejects.toThrow("Status update failed");

      // Verify: Session unchanged (still reading)
      const currentSession = await sessionRepository.findById(session.id);
      expect(currentSession?.status).toBe("reading");
      expect(currentSession?.isActive).toBe(true);
      expect(currentSession?.completedDate).toBeNull();

      // Cleanup
      sessionRepository.update = originalUpdate;
    });

    test("ManualSessionUpdateStrategy: session creation is atomic", async () => {
      // Setup: Book without pages, no existing session
      const book = await bookRepository.create(createTestBook({ totalPages: null }));

      // Mock to fail on create
      const originalCreate = sessionRepository.create;
      sessionRepository.create = mock(async (data: any, tx?: any) => {
        if (tx) {
          throw new Error("Creation failed");
        }
        return originalSessionCreate.call(sessionRepository, data, tx);
      }) as any;

      // Attempt to mark as read
      await expect(
        sessionService.markAsRead({ bookId: book.id })
      ).rejects.toThrow("Creation failed");

      // Verify: No session exists
      const sessions = await sessionRepository.findAllByBookId(book.id);
      expect(sessions.length).toBe(0);

      // Cleanup
      sessionRepository.create = originalCreate;
    });
  });
});
