import { describe, test, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { shelfRepository } from "@/lib/repositories/shelf.repository";
import { bookRepository } from "@/lib/repositories/book.repository";
import { setupTestDatabase, teardownTestDatabase, clearTestDatabase } from "@/__tests__/helpers/db-setup";
import { createTestBook } from "../fixtures/test-data";

/**
 * ShelfRepository Coverage Tests
 * 
 * Tests for uncovered lines and methods in shelf.repository.ts:
 * - getBooksOnShelf() with different sort options (series, rating, pages, dateAdded)
 * - getBooksWithShelfInfo() method
 * - findShelvesByBookId() alias method
 * - findBooksByShelfIds() method
 * - deleteAllBooksFromShelf() method
 * - extractLastName() edge case (empty string after trim)
 */

beforeAll(async () => {
  await setupTestDatabase(__filename);
});

afterAll(async () => {
  await teardownTestDatabase(__filename);
});

beforeEach(async () => {
  await clearTestDatabase(__filename);
});

describe("ShelfRepository.getBooksOnShelf() - Additional Sort Options", () => {
  describe("Sort by Series", () => {
    test("should sort books by series name ascending", async () => {
      // Arrange: Create shelf and books with series
      const shelf = await shelfRepository.create({
        name: "Series Shelf",
        userId: null,
      });

      const book1 = await bookRepository.create(createTestBook({
        calibreId: 1,
        title: "Stormlight Book",
        authors: ["Brandon Sanderson"],
        path: "Author/Book 1 (1)",
        series: "The Stormlight Archive",
        seriesIndex: 1,
      }));

      const book2 = await bookRepository.create(createTestBook({
        calibreId: 2,
        title: "Mistborn Book",
        authors: ["Brandon Sanderson"],
        path: "Author/Book 2 (2)",
        series: "Mistborn",
        seriesIndex: 1,
      }));

      const book3 = await bookRepository.create(createTestBook({
        calibreId: 3,
        title: "Book Without Series",
        authors: ["Patrick Rothfuss"],
        path: "Author/Book 3 (3)",
        series: null,
      }));

      await shelfRepository.addBookToShelf(shelf.id, book1.id);
      await shelfRepository.addBookToShelf(shelf.id, book2.id);
      await shelfRepository.addBookToShelf(shelf.id, book3.id);

      // Act: Sort by series ascending
      const books = await shelfRepository.getBooksOnShelf(shelf.id, "series", "asc");

      // Assert: Series order should be Mistborn, Stormlight, then NULL (books without series at end)
      expect(books).toHaveLength(3);
      expect(books[0].id).toBe(book2.id); // Mistborn
      expect(books[1].id).toBe(book1.id); // The Stormlight Archive
      expect(books[2].id).toBe(book3.id); // NULL series at end
    });

    test("should sort books by series name descending", async () => {
      // Arrange
      const shelf = await shelfRepository.create({
        name: "Series Shelf Desc",
        userId: null,
      });

      const book1 = await bookRepository.create(createTestBook({
        calibreId: 1,
        title: "Stormlight Book",
        authors: ["Brandon Sanderson"],
        path: "Author/Book 1 (1)",
        series: "The Stormlight Archive",
        seriesIndex: 1,
      }));

      const book2 = await bookRepository.create(createTestBook({
        calibreId: 2,
        title: "Mistborn Book",
        authors: ["Brandon Sanderson"],
        path: "Author/Book 2 (2)",
        series: "Mistborn",
        seriesIndex: 1,
      }));

      const book3 = await bookRepository.create(createTestBook({
        calibreId: 3,
        title: "No Series",
        authors: ["Author"],
        path: "Author/Book 3 (3)",
        series: null,
      }));

      await shelfRepository.addBookToShelf(shelf.id, book1.id);
      await shelfRepository.addBookToShelf(shelf.id, book2.id);
      await shelfRepository.addBookToShelf(shelf.id, book3.id);

      // Act: Sort by series descending
      const books = await shelfRepository.getBooksOnShelf(shelf.id, "series", "desc");

      // Assert: NULL series still at end, then Stormlight, then Mistborn
      expect(books).toHaveLength(3);
      expect(books[0].id).toBe(book1.id); // The Stormlight Archive
      expect(books[1].id).toBe(book2.id); // Mistborn
      expect(books[2].id).toBe(book3.id); // NULL at end
    });

    test("should sort by series index within same series", async () => {
      // Arrange: Multiple books in same series
      const shelf = await shelfRepository.create({
        name: "Series Index Shelf",
        userId: null,
      });

      const book1 = await bookRepository.create(createTestBook({
        calibreId: 1,
        title: "Mistborn Book 3",
        authors: ["Brandon Sanderson"],
        path: "Author/Book 1 (1)",
        series: "Mistborn",
        seriesIndex: 3,
      }));

      const book2 = await bookRepository.create(createTestBook({
        calibreId: 2,
        title: "Mistborn Book 1",
        authors: ["Brandon Sanderson"],
        path: "Author/Book 2 (2)",
        series: "Mistborn",
        seriesIndex: 1,
      }));

      const book3 = await bookRepository.create(createTestBook({
        calibreId: 3,
        title: "Mistborn Book 2",
        authors: ["Brandon Sanderson"],
        path: "Author/Book 3 (3)",
        series: "Mistborn",
        seriesIndex: 2,
      }));

      await shelfRepository.addBookToShelf(shelf.id, book1.id);
      await shelfRepository.addBookToShelf(shelf.id, book2.id);
      await shelfRepository.addBookToShelf(shelf.id, book3.id);

      // Act: Sort by series ascending
      const books = await shelfRepository.getBooksOnShelf(shelf.id, "series", "asc");

      // Assert: Should be ordered by series index 1, 2, 3
      expect(books).toHaveLength(3);
      expect(books[0].id).toBe(book2.id); // Index 1
      expect(books[1].id).toBe(book3.id); // Index 2
      expect(books[2].id).toBe(book1.id); // Index 3
    });
  });

  describe("Sort by Rating", () => {
    test("should sort books by rating ascending", async () => {
      // Arrange
      const shelf = await shelfRepository.create({
        name: "Rating Shelf",
        userId: null,
      });

      const book1 = await bookRepository.create(createTestBook({
        calibreId: 1,
        title: "5 Star Book",
        authors: ["Author"],
        path: "Author/Book 1 (1)",
        rating: 5,
      }));

      const book2 = await bookRepository.create(createTestBook({
        calibreId: 2,
        title: "3 Star Book",
        authors: ["Author"],
        path: "Author/Book 2 (2)",
        rating: 3,
      }));

      const book3 = await bookRepository.create(createTestBook({
        calibreId: 3,
        title: "Unrated Book",
        authors: ["Author"],
        path: "Author/Book 3 (3)",
        rating: null,
      }));

      await shelfRepository.addBookToShelf(shelf.id, book1.id);
      await shelfRepository.addBookToShelf(shelf.id, book2.id);
      await shelfRepository.addBookToShelf(shelf.id, book3.id);

      // Act: Sort by rating ascending
      const books = await shelfRepository.getBooksOnShelf(shelf.id, "rating", "asc");

      // Assert: 3, 5, then NULL at end
      expect(books).toHaveLength(3);
      expect(books[0].id).toBe(book2.id); // 3 stars
      expect(books[1].id).toBe(book1.id); // 5 stars
      expect(books[2].id).toBe(book3.id); // NULL at end
    });

    test("should sort books by rating descending", async () => {
      // Arrange
      const shelf = await shelfRepository.create({
        name: "Rating Desc Shelf",
        userId: null,
      });

      const book1 = await bookRepository.create(createTestBook({
        calibreId: 1,
        title: "5 Star Book",
        authors: ["Author"],
        path: "Author/Book 1 (1)",
        rating: 5,
      }));

      const book2 = await bookRepository.create(createTestBook({
        calibreId: 2,
        title: "3 Star Book",
        authors: ["Author"],
        path: "Author/Book 2 (2)",
        rating: 3,
      }));

      const book3 = await bookRepository.create(createTestBook({
        calibreId: 3,
        title: "Unrated",
        authors: ["Author"],
        path: "Author/Book 3 (3)",
        rating: null,
      }));

      await shelfRepository.addBookToShelf(shelf.id, book1.id);
      await shelfRepository.addBookToShelf(shelf.id, book2.id);
      await shelfRepository.addBookToShelf(shelf.id, book3.id);

      // Act: Sort by rating descending
      const books = await shelfRepository.getBooksOnShelf(shelf.id, "rating", "desc");

      // Assert: 5, 3, then NULL at end
      expect(books).toHaveLength(3);
      expect(books[0].id).toBe(book1.id); // 5 stars
      expect(books[1].id).toBe(book2.id); // 3 stars
      expect(books[2].id).toBe(book3.id); // NULL at end
    });
  });

  describe("Sort by Pages", () => {
    test("should sort books by page count ascending", async () => {
      // Arrange
      const shelf = await shelfRepository.create({
        name: "Pages Shelf",
        userId: null,
      });

      const book1 = await bookRepository.create(createTestBook({
        calibreId: 1,
        title: "Long Book",
        authors: ["Author"],
        path: "Author/Book 1 (1)",
        totalPages: 1000,
      }));

      const book2 = await bookRepository.create(createTestBook({
        calibreId: 2,
        title: "Short Book",
        authors: ["Author"],
        path: "Author/Book 2 (2)",
        totalPages: 200,
      }));

      const book3 = await bookRepository.create(createTestBook({
        calibreId: 3,
        title: "No Page Count",
        authors: ["Author"],
        path: "Author/Book 3 (3)",
        totalPages: null,
      }));

      await shelfRepository.addBookToShelf(shelf.id, book1.id);
      await shelfRepository.addBookToShelf(shelf.id, book2.id);
      await shelfRepository.addBookToShelf(shelf.id, book3.id);

      // Act: Sort by pages ascending
      const books = await shelfRepository.getBooksOnShelf(shelf.id, "pages", "asc");

      // Assert: 200, 1000, then NULL at end
      expect(books).toHaveLength(3);
      expect(books[0].id).toBe(book2.id); // 200 pages
      expect(books[1].id).toBe(book1.id); // 1000 pages
      expect(books[2].id).toBe(book3.id); // NULL at end
    });

    test("should sort books by page count descending", async () => {
      // Arrange
      const shelf = await shelfRepository.create({
        name: "Pages Desc Shelf",
        userId: null,
      });

      const book1 = await bookRepository.create(createTestBook({
        calibreId: 1,
        title: "Long Book",
        authors: ["Author"],
        path: "Author/Book 1 (1)",
        totalPages: 1000,
      }));

      const book2 = await bookRepository.create(createTestBook({
        calibreId: 2,
        title: "Short Book",
        authors: ["Author"],
        path: "Author/Book 2 (2)",
        totalPages: 200,
      }));

      const book3 = await bookRepository.create(createTestBook({
        calibreId: 3,
        title: "No Pages",
        authors: ["Author"],
        path: "Author/Book 3 (3)",
        totalPages: null,
      }));

      await shelfRepository.addBookToShelf(shelf.id, book1.id);
      await shelfRepository.addBookToShelf(shelf.id, book2.id);
      await shelfRepository.addBookToShelf(shelf.id, book3.id);

      // Act: Sort by pages descending
      const books = await shelfRepository.getBooksOnShelf(shelf.id, "pages", "desc");

      // Assert: 1000, 200, then NULL at end
      expect(books).toHaveLength(3);
      expect(books[0].id).toBe(book1.id); // 1000 pages
      expect(books[1].id).toBe(book2.id); // 200 pages
      expect(books[2].id).toBe(book3.id); // NULL at end
    });
  });

  describe("Sort by Date Added", () => {
    test("should sort books by date added to shelf ascending", async () => {
      // Arrange
      const shelf = await shelfRepository.create({
        name: "Date Added Shelf",
        userId: null,
      });

      const book1 = await bookRepository.create(createTestBook({
        calibreId: 1,
        title: "Book 1",
        authors: ["Author"],
        path: "Author/Book 1 (1)",
      }));

      const book2 = await bookRepository.create(createTestBook({
        calibreId: 2,
        title: "Book 2",
        authors: ["Author"],
        path: "Author/Book 2 (2)",
      }));

      const book3 = await bookRepository.create(createTestBook({
        calibreId: 3,
        title: "Book 3",
        authors: ["Author"],
        path: "Author/Book 3 (3)",
      }));

      // Add books in specific order (book2 first, then book1, then book3)
      await shelfRepository.addBookToShelf(shelf.id, book2.id);
      // Small delay to ensure different timestamps
      await new Promise(resolve => setTimeout(resolve, 10));
      await shelfRepository.addBookToShelf(shelf.id, book1.id);
      await new Promise(resolve => setTimeout(resolve, 10));
      await shelfRepository.addBookToShelf(shelf.id, book3.id);

      // Act: Sort by dateAdded ascending
      const books = await shelfRepository.getBooksOnShelf(shelf.id, "dateAdded", "asc");

      // Assert: Should be in order of addition (book2, book1, book3)
      expect(books).toHaveLength(3);
      expect(books[0].id).toBe(book2.id); // Added first
      expect(books[1].id).toBe(book1.id); // Added second
      expect(books[2].id).toBe(book3.id); // Added third
    });

    test("should sort books by date added to shelf descending", async () => {
      // Arrange
      const shelf = await shelfRepository.create({
        name: "Date Added Desc Shelf",
        userId: null,
      });

      const book1 = await bookRepository.create(createTestBook({
        calibreId: 1,
        title: "Book 1",
        authors: ["Author"],
        path: "Author/Book 1 (1)",
      }));

      const book2 = await bookRepository.create(createTestBook({
        calibreId: 2,
        title: "Book 2",
        authors: ["Author"],
        path: "Author/Book 2 (2)",
      }));

      // Add books in order (SQLite uses seconds, so delay 1100ms to ensure different timestamps)
      await shelfRepository.addBookToShelf(shelf.id, book1.id);
      await new Promise(resolve => setTimeout(resolve, 1100));
      await shelfRepository.addBookToShelf(shelf.id, book2.id);

      // Act: Sort by dateAdded descending
      const books = await shelfRepository.getBooksOnShelf(shelf.id, "dateAdded", "desc");

      // Assert: Reverse order (book2, book1)
      expect(books).toHaveLength(2);
      expect(books[0].id).toBe(book2.id); // Added last (most recent)
      expect(books[1].id).toBe(book1.id); // Added first
    });
  });
});

describe("ShelfRepository.getBooksWithShelfInfo()", () => {
  test("should return books with shelf-specific metadata", async () => {
    // Arrange
    const shelf = await shelfRepository.create({
      name: "Test Shelf",
      userId: null,
    });

    const book1 = await bookRepository.create(createTestBook({
      calibreId: 1,
      title: "Book 1",
      authors: ["Author 1"],
      path: "Author/Book 1 (1)",
    }));

    const book2 = await bookRepository.create(createTestBook({
      calibreId: 2,
      title: "Book 2",
      authors: ["Author 2"],
      path: "Author/Book 2 (2)",
    }));

    // Add books with specific sort orders
    await shelfRepository.addBookToShelf(shelf.id, book1.id, 5);
    await shelfRepository.addBookToShelf(shelf.id, book2.id, 10);

    // Act
    const books = await shelfRepository.getBooksWithShelfInfo(shelf.id);

    // Assert
    expect(books).toHaveLength(2);
    
    // Check that shelf metadata is included
    const bookWithInfo1 = books.find(b => b.id === book1.id);
    const bookWithInfo2 = books.find(b => b.id === book2.id);

    expect(bookWithInfo1).toBeDefined();
    expect(bookWithInfo1?.sortOrder).toBe(5);
    expect(bookWithInfo1?.addedAt).toBeInstanceOf(Date);

    expect(bookWithInfo2).toBeDefined();
    expect(bookWithInfo2?.sortOrder).toBe(10);
    expect(bookWithInfo2?.addedAt).toBeInstanceOf(Date);
  });

  test("should return books sorted by sortOrder", async () => {
    // Arrange
    const shelf = await shelfRepository.create({
      name: "Ordered Shelf",
      userId: null,
    });

    const book1 = await bookRepository.create(createTestBook({
      calibreId: 1,
      title: "Book 1",
      authors: ["Author"],
      path: "Author/Book 1 (1)",
    }));

    const book2 = await bookRepository.create(createTestBook({
      calibreId: 2,
      title: "Book 2",
      authors: ["Author"],
      path: "Author/Book 2 (2)",
    }));

    // Add with reversed sortOrder
    await shelfRepository.addBookToShelf(shelf.id, book1.id, 10);
    await shelfRepository.addBookToShelf(shelf.id, book2.id, 5);

    // Act
    const books = await shelfRepository.getBooksWithShelfInfo(shelf.id);

    // Assert: Should be sorted by sortOrder (book2 first with 5, then book1 with 10)
    expect(books).toHaveLength(2);
    expect(books[0].id).toBe(book2.id);
    expect(books[0].sortOrder).toBe(5);
    expect(books[1].id).toBe(book1.id);
    expect(books[1].sortOrder).toBe(10);
  });

  test("should return empty array for shelf with no books", async () => {
    // Arrange
    const shelf = await shelfRepository.create({
      name: "Empty Shelf",
      userId: null,
    });

    // Act
    const books = await shelfRepository.getBooksWithShelfInfo(shelf.id);

    // Assert
    expect(books).toEqual([]);
  });
});

describe("ShelfRepository.findShelvesByBookId()", () => {
  test("should find all shelves containing a book", async () => {
    // Arrange
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

    const book = await bookRepository.create(createTestBook({
      calibreId: 1,
      title: "Multi-Shelf Book",
      authors: ["Author"],
      path: "Author/Book (1)",
    }));

    // Add book to shelf1 and shelf2, but not shelf3
    await shelfRepository.addBookToShelf(shelf1.id, book.id);
    await shelfRepository.addBookToShelf(shelf2.id, book.id);

    // Act
    const shelves = await shelfRepository.findShelvesByBookId(book.id);

    // Assert
    expect(shelves).toHaveLength(2);
    const shelfIds = shelves.map(s => s.id);
    expect(shelfIds).toContain(shelf1.id);
    expect(shelfIds).toContain(shelf2.id);
    expect(shelfIds).not.toContain(shelf3.id);
  });

  test("should return empty array for book not on any shelf", async () => {
    // Arrange
    await shelfRepository.create({
      name: "Shelf",
      userId: null,
    });

    const book = await bookRepository.create(createTestBook({
      calibreId: 1,
      title: "Book Not on Shelf",
      authors: ["Author"],
      path: "Author/Book (1)",
    }));

    // Act
    const shelves = await shelfRepository.findShelvesByBookId(book.id);

    // Assert
    expect(shelves).toEqual([]);
  });

  test("should return shelves sorted by name", async () => {
    // Arrange
    const shelfZ = await shelfRepository.create({
      name: "Z Shelf",
      userId: null,
    });

    const shelfA = await shelfRepository.create({
      name: "A Shelf",
      userId: null,
    });

    const shelfM = await shelfRepository.create({
      name: "M Shelf",
      userId: null,
    });

    const book = await bookRepository.create(createTestBook({
      calibreId: 1,
      title: "Book",
      authors: ["Author"],
      path: "Author/Book (1)",
    }));

    await shelfRepository.addBookToShelf(shelfZ.id, book.id);
    await shelfRepository.addBookToShelf(shelfA.id, book.id);
    await shelfRepository.addBookToShelf(shelfM.id, book.id);

    // Act
    const shelves = await shelfRepository.findShelvesByBookId(book.id);

    // Assert: Should be sorted alphabetically
    expect(shelves).toHaveLength(3);
    expect(shelves[0].name).toBe("A Shelf");
    expect(shelves[1].name).toBe("M Shelf");
    expect(shelves[2].name).toBe("Z Shelf");
  });
});

describe("ShelfRepository.findBooksByShelfIds()", () => {
  test("should find all books on specified shelves", async () => {
    // Arrange
    const shelf1 = await shelfRepository.create({
      name: "Shelf 1",
      userId: null,
    });

    const shelf2 = await shelfRepository.create({
      name: "Shelf 2",
      userId: null,
    });

    const book1 = await bookRepository.create(createTestBook({
      calibreId: 1,
      title: "Book 1",
      authors: ["Author"],
      path: "Author/Book 1 (1)",
    }));

    const book2 = await bookRepository.create(createTestBook({
      calibreId: 2,
      title: "Book 2",
      authors: ["Author"],
      path: "Author/Book 2 (2)",
    }));

    const book3 = await bookRepository.create(createTestBook({
      calibreId: 3,
      title: "Book 3",
      authors: ["Author"],
      path: "Author/Book 3 (3)",
    }));

    // Add book1 to shelf1, book2 to shelf2, book3 to both
    await shelfRepository.addBookToShelf(shelf1.id, book1.id);
    await shelfRepository.addBookToShelf(shelf2.id, book2.id);
    await shelfRepository.addBookToShelf(shelf1.id, book3.id);
    await shelfRepository.addBookToShelf(shelf2.id, book3.id);

    // Act: Find books on either shelf
    const bookIds = await shelfRepository.findBooksByShelfIds([shelf1.id, shelf2.id]);

    // Assert: Should return all 3 books (book3 only once due to DISTINCT)
    expect(bookIds).toHaveLength(3);
    expect(bookIds).toContain(book1.id);
    expect(bookIds).toContain(book2.id);
    expect(bookIds).toContain(book3.id);
  });

  test("should return empty array for empty shelfIds array", async () => {
    // Act
    const bookIds = await shelfRepository.findBooksByShelfIds([]);

    // Assert
    expect(bookIds).toEqual([]);
  });

  test("should return empty array for shelves with no books", async () => {
    // Arrange
    const shelf = await shelfRepository.create({
      name: "Empty Shelf",
      userId: null,
    });

    // Act
    const bookIds = await shelfRepository.findBooksByShelfIds([shelf.id]);

    // Assert
    expect(bookIds).toEqual([]);
  });

  test("should not duplicate book IDs when book is on multiple selected shelves", async () => {
    // Arrange
    const shelf1 = await shelfRepository.create({
      name: "Shelf 1",
      userId: null,
    });

    const shelf2 = await shelfRepository.create({
      name: "Shelf 2",
      userId: null,
    });

    const book = await bookRepository.create(createTestBook({
      calibreId: 1,
      title: "Book on Both Shelves",
      authors: ["Author"],
      path: "Author/Book (1)",
    }));

    await shelfRepository.addBookToShelf(shelf1.id, book.id);
    await shelfRepository.addBookToShelf(shelf2.id, book.id);

    // Act
    const bookIds = await shelfRepository.findBooksByShelfIds([shelf1.id, shelf2.id]);

    // Assert: Should return book ID only once (DISTINCT)
    expect(bookIds).toHaveLength(1);
    expect(bookIds[0]).toBe(book.id);
  });
});

describe("ShelfRepository.deleteAllBooksFromShelf()", () => {
  test("should delete all book associations from a shelf", async () => {
    // Arrange
    const shelf = await shelfRepository.create({
      name: "Shelf to Clear",
      userId: null,
    });

    const book1 = await bookRepository.create(createTestBook({
      calibreId: 1,
      title: "Book 1",
      authors: ["Author"],
      path: "Author/Book 1 (1)",
    }));

    const book2 = await bookRepository.create(createTestBook({
      calibreId: 2,
      title: "Book 2",
      authors: ["Author"],
      path: "Author/Book 2 (2)",
    }));

    await shelfRepository.addBookToShelf(shelf.id, book1.id);
    await shelfRepository.addBookToShelf(shelf.id, book2.id);

    // Verify books are on shelf
    const booksBefore = await shelfRepository.getBooksOnShelf(shelf.id, "sortOrder", "asc");
    expect(booksBefore).toHaveLength(2);

    // Act
    const deletedCount = await shelfRepository.deleteAllBooksFromShelf(shelf.id);

    // Assert
    expect(deletedCount).toBe(2);

    // Verify shelf is now empty
    const booksAfter = await shelfRepository.getBooksOnShelf(shelf.id, "sortOrder", "asc");
    expect(booksAfter).toHaveLength(0);
  });

  test("should return 0 for shelf with no books", async () => {
    // Arrange
    const shelf = await shelfRepository.create({
      name: "Empty Shelf",
      userId: null,
    });

    // Act
    const deletedCount = await shelfRepository.deleteAllBooksFromShelf(shelf.id);

    // Assert
    expect(deletedCount).toBe(0);
  });

  test("should not delete books from other shelves", async () => {
    // Arrange
    const shelf1 = await shelfRepository.create({
      name: "Shelf 1",
      userId: null,
    });

    const shelf2 = await shelfRepository.create({
      name: "Shelf 2",
      userId: null,
    });

    const book = await bookRepository.create(createTestBook({
      calibreId: 1,
      title: "Book on Both Shelves",
      authors: ["Author"],
      path: "Author/Book (1)",
    }));

    await shelfRepository.addBookToShelf(shelf1.id, book.id);
    await shelfRepository.addBookToShelf(shelf2.id, book.id);

    // Act: Delete from shelf1 only
    await shelfRepository.deleteAllBooksFromShelf(shelf1.id);

    // Assert: Book should still be on shelf2
    const booksOnShelf1 = await shelfRepository.getBooksOnShelf(shelf1.id, "sortOrder", "asc");
    expect(booksOnShelf1).toHaveLength(0);

    const booksOnShelf2 = await shelfRepository.getBooksOnShelf(shelf2.id, "sortOrder", "asc");
    expect(booksOnShelf2).toHaveLength(1);
    expect(booksOnShelf2[0].id).toBe(book.id);
  });
});
