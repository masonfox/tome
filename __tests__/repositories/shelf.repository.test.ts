import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { shelfRepository } from "@/lib/repositories/shelf.repository";
import { bookRepository } from "@/lib/repositories/book.repository";
import { sessionRepository } from "@/lib/repositories/session.repository";
import { setupTestDatabase, teardownTestDatabase, clearTestDatabase } from "@/__tests__/helpers/db-setup";

describe("ShelfRepository - Status Display", () => {
  beforeAll(async () => {
    await setupTestDatabase(__filename);
  });

  beforeEach(async () => {
    await clearTestDatabase(__filename);
  });

  afterAll(async () => {
    await teardownTestDatabase(__filename);
  });

  describe("getBooksInShelf", () => {
    it("should return status from most recent reading session regardless of isActive", async () => {
      // Create a shelf
      const shelf = await shelfRepository.create({
        name: "Test Shelf",
        userId: null,
      });

      // Create books
      const book1 = await bookRepository.create({
        calibreId: 1,
        title: "Book with Read Status",
        authors: ["Author 1"],
        tags: [],
        path: "/path/1",
      });

      const book2 = await bookRepository.create({
        calibreId: 2,
        title: "Book with Reading Status",
        authors: ["Author 2"],
        tags: [],
        path: "/path/2",
      });

      const book3 = await bookRepository.create({
        calibreId: 3,
        title: "Book with To-Read Status",
        authors: ["Author 3"],
        tags: [],
        path: "/path/3",
      });

      const book4 = await bookRepository.create({
        calibreId: 4,
        title: "Book without Session",
        authors: ["Author 4"],
        tags: [],
        path: "/path/4",
      });

      // Add books to shelf
      await shelfRepository.addBookToShelf(shelf.id, book1!.id);
      await shelfRepository.addBookToShelf(shelf.id, book2!.id);
      await shelfRepository.addBookToShelf(shelf.id, book3!.id);
      await shelfRepository.addBookToShelf(shelf.id, book4!.id);

      // Create reading sessions
      // Book 1: Read status (isActive = false)
      await sessionRepository.create({
        bookId: book1!.id,
        userId: null,
        sessionNumber: 1,
        status: "read",
        isActive: false,
        completedDate: new Date("2024-01-15"),
      });

      // Book 2: Reading status (isActive = true)
      await sessionRepository.create({
        bookId: book2!.id,
        userId: null,
        sessionNumber: 1,
        status: "reading",
        isActive: true,
        startedDate: new Date("2024-01-10"),
      });

      // Book 3: To-read status (isActive = true)
      await sessionRepository.create({
        bookId: book3!.id,
        userId: null,
        sessionNumber: 1,
        status: "to-read",
        isActive: true,
      });

      // Book 4: No session (status should be null)

      // Get books from shelf
      const books = await shelfRepository.getBooksOnShelf(shelf.id, "sortOrder", "asc");

      expect(books).toHaveLength(4);

      // Find each book and verify status
      const readBook = books.find((b: any) => b.id === book1!.id);
      const readingBook = books.find((b: any) => b.id === book2!.id);
      const toReadBook = books.find((b: any) => b.id === book3!.id);
      const noSessionBook = books.find((b: any) => b.id === book4!.id);

      expect(readBook?.status).toBe("read"); // This was the bug - returned null before fix
      expect(readingBook?.status).toBe("reading");
      expect(toReadBook?.status).toBe("to-read");
      expect(noSessionBook?.status).toBeNull();
    });

    it("should return status from most recent session when multiple sessions exist", async () => {
      // Create a shelf
      const shelf = await shelfRepository.create({
        name: "Test Shelf",
        userId: null,
      });

      // Create a book
      const book = await bookRepository.create({
        calibreId: 1,
        title: "Book with Multiple Sessions",
        authors: ["Author 1"],
        tags: [],
        path: "/path/1",
      });

      await shelfRepository.addBookToShelf(shelf.id, book!.id);

      // Create multiple sessions (simulating re-reading)
      // Session 1: Read (completed)
      await sessionRepository.create({
        bookId: book!.id,
        userId: null,
        sessionNumber: 1,
        status: "read",
        isActive: false,
        completedDate: new Date("2024-01-15"),
      });

      // Session 2: Reading (current)
      await sessionRepository.create({
        bookId: book!.id,
        userId: null,
        sessionNumber: 2,
        status: "reading",
        isActive: true,
        startedDate: new Date("2024-02-01"),
      });

      // Get books from shelf
      const books = await shelfRepository.getBooksOnShelf(shelf.id, "sortOrder", "asc");

      expect(books).toHaveLength(1);
      // Should return the most recent session status (session 2 = "reading")
      expect(books[0].status).toBe("reading");
    });

    it("should handle all status types correctly", async () => {
      // Create a shelf
      const shelf = await shelfRepository.create({
        name: "Test Shelf",
        userId: null,
      });

      const statuses: Array<"to-read" | "read-next" | "reading" | "read"> = [
        "to-read",
        "read-next",
        "reading",
        "read",
      ];

      const createdBooks: number[] = [];

      // Create a book for each status
      for (let i = 0; i < statuses.length; i++) {
        const book = await bookRepository.create({
          calibreId: i + 1,
          title: `Book with ${statuses[i]} status`,
          authors: [`Author ${i + 1}`],
          tags: [],
          path: `/path/${i + 1}`,
        });

        await shelfRepository.addBookToShelf(shelf.id, book!.id);
        createdBooks.push(book!.id);

        // Create session with this status
        await sessionRepository.create({
          bookId: book!.id,
          userId: null,
          sessionNumber: 1,
          status: statuses[i],
          isActive: statuses[i] !== "read", // "read" books have isActive = false
          completedDate: statuses[i] === "read" ? new Date() : undefined,
        });
      }

      // Get books from shelf
      const books = await shelfRepository.getBooksOnShelf(shelf.id, "sortOrder", "asc");

      expect(books).toHaveLength(4);

      // Verify each status
      for (let i = 0; i < statuses.length; i++) {
        const book = books.find((b: any) => b.id === createdBooks[i]);
        expect(book?.status).toBe(statuses[i]);
      }
    });
  });
});
