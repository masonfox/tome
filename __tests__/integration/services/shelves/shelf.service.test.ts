import { describe, test, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { setupTestDatabase, teardownTestDatabase, clearTestDatabase } from "@/__tests__/helpers/db-setup";
import { shelfRepository } from "@/lib/repositories/shelf.repository";
import { bookRepository } from "@/lib/repositories/book.repository";
import { ShelfService } from "@/lib/services/shelf.service";
import { DATABASE_LIMITS } from "@/lib/constants";

describe("ShelfService", () => {
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

  describe("getAllShelves", () => {
    test("should return empty array when no shelves exist", async () => {
      const shelves = await shelfService.getAllShelves();
      expect(shelves).toEqual([]);
    });

    test("should return all shelves for null userId", async () => {
      const shelf1 = await shelfRepository.create({
        name: "Favorites",
        userId: null,
      });

      const shelf2 = await shelfRepository.create({
        name: "To Read",
        userId: null,
      });

      const shelves = await shelfService.getAllShelves(null);
      
      expect(shelves).toHaveLength(2);
      expect(shelves.map(s => s.id)).toContain(shelf1.id);
      expect(shelves.map(s => s.id)).toContain(shelf2.id);
    });
  });

  describe("getAllShelvesWithBookCount", () => {
    test("should return shelves with zero book count when empty", async () => {
      await shelfRepository.create({
        name: "Empty Shelf",
        userId: null,
      });

      const shelves = await shelfService.getAllShelvesWithBookCount();
      
      expect(shelves).toHaveLength(1);
      expect(shelves[0].bookCount).toBe(0);
    });

    test("should return shelves with correct book counts", async () => {
      const shelf1 = await shelfRepository.create({
        name: "Shelf 1",
        userId: null,
      });

      const shelf2 = await shelfRepository.create({
        name: "Shelf 2",
        userId: null,
      });

      // Create books
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

      // Add books to shelves
      await shelfRepository.addBookToShelf(shelf1.id, book1!.id);
      await shelfRepository.addBookToShelf(shelf2.id, book1!.id);
      await shelfRepository.addBookToShelf(shelf2.id, book2!.id);

      const shelves = await shelfService.getAllShelvesWithBookCount();
      
      const shelfWithCounts = shelves.reduce((acc, s) => {
        acc[s.id] = s.bookCount;
        return acc;
      }, {} as Record<number, number>);

      expect(shelfWithCounts[shelf1.id]).toBe(1);
      expect(shelfWithCounts[shelf2.id]).toBe(2);
    });
  });

  describe("getAllShelvesWithBookCountAndCovers", () => {
    test("should return shelves with book count and empty cover array when no books", async () => {
      await shelfRepository.create({
        name: "Empty Shelf",
        userId: null,
      });

      const shelves = await shelfService.getAllShelvesWithBookCountAndCovers();
      
      expect(shelves).toHaveLength(1);
      expect(shelves[0].bookCount).toBe(0);
      expect(shelves[0].bookCoverIds).toEqual([]);
    });

    test("should return shelves with book cover IDs", async () => {
      const shelf = await shelfRepository.create({
        name: "Test Shelf",
        userId: null,
      });

      // Create books with calibreIds
      const book1 = await bookRepository.create({
        calibreId: 101,
        title: "Book 1",
        authors: ["Author 1"],
        tags: [],
        path: "/path/1",
      });

      const book2 = await bookRepository.create({
        calibreId: 102,
        title: "Book 2",
        authors: ["Author 2"],
        tags: [],
        path: "/path/2",
      });

      await shelfRepository.addBookToShelf(shelf.id, book1!.id);
      await shelfRepository.addBookToShelf(shelf.id, book2!.id);

      const shelves = await shelfService.getAllShelvesWithBookCountAndCovers();
      
      expect(shelves).toHaveLength(1);
      expect(shelves[0].bookCount).toBe(2);
      expect(shelves[0].bookCoverIds).toEqual([101, 102]);
    });

    test("should limit cover IDs to 12 books", async () => {
      const shelf = await shelfRepository.create({
        name: "Large Shelf",
        userId: null,
      });

      // Create 15 books
      for (let i = 0; i < 15; i++) {
        const book = await bookRepository.create({
          calibreId: i + 1,
          title: `Book ${i + 1}`,
          authors: [`Author ${i + 1}`],
          tags: [],
          path: `/path/${i + 1}`,
        });
        await shelfRepository.addBookToShelf(shelf.id, book!.id);
      }

      const shelves = await shelfService.getAllShelvesWithBookCountAndCovers();
      
      expect(shelves).toHaveLength(1);
      expect(shelves[0].bookCount).toBe(15);
      expect(shelves[0].bookCoverIds).toHaveLength(12); // Limited to 12
    });
  });

  describe("getShelfWithBooks", () => {
    test("should return null for non-existent shelf", async () => {
      const result = await shelfService.getShelfWithBooks(999);
      expect(result).toBeNull();
    });

    test("should return shelf with books in specified order", async () => {
      const shelf = await shelfRepository.create({
        name: "Test Shelf",
        userId: null,
      });

      const book1 = await bookRepository.create({
        calibreId: 1,
        title: "Zulu Book",
        authors: ["Author A"],
        tags: [],
        path: "/path/1",
      });

      const book2 = await bookRepository.create({
        calibreId: 2,
        title: "Alpha Book",
        authors: ["Author B"],
        tags: [],
        path: "/path/2",
      });

      await shelfRepository.addBookToShelf(shelf.id, book1!.id);
      await shelfRepository.addBookToShelf(shelf.id, book2!.id);

      // Get by title ascending
      const result = await shelfService.getShelfWithBooks(shelf.id, "title", "asc");

      expect(result).not.toBeNull();
      expect(result!.books).toHaveLength(2);
      expect(result!.books[0].title).toBe("Alpha Book");
      expect(result!.books[1].title).toBe("Zulu Book");
    });

    test("should return shelf with books ordered by sortOrder by default", async () => {
      const shelf = await shelfRepository.create({
        name: "Test Shelf",
        userId: null,
      });

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

      await shelfRepository.addBookToShelf(shelf.id, book1!.id, 5);
      await shelfRepository.addBookToShelf(shelf.id, book2!.id, 1);

      const result = await shelfService.getShelfWithBooks(shelf.id);

      expect(result).not.toBeNull();
      expect(result!.books).toHaveLength(2);
      // sortOrder ascending should put book2 (sortOrder: 1) before book1 (sortOrder: 5)
      expect(result!.books[0].id).toBe(book2!.id);
      expect(result!.books[1].id).toBe(book1!.id);
    });
  });

  describe("getShelf", () => {
    test("should return null for non-existent shelf", async () => {
      const result = await shelfService.getShelf(999);
      expect(result).toBeNull();
    });

    test("should return shelf by ID", async () => {
      const created = await shelfRepository.create({
        name: "Test Shelf",
        description: "A test description",
        userId: null,
      });

      const result = await shelfService.getShelf(created.id);

      expect(result).not.toBeNull();
      expect(result!.id).toBe(created.id);
      expect(result!.name).toBe("Test Shelf");
      expect(result!.description).toBe("A test description");
    });
  });

  describe("createShelf", () => {
    test("should create shelf with name only", async () => {
      const shelf = await shelfService.createShelf("My Shelf");

      expect(shelf).toBeDefined();
      expect(shelf.name).toBe("My Shelf");
      expect(shelf.description).toBeNull();
      expect(shelf.color).toBeNull();
      expect(shelf.icon).toBeNull();
    });

    test("should create shelf with all options", async () => {
      const shelf = await shelfService.createShelf("My Shelf", {
        description: "A great shelf",
        color: "#ff0000",
        icon: "📚",
        userId: null,
      });

      expect(shelf.name).toBe("My Shelf");
      expect(shelf.description).toBe("A great shelf");
      expect(shelf.color).toBe("#ff0000");
      expect(shelf.icon).toBe("📚");
    });

    test("should trim whitespace from name", async () => {
      const shelf = await shelfService.createShelf("  My Shelf  ");
      expect(shelf.name).toBe("My Shelf");
    });

    test("should throw error for empty name", async () => {
      await expect(shelfService.createShelf("")).rejects.toThrow("Shelf name is required");
      await expect(shelfService.createShelf("   ")).rejects.toThrow("Shelf name is required");
    });

    test("should throw error for name exceeding max length", async () => {
      const longName = "a".repeat(DATABASE_LIMITS.SHELF_NAME_MAX_LENGTH + 1);
      
      await expect(shelfService.createShelf(longName)).rejects.toThrow(
        `Shelf name must be ${DATABASE_LIMITS.SHELF_NAME_MAX_LENGTH} characters or less`
      );
    });

    test("should throw error for duplicate name (case-insensitive)", async () => {
      await shelfService.createShelf("My Shelf");

      await expect(shelfService.createShelf("My Shelf")).rejects.toThrow(
        'A shelf named "My Shelf" already exists'
      );

      await expect(shelfService.createShelf("my shelf")).rejects.toThrow(
        'A shelf named "my shelf" already exists'
      );

      await expect(shelfService.createShelf("MY SHELF")).rejects.toThrow(
        'A shelf named "MY SHELF" already exists'
      );
    });
  });

  describe("updateShelf", () => {
    test("should update shelf name", async () => {
      const shelf = await shelfRepository.create({
        name: "Old Name",
        userId: null,
      });

      const updated = await shelfService.updateShelf(shelf.id, { name: "New Name" });

      expect(updated.name).toBe("New Name");
    });

    test("should update multiple fields", async () => {
      const shelf = await shelfRepository.create({
        name: "Test Shelf",
        userId: null,
      });

      const updated = await shelfService.updateShelf(shelf.id, {
        name: "Updated Shelf",
        description: "New description",
        color: "#00ff00",
        icon: "⭐",
      });

      expect(updated.name).toBe("Updated Shelf");
      expect(updated.description).toBe("New description");
      expect(updated.color).toBe("#00ff00");
      expect(updated.icon).toBe("⭐");
    });

    test("should trim whitespace from name", async () => {
      const shelf = await shelfRepository.create({
        name: "Test Shelf",
        userId: null,
      });

      const updated = await shelfService.updateShelf(shelf.id, {
        name: "  New Name  ",
      });

      expect(updated.name).toBe("New Name");
    });

    test("should throw error for non-existent shelf", async () => {
      await expect(shelfService.updateShelf(999, { name: "New Name" })).rejects.toThrow(
        "Shelf with ID 999 not found"
      );
    });

    test("should throw error for empty name", async () => {
      const shelf = await shelfRepository.create({
        name: "Test Shelf",
        userId: null,
      });

      await expect(shelfService.updateShelf(shelf.id, { name: "" })).rejects.toThrow(
        "Shelf name cannot be empty"
      );

      await expect(shelfService.updateShelf(shelf.id, { name: "   " })).rejects.toThrow(
        "Shelf name cannot be empty"
      );
    });

    test("should throw error for name exceeding max length", async () => {
      const shelf = await shelfRepository.create({
        name: "Test Shelf",
        userId: null,
      });

      const longName = "a".repeat(DATABASE_LIMITS.SHELF_NAME_MAX_LENGTH + 1);

      await expect(shelfService.updateShelf(shelf.id, { name: longName })).rejects.toThrow(
        `Shelf name must be ${DATABASE_LIMITS.SHELF_NAME_MAX_LENGTH} characters or less`
      );
    });

    test("should throw error for duplicate name (case-insensitive)", async () => {
      const shelf1 = await shelfRepository.create({
        name: "Shelf 1",
        userId: null,
      });

      const shelf2 = await shelfRepository.create({
        name: "Shelf 2",
        userId: null,
      });

      await expect(shelfService.updateShelf(shelf2.id, { name: "Shelf 1" })).rejects.toThrow(
        'A shelf named "Shelf 1" already exists'
      );

      await expect(shelfService.updateShelf(shelf2.id, { name: "shelf 1" })).rejects.toThrow(
        'A shelf named "shelf 1" already exists'
      );
    });

    test("should allow updating shelf with its own name", async () => {
      const shelf = await shelfRepository.create({
        name: "Test Shelf",
        userId: null,
      });

      // Updating with same name (different description) should work
      const updated = await shelfService.updateShelf(shelf.id, {
        name: "Test Shelf",
        description: "New description",
      });

      expect(updated.name).toBe("Test Shelf");
      expect(updated.description).toBe("New description");
    });

    test("should allow updating description without changing name", async () => {
      const shelf = await shelfRepository.create({
        name: "Test Shelf",
        description: "Old description",
        userId: null,
      });

      const updated = await shelfService.updateShelf(shelf.id, {
        description: "New description",
      });

      expect(updated.name).toBe("Test Shelf");
      expect(updated.description).toBe("New description");
    });
  });

  describe("deleteShelf", () => {
    test("should delete empty shelf", async () => {
      const shelf = await shelfRepository.create({
        name: "Test Shelf",
        userId: null,
      });

      const deleted = await shelfService.deleteShelf(shelf.id);

      expect(deleted).toBe(true);

      // Verify shelf is gone
      const found = await shelfRepository.findById(shelf.id);
      expect(found).toBeUndefined();
    });

    test("should delete shelf with books (cascade deletes book associations)", async () => {
      const shelf = await shelfRepository.create({
        name: "Test Shelf",
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

      const deleted = await shelfService.deleteShelf(shelf.id);

      expect(deleted).toBe(true);

      // Verify shelf is gone
      const found = await shelfRepository.findById(shelf.id);
      expect(found).toBeUndefined();

      // Verify book still exists
      const bookFound = await bookRepository.findById(book!.id);
      expect(bookFound).not.toBeNull();
    });

    test("should throw error for non-existent shelf", async () => {
      await expect(shelfService.deleteShelf(999)).rejects.toThrow(
        "Shelf with ID 999 not found"
      );
    });
  });

  describe("getShelvesForBook", () => {
    test("should return empty array for book not on any shelf", async () => {
      const book = await bookRepository.create({
        calibreId: 1,
        title: "Test Book",
        authors: ["Author"],
        tags: [],
        path: "/path/1",
      });

      const shelves = await shelfService.getShelvesForBook(book!.id);

      expect(shelves).toEqual([]);
    });

    test("should return all shelves containing the book", async () => {
      const shelf1 = await shelfRepository.create({
        name: "Shelf 1",
        userId: null,
      });

      const shelf2 = await shelfRepository.create({
        name: "Shelf 2",
        userId: null,
      });

      const shelf3 = await shelfRepository.create({
        name: "Shelf 3",
        userId: null,
      });

      const book = await bookRepository.create({
        calibreId: 1,
        title: "Test Book",
        authors: ["Author"],
        tags: [],
        path: "/path/1",
      });

      // Add book to shelf1 and shelf2, but not shelf3
      await shelfRepository.addBookToShelf(shelf1.id, book!.id);
      await shelfRepository.addBookToShelf(shelf2.id, book!.id);

      const shelves = await shelfService.getShelvesForBook(book!.id);

      expect(shelves).toHaveLength(2);
      expect(shelves.map(s => s.id)).toContain(shelf1.id);
      expect(shelves.map(s => s.id)).toContain(shelf2.id);
      expect(shelves.map(s => s.id)).not.toContain(shelf3.id);
    });
  });

  describe("addBookToShelf", () => {
    test("should add book to shelf", async () => {
      const shelf = await shelfRepository.create({
        name: "Test Shelf",
        userId: null,
      });

      const book = await bookRepository.create({
        calibreId: 1,
        title: "Test Book",
        authors: ["Author"],
        tags: [],
        path: "/path/1",
      });

      await shelfService.addBookToShelf(shelf.id, book!.id);

      const isOnShelf = await shelfRepository.isBookOnShelf(shelf.id, book!.id);
      expect(isOnShelf).toBe(true);
    });

    test("should add book with specific sortOrder", async () => {
      const shelf = await shelfRepository.create({
        name: "Test Shelf",
        userId: null,
      });

      const book = await bookRepository.create({
        calibreId: 1,
        title: "Test Book",
        authors: ["Author"],
        tags: [],
        path: "/path/1",
      });

      await shelfService.addBookToShelf(shelf.id, book!.id, 5);

      const books = await shelfRepository.getBooksOnShelf(shelf.id);
      expect(books[0].sortOrder).toBe(0); // Reindexed to 0
    });

    test("should reindex books after adding", async () => {
      const shelf = await shelfRepository.create({
        name: "Test Shelf",
        userId: null,
      });

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

      await shelfService.addBookToShelf(shelf.id, book1!.id);
      await shelfService.addBookToShelf(shelf.id, book2!.id);

      const books = await shelfRepository.getBooksOnShelf(shelf.id, "sortOrder", "asc");
      
      // Should be reindexed to 0, 1
      expect(books[0].sortOrder).toBe(0);
      expect(books[1].sortOrder).toBe(1);
    });

    test("should throw error for non-existent shelf", async () => {
      const book = await bookRepository.create({
        calibreId: 1,
        title: "Test Book",
        authors: ["Author"],
        tags: [],
        path: "/path/1",
      });

      await expect(shelfService.addBookToShelf(999, book!.id)).rejects.toThrow(
        "Shelf with ID 999 not found"
      );
    });

    test("should throw error for non-existent book", async () => {
      const shelf = await shelfRepository.create({
        name: "Test Shelf",
        userId: null,
      });

      await expect(shelfService.addBookToShelf(shelf.id, 999)).rejects.toThrow(
        "Book with ID 999 not found"
      );
    });

    test("should throw error when book already on shelf", async () => {
      const shelf = await shelfRepository.create({
        name: "Test Shelf",
        userId: null,
      });

      const book = await bookRepository.create({
        calibreId: 1,
        title: "Test Book",
        authors: ["Author"],
        tags: [],
        path: "/path/1",
      });

      await shelfService.addBookToShelf(shelf.id, book!.id);

      await expect(shelfService.addBookToShelf(shelf.id, book!.id)).rejects.toThrow(
        'Book is already on shelf "Test Shelf"'
      );
    });
  });

  describe("removeBookFromShelf", () => {
    test("should remove book from shelf", async () => {
      const shelf = await shelfRepository.create({
        name: "Test Shelf",
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

      const removed = await shelfService.removeBookFromShelf(shelf.id, book!.id);

      expect(removed).toBe(true);

      const isOnShelf = await shelfRepository.isBookOnShelf(shelf.id, book!.id);
      expect(isOnShelf).toBe(false);
    });

    test("should return false when book not on shelf", async () => {
      const shelf = await shelfRepository.create({
        name: "Test Shelf",
        userId: null,
      });

      const book = await bookRepository.create({
        calibreId: 1,
        title: "Test Book",
        authors: ["Author"],
        tags: [],
        path: "/path/1",
      });

      const removed = await shelfService.removeBookFromShelf(shelf.id, book!.id);

      expect(removed).toBe(false);
    });

    test("should throw error for non-existent shelf", async () => {
      await expect(shelfService.removeBookFromShelf(999, 1)).rejects.toThrow(
        "Shelf with ID 999 not found"
      );
    });
  });

  describe("updateBookOrder", () => {
    test("should update book order on shelf", async () => {
      const shelf = await shelfRepository.create({
        name: "Test Shelf",
        userId: null,
      });

      const book = await bookRepository.create({
        calibreId: 1,
        title: "Test Book",
        authors: ["Author"],
        tags: [],
        path: "/path/1",
      });

      await shelfRepository.addBookToShelf(shelf.id, book!.id, 0);

      await shelfService.updateBookOrder(shelf.id, book!.id, 5);

      const books = await shelfRepository.getBooksOnShelf(shelf.id);
      expect(books[0].sortOrder).toBe(5);
    });

    test("should throw error for non-existent shelf", async () => {
      await expect(shelfService.updateBookOrder(999, 1, 0)).rejects.toThrow(
        "Shelf with ID 999 not found"
      );
    });

    test("should throw error when book not on shelf", async () => {
      const shelf = await shelfRepository.create({
        name: "Test Shelf",
        userId: null,
      });

      const book = await bookRepository.create({
        calibreId: 1,
        title: "Test Book",
        authors: ["Author"],
        tags: [],
        path: "/path/1",
      });

      await expect(shelfService.updateBookOrder(shelf.id, book!.id, 0)).rejects.toThrow(
        `Book ${book!.id} is not on shelf ${shelf.id}`
      );
    });
  });

  describe("manageBookShelves", () => {
    test("should add book to new shelves", async () => {
      const shelf1 = await shelfRepository.create({
        name: "Shelf 1",
        userId: null,
      });

      const shelf2 = await shelfRepository.create({
        name: "Shelf 2",
        userId: null,
      });

      const book = await bookRepository.create({
        calibreId: 1,
        title: "Test Book",
        authors: ["Author"],
        tags: [],
        path: "/path/1",
      });

      await shelfService.manageBookShelves(book!.id, [shelf1.id, shelf2.id]);

      const shelves = await shelfRepository.getShelvesForBook(book!.id);
      expect(shelves).toHaveLength(2);
      expect(shelves.map(s => s.id)).toContain(shelf1.id);
      expect(shelves.map(s => s.id)).toContain(shelf2.id);
    });

    test("should remove book from shelves not in list", async () => {
      const shelf1 = await shelfRepository.create({
        name: "Shelf 1",
        userId: null,
      });

      const shelf2 = await shelfRepository.create({
        name: "Shelf 2",
        userId: null,
      });

      const book = await bookRepository.create({
        calibreId: 1,
        title: "Test Book",
        authors: ["Author"],
        tags: [],
        path: "/path/1",
      });

      // Add to both shelves
      await shelfRepository.addBookToShelf(shelf1.id, book!.id);
      await shelfRepository.addBookToShelf(shelf2.id, book!.id);

      // Manage to only be on shelf1
      await shelfService.manageBookShelves(book!.id, [shelf1.id]);

      const shelves = await shelfRepository.getShelvesForBook(book!.id);
      expect(shelves).toHaveLength(1);
      expect(shelves[0].id).toBe(shelf1.id);
    });

    test("should handle empty shelf list (remove from all shelves)", async () => {
      const shelf = await shelfRepository.create({
        name: "Test Shelf",
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

      await shelfService.manageBookShelves(book!.id, []);

      const shelves = await shelfRepository.getShelvesForBook(book!.id);
      expect(shelves).toHaveLength(0);
    });

    test("should throw error for non-existent book", async () => {
      await expect(shelfService.manageBookShelves(999, [])).rejects.toThrow(
        "Book with ID 999 not found"
      );
    });

    test("should skip non-existent shelves", async () => {
      const shelf1 = await shelfRepository.create({
        name: "Shelf 1",
        userId: null,
      });

      const book = await bookRepository.create({
        calibreId: 1,
        title: "Test Book",
        authors: ["Author"],
        tags: [],
        path: "/path/1",
      });

      // Try to add to shelf1 and non-existent shelf 999
      await shelfService.manageBookShelves(book!.id, [shelf1.id, 999]);

      // Should only be on shelf1
      const shelves = await shelfRepository.getShelvesForBook(book!.id);
      expect(shelves).toHaveLength(1);
      expect(shelves[0].id).toBe(shelf1.id);
    });
  });

  describe("reorderBooksInShelf", () => {
    test("should reorder books according to provided array", async () => {
      const shelf = await shelfRepository.create({
        name: "Test Shelf",
        userId: null,
      });

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

      await shelfRepository.addBookToShelf(shelf.id, book1!.id);
      await shelfRepository.addBookToShelf(shelf.id, book2!.id);
      await shelfRepository.addBookToShelf(shelf.id, book3!.id);

      // Reverse the order
      await shelfService.reorderBooksInShelf(shelf.id, [book3!.id, book2!.id, book1!.id]);

      const books = await shelfRepository.getBooksOnShelf(shelf.id, "sortOrder", "asc");
      
      expect(books[0].id).toBe(book3!.id);
      expect(books[1].id).toBe(book2!.id);
      expect(books[2].id).toBe(book1!.id);
    });

    test("should throw error for non-existent shelf", async () => {
      await expect(shelfService.reorderBooksInShelf(999, [])).rejects.toThrow(
        "Shelf with ID 999 not found"
      );
    });

    test("should throw error when book not on shelf", async () => {
      const shelf = await shelfRepository.create({
        name: "Test Shelf",
        userId: null,
      });

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

      await shelfRepository.addBookToShelf(shelf.id, book1!.id);

      await expect(
        shelfService.reorderBooksInShelf(shelf.id, [book1!.id, book2!.id])
      ).rejects.toThrow(`Book ${book2!.id} is not on shelf ${shelf.id}`);
    });

    test("should handle partial reordering", async () => {
      const shelf = await shelfRepository.create({
        name: "Test Shelf",
        userId: null,
      });

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

      await shelfRepository.addBookToShelf(shelf.id, book1!.id);
      await shelfRepository.addBookToShelf(shelf.id, book2!.id);
      await shelfRepository.addBookToShelf(shelf.id, book3!.id);

      // Reorder only book1 and book2 (book3 not included)
      await shelfService.reorderBooksInShelf(shelf.id, [book2!.id, book1!.id]);

      const books = await shelfRepository.getBooksOnShelf(shelf.id, "sortOrder", "asc");
      
      // book2 and book1 should be reordered, book3 position depends on implementation
      expect(books[0].id).toBe(book2!.id);
      expect(books[1].id).toBe(book1!.id);
    });
  });

  describe("addBooksToShelf (bulk operation)", () => {
    test("should add multiple books to shelf", async () => {
      const shelf = await shelfRepository.create({
        name: "Bulk Test Shelf",
        userId: null,
      });

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

      const result = await shelfService.addBooksToShelf(shelf.id, [
        book1!.id,
        book2!.id,
        book3!.id,
      ]);

      expect(result.count).toBe(3);
      expect(result.addedBookIds).toHaveLength(3);
      expect(result.addedBookIds).toContain(book1!.id);
      expect(result.addedBookIds).toContain(book2!.id);
      expect(result.addedBookIds).toContain(book3!.id);

      // Verify books are on shelf
      const booksOnShelf = await shelfRepository.getBooksOnShelf(shelf.id);
      expect(booksOnShelf).toHaveLength(3);
    });

    test("should return correct count and addedBookIds array", async () => {
      const shelf = await shelfRepository.create({
        name: "Test Shelf",
        userId: null,
      });

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

      const result = await shelfService.addBooksToShelf(shelf.id, [book1!.id, book2!.id]);

      expect(result).toEqual({
        count: 2,
        addedBookIds: [book1!.id, book2!.id],
      });
    });

    test("should throw error when shelf doesn't exist", async () => {
      await expect(shelfService.addBooksToShelf(999, [1, 2, 3])).rejects.toThrow(
        "Shelf with ID 999 not found"
      );
    });

    test("should skip non-existent books with warning", async () => {
      const shelf = await shelfRepository.create({
        name: "Test Shelf",
        userId: null,
      });

      const book1 = await bookRepository.create({
        calibreId: 1,
        title: "Valid Book",
        authors: ["Author"],
        tags: [],
        path: "/path/1",
      });

      // Include valid and non-existent book IDs
      const result = await shelfService.addBooksToShelf(shelf.id, [
        book1!.id,
        9999,
        8888,
      ]);

      // Should only add the valid book
      expect(result.count).toBe(1);
      expect(result.addedBookIds).toEqual([book1!.id]);

      const booksOnShelf = await shelfRepository.getBooksOnShelf(shelf.id);
      expect(booksOnShelf).toHaveLength(1);
      expect(booksOnShelf[0].id).toBe(book1!.id);
    });

    test("should skip books already on shelf (defensive check)", async () => {
      const shelf = await shelfRepository.create({
        name: "Test Shelf",
        userId: null,
      });

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

      // Add book1 beforehand
      await shelfRepository.addBookToShelf(shelf.id, book1!.id);

      // Try to add both books
      const result = await shelfService.addBooksToShelf(shelf.id, [book1!.id, book2!.id]);

      // Should only add book2 (book1 skipped)
      expect(result.count).toBe(1);
      expect(result.addedBookIds).toEqual([book2!.id]);

      const booksOnShelf = await shelfRepository.getBooksOnShelf(shelf.id);
      expect(booksOnShelf).toHaveLength(2);
    });

    test("should reindex shelf after bulk add", async () => {
      const shelf = await shelfRepository.create({
        name: "Reindex Shelf",
        userId: null,
      });

      const books = [];
      for (let i = 1; i <= 5; i++) {
        const book = await bookRepository.create({
          calibreId: i,
          title: `Book ${i}`,
          authors: [`Author ${i}`],
          tags: [],
          path: `/path/${i}`,
        });
        books.push(book!);
      }

      await shelfService.addBooksToShelf(
        shelf.id,
        books.map((b) => b.id)
      );

      // Verify books are reindexed with continuous sortOrder
      const booksOnShelf = await shelfRepository.getBooksOnShelf(shelf.id, "sortOrder", "asc");
      expect(booksOnShelf).toHaveLength(5);

      booksOnShelf.forEach((book, index) => {
        expect(book.sortOrder).toBe(index);
      });
    });

    test("should handle mixed valid/invalid book IDs", async () => {
      const shelf = await shelfRepository.create({
        name: "Mixed Shelf",
        userId: null,
      });

      const book1 = await bookRepository.create({
        calibreId: 1,
        title: "Valid 1",
        authors: ["Author 1"],
        tags: [],
        path: "/path/1",
      });

      const book2 = await bookRepository.create({
        calibreId: 2,
        title: "Valid 2",
        authors: ["Author 2"],
        tags: [],
        path: "/path/2",
      });

      const result = await shelfService.addBooksToShelf(shelf.id, [
        book1!.id,
        9999,
        book2!.id,
        8888,
      ]);

      expect(result.count).toBe(2);
      expect(result.addedBookIds).toEqual([book1!.id, book2!.id]);
    });

    test("should handle empty bookIds array gracefully", async () => {
      const shelf = await shelfRepository.create({
        name: "Empty Array Shelf",
        userId: null,
      });

      const result = await shelfService.addBooksToShelf(shelf.id, []);

      expect(result.count).toBe(0);
      expect(result.addedBookIds).toEqual([]);
    });

    test("should continue processing after individual book failures", async () => {
      const shelf = await shelfRepository.create({
        name: "Failure Test Shelf",
        userId: null,
      });

      const book1 = await bookRepository.create({
        calibreId: 1,
        title: "Valid Book 1",
        authors: ["Author 1"],
        tags: [],
        path: "/path/1",
      });

      const book2 = await bookRepository.create({
        calibreId: 2,
        title: "Valid Book 2",
        authors: ["Author 2"],
        tags: [],
        path: "/path/2",
      });

      // Mix valid books with non-existent IDs
      const result = await shelfService.addBooksToShelf(shelf.id, [
        book1!.id,
        9999, // Non-existent
        book2!.id,
      ]);

      // Should successfully add valid books despite invalid ones
      expect(result.count).toBe(2);
      expect(result.addedBookIds).toHaveLength(2);
    });

    test("should return empty array when no books added", async () => {
      const shelf = await shelfRepository.create({
        name: "No Adds Shelf",
        userId: null,
      });

      // Try to add only non-existent books
      const result = await shelfService.addBooksToShelf(shelf.id, [9999, 8888, 7777]);

      expect(result.count).toBe(0);
      expect(result.addedBookIds).toEqual([]);

      const booksOnShelf = await shelfRepository.getBooksOnShelf(shelf.id);
      expect(booksOnShelf).toHaveLength(0);
    });

    test("should not reindex when no books were added", async () => {
      const shelf = await shelfRepository.create({
        name: "No Reindex Shelf",
        userId: null,
      });

      // Add a book beforehand
      const existingBook = await bookRepository.create({
        calibreId: 1,
        title: "Existing Book",
        authors: ["Author"],
        tags: [],
        path: "/path/1",
      });
      await shelfRepository.addBookToShelf(shelf.id, existingBook!.id, 5);

      // Try to add non-existent books (shouldn't reindex)
      await shelfService.addBooksToShelf(shelf.id, [9999, 8888]);

      const booksOnShelf = await shelfRepository.getBooksOnShelf(shelf.id);
      expect(booksOnShelf).toHaveLength(1);
      // sortOrder should still be 5 (not reindexed to 0)
      expect(booksOnShelf[0].sortOrder).toBe(5);
    });
  });

  describe("removeBooksFromShelf", () => {
    test("should remove multiple books from shelf", async () => {
      const shelf = await shelfRepository.create({
        name: "Bulk Remove Test",
        userId: null,
      });

      // Create and add 5 books
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

      // Remove 3 books
      const bookIdsToRemove = [books[1].id, books[2].id, books[4].id];
      const result = await shelfService.removeBooksFromShelf(shelf.id, bookIdsToRemove);

      expect(result.count).toBe(3);
      expect(result.removedBookIds).toEqual(bookIdsToRemove);

      // Verify only 2 books remain
      const remainingBooks = await shelfRepository.getBooksOnShelf(shelf.id);
      expect(remainingBooks).toHaveLength(2);
      expect(remainingBooks[0].id).toBe(books[0].id);
      expect(remainingBooks[1].id).toBe(books[3].id);
    });

    test("should throw error if shelf does not exist", async () => {
      const book = await bookRepository.create({
        calibreId: 1,
        title: "Test Book",
        authors: ["Author"],
        tags: [],
        path: "/path/1",
      });

      await expect(
        shelfService.removeBooksFromShelf(9999, [book!.id])
      ).rejects.toThrow("Shelf with ID 9999 not found");
    });

    test("should handle empty bookIds array", async () => {
      const shelf = await shelfRepository.create({
        name: "Empty Remove Test",
        userId: null,
      });

      const result = await shelfService.removeBooksFromShelf(shelf.id, []);

      expect(result.count).toBe(0);
      expect(result.removedBookIds).toEqual([]);
    });

    test("should handle non-existent book IDs gracefully", async () => {
      const shelf = await shelfRepository.create({
        name: "Non-Existent Books Test",
        userId: null,
      });

      const book = await bookRepository.create({
        calibreId: 1,
        title: "Real Book",
        authors: ["Author"],
        tags: [],
        path: "/path/1",
      });
      await shelfRepository.addBookToShelf(shelf.id, book!.id);

      // Try to remove real book and non-existent books
      const result = await shelfService.removeBooksFromShelf(shelf.id, [
        book!.id,
        9999,
        8888,
      ]);

      // Should only remove the real book
      expect(result.count).toBe(1);
      expect(result.removedBookIds).toEqual([book!.id]);

      const remainingBooks = await shelfRepository.getBooksOnShelf(shelf.id);
      expect(remainingBooks).toHaveLength(0);
    });

    test("should reindex remaining books after removal", async () => {
      const shelf = await shelfRepository.create({
        name: "Reindex After Remove Test",
        userId: null,
      });

      // Create and add 6 books
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

      // Remove books at indices 1, 3, 4
      await shelfService.removeBooksFromShelf(shelf.id, [
        books[1].id,
        books[3].id,
        books[4].id,
      ]);

      // Verify remaining books are reindexed to 0, 1, 2
      const remainingBooks = await shelfRepository.getBooksOnShelf(shelf.id, "sortOrder", "asc");
      expect(remainingBooks).toHaveLength(3);
      expect(remainingBooks[0].sortOrder).toBe(0);
      expect(remainingBooks[1].sortOrder).toBe(1);
      expect(remainingBooks[2].sortOrder).toBe(2);
    });

    test("should preserve order of remaining books", async () => {
      const shelf = await shelfRepository.create({
        name: "Order Preservation Test",
        userId: null,
      });

      // Create and add 10 books
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
      await shelfService.removeBooksFromShelf(shelf.id, [
        books[1].id,
        books[3].id,
        books[5].id,
        books[7].id,
        books[9].id,
      ]);

      // Verify remaining books maintain relative order
      const remainingBooks = await shelfRepository.getBooksOnShelf(shelf.id, "sortOrder", "asc");
      expect(remainingBooks).toHaveLength(5);
      expect(remainingBooks[0].id).toBe(books[0].id);
      expect(remainingBooks[1].id).toBe(books[2].id);
      expect(remainingBooks[2].id).toBe(books[4].id);
      expect(remainingBooks[3].id).toBe(books[6].id);
      expect(remainingBooks[4].id).toBe(books[8].id);
    });

    test("should handle removing all books from shelf", async () => {
      const shelf = await shelfRepository.create({
        name: "Remove All Test",
        userId: null,
      });

      // Create and add 3 books
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
      const result = await shelfService.removeBooksFromShelf(shelf.id, allBookIds);

      expect(result.count).toBe(3);
      expect(result.removedBookIds).toEqual(allBookIds);

      const remainingBooks = await shelfRepository.getBooksOnShelf(shelf.id);
      expect(remainingBooks).toHaveLength(0);
    });

    test("should not remove books that are not on the shelf", async () => {
      const shelf = await shelfRepository.create({
        name: "Not On Shelf Test",
        userId: null,
      });

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

      // Only add book1 to shelf
      await shelfRepository.addBookToShelf(shelf.id, book1!.id);

      // Try to remove both books
      const result = await shelfService.removeBooksFromShelf(shelf.id, [
        book1!.id,
        book2!.id,
      ]);

      // Should only report book1 as removed
      expect(result.count).toBe(1);
      expect(result.removedBookIds).toEqual([book1!.id]);

      const remainingBooks = await shelfRepository.getBooksOnShelf(shelf.id);
      expect(remainingBooks).toHaveLength(0);
    });
  });
});
