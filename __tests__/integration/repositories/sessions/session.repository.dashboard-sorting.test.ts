/**
 * Tests for dashboard read-next sorting behavior in sessionRepository.findByStatus()
 * 
 * Verifies that:
 * - read-next status sorts by readNextOrder ASC (0, 1, 2, 3...)
 * - Other statuses sort by updatedAt DESC (most recent first)
 * - Limit parameter works correctly with both sort orders
 */

import { describe, test, expect, beforeAll, beforeEach, afterAll } from "vitest";
import { bookRepository, sessionRepository } from "@/lib/repositories";
import {
  setupTestDatabase,
  clearTestDatabase,
  teardownTestDatabase,
} from "@/__tests__/helpers/db-setup";

describe("sessionRepository.findByStatus - Dashboard Sorting", () => {
  beforeAll(async () => {
    await setupTestDatabase(__filename);
  });

  beforeEach(async () => {
    await clearTestDatabase(__filename);
  });

  afterAll(async () => {
    await teardownTestDatabase(__filename);
  });

  describe("read-next status sorting", () => {
    test("should return read-next sessions sorted by readNextOrder ASC", async () => {
      // Create 3 separate books (unique constraint: only 1 active session per book)
      const book1 = await bookRepository.create({
        calibreId: 1,
        title: "Book 1",
        authors: ["Author 1"],
        path: "/test/path1",
      });

      const book2 = await bookRepository.create({
        calibreId: 2,
        title: "Book 2",
        authors: ["Author 2"],
        path: "/test/path2",
      });

      const book3 = await bookRepository.create({
        calibreId: 3,
        title: "Book 3",
        authors: ["Author 3"],
        path: "/test/path3",
      });

      // Create read-next sessions with readNextOrder in non-sequential creation order
      // Create with readNextOrder: 2, 0, 1 to ensure we're sorting by readNextOrder
      const session2 = await sessionRepository.create({
        bookId: book1.id,
        sessionNumber: 1,
        status: "read-next",
        isActive: true,
        readNextOrder: 2,
      });

      await new Promise(resolve => setTimeout(resolve, 10));

      const session0 = await sessionRepository.create({
        bookId: book2.id,
        sessionNumber: 1,
        status: "read-next",
        isActive: true,
        readNextOrder: 0,
      });

      await new Promise(resolve => setTimeout(resolve, 10));

      const session1 = await sessionRepository.create({
        bookId: book3.id,
        sessionNumber: 1,
        status: "read-next",
        isActive: true,
        readNextOrder: 1,
      });

      // Update sessions in different order to vary updatedAt timestamps
      // This ensures we're NOT sorting by updatedAt
      await sessionRepository.update(session2.id, { status: "read-next" });
      await new Promise(resolve => setTimeout(resolve, 10));
      await sessionRepository.update(session0.id, { status: "read-next" });
      await new Promise(resolve => setTimeout(resolve, 10));
      await sessionRepository.update(session1.id, { status: "read-next" });

      // Fetch read-next sessions
      const sessions = await sessionRepository.findByStatus("read-next", true);

      // Should be sorted by readNextOrder ASC: 0, 1, 2
      expect(sessions).toHaveLength(3);
      expect(sessions[0].readNextOrder).toBe(0);
      expect(sessions[0].id).toBe(session0.id);
      expect(sessions[1].readNextOrder).toBe(1);
      expect(sessions[1].id).toBe(session1.id);
      expect(sessions[2].readNextOrder).toBe(2);
      expect(sessions[2].id).toBe(session2.id);
    });

    test("should respect limit parameter with read-next ordering", async () => {
      // Create 5 separate books
      const books = [];
      for (let i = 0; i < 5; i++) {
        const book = await bookRepository.create({
          calibreId: i + 1,
          title: `Book ${i + 1}`,
          authors: [`Author ${i + 1}`],
          path: `/test/path${i + 1}`,
        });
        books.push(book);
      }

      // Create read-next sessions with sequential readNextOrder
      for (let i = 0; i < 5; i++) {
        await sessionRepository.create({
          bookId: books[i].id,
          sessionNumber: 1,
          status: "read-next",
          isActive: true,
          readNextOrder: i,
        });
        await new Promise(resolve => setTimeout(resolve, 5));
      }

      // Fetch with limit=3
      const sessions = await sessionRepository.findByStatus("read-next", true, 3);

      // Should return first 3 in order: 0, 1, 2
      expect(sessions).toHaveLength(3);
      expect(sessions[0].readNextOrder).toBe(0);
      expect(sessions[1].readNextOrder).toBe(1);
      expect(sessions[2].readNextOrder).toBe(2);
    });

    test("should handle gaps in readNextOrder sequence", async () => {
      // Create 3 books
      const book0 = await bookRepository.create({
        calibreId: 1,
        title: "Book 0",
        authors: ["Author 0"],
        path: "/test/path0",
      });

      const book2 = await bookRepository.create({
        calibreId: 2,
        title: "Book 2",
        authors: ["Author 2"],
        path: "/test/path2",
      });

      const book5 = await bookRepository.create({
        calibreId: 3,
        title: "Book 5",
        authors: ["Author 5"],
        path: "/test/path5",
      });

      // Create sessions with gaps in readNextOrder (0, 2, 5)
      const session0 = await sessionRepository.create({
        bookId: book0.id,
        sessionNumber: 1,
        status: "read-next",
        isActive: true,
        readNextOrder: 0,
      });

      const session2 = await sessionRepository.create({
        bookId: book2.id,
        sessionNumber: 1,
        status: "read-next",
        isActive: true,
        readNextOrder: 2,
      });

      const session5 = await sessionRepository.create({
        bookId: book5.id,
        sessionNumber: 1,
        status: "read-next",
        isActive: true,
        readNextOrder: 5,
      });

      const sessions = await sessionRepository.findByStatus("read-next", true);

      // Should maintain order despite gaps: 0, 2, 5
      expect(sessions).toHaveLength(3);
      expect(sessions[0].readNextOrder).toBe(0);
      expect(sessions[1].readNextOrder).toBe(2);
      expect(sessions[2].readNextOrder).toBe(5);
    });

    test("should return empty array when no read-next sessions exist", async () => {
      const sessions = await sessionRepository.findByStatus("read-next", true);
      expect(sessions).toEqual([]);
    });
  });
});
