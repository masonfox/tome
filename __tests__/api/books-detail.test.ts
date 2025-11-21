import { test, expect, describe, beforeAll, afterAll, beforeEach, mock } from "bun:test";
import { GET, PATCH } from "@/app/api/books/[id]/route";
import { bookRepository, sessionRepository, progressRepository } from "@/lib/repositories";
import { setupTestDatabase, teardownTestDatabase, clearTestDatabase } from "@/__tests__/helpers/db-setup";

mock.module("next/cache", () => ({ revalidatePath: () => {} }));

beforeAll(async () => {
  await setupTestDatabase();
});

afterAll(async () => {
  await teardownTestDatabase();
});

beforeEach(async () => {
  await clearTestDatabase();
});

describe("GET /api/books/[id]", () => {
  test("should return book with totalReads count for single session", async () => {
    // Create a book
    const book = await bookRepository.create({
      calibreId: 1,
      title: "Test Book",
      authors: ["Author One"],
      totalPages: 300,
      tags: [],
      path: "Author One/Test Book (1)",
    });

    // Create one completed reading session
    await sessionRepository.create({
      bookId: book.id,
      sessionNumber: 1,
      status: "read",
      isActive: false,
      completedDate: new Date("2024-11-01"),
    });

    const request = new Request("http://localhost:3000/api/books/1");
    const response = await GET(request, { params: { id: book.id.toString() } });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.totalReads).toBe(1);
    expect(data.hasCompletedReads).toBe(true);
    expect(data.title).toBe("Test Book");
  });

  test("should return book with totalReads count for multiple sessions", async () => {
    // Create a book
    const book = await bookRepository.create({
      calibreId: 2,
      title: "Re-read Book",
      authors: ["Author Two"],
      totalPages: 400,
      tags: [],
      path: "Author Two/Re-read Book (2)",
    });

    // Create multiple reading sessions (simulating re-reads)
    await sessionRepository.create({
      bookId: book.id,
      sessionNumber: 1,
      status: "read",
      isActive: false,
      completedDate: new Date("2024-01-15"),
    });

    await sessionRepository.create({
      bookId: book.id,
      sessionNumber: 2,
      status: "read",
      isActive: false,
      completedDate: new Date("2024-06-20"),
    });

    await sessionRepository.create({
      bookId: book.id,
      sessionNumber: 3,
      status: "reading",
      isActive: true,
      startedDate: new Date("2024-11-01"),
    });

    const request = new Request("http://localhost:3000/api/books/2");
    const response = await GET(request, { params: { id: book.id.toString() } });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.totalReads).toBe(2); // Only completed reads count
    expect(data.hasCompletedReads).toBe(true);
    expect(data.activeSession).toBeTruthy(); // Has active session
    expect(data.title).toBe("Re-read Book");
  });

  test("should return totalReads as 0 for book with no sessions", async () => {
    // Create a book without any sessions
    const book = await bookRepository.create({
      calibreId: 3,
      title: "New Book",
      authors: ["Author Three"],
      totalPages: 250,
      tags: [],
      path: "Author Three/New Book (3)",
    });

    const request = new Request("http://localhost:3000/api/books/3");
    const response = await GET(request, { params: { id: book.id.toString() } });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.totalReads).toBe(0);
    expect(data.title).toBe("New Book");
  });

  test("should return active session status with totalReads", async () => {
    // Create a book
    const book = await bookRepository.create({
      calibreId: 4,
      title: "Active Reading Book",
      authors: ["Author Four"],
      totalPages: 500,
      tags: [],
      path: "Author Four/Active Reading Book (4)",
    });

    // Create an active session
    const activeSession = await sessionRepository.create({
      bookId: book.id,
      sessionNumber: 1,
      status: "reading",
      isActive: true,
      startedDate: new Date("2024-11-01"),
    });

    const request = new Request("http://localhost:3000/api/books/4");
    const response = await GET(request, { params: { id: book.id.toString() } });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.totalReads).toBe(0); // Active reading session is not completed yet
    expect(data.hasCompletedReads).toBe(false);
    expect(data.activeSession).toBeTruthy();
    expect(data.activeSession.status).toBe("reading");
    expect(data.activeSession.sessionNumber).toBe(1);
    expect(data.activeSession.isActive).toBe(true);
  });

  test("should return latest progress for active session with totalReads", async () => {
    // Create a book
    const book = await bookRepository.create({
      calibreId: 5,
      title: "Progress Book",
      authors: ["Author Five"],
      totalPages: 350,
      tags: [],
      path: "Author Five/Progress Book (5)",
    });

    // Create an active session
    const activeSession = await sessionRepository.create({
      bookId: book.id,
      sessionNumber: 1,
      status: "reading",
      isActive: true,
    });

    // Create progress logs
    await progressRepository.create({
      bookId: book.id,
      sessionId: activeSession.id,
      currentPage: 50,
      currentPercentage: 14.29,
      progressDate: new Date("2024-11-01"),
      pagesRead: 50,
    });

    await progressRepository.create({
      bookId: book.id,
      sessionId: activeSession.id,
      currentPage: 150,
      currentPercentage: 42.86,
      progressDate: new Date("2024-11-10"),
      pagesRead: 100,
    });

    const request = new Request("http://localhost:3000/api/books/5");
    const response = await GET(request, { params: { id: book.id.toString() } });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.totalReads).toBe(0); // Active reading session is not completed
    expect(data.hasCompletedReads).toBe(false);
    expect(data.latestProgress).toBeTruthy();
    expect(data.latestProgress.currentPage).toBe(150);
    expect(data.latestProgress.currentPercentage).toBe(42.86);
  });

  test("should count only sessions for specific book", async () => {
    // Create two books
    const book1 = await bookRepository.create({
      calibreId: 6,
      title: "Book One",
      authors: ["Author Six"],
      totalPages: 300,
      tags: [],
      path: "Author Six/Book One (6)",
    });

    const book2 = await bookRepository.create({
      calibreId: 7,
      title: "Book Two",
      authors: ["Author Seven"],
      totalPages: 400,
      tags: [],
      path: "Author Seven/Book Two (7)",
    });

    // Create sessions for book1
    await sessionRepository.create({
      bookId: book1.id,
      sessionNumber: 1,
      status: "read",
      isActive: false,
    });

    await sessionRepository.create({
      bookId: book1.id,
      sessionNumber: 2,
      status: "reading",
      isActive: true,
    });

    // Create session for book2
    await sessionRepository.create({
      bookId: book2.id,
      sessionNumber: 1,
      status: "reading",
      isActive: true,
    });

    // Check book1
    const request1 = new Request("http://localhost:3000/api/books/6");
    const response1 = await GET(request1, { params: { id: book1.id.toString() } });
    const data1 = await response1.json();

    expect(response1.status).toBe(200);
    expect(data1.totalReads).toBe(1); // Only one completed read (session 2 is reading)
    expect(data1.hasCompletedReads).toBe(true);
    expect(data1.activeSession).toBeTruthy();

    // Check book2
    const request2 = new Request("http://localhost:3000/api/books/7");
    const response2 = await GET(request2, { params: { id: book2.id.toString() } });
    const data2 = await response2.json();

    expect(response2.status).toBe(200);
    expect(data2.totalReads).toBe(0); // No completed reads yet (session is reading)
    expect(data2.hasCompletedReads).toBe(false);
    expect(data2.activeSession).toBeTruthy();
  });

  test("should return 404 for non-existent book", async () => {
    const fakeId = 999999;
    const request = new Request("http://localhost:3000/api/books/999");
    const response = await GET(request, { params: { id: fakeId.toString() } });
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe("Book not found");
  });

  test("should include totalReads even when no active session exists", async () => {
    // Create a book
    const book = await bookRepository.create({
      calibreId: 8,
      title: "Completed Book",
      authors: ["Author Eight"],
      totalPages: 320,
      tags: [],
      path: "Author Eight/Completed Book (8)",
    });

    // Create only completed (inactive) sessions
    await sessionRepository.create({
      bookId: book.id,
      sessionNumber: 1,
      status: "read",
      isActive: false,
      completedDate: new Date("2024-05-15"),
    });

    await sessionRepository.create({
      bookId: book.id,
      sessionNumber: 2,
      status: "read",
      isActive: false,
      completedDate: new Date("2024-10-20"),
    });

    const request = new Request("http://localhost:3000/api/books/8");
    const response = await GET(request, { params: { id: book.id.toString() } });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.totalReads).toBe(2);
    expect(data.hasCompletedReads).toBe(true);
    expect(data.activeSession).toBeNull(); // No active session (explicitly null, not undefined)
    expect(data.latestProgress).toBeNull(); // No progress for inactive session
  });
});

describe("PATCH /api/books/[id]", () => {
  test("should update book totalPages", async () => {
    const book = await bookRepository.create({
      calibreId: 9,
      title: "Update Test Book",
      authors: ["Author Nine"],
      totalPages: 300,
      tags: [],
      path: "Author Nine/Update Test Book (9)",
    });

    const request = new Request("http://localhost:3000/api/books/9", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ totalPages: 350 }),
    });

    const response = await PATCH(request, { params: { id: book.id.toString() } });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.totalPages).toBe(350);

    // Verify in database
    const updatedBook = await bookRepository.findById(book.id);
    expect(updatedBook?.totalPages).toBe(350);
  });

  test("should return 404 for non-existent book", async () => {
    const fakeId = 999999;
    const request = new Request("http://localhost:3000/api/books/999", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ totalPages: 400 }),
    });

    const response = await PATCH(request, { params: { id: fakeId.toString() } });
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe("Book not found");
  });
});
