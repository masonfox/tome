import { describe, test, expect, beforeAll, afterAll, beforeEach, mock } from "bun:test";
import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
import Book from "@/models/Book";
import ReadingSession from "@/models/ReadingSession";
import ProgressLog from "@/models/ProgressLog";
import { GET as GET_BOOKS } from "@/app/api/books/route";
import { POST as UPDATE_STATUS } from "@/app/api/books/[id]/status/route";
import { POST as LOG_PROGRESS } from "@/app/api/books/[id]/progress/route";
import { POST as START_REREAD } from "@/app/api/books/[id]/reread/route";
import { createMockRequest } from "../../fixtures/test-data";

// Mock Next.js cache revalidation - required for integration tests
mock.module("next/cache", () => ({
  revalidatePath: () => {},
}));

let mongoServer: MongoMemoryServer;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const mongoUri = mongoServer.getUri();
  await mongoose.connect(mongoUri);
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

beforeEach(async () => {
  await Book.deleteMany({});
  await ReadingSession.deleteMany({});
  await ProgressLog.deleteMany({});
});

describe("Integration: Read Filter Lifecycle", () => {
  test("complete lifecycle: to-read -> reading -> read (appears in read filter) -> re-read", async () => {
    // ========================================================================
    // STEP 1: Create a book
    // ========================================================================
    const book = await Book.create({
      calibreId: 1,
      path: "test/path/1",
      title: "Test Book",
      authors: ["Test Author"],
      totalPages: 300,
    });

    // ========================================================================
    // STEP 2: Mark as "to-read"
    // ========================================================================
    let request = createMockRequest("POST", `/api/books/${book._id}/status`, {
      status: "to-read",
    });
    let response = await UPDATE_STATUS(request, { params: { id: book._id.toString() } });
    expect(response.status).toBe(200);

    // Verify appears in "to-read" filter
    request = createMockRequest("GET", "/api/books?status=to-read");
    response = await GET_BOOKS(request);
    let data = await response.json();
    expect(data.books).toHaveLength(1);
    expect(data.books[0].title).toBe("Test Book");
    expect(data.books[0].status).toBe("to-read");

    // Verify NOT in "read" filter
    request = createMockRequest("GET", "/api/books?status=read");
    response = await GET_BOOKS(request);
    data = await response.json();
    expect(data.books).toHaveLength(0);

    // ========================================================================
    // STEP 3: Mark as "reading"
    // ========================================================================
    request = createMockRequest("POST", `/api/books/${book._id}/status`, {
      status: "reading",
    });
    response = await UPDATE_STATUS(request, { params: { id: book._id.toString() } });
    expect(response.status).toBe(200);

    // Verify appears in "reading" filter
    request = createMockRequest("GET", "/api/books?status=reading");
    response = await GET_BOOKS(request);
    data = await response.json();
    expect(data.books).toHaveLength(1);
    expect(data.books[0].status).toBe("reading");

    // Verify session is active
    const activeSession = await ReadingSession.findOne({
      bookId: book._id,
      isActive: true,
    });
    expect(activeSession).not.toBeNull();
    expect(activeSession?.status).toBe("reading");

    // ========================================================================
    // STEP 4: Log progress
    // ========================================================================
    request = createMockRequest("POST", `/api/books/${book._id}/progress`, {
      currentPage: 150,
      currentPercentage: 50,
    });
    response = await LOG_PROGRESS(request, { params: { id: book._id.toString() } });
    expect(response.status).toBe(200);

    // ========================================================================
    // STEP 5: Mark as "read" (completes the book)
    // ========================================================================
    request = createMockRequest("POST", `/api/books/${book._id}/status`, {
      status: "read",
      rating: 5,
    });
    response = await UPDATE_STATUS(request, { params: { id: book._id.toString() } });
    const statusData = await response.json();
    expect(response.status).toBe(200);

    // Verify session is now ARCHIVED (isActive: false)
    const archivedSession = await ReadingSession.findOne({
      bookId: book._id,
      status: "read",
    });
    expect(archivedSession).not.toBeNull();
    expect(archivedSession?.isActive).toBe(false);
    expect(archivedSession?.rating).toBe(5);
    expect(archivedSession?.completedDate).not.toBeNull();

    // ========================================================================
    // STEP 6: CRITICAL TEST - Verify appears in "read" filter
    // ========================================================================
    request = createMockRequest("GET", "/api/books?status=read");
    response = await GET_BOOKS(request);
    data = await response.json();

    expect(response.status).toBe(200);
    expect(data.books).toHaveLength(1);
    expect(data.books[0].title).toBe("Test Book");
    expect(data.books[0].status).toBe("read");
    expect(data.books[0].rating).toBe(5);

    // Verify NOT in "reading" filter
    request = createMockRequest("GET", "/api/books?status=reading");
    response = await GET_BOOKS(request);
    data = await response.json();
    expect(data.books).toHaveLength(0);

    // ========================================================================
    // STEP 7: Start re-reading
    // ========================================================================
    request = createMockRequest("POST", `/api/books/${book._id}/reread`, {});
    response = await START_REREAD(request, { params: { id: book._id.toString() } });
    const rereadData = await response.json();
    expect(response.status).toBe(200);

    // Verify new active session created
    const newActiveSession = await ReadingSession.findOne({
      bookId: book._id,
      isActive: true,
    });
    expect(newActiveSession).not.toBeNull();
    expect(newActiveSession?.sessionNumber).toBe(2);
    expect(newActiveSession?.status).toBe("reading");

    // Verify old session still archived
    const oldSession = await ReadingSession.findOne({
      bookId: book._id,
      sessionNumber: 1,
    });
    expect(oldSession?.isActive).toBe(false);
    expect(oldSession?.status).toBe("read");

    // ========================================================================
    // STEP 8: Verify archived "read" session STILL appears in "read" filter
    // ========================================================================
    request = createMockRequest("GET", "/api/books?status=read");
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
    request = createMockRequest("GET", "/api/books?status=reading");
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
    const book = await Book.create({
      calibreId: 1,
      path: "test/path/1",
      title: "Re-read Book",
      authors: ["Test Author"],
      totalPages: 300,
    });

    // ========================================================================
    // STEP 2: First read - mark as reading then read
    // ========================================================================
    let request = createMockRequest("POST", `/api/books/${book._id}/status`, {
      status: "reading",
    });
    await UPDATE_STATUS(request, { params: { id: book._id.toString() } });

    request = createMockRequest("POST", `/api/books/${book._id}/status`, {
      status: "read",
      rating: 4,
    });
    await UPDATE_STATUS(request, { params: { id: book._id.toString() } });

    // Verify appears in read filter
    request = createMockRequest("GET", "/api/books?status=read");
    let response = await GET_BOOKS(request);
    let data = await response.json();
    expect(data.books).toHaveLength(1);
    expect(data.books[0].rating).toBe(4);

    // ========================================================================
    // STEP 3: Start re-reading
    // ========================================================================
    request = createMockRequest("POST", `/api/books/${book._id}/reread`, {});
    await START_REREAD(request, { params: { id: book._id.toString() } });

    // ========================================================================
    // STEP 4: Complete second read
    // ========================================================================
    request = createMockRequest("POST", `/api/books/${book._id}/status`, {
      status: "read",
      rating: 5,
    });
    await UPDATE_STATUS(request, { params: { id: book._id.toString() } });

    // ========================================================================
    // STEP 5: Verify both archived sessions exist
    // ========================================================================
    const archivedSessions = await ReadingSession.find({
      bookId: book._id,
      isActive: false,
      status: "read",
    });
    expect(archivedSessions).toHaveLength(2);

    // ========================================================================
    // STEP 6: CRITICAL TEST - Verify still appears in "read" filter
    // And shows most recent read data
    // ========================================================================
    request = createMockRequest("GET", "/api/books?status=read");
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
    const toReadBook = await Book.create({
      calibreId: 1,
      path: "test/path/1",
      title: "To Read Book",
      authors: ["Author 1"],
      totalPages: 300,
    });

    const readingBook = await Book.create({
      calibreId: 2,
      path: "test/path/2",
      title: "Reading Book",
      authors: ["Author 2"],
      totalPages: 400,
    });

    const readBook = await Book.create({
      calibreId: 3,
      path: "test/path/3",
      title: "Read Book",
      authors: ["Author 3"],
      totalPages: 350,
    });

    // Set statuses
    let request = createMockRequest("POST", `/api/books/${toReadBook._id}/status`, {
      status: "to-read",
    });
    await UPDATE_STATUS(request, { params: { id: toReadBook._id.toString() } });

    request = createMockRequest("POST", `/api/books/${readingBook._id}/status`, {
      status: "reading",
    });
    await UPDATE_STATUS(request, { params: { id: readingBook._id.toString() } });

    request = createMockRequest("POST", `/api/books/${readBook._id}/status`, {
      status: "reading",
    });
    await UPDATE_STATUS(request, { params: { id: readBook._id.toString() } });

    request = createMockRequest("POST", `/api/books/${readBook._id}/status`, {
      status: "read",
      rating: 5,
    });
    await UPDATE_STATUS(request, { params: { id: readBook._id.toString() } });

    // ========================================================================
    // Verify each filter returns correct books
    // ========================================================================
    
    // To-read filter
    request = createMockRequest("GET", "/api/books?status=to-read");
    let response = await GET_BOOKS(request);
    let data = await response.json();
    expect(data.books).toHaveLength(1);
    expect(data.books[0].title).toBe("To Read Book");

    // Reading filter
    request = createMockRequest("GET", "/api/books?status=reading");
    response = await GET_BOOKS(request);
    data = await response.json();
    expect(data.books).toHaveLength(1);
    expect(data.books[0].title).toBe("Reading Book");

    // Read filter (archived sessions)
    request = createMockRequest("GET", "/api/books?status=read");
    response = await GET_BOOKS(request);
    data = await response.json();
    expect(data.books).toHaveLength(1);
    expect(data.books[0].title).toBe("Read Book");
    expect(data.books[0].rating).toBe(5);

    // All books filter (no status filter)
    request = createMockRequest("GET", "/api/books");
    response = await GET_BOOKS(request);
    data = await response.json();
    expect(data.books).toHaveLength(3);
  });

  test("archived session without active session appears correctly", async () => {
    // ========================================================================
    // Simulate a book that was marked as read but has no active session
    // (This can happen after migration or manual data manipulation)
    // ========================================================================
    const book = await Book.create({
      calibreId: 1,
      path: "test/path/1",
      title: "Only Archived Session",
      authors: ["Test Author"],
      totalPages: 300,
    });

    // Create archived session directly
    await ReadingSession.create({
      bookId: book._id,
      sessionNumber: 1,
      status: "read",
      startedDate: new Date("2024-01-01"),
      completedDate: new Date("2024-01-15"),
      isActive: false,
      rating: 4,
    });

    // ========================================================================
    // CRITICAL TEST - Book should appear in "read" filter
    // ========================================================================
    const request = createMockRequest("GET", "/api/books?status=read");
    const response = await GET_BOOKS(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.books).toHaveLength(1);
    expect(data.books[0].title).toBe("Only Archived Session");
    expect(data.books[0].status).toBe("read");
    expect(data.books[0].rating).toBe(4);

    // Verify NOT in other filters
    const readingRequest = createMockRequest("GET", "/api/books?status=reading");
    const readingResponse = await GET_BOOKS(readingRequest);
    const readingData = await readingResponse.json();
    expect(readingData.books).toHaveLength(0);
  });
});
