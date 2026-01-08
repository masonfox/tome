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

  describe("getBooksOnShelf - Author Sorting by Last Name", () => {
    it("should sort books by author last name in ascending order", async () => {
      // Create a shelf
      const shelf = await shelfRepository.create({
        name: "Author Sort Test Shelf",
        userId: null,
      });

      // Create books with different author last names
      const book1 = await bookRepository.create({
        calibreId: 1,
        title: "Book by Sanderson",
        authors: ["Brandon Sanderson"], // Last name: Sanderson
        tags: [],
        path: "/path/1",
      });

      const book2 = await bookRepository.create({
        calibreId: 2,
        title: "Book by Rothfuss",
        authors: ["Patrick Rothfuss"], // Last name: Rothfuss
        tags: [],
        path: "/path/2",
      });

      const book3 = await bookRepository.create({
        calibreId: 3,
        title: "Book by Abercrombie",
        authors: ["Joe Abercrombie"], // Last name: Abercrombie
        tags: [],
        path: "/path/3",
      });

      const book4 = await bookRepository.create({
        calibreId: 4,
        title: "Book by Le Guin",
        authors: ["Ursula K. Le Guin"], // Last name: Guin (last word)
        tags: [],
        path: "/path/4",
      });

      const book5 = await bookRepository.create({
        calibreId: 5,
        title: "Book by Plato",
        authors: ["Plato"], // Single name: Plato
        tags: [],
        path: "/path/5",
      });

      // Add books to shelf in random order
      await shelfRepository.addBookToShelf(shelf.id, book1!.id);
      await shelfRepository.addBookToShelf(shelf.id, book2!.id);
      await shelfRepository.addBookToShelf(shelf.id, book3!.id);
      await shelfRepository.addBookToShelf(shelf.id, book4!.id);
      await shelfRepository.addBookToShelf(shelf.id, book5!.id);

      // Get books sorted by author ascending
      const booksAsc = await shelfRepository.getBooksOnShelf(shelf.id, "author", "asc");

      expect(booksAsc).toHaveLength(5);
      
      // Expected order by last name:
      // Abercrombie, Guin, Plato, Rothfuss, Sanderson
      expect(booksAsc[0].id).toBe(book3!.id); // Abercrombie
      expect(booksAsc[1].id).toBe(book4!.id); // Guin (from Le Guin)
      expect(booksAsc[2].id).toBe(book5!.id); // Plato
      expect(booksAsc[3].id).toBe(book2!.id); // Rothfuss
      expect(booksAsc[4].id).toBe(book1!.id); // Sanderson
    });

    it("should sort books by author last name in descending order", async () => {
      // Create a shelf
      const shelf = await shelfRepository.create({
        name: "Author Sort Desc Test Shelf",
        userId: null,
      });

      // Create books with different author last names
      const book1 = await bookRepository.create({
        calibreId: 1,
        title: "Book by Sanderson",
        authors: ["Brandon Sanderson"],
        tags: [],
        path: "/path/1",
      });

      const book2 = await bookRepository.create({
        calibreId: 2,
        title: "Book by Abercrombie",
        authors: ["Joe Abercrombie"],
        tags: [],
        path: "/path/2",
      });

      // Add books to shelf
      await shelfRepository.addBookToShelf(shelf.id, book1!.id);
      await shelfRepository.addBookToShelf(shelf.id, book2!.id);

      // Get books sorted by author descending
      const booksDesc = await shelfRepository.getBooksOnShelf(shelf.id, "author", "desc");

      expect(booksDesc).toHaveLength(2);
      
      // Expected order by last name descending:
      // Sanderson, Abercrombie
      expect(booksDesc[0].id).toBe(book1!.id); // Sanderson
      expect(booksDesc[1].id).toBe(book2!.id); // Abercrombie
    });

    it("should handle books with no authors when sorting by author", async () => {
      // Create a shelf
      const shelf = await shelfRepository.create({
        name: "No Author Test Shelf",
        userId: null,
      });

      // Create book with authors
      const book1 = await bookRepository.create({
        calibreId: 1,
        title: "Book with Author",
        authors: ["Brandon Sanderson"],
        tags: [],
        path: "/path/1",
      });

      // Create book with empty authors array
      const book2 = await bookRepository.create({
        calibreId: 2,
        title: "Book without Author",
        authors: [],
        tags: [],
        path: "/path/2",
      });

      // Add books to shelf
      await shelfRepository.addBookToShelf(shelf.id, book1!.id);
      await shelfRepository.addBookToShelf(shelf.id, book2!.id);

      // Get books sorted by author
      const books = await shelfRepository.getBooksOnShelf(shelf.id, "author", "asc");

      expect(books).toHaveLength(2);
      
      // Books with no author (empty string) should come first
      expect(books[0].id).toBe(book2!.id); // No author (empty)
      expect(books[1].id).toBe(book1!.id); // Sanderson
    });

    it("should handle multi-word last names correctly", async () => {
      // Create a shelf
      const shelf = await shelfRepository.create({
        name: "Multi-word Last Name Shelf",
        userId: null,
      });

      // Create books with multi-word last names
      const book1 = await bookRepository.create({
        calibreId: 1,
        title: "Book by Le Guin",
        authors: ["Ursula K. Le Guin"], // Last word: Guin
        tags: [],
        path: "/path/1",
      });

      const book2 = await bookRepository.create({
        calibreId: 2,
        title: "Book by King",
        authors: ["Martin Luther King Jr."], // Last word: Jr.
        tags: [],
        path: "/path/2",
      });

      const book3 = await bookRepository.create({
        calibreId: 3,
        title: "Book by van Gogh",
        authors: ["Vincent van Gogh"], // Last word: Gogh
        tags: [],
        path: "/path/3",
      });

      // Add books to shelf
      await shelfRepository.addBookToShelf(shelf.id, book1!.id);
      await shelfRepository.addBookToShelf(shelf.id, book2!.id);
      await shelfRepository.addBookToShelf(shelf.id, book3!.id);

      // Get books sorted by author
      const books = await shelfRepository.getBooksOnShelf(shelf.id, "author", "asc");

      expect(books).toHaveLength(3);
      
      // Expected order by last word (simple implementation):
      // Gogh, Guin, Jr.
      expect(books[0].id).toBe(book3!.id); // Gogh
      expect(books[1].id).toBe(book1!.id); // Guin
      expect(books[2].id).toBe(book2!.id); // Jr.
    });
  });

  describe("reindexShelfBooks", () => {
    it("should reindex books to have continuous sortOrder (0, 1, 2, ...)", async () => {
      // Create a shelf
      const shelf = await shelfRepository.create({
        name: "Reindex Test Shelf",
        userId: null,
      });

      // Create books
      const book1 = await bookRepository.create({
        calibreId: 1,
        title: "First Book",
        authors: ["Author 1"],
        tags: [],
        path: "/path/1",
      });

      const book2 = await bookRepository.create({
        calibreId: 2,
        title: "Second Book",
        authors: ["Author 2"],
        tags: [],
        path: "/path/2",
      });

      const book3 = await bookRepository.create({
        calibreId: 3,
        title: "Third Book",
        authors: ["Author 3"],
        tags: [],
        path: "/path/3",
      });

      // Add books with explicit sortOrder values that have gaps
      await shelfRepository.addBookToShelf(shelf.id, book1!.id, 0);
      await shelfRepository.addBookToShelf(shelf.id, book2!.id, 5); // Gap
      await shelfRepository.addBookToShelf(shelf.id, book3!.id, 10); // Gap

      // Verify gaps exist
      const booksBeforeReindex = await shelfRepository.getBooksOnShelf(shelf.id, "sortOrder", "asc");
      expect(booksBeforeReindex[0].sortOrder).toBe(0);
      expect(booksBeforeReindex[1].sortOrder).toBe(5);
      expect(booksBeforeReindex[2].sortOrder).toBe(10);

      // Reindex
      await shelfRepository.reindexShelfBooks(shelf.id);

      // Verify continuous sortOrder
      const booksAfterReindex = await shelfRepository.getBooksOnShelf(shelf.id, "sortOrder", "asc");
      expect(booksAfterReindex).toHaveLength(3);
      expect(booksAfterReindex[0].sortOrder).toBe(0);
      expect(booksAfterReindex[1].sortOrder).toBe(1);
      expect(booksAfterReindex[2].sortOrder).toBe(2);

      // Verify order is preserved
      expect(booksAfterReindex[0].id).toBe(book1!.id);
      expect(booksAfterReindex[1].id).toBe(book2!.id);
      expect(booksAfterReindex[2].id).toBe(book3!.id);
    });

    it("should preserve existing order when reindexing", async () => {
      // Create a shelf
      const shelf = await shelfRepository.create({
        name: "Order Preservation Shelf",
        userId: null,
      });

      // Create books
      const books = [];
      for (let i = 0; i < 5; i++) {
        const book = await bookRepository.create({
          calibreId: i + 1,
          title: `Book ${i + 1}`,
          authors: [`Author ${i + 1}`],
          tags: [],
          path: `/path/${i + 1}`,
        });
        books.push(book!);
      }

      // Add books with gaps in sortOrder (simulating removals)
      await shelfRepository.addBookToShelf(shelf.id, books[0].id, 0);
      await shelfRepository.addBookToShelf(shelf.id, books[1].id, 1);
      await shelfRepository.addBookToShelf(shelf.id, books[2].id, 5); // Gap after removal
      await shelfRepository.addBookToShelf(shelf.id, books[3].id, 7); // Gap after removal
      await shelfRepository.addBookToShelf(shelf.id, books[4].id, 12); // Gap after removal

      // Reindex
      await shelfRepository.reindexShelfBooks(shelf.id);

      // Verify continuous sortOrder and preserved order
      const reindexedBooks = await shelfRepository.getBooksOnShelf(shelf.id, "sortOrder", "asc");
      expect(reindexedBooks).toHaveLength(5);
      
      for (let i = 0; i < 5; i++) {
        expect(reindexedBooks[i].sortOrder).toBe(i);
        expect(reindexedBooks[i].id).toBe(books[i].id);
      }
    });

    it("should handle empty shelf when reindexing", async () => {
      // Create an empty shelf
      const shelf = await shelfRepository.create({
        name: "Empty Shelf",
        userId: null,
      });

      // Should not throw error
      await expect(shelfRepository.reindexShelfBooks(shelf.id)).resolves.not.toThrow();

      // Verify shelf is still empty
      const books = await shelfRepository.getBooksOnShelf(shelf.id, "sortOrder", "asc");
      expect(books).toHaveLength(0);
    });

    it("should handle shelf with single book when reindexing", async () => {
      // Create a shelf
      const shelf = await shelfRepository.create({
        name: "Single Book Shelf",
        userId: null,
      });

      // Create and add a single book with non-zero sortOrder
      const book = await bookRepository.create({
        calibreId: 1,
        title: "Only Book",
        authors: ["Author 1"],
        tags: [],
        path: "/path/1",
      });

      await shelfRepository.addBookToShelf(shelf.id, book!.id, 99);

      // Reindex
      await shelfRepository.reindexShelfBooks(shelf.id);

      // Verify sortOrder is now 0
      const books = await shelfRepository.getBooksOnShelf(shelf.id, "sortOrder", "asc");
      expect(books).toHaveLength(1);
      expect(books[0].sortOrder).toBe(0);
      expect(books[0].id).toBe(book!.id);
    });
  });

  describe("removeBookFromShelf - Auto Reindexing", () => {
    it("should automatically reindex remaining books after removal", async () => {
      // Create a shelf
      const shelf = await shelfRepository.create({
        name: "Auto Reindex Test Shelf",
        userId: null,
      });

      // Create books
      const book1 = await bookRepository.create({
        calibreId: 1,
        title: "First Book",
        authors: ["Author 1"],
        tags: [],
        path: "/path/1",
      });

      const book2 = await bookRepository.create({
        calibreId: 2,
        title: "Second Book",
        authors: ["Author 2"],
        tags: [],
        path: "/path/2",
      });

      const book3 = await bookRepository.create({
        calibreId: 3,
        title: "Third Book",
        authors: ["Author 3"],
        tags: [],
        path: "/path/3",
      });

      // Add books to shelf
      await shelfRepository.addBookToShelf(shelf.id, book1!.id);
      await shelfRepository.addBookToShelf(shelf.id, book2!.id);
      await shelfRepository.addBookToShelf(shelf.id, book3!.id);

      // Verify initial sortOrder (0, 1, 2)
      let books = await shelfRepository.getBooksOnShelf(shelf.id, "sortOrder", "asc");
      expect(books).toHaveLength(3);
      expect(books[0].sortOrder).toBe(0);
      expect(books[1].sortOrder).toBe(1);
      expect(books[2].sortOrder).toBe(2);

      // Remove the middle book
      const removed = await shelfRepository.removeBookFromShelf(shelf.id, book2!.id);
      expect(removed).toBe(true);

      // Verify remaining books are automatically reindexed (0, 1)
      books = await shelfRepository.getBooksOnShelf(shelf.id, "sortOrder", "asc");
      expect(books).toHaveLength(2);
      expect(books[0].sortOrder).toBe(0);
      expect(books[0].id).toBe(book1!.id);
      expect(books[1].sortOrder).toBe(1);
      expect(books[1].id).toBe(book3!.id);
    });

    it("should handle removal when book is not on shelf", async () => {
      // Create a shelf
      const shelf = await shelfRepository.create({
        name: "Empty Removal Test Shelf",
        userId: null,
      });

      // Create a book
      const book = await bookRepository.create({
        calibreId: 1,
        title: "Book Not On Shelf",
        authors: ["Author"],
        tags: [],
        path: "/path/1",
      });

      // Try to remove book that's not on shelf
      const removed = await shelfRepository.removeBookFromShelf(shelf.id, book!.id);
      expect(removed).toBe(false);

      // Shelf should still be empty
      const books = await shelfRepository.getBooksOnShelf(shelf.id, "sortOrder", "asc");
      expect(books).toHaveLength(0);
    });

    it("should maintain order when removing first book", async () => {
      // Create shelf and books
      const shelf = await shelfRepository.create({
        name: "Remove First Book Shelf",
        userId: null,
      });

      const books = [];
      for (let i = 0; i < 3; i++) {
        const book = await bookRepository.create({
          calibreId: i + 1,
          title: `Book ${i + 1}`,
          authors: [`Author ${i + 1}`],
          tags: [],
          path: `/path/${i + 1}`,
        });
        books.push(book!);
        await shelfRepository.addBookToShelf(shelf.id, book!.id);
      }

      // Remove first book
      await shelfRepository.removeBookFromShelf(shelf.id, books[0].id);

      // Verify remaining books are reindexed starting from 0
      const remaining = await shelfRepository.getBooksOnShelf(shelf.id, "sortOrder", "asc");
      expect(remaining).toHaveLength(2);
      expect(remaining[0].sortOrder).toBe(0);
      expect(remaining[0].id).toBe(books[1].id);
      expect(remaining[1].sortOrder).toBe(1);
      expect(remaining[1].id).toBe(books[2].id);
    });

    it("should maintain order when removing last book", async () => {
      // Create shelf and books
      const shelf = await shelfRepository.create({
        name: "Remove Last Book Shelf",
        userId: null,
      });

      const books = [];
      for (let i = 0; i < 3; i++) {
        const book = await bookRepository.create({
          calibreId: i + 1,
          title: `Book ${i + 1}`,
          authors: [`Author ${i + 1}`],
          tags: [],
          path: `/path/${i + 1}`,
        });
        books.push(book!);
        await shelfRepository.addBookToShelf(shelf.id, book!.id);
      }

      // Remove last book
      await shelfRepository.removeBookFromShelf(shelf.id, books[2].id);

      // Verify remaining books maintain proper sortOrder
      const remaining = await shelfRepository.getBooksOnShelf(shelf.id, "sortOrder", "asc");
      expect(remaining).toHaveLength(2);
      expect(remaining[0].sortOrder).toBe(0);
      expect(remaining[0].id).toBe(books[0].id);
      expect(remaining[1].sortOrder).toBe(1);
      expect(remaining[1].id).toBe(books[1].id);
    });
  });

  describe("removeBooksFromShelf - Bulk Delete", () => {
    it("should remove multiple books in a single transaction", async () => {
      // Create a shelf
      const shelf = await shelfRepository.create({
        name: "Bulk Delete Test Shelf",
        userId: null,
      });

      // Create 5 books
      const books = [];
      for (let i = 0; i < 5; i++) {
        const book = await bookRepository.create({
          calibreId: i + 1,
          title: `Book ${i + 1}`,
          authors: [`Author ${i + 1}`],
          tags: [],
          path: `/path/${i + 1}`,
        });
        books.push(book!);
        await shelfRepository.addBookToShelf(shelf.id, book!.id);
      }

      // Verify all books are on shelf
      let shelfBooks = await shelfRepository.getBooksOnShelf(shelf.id, "sortOrder", "asc");
      expect(shelfBooks).toHaveLength(5);

      // Remove 3 books (indices 1, 2, 4)
      const bookIdsToRemove = [books[1].id, books[2].id, books[4].id];
      await shelfRepository.removeBooksFromShelf(shelf.id, bookIdsToRemove);

      // Verify only 2 books remain
      shelfBooks = await shelfRepository.getBooksOnShelf(shelf.id, "sortOrder", "asc");
      expect(shelfBooks).toHaveLength(2);
      expect(shelfBooks[0].id).toBe(books[0].id);
      expect(shelfBooks[1].id).toBe(books[3].id);
    });

    it("should automatically reindex remaining books after bulk removal", async () => {
      // Create a shelf
      const shelf = await shelfRepository.create({
        name: "Bulk Reindex Test Shelf",
        userId: null,
      });

      // Create 6 books
      const books = [];
      for (let i = 0; i < 6; i++) {
        const book = await bookRepository.create({
          calibreId: i + 1,
          title: `Book ${i + 1}`,
          authors: [`Author ${i + 1}`],
          tags: [],
          path: `/path/${i + 1}`,
        });
        books.push(book!);
        await shelfRepository.addBookToShelf(shelf.id, book!.id);
      }

      // Verify initial sortOrder (0, 1, 2, 3, 4, 5)
      let shelfBooks = await shelfRepository.getBooksOnShelf(shelf.id, "sortOrder", "asc");
      expect(shelfBooks[0].sortOrder).toBe(0);
      expect(shelfBooks[1].sortOrder).toBe(1);
      expect(shelfBooks[2].sortOrder).toBe(2);
      expect(shelfBooks[3].sortOrder).toBe(3);
      expect(shelfBooks[4].sortOrder).toBe(4);
      expect(shelfBooks[5].sortOrder).toBe(5);

      // Remove books at indices 1, 3, 4 (leaving 0, 2, 5)
      const bookIdsToRemove = [books[1].id, books[3].id, books[4].id];
      await shelfRepository.removeBooksFromShelf(shelf.id, bookIdsToRemove);

      // Verify remaining books are reindexed to 0, 1, 2
      shelfBooks = await shelfRepository.getBooksOnShelf(shelf.id, "sortOrder", "asc");
      expect(shelfBooks).toHaveLength(3);
      expect(shelfBooks[0].sortOrder).toBe(0);
      expect(shelfBooks[0].id).toBe(books[0].id);
      expect(shelfBooks[1].sortOrder).toBe(1);
      expect(shelfBooks[1].id).toBe(books[2].id);
      expect(shelfBooks[2].sortOrder).toBe(2);
      expect(shelfBooks[2].id).toBe(books[5].id);
    });

    it("should handle empty bookIds array", async () => {
      // Create a shelf with books
      const shelf = await shelfRepository.create({
        name: "Empty Array Test Shelf",
        userId: null,
      });

      const book = await bookRepository.create({
        calibreId: 1,
        title: "Test Book",
        authors: ["Author"],
        tags: [],
        path: "/path/1",
      });
      await shelfRepository.addBookToShelf(shelf.id, book!.id);

      // Try to remove with empty array
      await shelfRepository.removeBooksFromShelf(shelf.id, []);

      // Book should still be on shelf
      const shelfBooks = await shelfRepository.getBooksOnShelf(shelf.id, "sortOrder", "asc");
      expect(shelfBooks).toHaveLength(1);
      expect(shelfBooks[0].id).toBe(book!.id);
    });

    it("should handle removing all books from shelf", async () => {
      // Create a shelf
      const shelf = await shelfRepository.create({
        name: "Remove All Test Shelf",
        userId: null,
      });

      // Create 3 books
      const books = [];
      for (let i = 0; i < 3; i++) {
        const book = await bookRepository.create({
          calibreId: i + 1,
          title: `Book ${i + 1}`,
          authors: [`Author ${i + 1}`],
          tags: [],
          path: `/path/${i + 1}`,
        });
        books.push(book!);
        await shelfRepository.addBookToShelf(shelf.id, book!.id);
      }

      // Remove all books
      const allBookIds = books.map(b => b.id);
      await shelfRepository.removeBooksFromShelf(shelf.id, allBookIds);

      // Shelf should be empty
      const shelfBooks = await shelfRepository.getBooksOnShelf(shelf.id, "sortOrder", "asc");
      expect(shelfBooks).toHaveLength(0);
    });

    it("should handle partial book list (some books not on shelf)", async () => {
      // Create a shelf
      const shelf = await shelfRepository.create({
        name: "Partial Remove Test Shelf",
        userId: null,
      });

      // Create books - only add some to shelf
      const book1 = await bookRepository.create({
        calibreId: 1,
        title: "Book On Shelf",
        authors: ["Author 1"],
        tags: [],
        path: "/path/1",
      });

      const book2 = await bookRepository.create({
        calibreId: 2,
        title: "Book Not On Shelf",
        authors: ["Author 2"],
        tags: [],
        path: "/path/2",
      });

      const book3 = await bookRepository.create({
        calibreId: 3,
        title: "Another Book On Shelf",
        authors: ["Author 3"],
        tags: [],
        path: "/path/3",
      });

      // Only add book1 and book3 to shelf
      await shelfRepository.addBookToShelf(shelf.id, book1!.id);
      await shelfRepository.addBookToShelf(shelf.id, book3!.id);

      // Try to remove all three (including book2 which isn't on shelf)
      await shelfRepository.removeBooksFromShelf(shelf.id, [book1!.id, book2!.id, book3!.id]);

      // Shelf should be empty (book1 and book3 removed, book2 ignored)
      const shelfBooks = await shelfRepository.getBooksOnShelf(shelf.id, "sortOrder", "asc");
      expect(shelfBooks).toHaveLength(0);
    });

    it("should preserve order of remaining books after bulk removal", async () => {
      // Create a shelf
      const shelf = await shelfRepository.create({
        name: "Order Preservation Test Shelf",
        userId: null,
      });

      // Create 10 books
      const books = [];
      for (let i = 0; i < 10; i++) {
        const book = await bookRepository.create({
          calibreId: i + 1,
          title: `Book ${i + 1}`,
          authors: [`Author ${i + 1}`],
          tags: [],
          path: `/path/${i + 1}`,
        });
        books.push(book!);
        await shelfRepository.addBookToShelf(shelf.id, book!.id);
      }

      // Remove every other book (indices 1, 3, 5, 7, 9)
      const bookIdsToRemove = [
        books[1].id,
        books[3].id,
        books[5].id,
        books[7].id,
        books[9].id,
      ];
      await shelfRepository.removeBooksFromShelf(shelf.id, bookIdsToRemove);

      // Verify remaining books (indices 0, 2, 4, 6, 8) maintain relative order
      const shelfBooks = await shelfRepository.getBooksOnShelf(shelf.id, "sortOrder", "asc");
      expect(shelfBooks).toHaveLength(5);
      expect(shelfBooks[0].id).toBe(books[0].id);
      expect(shelfBooks[1].id).toBe(books[2].id);
      expect(shelfBooks[2].id).toBe(books[4].id);
      expect(shelfBooks[3].id).toBe(books[6].id);
      expect(shelfBooks[4].id).toBe(books[8].id);

      // Verify sortOrder is continuous (0, 1, 2, 3, 4)
      for (let i = 0; i < 5; i++) {
        expect(shelfBooks[i].sortOrder).toBe(i);
      }
    });
  });
});
