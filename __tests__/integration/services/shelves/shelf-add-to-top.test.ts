import { describe, test, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { setupTestDatabase, teardownTestDatabase, clearTestDatabase } from "@/__tests__/helpers/db-setup";
import { shelfRepository } from "@/lib/repositories/shelf.repository";
import { bookRepository } from "@/lib/repositories/book.repository";
import { ShelfService } from "@/lib/services/shelf.service";

describe("ShelfService - Add to Top", () => {
  let shelfService: ShelfService;

  beforeAll(async () => {
    await setupTestDatabase(__filename);
    shelfService = new ShelfService();
  });

  afterAll(async () => {
    await teardownTestDatabase(__filename);
  });

  beforeEach(async () => {
    await clearTestDatabase(__filename);
  });

  describe("addBookToShelfAtTop", () => {
    test("should validate shelf exists", async () => {
      // Create a book
      const book = await bookRepository.create({
        calibreId: 1,
        title: "Test Book",
        authors: ["Author"],
        tags: [],
      });

      // Try to add to non-existent shelf
      await expect(async () => {
        await shelfService.addBookToShelfAtTop(999, book!.id);
      }).rejects.toThrow("Shelf with ID 999 not found");
    });

    test("should validate book exists", async () => {
      // Create a shelf
      const shelf = await shelfRepository.create({
        name: "Test Shelf",
        userId: null,
      });

      // Try to add non-existent book
      await expect(async () => {
        await shelfService.addBookToShelfAtTop(shelf.id, 999);
      }).rejects.toThrow("Book with ID 999 not found");
    });

    test("should prevent duplicate book-shelf associations", async () => {
      // Create shelf and book
      const shelf = await shelfRepository.create({
        name: "Test Shelf",
        userId: null,
      });

      const book = await bookRepository.create({
        calibreId: 1,
        title: "Test Book",
        authors: ["Author"],
        tags: [],
      });

      // Add book to shelf normally
      await shelfRepository.addBookToShelf(shelf.id, book!.id);

      // Try to add same book to top
      await expect(async () => {
        await shelfService.addBookToShelfAtTop(shelf.id, book!.id);
      }).rejects.toThrow(`Book is already on shelf "Test Shelf"`);
    });

    test("should successfully add book to top of shelf", async () => {
      // Create shelf
      const shelf = await shelfRepository.create({
        name: "Test Shelf",
        userId: null,
      });

      // Create books
      const book1 = await bookRepository.create({
        calibreId: 1,
        title: "Book 1",
        authors: ["Author 1"],
        tags: [],
      });

      const book2 = await bookRepository.create({
        calibreId: 2,
        title: "Book 2",
        authors: ["Author 2"],
        tags: [],
      });

      // Add book1 to shelf normally
      await shelfRepository.addBookToShelf(shelf.id, book1!.id);

      // Add book2 to top via service
      const result = await shelfService.addBookToShelfAtTop(shelf.id, book2!.id);

      // Verify result
      expect(result).toBeDefined();
      expect(result.shelfId).toBe(shelf.id);
      expect(result.bookId).toBe(book2!.id);
      expect(result.sortOrder).toBe(0);

      // Verify order in shelf
      const books = await shelfRepository.getBooksOnShelf(shelf.id, "sortOrder", "asc");
      expect(books).toHaveLength(2);
      expect(books[0]?.id).toBe(book2!.id);
      expect(books[0]?.sortOrder).toBe(0);
      expect(books[1]?.id).toBe(book1!.id);
      expect(books[1]?.sortOrder).toBe(1);
    });

    test("should add book to top of empty shelf", async () => {
      // Create shelf
      const shelf = await shelfRepository.create({
        name: "Empty Shelf",
        userId: null,
      });

      // Create book
      const book = await bookRepository.create({
        calibreId: 1,
        title: "First Book",
        authors: ["Author"],
        tags: [],
      });

      // Add book to top
      const result = await shelfService.addBookToShelfAtTop(shelf.id, book!.id);

      // Verify result
      expect(result).toBeDefined();
      expect(result.sortOrder).toBe(0);

      // Verify book is on shelf
      const books = await shelfRepository.getBooksOnShelf(shelf.id, "sortOrder", "asc");
      expect(books).toHaveLength(1);
      expect(books[0]?.id).toBe(book!.id);
    });

    test("should handle multiple consecutive adds to top", async () => {
      // Create shelf
      const shelf = await shelfRepository.create({
        name: "Test Shelf",
        userId: null,
      });

      // Create three books
      const books = [];
      for (let i = 1; i <= 3; i++) {
        const book = await bookRepository.create({
          calibreId: i,
          title: `Book ${i}`,
          authors: [`Author ${i}`],
          tags: [],
          path: `/path/${i}`,
        });
        books.push(book);
      }

      // Add all books to top via service
      for (const book of books) {
        await shelfService.addBookToShelfAtTop(shelf.id, book!.id);
      }

      // Verify final order (reverse of add order)
      const shelfBooks = await shelfRepository.getBooksOnShelf(shelf.id, "sortOrder", "asc");
      expect(shelfBooks).toHaveLength(3);
      expect(shelfBooks[0]?.id).toBe(books[2]!.id); // Last added is first
      expect(shelfBooks[1]?.id).toBe(books[1]!.id);
      expect(shelfBooks[2]?.id).toBe(books[0]!.id); // First added is last
    });

    test("should handle adding to shelf with existing books at various positions", async () => {
      // Create shelf
      const shelf = await shelfRepository.create({
        name: "Test Shelf",
        userId: null,
      });

      // Create books
      const book1 = await bookRepository.create({
        calibreId: 1,
        title: "Book 1",
        authors: ["Author 1"],
        tags: [],
      });

      const book2 = await bookRepository.create({
        calibreId: 2,
        title: "Book 2",
        authors: ["Author 2"],
        tags: [],
      });

      const book3 = await bookRepository.create({
        calibreId: 3,
        title: "Book 3",
        authors: ["Author 3"],
        tags: [],
      });

      const newBook = await bookRepository.create({
        calibreId: 4,
        title: "New Book",
        authors: ["Author 4"],
        tags: [],
      });

      // Add books to shelf at specific positions
      await shelfRepository.addBookToShelf(shelf.id, book1!.id, 0);
      await shelfRepository.addBookToShelf(shelf.id, book2!.id, 5);
      await shelfRepository.addBookToShelf(shelf.id, book3!.id, 10);

      // Add new book to top via service
      await shelfService.addBookToShelfAtTop(shelf.id, newBook!.id);

      // Verify new book is at top and others shifted
      const books = await shelfRepository.getBooksOnShelf(shelf.id, "sortOrder", "asc");
      expect(books).toHaveLength(4);
      expect(books[0]?.id).toBe(newBook!.id);
      expect(books[0]?.sortOrder).toBe(0);
      expect(books[1]?.sortOrder).toBe(1);
      expect(books[2]?.sortOrder).toBe(6);
      expect(books[3]?.sortOrder).toBe(11);
    });

    test("should throw error with shelf name in message", async () => {
      // Create shelf with specific name
      const shelf = await shelfRepository.create({
        name: "My Favorite Books",
        userId: null,
      });

      // Create book
      const book = await bookRepository.create({
        calibreId: 1,
        title: "Test Book",
        authors: ["Author"],
        tags: [],
      });

      // Add book to shelf
      await shelfRepository.addBookToShelf(shelf.id, book!.id);

      // Try to add again via service
      await expect(async () => {
        await shelfService.addBookToShelfAtTop(shelf.id, book!.id);
      }).rejects.toThrow('Book is already on shelf "My Favorite Books"');
    });
  });
});
