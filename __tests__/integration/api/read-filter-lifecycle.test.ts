import { describe, test, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { bookRepository, sessionRepository, progressRepository } from "@/lib/repositories";
import { GET as GET_BOOKS } from "@/app/api/books/route";
import { POST as UPDATE_STATUS } from "@/app/api/books/[id]/status/route";
import { POST as LOG_PROGRESS } from "@/app/api/books/[id]/progress/route";
import { POST as START_REREAD } from "@/app/api/books/[id]/reread/route";
import { createMockRequest, createTestBook } from "../../fixtures/test-data";
import { toSessionDate } from "../../test-utils";
import { setupTestDatabase, teardownTestDatabase, clearTestDatabase } from "@/__tests__/helpers/db-setup";

// Mock Next.js cache revalidation - required for integration tests
vi.mock("next/cache", () => ({
  revalidatePath: () => {},
}));

beforeAll(async () => {
  await setupTestDatabase(__filename);
});

afterAll(async () => {
  await teardownTestDatabase(__filename);
});

beforeEach(async () => {
  await clearTestDatabase(__filename);
});

describe("Integration: Read Filter Lifecycle", () => {
  test("complete lifecycle: to-read -> reading -> read (appears in read filter) -> re-read", async () => {
    // ========================================================================
    // STEP 1: Create a book
    // ========================================================================
    const book = await bookRepository.create(createTestBook({
      calibreId: 1,
      path: "test/path/1",
      title: "Test Book",
      authors: ["Test Author"],
      totalPages: 300,
    }));

    // ========================================================================
    // STEP 2: Mark as "to-read"
    // ========================================================================
    let request = createMockRequest("POST", `/api/books/${book.id}/status`, {
      status: "to-read",
    }) as any;
    let response = await UPDATE_STATUS(request, { params: { id: book.id.toString() } });
    expect(response.status).toBe(200);

    // Verify appears in "to-read" filter
    request = createMockRequest("GET", "/api/books?status=to-read") as any;
    response = await GET_BOOKS(request);
    let data = await response.json();
    expect(data.books).toHaveLength(1);
    expect(data.books[0].title).toBe("Test Book");
    expect(data.books[0].status).toBe("to-read");

    // Verify NOT in "read" filter
    request = createMockRequest("GET", "/api/books?status=read") as any;
    response = await GET_BOOKS(request);
    data = await response.json();
    expect(data.books).toHaveLength(0);

    // ========================================================================
    // STEP 3: Mark as "reading"
    // ========================================================================
    request = createMockRequest("POST", `/api/books/${book.id}/status`, {
      status: "reading",
    }) as any;
    response = await UPDATE_STATUS(request, { params: { id: book.id.toString() } });
    expect(response.status).toBe(200);

    // Verify appears in "reading" filter
    request = createMockRequest("GET", "/api/books?status=reading") as any;
    response = await GET_BOOKS(request);
    data = await response.json();
    expect(data.books).toHaveLength(1);
    expect(data.books[0].status).toBe("reading");

    // Verify session is active
    const activeSession = await sessionRepository.findActiveByBookId(book.id);
    expect(activeSession).not.toBeNull();
    expect(activeSession?.status).toBe("reading");

    // ========================================================================
    // STEP 4: Log progress
    // ========================================================================
    request = createMockRequest("POST", `/api/books/${book.id}/progress`, {
      currentPage: 150,
      currentPercentage: 50,
    }) as any;
    response = await LOG_PROGRESS(request, { params: { id: book.id.toString() } });
    expect(response.status).toBe(200);

    // ========================================================================
    // STEP 5: Mark as "read" (completes the book)
    // ========================================================================
    request = createMockRequest("POST", `/api/books/${book.id}/status`, {
      status: "read",
      rating: 5,
    }) as any;
    response = await UPDATE_STATUS(request, { params: { id: book.id.toString() } });
    const statusData = await response.json();
    expect(response.status).toBe(200);

    // Verify session is now ARCHIVED (isActive: false)
    const sessions = await sessionRepository.findAllByBookId(book.id);
    const archivedSession = sessions.find(s => s.status === "read");
    expect(archivedSession).not.toBeNull();
    expect(archivedSession?.isActive).toBe(false);
    expect(archivedSession?.completedDate).not.toBeNull();
    
    // Verify rating is on the book (not the session)
    const updatedBook = await bookRepository.findById(book.id);
    expect(updatedBook?.rating).toBe(5);

    // ========================================================================
    // STEP 6: CRITICAL TEST - Verify appears in "read" filter
    // ========================================================================
    request = createMockRequest("GET", "/api/books?status=read") as any;
    response = await GET_BOOKS(request);
    data = await response.json();

    expect(response.status).toBe(200);
    expect(data.books).toHaveLength(1);
    expect(data.books[0].title).toBe("Test Book");
    expect(data.books[0].status).toBe("read");
    expect(data.books[0].rating).toBe(5);

    // Verify NOT in "reading" filter
    request = createMockRequest("GET", "/api/books?status=reading") as any;
    response = await GET_BOOKS(request);
    data = await response.json();
    expect(data.books).toHaveLength(0);

    // ========================================================================
    // STEP 7: Start re-reading
    // ========================================================================
    request = createMockRequest("POST", `/api/books/${book.id}/reread`, {}) as any;
    response = await START_REREAD(request, { params: { id: book.id.toString() } });
    const rereadData = await response.json();
    expect(response.status).toBe(200);

    // Verify new active session created
    const newActiveSession = await sessionRepository.findActiveByBookId(book.id);
    expect(newActiveSession).not.toBeNull();
    expect(newActiveSession?.sessionNumber).toBe(2);
    expect(newActiveSession?.status).toBe("reading");

    // Verify old session still archived
    const oldSession = await sessionRepository.findByBookIdAndSessionNumber(book.id, 1);
    expect(oldSession?.isActive).toBe(false);
    expect(oldSession?.status).toBe("read");

    // ========================================================================
    // STEP 8: Verify archived "read" session STILL appears in "read" filter
    // ========================================================================
    request = createMockRequest("GET", "/api/books?status=read") as any;
    response = await GET_BOOKS(request);
    data = await response.json();

    expect(response.status).toBe(200);
    expect(data.books).toHaveLength(1);
    expect(data.books[0].title).toBe("Test Book");
    // Should show archived "read" session data
    expect(data.books[0].status).toBe("read");
    expect(data.books[0].rating).toBe(5);

    // ========================================================================
    // STEP 9: Verify book appears in "reading" filter for active session
    // ========================================================================
    request = createMockRequest("GET", "/api/books?status=reading") as any;
    response = await GET_BOOKS(request);
    data = await response.json();

    expect(response.status).toBe(200);
    expect(data.books).toHaveLength(1);
    expect(data.books[0].title).toBe("Test Book");
    expect(data.books[0].status).toBe("reading");
  });

  test("book with multiple archived 'read' sessions appears in read filter", async () => {
    // ========================================================================
    // STEP 1: Create a book
    // ========================================================================
    const book = await bookRepository.create(createTestBook({
      calibreId: 1,
      path: "test/path/1",
      title: "Re-read Book",
      authors: ["Test Author"],
      totalPages: 300,
    }));

    // ========================================================================
    // STEP 2: First read - mark as reading then read
    // ========================================================================
    let request = createMockRequest("POST", `/api/books/${book.id}/status`, {
      status: "reading",
    }) as any;
    await UPDATE_STATUS(request, { params: { id: book.id.toString() } });

    request = createMockRequest("POST", `/api/books/${book.id}/status`, {
      status: "read",
      rating: 4,
    }) as any;
    await UPDATE_STATUS(request, { params: { id: book.id.toString() } });

    // Verify appears in read filter
    request = createMockRequest("GET", "/api/books?status=read") as any;
    let response = await GET_BOOKS(request);
    let data = await response.json();
    expect(data.books).toHaveLength(1);
    expect(data.books[0].rating).toBe(4);

    // ========================================================================
    // STEP 3: Start re-reading
    // ========================================================================
    request = createMockRequest("POST", `/api/books/${book.id}/reread`, {}) as any;
    await START_REREAD(request, { params: { id: book.id.toString() } });

    // ========================================================================
    // STEP 4: Complete second read
    // ========================================================================
    request = createMockRequest("POST", `/api/books/${book.id}/status`, {
      status: "read",
      rating: 5,
    }) as any;
    await UPDATE_STATUS(request, { params: { id: book.id.toString() } });

    // ========================================================================
    // STEP 5: Verify both archived sessions exist
    // ========================================================================
    const allSessions = await sessionRepository.findAllByBookId(book.id);
    const archivedSessions = allSessions.filter(
      s => s.isActive === false && s.status === "read"
    );
    expect(archivedSessions).toHaveLength(2);

    // ========================================================================
    // STEP 6: CRITICAL TEST - Verify still appears in "read" filter
    // And shows most recent read data
    // ========================================================================
    request = createMockRequest("GET", "/api/books?status=read") as any;
    response = await GET_BOOKS(request);
    data = await response.json();

    expect(response.status).toBe(200);
    expect(data.books).toHaveLength(1);
    expect(data.books[0].title).toBe("Re-read Book");
    expect(data.books[0].status).toBe("read");
    // Should show most recent read rating
    expect(data.books[0].rating).toBe(5);
  });

  test("books with different statuses appear in correct filters simultaneously", async () => {
    // ========================================================================
    // Create books with different statuses
    // ========================================================================
    const toReadBook = await bookRepository.create(createTestBook({
      calibreId: 1,
      path: "test/path/1",
      title: "To Read Book",
      authors: ["Author 1"],
      totalPages: 300,
    }));

    const readingBook = await bookRepository.create(createTestBook({
      calibreId: 2,
      path: "test/path/2",
      title: "Reading Book",
      authors: ["Author 2"],
      totalPages: 400,
    }));

    const readBook = await bookRepository.create(createTestBook({
      calibreId: 3,
      path: "test/path/3",
      title: "Read Book",
      authors: ["Author 3"],
      totalPages: 350,
    }));

    // Set statuses
    let request = createMockRequest("POST", `/api/books/${toReadBook.id}/status`, {
      status: "to-read",
    }) as any;
    await UPDATE_STATUS(request, { params: { id: toReadBook.id.toString() } });

    request = createMockRequest("POST", `/api/books/${readingBook.id}/status`, {
      status: "reading",
    }) as any;
    await UPDATE_STATUS(request, { params: { id: readingBook.id.toString() } });

    request = createMockRequest("POST", `/api/books/${readBook.id}/status`, {
      status: "reading",
    }) as any;
    await UPDATE_STATUS(request, { params: { id: readBook.id.toString() } });

    request = createMockRequest("POST", `/api/books/${readBook.id}/status`, {
      status: "read",
      rating: 5,
    }) as any;
    await UPDATE_STATUS(request, { params: { id: readBook.id.toString() } });

    // ========================================================================
    // Verify each filter returns correct books
    // ========================================================================

    // To-read filter
    request = createMockRequest("GET", "/api/books?status=to-read") as any;
    let response = await GET_BOOKS(request);
    let data = await response.json();
    expect(data.books).toHaveLength(1);
    expect(data.books[0].title).toBe("To Read Book");

    // Reading filter
    request = createMockRequest("GET", "/api/books?status=reading") as any;
    response = await GET_BOOKS(request);
    data = await response.json();
    expect(data.books).toHaveLength(1);
    expect(data.books[0].title).toBe("Reading Book");

    // Read filter (archived sessions)
    request = createMockRequest("GET", "/api/books?status=read") as any;
    response = await GET_BOOKS(request);
    data = await response.json();
    expect(data.books).toHaveLength(1);
    expect(data.books[0].title).toBe("Read Book");
    expect(data.books[0].rating).toBe(5);

    // All books filter (no status filter)
    request = createMockRequest("GET", "/api/books") as any;
    response = await GET_BOOKS(request);
    data = await response.json();
    expect(data.books).toHaveLength(3);
  });

  test("archived session without active session appears correctly", async () => {
    // ========================================================================
    // Simulate a book that was marked as read but has no active session
    // (This can happen after migration or manual data manipulation)
    // ========================================================================
    const book = await bookRepository.create(createTestBook({
      calibreId: 1,
      path: "test/path/1",
      title: "Only Archived Session",
      authors: ["Test Author"],
      totalPages: 300,
    }));

    // Create archived session directly
    await sessionRepository.create({
      bookId: book.id,
      sessionNumber: 1,
      status: "read",
      startedDate: toSessionDate(new Date("2024-01-01")),
      completedDate: toSessionDate(new Date("2024-01-15")),
      isActive: false,
      rating: 4,
    });

    // Update book rating (ratings now live on books table)
    await bookRepository.update(book.id, { rating: 4 });

    // ========================================================================
    // CRITICAL TEST - Book should appear in "read" filter
    // ========================================================================
    const request = createMockRequest("GET", "/api/books?status=read") as any;
    const response = await GET_BOOKS(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.books).toHaveLength(1);
    expect(data.books[0].title).toBe("Only Archived Session");
    expect(data.books[0].status).toBe("read");
    expect(data.books[0].rating).toBe(4);

    // Verify NOT in other filters
    const readingRequest = createMockRequest("GET", "/api/books?status=reading") as any;
    const readingResponse = await GET_BOOKS(readingRequest);
    const readingData = await readingResponse.json();
    expect(readingData.books).toHaveLength(0);
  });
});
