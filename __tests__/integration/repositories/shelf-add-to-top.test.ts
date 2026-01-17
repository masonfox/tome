import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { shelfRepository } from "@/lib/repositories/shelf.repository";
import { bookRepository } from "@/lib/repositories/book.repository";
import { setupTestDatabase, teardownTestDatabase, clearTestDatabase } from "@/__tests__/helpers/db-setup";

describe("ShelfRepository - Add to Top", () => {
  beforeAll(async () => {
    await setupTestDatabase(__filename);
  });

  beforeEach(async () => {
    await clearTestDatabase(__filename);
  });

  afterAll(async () => {
    await teardownTestDatabase(__filename);
  });

  describe("addBookToShelfAtTop", () => {
    it("should add book to position 0 when shelf is empty", async () => {
      // Create a shelf
      const shelf = await shelfRepository.create({
        name: "Empty Shelf",
        userId: null,
      });

      // Create a book
      const book = await bookRepository.create({
        calibreId: 1,
        title: "First Book",
        authors: ["Author 1"],
        tags: [],
        path: "/path/1",
      });

      // Add book to top of empty shelf
      const result = await shelfRepository.addBookToShelfAtTop(shelf.id, book!.id);

      // Should return the inserted record
      expect(result).toBeDefined();
      expect(result.shelfId).toBe(shelf.id);
      expect(result.bookId).toBe(book!.id);
      expect(result.sortOrder).toBe(0);

      // Verify the book is on the shelf at position 0
      const books = await shelfRepository.getBooksOnShelf(shelf.id, "sortOrder", "asc");
      expect(books).toHaveLength(1);
      expect(books[0]?.id).toBe(book!.id);
      expect(books[0]?.sortOrder).toBe(0);
    });

    it("should shift existing books down when adding to top", async () => {
      // Create a shelf
      const shelf = await shelfRepository.create({
        name: "Test Shelf",
        userId: null,
      });

      // Create three books
      const book1 = await bookRepository.create({
        calibreId: 1,
        title: "Book 1",
        authors: ["Author 1"],
        tags: [],
        path: "/path/1",
      });

      const book2 = await bookRepository.create({
        calibreId: 2,
        title: "Book 2",
        authors: ["Author 2"],
        tags: [],
        path: "/path/2",
      });

      const book3 = await bookRepository.create({
        calibreId: 3,
        title: "Book 3",
        authors: ["Author 3"],
        tags: [],
        path: "/path/3",
      });

      // Add books to end (positions 0, 1, 2)
      await shelfRepository.addBookToShelf(shelf.id, book1!.id);
      await shelfRepository.addBookToShelf(shelf.id, book2!.id);
      await shelfRepository.addBookToShelf(shelf.id, book3!.id);

      // Verify initial order
      let books = await shelfRepository.getBooksOnShelf(shelf.id, "sortOrder", "asc");
      expect(books).toHaveLength(3);
      expect(books[0]?.id).toBe(book1!.id);
      expect(books[0]?.sortOrder).toBe(0);
      expect(books[1]?.id).toBe(book2!.id);
      expect(books[1]?.sortOrder).toBe(1);
      expect(books[2]?.id).toBe(book3!.id);
      expect(books[2]?.sortOrder).toBe(2);

      // Create a new book
      const newBook = await bookRepository.create({
        calibreId: 4,
        title: "New Book",
        authors: ["Author 4"],
        tags: [],
        path: "/path/4",
      });

      // Add new book to top
      await shelfRepository.addBookToShelfAtTop(shelf.id, newBook!.id);

      // Verify new order - newBook should be at 0, others shifted down
      books = await shelfRepository.getBooksOnShelf(shelf.id, "sortOrder", "asc");
      expect(books).toHaveLength(4);
      expect(books[0]?.id).toBe(newBook!.id);
      expect(books[0]?.sortOrder).toBe(0);
      expect(books[1]?.id).toBe(book1!.id);
      expect(books[1]?.sortOrder).toBe(1);
      expect(books[2]?.id).toBe(book2!.id);
      expect(books[2]?.sortOrder).toBe(2);
      expect(books[3]?.id).toBe(book3!.id);
      expect(books[3]?.sortOrder).toBe(3);
    });

    it("should maintain correct sortOrder after multiple top additions", async () => {
      // Create a shelf
      const shelf = await shelfRepository.create({
        name: "Test Shelf",
        userId: null,
      });

      // Create five books
      const books = [];
      for (let i = 1; i <= 5; i++) {
        const book = await bookRepository.create({
          calibreId: i,
          title: `Book ${i}`,
          authors: [`Author ${i}`],
          tags: [],
          path: `/path/${i}`,
        });
        books.push(book);
      }

      // Add all books to top in sequence
      // After all additions, order should be: book5, book4, book3, book2, book1
      for (const book of books) {
        await shelfRepository.addBookToShelfAtTop(shelf.id, book!.id);
      }

      // Verify final order (FIFO: first added ends up at bottom)
      const shelfBooks = await shelfRepository.getBooksOnShelf(shelf.id, "sortOrder", "asc");
      expect(shelfBooks).toHaveLength(5);
      
      // Book 5 was added last, so it's at position 0
      expect(shelfBooks[0]?.id).toBe(books[4]!.id);
      expect(shelfBooks[0]?.sortOrder).toBe(0);
      
      // Book 4 was added second-to-last, so it's at position 1
      expect(shelfBooks[1]?.id).toBe(books[3]!.id);
      expect(shelfBooks[1]?.sortOrder).toBe(1);
      
      // Book 3 was added third-to-last, so it's at position 2
      expect(shelfBooks[2]?.id).toBe(books[2]!.id);
      expect(shelfBooks[2]?.sortOrder).toBe(2);
      
      // Book 2 was added second, so it's at position 3
      expect(shelfBooks[3]?.id).toBe(books[1]!.id);
      expect(shelfBooks[3]?.sortOrder).toBe(3);
      
      // Book 1 was added first, so it's at position 4
      expect(shelfBooks[4]?.id).toBe(books[0]!.id);
      expect(shelfBooks[4]?.sortOrder).toBe(4);
    });

    it("should handle adding to top of shelf with gaps in sortOrder", async () => {
      // Create a shelf
      const shelf = await shelfRepository.create({
        name: "Shelf with Gaps",
        userId: null,
      });

      // Create three books
      const book1 = await bookRepository.create({
        calibreId: 1,
        title: "Book 1",
        authors: ["Author 1"],
        tags: [],
        path: "/path/1",
      });

      const book2 = await bookRepository.create({
        calibreId: 2,
        title: "Book 2",
        authors: ["Author 2"],
        tags: [],
        path: "/path/2",
      });

      const book3 = await bookRepository.create({
        calibreId: 3,
        title: "Book 3",
        authors: ["Author 3"],
        tags: [],
        path: "/path/3",
      });

      // Add books with specific sortOrder to create gaps (0, 5, 10)
      await shelfRepository.addBookToShelf(shelf.id, book1!.id, 0);
      await shelfRepository.addBookToShelf(shelf.id, book2!.id, 5);
      await shelfRepository.addBookToShelf(shelf.id, book3!.id, 10);

      // Verify initial order with gaps
      let books = await shelfRepository.getBooksOnShelf(shelf.id, "sortOrder", "asc");
      expect(books).toHaveLength(3);
      expect(books[0]?.sortOrder).toBe(0);
      expect(books[1]?.sortOrder).toBe(5);
      expect(books[2]?.sortOrder).toBe(10);

      // Create a new book
      const newBook = await bookRepository.create({
        calibreId: 4,
        title: "New Book",
        authors: ["Author 4"],
        tags: [],
        path: "/path/4",
      });

      // Add new book to top
      await shelfRepository.addBookToShelfAtTop(shelf.id, newBook!.id);

      // Verify new order - all existing books shifted by 1
      books = await shelfRepository.getBooksOnShelf(shelf.id, "sortOrder", "asc");
      expect(books).toHaveLength(4);
      expect(books[0]?.id).toBe(newBook!.id);
      expect(books[0]?.sortOrder).toBe(0);
      expect(books[1]?.id).toBe(book1!.id);
      expect(books[1]?.sortOrder).toBe(1);
      expect(books[2]?.id).toBe(book2!.id);
      expect(books[2]?.sortOrder).toBe(6);
      expect(books[3]?.id).toBe(book3!.id);
      expect(books[3]?.sortOrder).toBe(11);
    });

    it("should handle large shelf efficiently", async () => {
      // Create a shelf
      const shelf = await shelfRepository.create({
        name: "Large Shelf",
        userId: null,
      });

      // Add 100 books to the shelf
      const books = [];
      for (let i = 1; i <= 100; i++) {
        const book = await bookRepository.create({
          calibreId: i,
          title: `Book ${i}`,
          authors: [`Author ${i}`],
          tags: [],
          path: `/path/${i}`,
        });
        books.push(book);
        await shelfRepository.addBookToShelf(shelf.id, book!.id);
      }

      // Verify initial count
      let shelfBooks = await shelfRepository.getBooksOnShelf(shelf.id, "sortOrder", "asc");
      expect(shelfBooks).toHaveLength(100);

      // Create a new book
      const newBook = await bookRepository.create({
        calibreId: 101,
        title: "New Book",
        authors: ["Author 101"],
        tags: [],
        path: "/path/101",
      });

      // Measure time for adding to top
      const startTime = Date.now();
      await shelfRepository.addBookToShelfAtTop(shelf.id, newBook!.id);
      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should complete in reasonable time (<500ms as per plan)
      expect(duration).toBeLessThan(500);

      // Verify new book is at position 0
      shelfBooks = await shelfRepository.getBooksOnShelf(shelf.id, "sortOrder", "asc");
      expect(shelfBooks).toHaveLength(101);
      expect(shelfBooks[0]?.id).toBe(newBook!.id);
      expect(shelfBooks[0]?.sortOrder).toBe(0);

      // Verify first original book shifted to position 1
      expect(shelfBooks[1]?.id).toBe(books[0]!.id);
      expect(shelfBooks[1]?.sortOrder).toBe(1);

      // Verify last book is now at position 100
      expect(shelfBooks[100]?.id).toBe(books[99]!.id);
      expect(shelfBooks[100]?.sortOrder).toBe(100);
    });

    it("should work correctly with transaction isolation", async () => {
      // Create a shelf
      const shelf = await shelfRepository.create({
        name: "Test Shelf",
        userId: null,
      });

      // Create two books
      const book1 = await bookRepository.create({
        calibreId: 1,
        title: "Book 1",
        authors: ["Author 1"],
        tags: [],
        path: "/path/1",
      });

      const book2 = await bookRepository.create({
        calibreId: 2,
        title: "Book 2",
        authors: ["Author 2"],
        tags: [],
        path: "/path/2",
      });

      // Add book1 to shelf
      await shelfRepository.addBookToShelf(shelf.id, book1!.id);

      // Add book2 to top - should complete atomically
      const result = await shelfRepository.addBookToShelfAtTop(shelf.id, book2!.id);

      // Verify result
      expect(result).toBeDefined();
      expect(result.sortOrder).toBe(0);

      // Verify both books are on shelf in correct order
      const books = await shelfRepository.getBooksOnShelf(shelf.id, "sortOrder", "asc");
      expect(books).toHaveLength(2);
      expect(books[0]?.id).toBe(book2!.id);
      expect(books[0]?.sortOrder).toBe(0);
      expect(books[1]?.id).toBe(book1!.id);
      expect(books[1]?.sortOrder).toBe(1);
    });

    it("should throw error if transaction fails", async () => {
      // This test verifies that if anything goes wrong during the transaction,
      // the entire operation is rolled back
      
      // Create a shelf
      const shelf = await shelfRepository.create({
        name: "Test Shelf",
        userId: null,
      });

      // Create a book
      const book = await bookRepository.create({
        calibreId: 1,
        title: "Book 1",
        authors: ["Author 1"],
        tags: [],
        path: "/path/1",
      });

      // Add book to shelf
      await shelfRepository.addBookToShelf(shelf.id, book!.id);

      // Try to add the same book again to top (should fail due to unique constraint)
      await expect(async () => {
        await shelfRepository.addBookToShelfAtTop(shelf.id, book!.id);
      }).rejects.toThrow();

      // Verify original book is still at position 0 (no partial update)
      const books = await shelfRepository.getBooksOnShelf(shelf.id, "sortOrder", "asc");
      expect(books).toHaveLength(1);
      expect(books[0]?.id).toBe(book!.id);
      expect(books[0]?.sortOrder).toBe(0);
    });
  });
});
