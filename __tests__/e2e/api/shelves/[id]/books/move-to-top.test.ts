/**
 * API Tests: POST /api/shelves/[id]/books/[bookId]/move-to-top
 * 
 * Tests the move to top endpoint for books on shelves
 */

import { describe, test, expect, beforeAll, beforeEach, afterAll, vi } from "vitest";
import { POST } from "@/app/api/shelves/[id]/books/[bookId]/move-to-top/route";
import { shelfRepository } from "@/lib/repositories/shelf.repository";
import { bookRepository } from "@/lib/repositories";
import type { NextRequest } from "next/server";
import {
  setupTestDatabase,
  clearTestDatabase,
  teardownTestDatabase,
} from "@/__tests__/helpers/db-setup";

/**
 * Mock Rationale: Prevent Next.js cache revalidation side effects during tests.
 */
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));

describe("POST /api/shelves/[id]/books/[bookId]/move-to-top", () => {
  beforeAll(async () => {
    await setupTestDatabase(__filename);
  });

  beforeEach(async () => {
    await clearTestDatabase(__filename);
  });

  afterAll(async () => {
    await teardownTestDatabase(__filename);
  });

  test("should move book to top and return 200", async () => {
    // Create shelf
    const shelf = await shelfRepository.create({
      name: "Test Shelf",
      userId: null,
    });

    // Create books and add to shelf
    const books = await Promise.all(
      Array.from({ length: 3 }, (_, i) =>
        bookRepository.create({
          title: `Book ${i + 1}`,
          calibreId: i + 1,
          path: `/test/book${i + 1}.epub`,
        })
      )
    );

    for (const book of books) {
      await shelfRepository.addBookToShelf(shelf.id, book.id);
    }

    // Move book at position 2 to top
    const request = new Request(
      `http://localhost/api/shelves/${shelf.id}/books/${books[2].id}/move-to-top`,
      { method: "POST" }
    );

    const response = await POST(request as NextRequest, {
      params: Promise.resolve({ id: shelf.id.toString(), bookId: books[2].id.toString() }),
    });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);

    // Verify new order
    const shelfBooks = await shelfRepository.getBooksOnShelf(shelf.id, "sortOrder", "asc");
    expect(shelfBooks).toHaveLength(3);
    expect(shelfBooks[0].id).toBe(books[2].id); // Moved to top
    expect(shelfBooks[0].sortOrder).toBe(0);
    expect(shelfBooks[1].id).toBe(books[0].id); // Shifted down
    expect(shelfBooks[1].sortOrder).toBe(1);
    expect(shelfBooks[2].id).toBe(books[1].id); // Shifted down
    expect(shelfBooks[2].sortOrder).toBe(2);
  });

  test("should handle moving already top item (no-op)", async () => {
    const shelf = await shelfRepository.create({
      name: "Test Shelf",
      userId: null,
    });

    const books = await Promise.all(
      Array.from({ length: 2 }, (_, i) =>
        bookRepository.create({
          title: `Book ${i + 1}`,
          calibreId: i + 1,
          path: `/test/book${i + 1}.epub`,
        })
      )
    );

    for (const book of books) {
      await shelfRepository.addBookToShelf(shelf.id, book.id);
    }

    const request = new Request(
      `http://localhost/api/shelves/${shelf.id}/books/${books[0].id}/move-to-top`,
      { method: "POST" }
    );

    const response = await POST(request as NextRequest, {
      params: Promise.resolve({ id: shelf.id.toString(), bookId: books[0].id.toString() }),
    });

    expect(response.status).toBe(200);

    // Verify positions unchanged
    const shelfBooks = await shelfRepository.getBooksOnShelf(shelf.id, "sortOrder", "asc");
    expect(shelfBooks[0].id).toBe(books[0].id);
    expect(shelfBooks[0].sortOrder).toBe(0);
  });

  test("should return 400 for invalid shelf ID format", async () => {
    const request = new Request("http://localhost/api/shelves/invalid/books/1/move-to-top", {
      method: "POST",
    });

    const response = await POST(request as NextRequest, {
      params: Promise.resolve({ id: "invalid", bookId: "1" }),
    });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error.message).toBe("Shelf ID must be a valid number");
  });

  test("should return 400 for invalid book ID format", async () => {
    const request = new Request("http://localhost/api/shelves/1/books/invalid/move-to-top", {
      method: "POST",
    });

    const response = await POST(request as NextRequest, {
      params: Promise.resolve({ id: "1", bookId: "invalid" }),
    });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error.message).toBe("Book ID must be a valid number");
  });

  test("should return 404 for non-existent shelf", async () => {
    const book = await bookRepository.create({
      title: "Book 1",
      calibreId: 1,
    });

    const request = new Request(`http://localhost/api/shelves/99999/books/${book.id}/move-to-top`, {
      method: "POST",
    });

    const response = await POST(request as NextRequest, {
      params: Promise.resolve({ id: "99999", bookId: book.id.toString() }),
    });
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error.message).toContain("not found");
  });

  test("should return 404 for book not on shelf", async () => {
    const shelf = await shelfRepository.create({
      name: "Test Shelf",
      userId: null,
    });

    const book = await bookRepository.create({
      title: "Book Not On Shelf",
      calibreId: 1,
    });

    const request = new Request(
      `http://localhost/api/shelves/${shelf.id}/books/${book.id}/move-to-top`,
      { method: "POST" }
    );

    const response = await POST(request as NextRequest, {
      params: Promise.resolve({ id: shelf.id.toString(), bookId: book.id.toString() }),
    });
    const data = await response.json();

    expect(response.status).toBe(400); // Bad request: book not on shelf
    expect(data.error.message).toContain("not on shelf");
  });

  test("should only affect specified shelf", async () => {
    // Create two shelves
    const shelf1 = await shelfRepository.create({
      name: "Shelf 1",
      userId: null,
    });
    const shelf2 = await shelfRepository.create({
      name: "Shelf 2",
      userId: null,
    });

    // Create books and add to both shelves
    const books = await Promise.all(
      Array.from({ length: 3 }, (_, i) =>
        bookRepository.create({
          title: `Book ${i + 1}`,
          calibreId: i + 1,
          path: `/test/book${i + 1}.epub`,
        })
      )
    );

    for (const book of books) {
      await shelfRepository.addBookToShelf(shelf1.id, book.id);
      await shelfRepository.addBookToShelf(shelf2.id, book.id);
    }

    // Move book to top on shelf1
    const request = new Request(
      `http://localhost/api/shelves/${shelf1.id}/books/${books[2].id}/move-to-top`,
      { method: "POST" }
    );

    await POST(request as NextRequest, {
      params: Promise.resolve({ id: shelf1.id.toString(), bookId: books[2].id.toString() }),
    });

    // Verify shelf1 changed
    const shelf1Books = await shelfRepository.getBooksOnShelf(shelf1.id, "sortOrder", "asc");
    expect(shelf1Books[0].id).toBe(books[2].id);

    // Verify shelf2 unchanged
    const shelf2Books = await shelfRepository.getBooksOnShelf(shelf2.id, "sortOrder", "asc");
    expect(shelf2Books[0].id).toBe(books[0].id);
    expect(shelf2Books[1].id).toBe(books[1].id);
    expect(shelf2Books[2].id).toBe(books[2].id);
  });

  test("should work with single book on shelf", async () => {
    const shelf = await shelfRepository.create({
      name: "Single Book Shelf",
      userId: null,
    });

    const book = await bookRepository.create({
      title: "Only Book",
      calibreId: 1,
    });

    await shelfRepository.addBookToShelf(shelf.id, book.id);

    const request = new Request(
      `http://localhost/api/shelves/${shelf.id}/books/${book.id}/move-to-top`,
      { method: "POST" }
    );

    const response = await POST(request as NextRequest, {
      params: Promise.resolve({ id: shelf.id.toString(), bookId: book.id.toString() }),
    });

    expect(response.status).toBe(200);

    const shelfBooks = await shelfRepository.getBooksOnShelf(shelf.id, "sortOrder", "asc");
    expect(shelfBooks).toHaveLength(1);
    expect(shelfBooks[0].id).toBe(book.id);
    expect(shelfBooks[0].sortOrder).toBe(0);
  });
});
