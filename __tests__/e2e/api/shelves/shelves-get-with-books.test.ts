import { describe, test, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { setupTestDatabase, teardownTestDatabase, clearTestDatabase } from "../../../helpers/db-setup";
import { bookRepository, sessionRepository } from "@/lib/repositories";
import { shelfRepository } from "@/lib/repositories/shelf.repository";
import { GET } from "@/app/api/shelves/[id]/route";
import { createMockRequest } from "../../../fixtures/test-data";
import type { NextRequest } from "next/server";

/**
 * Mock Rationale: Prevent Next.js cache revalidation side effects during tests.
 * The shelf API calls revalidatePath on updates, but we don't need to test
 * Next.js's caching behavior - just our business logic.
 */
vi.mock("next/cache", () => ({
  revalidatePath: () => {},
}));

/**
 * Shelf API Endpoint Tests - Status Display Regression
 * 
 * Tests the GET /api/shelves/:id?withBooks=true endpoint to ensure
 * all status types are returned correctly, including edge cases.
 * 
 * REGRESSION: Books with "read" status were showing as null because
 * the query only joined with active reading sessions (is_active = true),
 * but "read" books have is_active = false.
 * 
 * FIX: Changed query to use subquery that gets most recent reading
 * session regardless of is_active flag.
 * 
 * Coverage:
 * - All status types: to-read, read-next, reading, read
 * - Books without sessions (null status)
 * - Read books with inactive sessions (THE BUG)
 * - Multiple sessions per book (should return most recent)
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

describe('GET /api/shelves/:id - Status Display Regression', () => {
  test('should return all book statuses including read (inactive sessions)', async () => {
    // ========================================================================
    // ARRANGE: Create shelf and books with all status types
    // ========================================================================
    
    // Create a shelf
    const shelf = await shelfRepository.create({
      name: "Test Shelf",
      userId: null,
    });

    // Create 5 books to test all status scenarios
    const bookToRead = await bookRepository.create({
      calibreId: 1,
      title: "Book with To-Read Status",
      authors: ["Author 1"],
      tags: [],
      path: "/path/1",
      totalPages: 300,
    });

    const bookReadNext = await bookRepository.create({
      calibreId: 2,
      title: "Book with Read-Next Status",
      authors: ["Author 2"],
      tags: [],
      path: "/path/2",
      totalPages: 400,
    });

    const bookReading = await bookRepository.create({
      calibreId: 3,
      title: "Book with Reading Status",
      authors: ["Author 3"],
      tags: [],
      path: "/path/3",
      totalPages: 500,
    });

    const bookRead = await bookRepository.create({
      calibreId: 4,
      title: "Book with Read Status (Inactive)",
      authors: ["Author 4"],
      tags: [],
      path: "/path/4",
      totalPages: 600,
    });

    const bookNoSession = await bookRepository.create({
      calibreId: 5,
      title: "Book without Session",
      authors: ["Author 5"],
      tags: [],
      path: "/path/5",
      totalPages: 700,
    });

    // Add all books to shelf
    await shelfRepository.addBookToShelf(shelf.id, bookToRead!.id);
    await shelfRepository.addBookToShelf(shelf.id, bookReadNext!.id);
    await shelfRepository.addBookToShelf(shelf.id, bookReading!.id);
    await shelfRepository.addBookToShelf(shelf.id, bookRead!.id);
    await shelfRepository.addBookToShelf(shelf.id, bookNoSession!.id);

    // Create reading sessions with different statuses
    // Book 1: "to-read" status (active session)
    await sessionRepository.create({
      bookId: bookToRead!.id,
      userId: null,
      sessionNumber: 1,
      status: "to-read",
      isActive: true,
    });

    // Book 2: "read-next" status (active session)
    await sessionRepository.create({
      bookId: bookReadNext!.id,
      userId: null,
      sessionNumber: 1,
      status: "read-next",
      isActive: true,
    });

    // Book 3: "reading" status (active session)
    await sessionRepository.create({
      bookId: bookReading!.id,
      userId: null,
      sessionNumber: 1,
      status: "reading",
      isActive: true,
      startedDate: "2024-01-10",
    });

    // Book 4: "read" status (INACTIVE session) - THIS WAS THE BUG
    await sessionRepository.create({
      bookId: bookRead!.id,
      userId: null,
      sessionNumber: 1,
      status: "read",
      isActive: false, // <-- Critical: read books have isActive = false
      startedDate: "2024-01-01",
      completedDate: "2024-01-15",
      review: "Great book!",
    });

    // Book 5: No session (status should be null)

    // ========================================================================
    // ACT: Call the shelf API
    // ========================================================================
    
    const request = createMockRequest("GET", `/api/shelves/${shelf.id}?withBooks=true`) as NextRequest;
    const params = Promise.resolve({ id: shelf.id.toString() });
    const response = await GET(request, { params });
    const result = await response.json();

    // ========================================================================
    // ASSERT: Verify response structure
    // ========================================================================
    
    expect(response.status).toBe(200);
    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
    expect(result.data.id).toBe(shelf.id);
    expect(result.data.name).toBe("Test Shelf");
    expect(result.data.books).toBeDefined();
    expect(result.data.books).toHaveLength(5);

    // ========================================================================
    // ASSERT: Verify each book returns the correct status
    // ========================================================================
    
    const { books } = result.data;

    // Find each book in the response
    const toReadBook = books.find((b: any) => b.id === bookToRead!.id);
    const readNextBook = books.find((b: any) => b.id === bookReadNext!.id);
    const readingBook = books.find((b: any) => b.id === bookReading!.id);
    const readBook = books.find((b: any) => b.id === bookRead!.id);
    const noSessionBook = books.find((b: any) => b.id === bookNoSession!.id);

    // Verify all books were found
    expect(toReadBook).toBeDefined();
    expect(readNextBook).toBeDefined();
    expect(readingBook).toBeDefined();
    expect(readBook).toBeDefined();
    expect(noSessionBook).toBeDefined();

    // Verify statuses
    expect(toReadBook.status).toBe("to-read");
    expect(readNextBook.status).toBe("read-next");
    expect(readingBook.status).toBe("reading");
    
    // THIS IS THE CRITICAL ASSERTION - was returning null before fix
    expect(readBook.status).toBe("read");
    
    expect(noSessionBook.status).toBeNull();

    // ========================================================================
    // ASSERT: Verify book metadata is included
    // ========================================================================
    
    expect(readBook.title).toBe("Book with Read Status (Inactive)");
    expect(readBook.authors).toEqual(["Author 4"]);
    expect(readBook.totalPages).toBe(600);
  });

  test('should return status from most recent session when multiple sessions exist', async () => {
    // ========================================================================
    // ARRANGE: Create a book with multiple reading sessions (re-reading)
    // ========================================================================
    
    const shelf = await shelfRepository.create({
      name: "Re-reading Shelf",
      userId: null,
    });

    const book = await bookRepository.create({
      calibreId: 1,
      title: "Book with Multiple Sessions",
      authors: ["Author 1"],
      tags: [],
      path: "/path/1",
      totalPages: 500,
    });

    await shelfRepository.addBookToShelf(shelf.id, book!.id);

    // Session 1: Read (completed, inactive)
    await sessionRepository.create({
      bookId: book!.id,
      userId: null,
      sessionNumber: 1,
      status: "read",
      isActive: false,
      startedDate: "2024-01-01",
      completedDate: "2024-01-15",
    });

    // Session 2: Reading (current, active) - this should be returned
    await sessionRepository.create({
      bookId: book!.id,
      userId: null,
      sessionNumber: 2,
      status: "reading",
      isActive: true,
      startedDate: "2024-02-01",
    });

    // ========================================================================
    // ACT: Call the shelf API
    // ========================================================================
    
    const request = createMockRequest("GET", `/api/shelves/${shelf.id}?withBooks=true`) as NextRequest;
    const params = Promise.resolve({ id: shelf.id.toString() });
    const response = await GET(request, { params });
    const result = await response.json();

    // ========================================================================
    // ASSERT: Should return the most recent session status (session 2)
    // ========================================================================
    
    expect(response.status).toBe(200);
    expect(result.success).toBe(true);
    expect(result.data.books).toHaveLength(1);
    
    const returnedBook = result.data.books[0];
    expect(returnedBook.id).toBe(book!.id);
    // Should return the most recent session status (reading, not read)
    expect(returnedBook.status).toBe("reading");
  });

  test('should return read status from most recent completed session', async () => {
    // ========================================================================
    // ARRANGE: Create a book that was read multiple times
    // ========================================================================
    
    const shelf = await shelfRepository.create({
      name: "Multiple Reads Shelf",
      userId: null,
    });

    const book = await bookRepository.create({
      calibreId: 1,
      title: "Book Read Multiple Times",
      authors: ["Author 1"],
      tags: [],
      path: "/path/1",
      totalPages: 400,
    });

    await shelfRepository.addBookToShelf(shelf.id, book!.id);

    // Session 1: Read (first read, inactive)
    await sessionRepository.create({
      bookId: book!.id,
      userId: null,
      sessionNumber: 1,
      status: "read",
      isActive: false,
      startedDate: "2023-01-01",
      completedDate: "2023-01-15",
    });

    // Session 2: Read (second read, inactive) - most recent
    await sessionRepository.create({
      bookId: book!.id,
      userId: null,
      sessionNumber: 2,
      status: "read",
      isActive: false,
      startedDate: "2024-01-01",
      completedDate: "2024-01-15",
    });

    // ========================================================================
    // ACT: Call the shelf API
    // ========================================================================
    
    const request = createMockRequest("GET", `/api/shelves/${shelf.id}?withBooks=true`) as NextRequest;
    const params = Promise.resolve({ id: shelf.id.toString() });
    const response = await GET(request, { params });
    const result = await response.json();

    // ========================================================================
    // ASSERT: Should return read status from most recent session
    // ========================================================================
    
    expect(response.status).toBe(200);
    expect(result.success).toBe(true);
    expect(result.data.books).toHaveLength(1);
    
    const returnedBook = result.data.books[0];
    expect(returnedBook.id).toBe(book!.id);
    // Should still return "read" status from most recent session
    expect(returnedBook.status).toBe("read");
  });

  test('should handle empty shelf correctly', async () => {
    // ========================================================================
    // ARRANGE: Create an empty shelf
    // ========================================================================
    
    const shelf = await shelfRepository.create({
      name: "Empty Shelf",
      userId: null,
    });

    // ========================================================================
    // ACT: Call the shelf API
    // ========================================================================
    
    const request = createMockRequest("GET", `/api/shelves/${shelf.id}?withBooks=true`) as NextRequest;
    const params = Promise.resolve({ id: shelf.id.toString() });
    const response = await GET(request, { params });
    const result = await response.json();

    // ========================================================================
    // ASSERT: Should return empty books array
    // ========================================================================
    
    expect(response.status).toBe(200);
    expect(result.success).toBe(true);
    expect(result.data.books).toBeDefined();
    expect(result.data.books).toHaveLength(0);
  });

  test('should return 404 for non-existent shelf', async () => {
    // ========================================================================
    // ARRANGE: Use a shelf ID that doesn't exist
    // ========================================================================
    
    const nonExistentShelfId = 99999;

    // ========================================================================
    // ACT: Call the shelf API
    // ========================================================================
    
    const request = createMockRequest("GET", `/api/shelves/${nonExistentShelfId}?withBooks=true`) as NextRequest;
    const params = Promise.resolve({ id: nonExistentShelfId.toString() });
    const response = await GET(request, { params });
    const result = await response.json();

    // ========================================================================
    // ASSERT: Should return 404 error
    // ========================================================================
    
    expect(response.status).toBe(404);
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
    expect(result.error.code).toBe("NOT_FOUND");
  });

  test('should work without withBooks parameter', async () => {
    // ========================================================================
    // ARRANGE: Create a shelf with books
    // ========================================================================
    
    const shelf = await shelfRepository.create({
      name: "Test Shelf",
      userId: null,
    });

    const book = await bookRepository.create({
      calibreId: 1,
      title: "Test Book",
      authors: ["Author 1"],
      tags: [],
      path: "/path/1",
    });

    await shelfRepository.addBookToShelf(shelf.id, book!.id);

    // ========================================================================
    // ACT: Call the shelf API without withBooks parameter
    // ========================================================================
    
    const request = createMockRequest("GET", `/api/shelves/${shelf.id}`) as NextRequest;
    const params = Promise.resolve({ id: shelf.id.toString() });
    const response = await GET(request, { params });
    const result = await response.json();

    // ========================================================================
    // ASSERT: Should return shelf without books array
    // ========================================================================
    
    expect(response.status).toBe(200);
    expect(result.success).toBe(true);
    expect(result.data.id).toBe(shelf.id);
    expect(result.data.name).toBe("Test Shelf");
    expect(result.data.books).toBeUndefined(); // books not included
  });
});

describe('GET /api/shelves/:id - Sorting and Ordering', () => {
  test('should sort books by custom sortOrder', async () => {
    // ========================================================================
    // ARRANGE: Create shelf with multiple books in specific order
    // ========================================================================
    
    const shelf = await shelfRepository.create({
      name: "Sorted Shelf",
      userId: null,
    });

    const book1 = await bookRepository.create({
      calibreId: 1,
      title: "First Book",
      authors: ["Author A"],
      tags: [],
      path: "/path/1",
    });

    const book2 = await bookRepository.create({
      calibreId: 2,
      title: "Second Book",
      authors: ["Author B"],
      tags: [],
      path: "/path/2",
    });

    const book3 = await bookRepository.create({
      calibreId: 3,
      title: "Third Book",
      authors: ["Author C"],
      tags: [],
      path: "/path/3",
    });

    // Add books with specific sort order
    await shelfRepository.addBookToShelf(shelf.id, book2!.id); // sortOrder = 0
    await shelfRepository.addBookToShelf(shelf.id, book1!.id); // sortOrder = 1
    await shelfRepository.addBookToShelf(shelf.id, book3!.id); // sortOrder = 2

    // ========================================================================
    // ACT: Call the shelf API with default sorting (sortOrder asc)
    // ========================================================================
    
    const request = createMockRequest("GET", `/api/shelves/${shelf.id}?withBooks=true`) as NextRequest;
    const params = Promise.resolve({ id: shelf.id.toString() });
    const response = await GET(request, { params });
    const result = await response.json();

    // ========================================================================
    // ASSERT: Books should be in sortOrder
    // ========================================================================
    
    expect(response.status).toBe(200);
    expect(result.data.books).toHaveLength(3);
    expect(result.data.books[0].id).toBe(book2!.id); // sortOrder 0
    expect(result.data.books[1].id).toBe(book1!.id); // sortOrder 1
    expect(result.data.books[2].id).toBe(book3!.id); // sortOrder 2
  });
});
