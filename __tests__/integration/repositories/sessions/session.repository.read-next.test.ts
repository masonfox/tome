/**
 * Tests for read-next ordering functionality in SessionRepository
 * 
 * Tests the three new methods:
 * - getNextReadNextOrder()
 * - reorderReadNextBooks()
 * - reindexReadNextOrders()
 */

import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { sessionRepository } from "@/lib/repositories/session.repository";
import { bookRepository } from "@/lib/repositories/book.repository";
import {
  setupTestDatabase,
  clearTestDatabase,
} from "@/__tests__/helpers/db-setup";

describe("SessionRepository - Read-Next Ordering", () => {
  beforeAll(async () => {
    await setupTestDatabase(__filename);
  });

  beforeEach(async () => {
    await clearTestDatabase(__filename);
  });

  describe("getNextReadNextOrder", () => {
    it("should return 0 when no read-next books exist", async () => {
      const nextOrder = await sessionRepository.getNextReadNextOrder();
      expect(nextOrder).toBe(0);
    });

    it("should return max + 1 when read-next books exist", async () => {
      // Create books
      const book1 = await bookRepository.create({
        calibreId: 1,
        title: "Test Book 1",
        path: "test1.epub",
      });

      const book2 = await bookRepository.create({
        calibreId: 2,
        title: "Test Book 2",
        path: "test2.epub",
      });

      // Create multiple read-next sessions with different orders
      await sessionRepository.create({
        bookId: book1.id,
        sessionNumber: 1,
        status: "read-next",
        readNextOrder: 0,
      });

      await sessionRepository.create({
        bookId: book2.id,
        sessionNumber: 1,
        status: "read-next",
        readNextOrder: 2,
      });

      const nextOrder = await sessionRepository.getNextReadNextOrder();
      expect(nextOrder).toBe(3); // max(0, 2) + 1
    });

    it("should ignore non-read-next sessions", async () => {
      const book = await bookRepository.create({
        calibreId: 1,
        title: "Test Book",
        path: "test.epub",
      });

      // Create sessions with various statuses
      await sessionRepository.create({
        bookId: book.id,
        sessionNumber: 1,
        status: "to-read",
        readNextOrder: 5, // Should be ignored
      });

      // Create second book for second session (can't have 2 sessions for same book without finishing first)
      const book2 = await bookRepository.create({
        calibreId: 2,
        title: "Test Book 2",
        path: "test2.epub",
      });

      await sessionRepository.create({
        bookId: book2.id,
        sessionNumber: 1,
        status: "reading",
        readNextOrder: 10, // Should be ignored
      });

      const nextOrder = await sessionRepository.getNextReadNextOrder();
      expect(nextOrder).toBe(0); // No read-next sessions
    });
  });

  describe("reorderReadNextBooks", () => {
    it("should update multiple books in a single transaction", async () => {
      // Create books and sessions
      const book1 = await bookRepository.create({
        calibreId: 1,
        title: "Book 1",
        path: "book1.epub",
      });

      const book2 = await bookRepository.create({
        calibreId: 2,
        title: "Book 2",
        path: "book2.epub",
      });

      const session1 = await sessionRepository.create({
        bookId: book1.id,
        sessionNumber: 1,
        status: "read-next",
        readNextOrder: 0,
      });

      const session2 = await sessionRepository.create({
        bookId: book2.id,
        sessionNumber: 1,
        status: "read-next",
        readNextOrder: 1,
      });

      // Reorder (swap positions)
      await sessionRepository.reorderReadNextBooks([
        { id: session1.id, readNextOrder: 1 },
        { id: session2.id, readNextOrder: 0 },
      ]);

      // Verify new order
      const updated1 = await sessionRepository.findById(session1.id);
      const updated2 = await sessionRepository.findById(session2.id);

      expect(updated1?.readNextOrder).toBe(1);
      expect(updated2?.readNextOrder).toBe(0);
    });

    it("should update updatedAt timestamp", async () => {
      const book = await bookRepository.create({
        calibreId: 1,
        title: "Test Book",
        path: "book.epub",
      });

      const session = await sessionRepository.create({
        bookId: book.id,
        sessionNumber: 1,
        status: "read-next",
        readNextOrder: 0,
      });

      const originalUpdatedAt = session.updatedAt;

      // Wait a bit to ensure timestamp difference
      await new Promise((resolve) => setTimeout(resolve, 50));

      await sessionRepository.reorderReadNextBooks([
        { id: session.id, readNextOrder: 5 },
      ]);

      const updated = await sessionRepository.findById(session.id);
      expect(updated?.updatedAt.getTime()).toBeGreaterThanOrEqual(
        originalUpdatedAt.getTime()
      );
    });

    it("should handle empty updates array", async () => {
      await expect(
        sessionRepository.reorderReadNextBooks([])
      ).resolves.not.toThrow();
    });
  });

  describe("reindexReadNextOrders", () => {
    it("should eliminate gaps and renumber sequentially", async () => {
      // Create books with non-sequential orders (gaps)
      const book1 = await bookRepository.create({
        calibreId: 1,
        title: "Book 1",
        path: "book1.epub",
      });

      const book2 = await bookRepository.create({
        calibreId: 2,
        title: "Book 2",
        path: "book2.epub",
      });

      const book3 = await bookRepository.create({
        calibreId: 3,
        title: "Book 3",
        path: "book3.epub",
      });

      const session1 = await sessionRepository.create({
        bookId: book1.id,
        sessionNumber: 1,
        status: "read-next",
        readNextOrder: 0,
      });

      const session2 = await sessionRepository.create({
        bookId: book2.id,
        sessionNumber: 1,
        status: "read-next",
        readNextOrder: 5, // Gap
      });

      const session3 = await sessionRepository.create({
        bookId: book3.id,
        sessionNumber: 1,
        status: "read-next",
        readNextOrder: 10, // Gap
      });

      // Reindex
      await sessionRepository.reindexReadNextOrders();

      // Verify sequential order (0, 1, 2)
      const updated1 = await sessionRepository.findById(session1.id);
      const updated2 = await sessionRepository.findById(session2.id);
      const updated3 = await sessionRepository.findById(session3.id);

      expect(updated1?.readNextOrder).toBe(0);
      expect(updated2?.readNextOrder).toBe(1);
      expect(updated3?.readNextOrder).toBe(2);
    });

    it("should only affect read-next status books", async () => {
      const book1 = await bookRepository.create({
        calibreId: 1,
        title: "Book 1",
        path: "book1.epub",
      });

      const book2 = await bookRepository.create({
        calibreId: 2,
        title: "Book 2",
        path: "book2.epub",
      });

      const readNextSession = await sessionRepository.create({
        bookId: book1.id,
        sessionNumber: 1,
        status: "read-next",
        readNextOrder: 5,
      });

      const toReadSession = await sessionRepository.create({
        bookId: book2.id,
        sessionNumber: 1,
        status: "to-read",
        readNextOrder: 10,
      });

      await sessionRepository.reindexReadNextOrders();

      const updated1 = await sessionRepository.findById(readNextSession.id);
      const updated2 = await sessionRepository.findById(toReadSession.id);

      expect(updated1?.readNextOrder).toBe(0); // Reindexed
      expect(updated2?.readNextOrder).toBe(10); // Unchanged
    });

    it("should handle empty read-next queue", async () => {
      await expect(
        sessionRepository.reindexReadNextOrders()
      ).resolves.not.toThrow();
    });

    it("should preserve order when already sequential", async () => {
      const book1 = await bookRepository.create({
        calibreId: 1,
        title: "Book 1",
        path: "book1.epub",
      });

      const book2 = await bookRepository.create({
        calibreId: 2,
        title: "Book 2",
        path: "book2.epub",
      });

      const session1 = await sessionRepository.create({
        bookId: book1.id,
        sessionNumber: 1,
        status: "read-next",
        readNextOrder: 0,
      });

      const session2 = await sessionRepository.create({
        bookId: book2.id,
        sessionNumber: 1,
        status: "read-next",
        readNextOrder: 1,
      });

      await sessionRepository.reindexReadNextOrders();

      const updated1 = await sessionRepository.findById(session1.id);
      const updated2 = await sessionRepository.findById(session2.id);

      expect(updated1?.readNextOrder).toBe(0);
      expect(updated2?.readNextOrder).toBe(1);
    });
  });
});
