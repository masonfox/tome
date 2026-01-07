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
});
