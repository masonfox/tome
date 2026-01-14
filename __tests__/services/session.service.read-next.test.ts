/**
 * Tests for read-next ordering logic in SessionService
 * 
 * Tests the auto-compaction behavior when status transitions involve read-next:
 * - Entering read-next assigns sequential order
 * - Leaving read-next resets order to 0 and compacts remaining
 * - Status changes not involving read-next don't affect ordering
 */

import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { sessionService } from "@/lib/services/session.service";
import { sessionRepository } from "@/lib/repositories/session.repository";
import { bookRepository } from "@/lib/repositories/book.repository";
import {
  setupTestDatabase,
  clearTestDatabase,
} from "@/__tests__/helpers/db-setup";

describe("SessionService - Read-Next Ordering", () => {
  beforeAll(async () => {
    await setupTestDatabase(__filename);
  });

  beforeEach(async () => {
    await clearTestDatabase(__filename);
  });

  describe("entering read-next status", () => {
    it("should assign sequential order when entering read-next", async () => {
      // Create three books
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

      // Update all to read-next (should get orders 0, 1, 2)
      await sessionService.updateStatus(book1.id, { status: "read-next" });
      await sessionService.updateStatus(book2.id, { status: "read-next" });
      await sessionService.updateStatus(book3.id, { status: "read-next" });

      // Verify orders
      const session1 = await sessionRepository.findActiveByBookId(book1.id);
      const session2 = await sessionRepository.findActiveByBookId(book2.id);
      const session3 = await sessionRepository.findActiveByBookId(book3.id);

      expect(session1?.readNextOrder).toBe(0);
      expect(session2?.readNextOrder).toBe(1);
      expect(session3?.readNextOrder).toBe(2);
    });

    it("should auto-compact after entering read-next", async () => {
      const book = await bookRepository.create({
        calibreId: 1,
        title: "Book 1",
        path: "book1.epub",
      });

      // Create a read-next session manually with high order
      await sessionRepository.create({
        bookId: book.id,
        sessionNumber: 1,
        status: "read-next",
        readNextOrder: 100,
      });

      // Create another book and set to read-next (should trigger compaction)
      const book2 = await bookRepository.create({
        calibreId: 2,
        title: "Book 2",
        path: "book2.epub",
      });

      await sessionService.updateStatus(book2.id, { status: "read-next" });

      // Both should now be sequential (0, 1)
      const session1 = await sessionRepository.findActiveByBookId(book.id);
      const session2 = await sessionRepository.findActiveByBookId(book2.id);

      expect(session1?.readNextOrder).toBe(0);
      expect(session2?.readNextOrder).toBe(1);
    });
  });

  describe("leaving read-next status", () => {
    it("should reset order to 0 when leaving read-next", async () => {
      const book = await bookRepository.create({
        calibreId: 1,
        title: "Book 1",
        path: "book1.epub",
        totalPages: 300,
      });

      // Set to read-next
      await sessionService.updateStatus(book.id, { status: "read-next" });

      const session = await sessionRepository.findActiveByBookId(book.id);
      expect(session?.readNextOrder).toBe(0);

      // Move to reading
      await sessionService.updateStatus(book.id, { status: "reading" });

      const updatedSession = await sessionRepository.findActiveByBookId(book.id);
      expect(updatedSession?.readNextOrder).toBe(0);
      expect(updatedSession?.status).toBe("reading");
    });

    it("should auto-compact remaining books when one leaves read-next", async () => {
      // Create three read-next books (orders 0, 1, 2)
      const book1 = await bookRepository.create({
        calibreId: 1,
        title: "Book 1",
        path: "book1.epub",
        totalPages: 300,
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

      await sessionService.updateStatus(book1.id, { status: "read-next" });
      await sessionService.updateStatus(book2.id, { status: "read-next" });
      await sessionService.updateStatus(book3.id, { status: "read-next" });

      // Move book1 to reading (should trigger compaction)
      await sessionService.updateStatus(book1.id, { status: "reading" });

      // Book1 should have order 0 (reset)
      const session1 = await sessionRepository.findActiveByBookId(book1.id);
      expect(session1?.readNextOrder).toBe(0);
      expect(session1?.status).toBe("reading");

      // Book2 and Book3 should be compacted to 0, 1
      const session2 = await sessionRepository.findActiveByBookId(book2.id);
      const session3 = await sessionRepository.findActiveByBookId(book3.id);

      expect(session2?.readNextOrder).toBe(0);
      expect(session3?.readNextOrder).toBe(1);
    });

    it("should handle leaving read-next for to-read status", async () => {
      const book = await bookRepository.create({
        calibreId: 1,
        title: "Book 1",
        path: "book1.epub",
      });

      // Set to read-next
      await sessionService.updateStatus(book.id, { status: "read-next" });

      // Move back to to-read
      await sessionService.updateStatus(book.id, { status: "to-read" });

      const session = await sessionRepository.findActiveByBookId(book.id);
      expect(session?.readNextOrder).toBe(0);
      expect(session?.status).toBe("to-read");
    });
  });

  describe("status changes not involving read-next", () => {
    it("should not affect order when changing between non-read-next statuses", async () => {
      const book = await bookRepository.create({
        calibreId: 1,
        title: "Book 1",
        path: "book1.epub",
        totalPages: 300,
      });

      // to-read → reading
      await sessionService.updateStatus(book.id, { status: "to-read" });
      await sessionService.updateStatus(book.id, { status: "reading" });

      const session = await sessionRepository.findActiveByBookId(book.id);
      expect(session?.readNextOrder).toBe(0);
      expect(session?.status).toBe("reading");
    });

    it("should preserve read-next order when updating within read-next", async () => {
      const book = await bookRepository.create({
        calibreId: 1,
        title: "Book 1",
        path: "book1.epub",
      });

      // Set to read-next
      const result = await sessionService.updateStatus(book.id, { status: "read-next" });
      const originalOrder = result.session.readNextOrder;

      // Update with same status (e.g., adding review)
      await sessionService.updateStatus(book.id, {
        status: "read-next",
        review: "Can't wait to read this!",
      });

      const session = await sessionRepository.findActiveByBookId(book.id);
      expect(session?.readNextOrder).toBe(originalOrder);
      expect(session?.review).toBe("Can't wait to read this!");
    });
  });

  describe("edge cases", () => {
    it("should handle empty read-next queue", async () => {
      const book = await bookRepository.create({
        calibreId: 1,
        title: "Book 1",
        path: "book1.epub",
      });

      // First book entering empty queue gets order 0
      await sessionService.updateStatus(book.id, { status: "read-next" });

      const session = await sessionRepository.findActiveByBookId(book.id);
      expect(session?.readNextOrder).toBe(0);
    });

    it("should handle rapid status changes", async () => {
      const book = await bookRepository.create({
        calibreId: 1,
        title: "Book 1",
        path: "book1.epub",
        totalPages: 300,
      });

      // Rapid transitions: to-read → read-next → reading → read-next
      await sessionService.updateStatus(book.id, { status: "to-read" });
      await sessionService.updateStatus(book.id, { status: "read-next" });
      await sessionService.updateStatus(book.id, { status: "reading" });
      await sessionService.updateStatus(book.id, { status: "read-next" });

      const session = await sessionRepository.findActiveByBookId(book.id);
      expect(session?.readNextOrder).toBe(0); // Should have valid order
      expect(session?.status).toBe("read-next");
    });
  });
});
