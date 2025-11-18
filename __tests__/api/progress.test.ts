import { describe, test, expect, beforeAll, afterAll, beforeEach, mock } from "bun:test";
import { GET, POST } from "@/app/api/books/[id]/progress/route";
import Book from "@/models/Book";
import ProgressLog from "@/models/ProgressLog";
import ReadingStatus from "@/models/ReadingStatus";
import { setupTestDatabase, teardownTestDatabase, clearTestDatabase } from "@/__tests__/helpers/db-setup";
import { createMockRequest } from "@/__tests__/fixtures/test-data";
import type { NextRequest } from "next/server";

/**
 * Progress API Tests
 * Tests the /api/books/[id]/progress endpoints using real database
 *
 * Covers:
 * - GET: Fetching progress logs
 * - POST: Creating progress logs with page/percentage calculations
 * - Automatic status updates when book is completed
 * - Streak integration (real - runs with test database)
 */

// Mock revalidatePath (Next.js cache revalidation) - this is a Next.js internal
mock.module("next/cache", () => ({
  revalidatePath: () => {},
}));

// Note: We don't mock updateStreaks - let it run with the real test database
// This ensures better test isolation and doesn't leak mocks to other test files

describe("Progress API - GET /api/books/[id]/progress", () => {
  let testBook: any;

  beforeAll(async () => {
    await setupTestDatabase();
  });

  afterAll(async () => {
    await teardownTestDatabase();
  });

  beforeEach(async () => {
    await clearTestDatabase();

    // Create test book
    testBook = await Book.create({
      calibreId: 1,
      title: "Test Book",
      authors: ["Test Author"],
      totalPages: 500,
      path: "Test/Book",
      orphaned: false,
    });

    // Create some progress logs
    await ProgressLog.create({
      bookId: testBook._id,
      currentPage: 100,
      currentPercentage: 20,
      progressDate: new Date("2025-11-01"),
      pagesRead: 100,
    });

    await ProgressLog.create({
      bookId: testBook._id,
      currentPage: 250,
      currentPercentage: 50,
      progressDate: new Date("2025-11-05"),
      pagesRead: 150,
      notes: "Great chapter!",
    });

    await ProgressLog.create({
      bookId: testBook._id,
      currentPage: 400,
      currentPercentage: 80,
      progressDate: new Date("2025-11-10"),
      pagesRead: 150,
    });
  });

  test("fetches all progress logs for a book", async () => {
    const request = createMockRequest("GET", "/api/books/123/progress");
    const params = { id: testBook._id.toString() };

    const response = await GET(request as NextRequest, { params });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toHaveLength(3);
  });

  test("sorts progress logs by date descending (most recent first)", async () => {
    const request = createMockRequest("GET", "/api/books/123/progress");
    const params = { id: testBook._id.toString() };

    const response = await GET(request as NextRequest, { params });
    const data = await response.json();

    // Most recent should be first
    expect(new Date(data[0].progressDate).getTime()).toBeGreaterThan(
      new Date(data[1].progressDate).getTime()
    );
    expect(new Date(data[1].progressDate).getTime()).toBeGreaterThan(
      new Date(data[2].progressDate).getTime()
    );

    expect(data[0].currentPage).toBe(400);
    expect(data[1].currentPage).toBe(250);
    expect(data[2].currentPage).toBe(100);
  });

  test("returns empty array for book with no progress", async () => {
    const newBook = await Book.create({
      calibreId: 2,
      title: "New Book",
      authors: ["Author"],
      path: "New/Book",
      orphaned: false,
    });

    const request = createMockRequest("GET", "/api/books/123/progress");
    const params = { id: newBook._id.toString() };

    const response = await GET(request as NextRequest, { params });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toHaveLength(0);
  });

  test("handles database errors gracefully", async () => {
    const request = createMockRequest("GET", "/api/books/123/progress");
    const params = { id: "invalid-id" };

    const response = await GET(request as NextRequest, { params });
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe("Failed to fetch progress");
  });
});

describe("Progress API - POST /api/books/[id]/progress", () => {
  let testBook: any;

  beforeAll(async () => {
    await setupTestDatabase();
  });

  afterAll(async () => {
    await teardownTestDatabase();
  });

  beforeEach(async () => {
    await clearTestDatabase();

    // Create test book with total pages
    testBook = await Book.create({
      calibreId: 1,
      title: "Test Book",
      authors: ["Test Author"],
      totalPages: 500,
      path: "Test/Book",
      orphaned: false,
    });
  });

  test("creates progress log with page number and calculates percentage", async () => {
    const request = createMockRequest("POST", "/api/books/123/progress", {
      currentPage: 250,
      notes: "Halfway there!",
    });
    const params = { id: testBook._id.toString() };

    const response = await POST(request as NextRequest, { params });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.currentPage).toBe(250);
    expect(data.currentPercentage).toBe(50);
    expect(data.notes).toBe("Halfway there!");
    expect(data.pagesRead).toBe(250); // First entry, so all pages are "read"
  });

  test("creates progress log with percentage and calculates page number", async () => {
    const request = createMockRequest("POST", "/api/books/123/progress", {
      currentPercentage: 75,
    });
    const params = { id: testBook._id.toString() };

    const response = await POST(request as NextRequest, { params });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.currentPage).toBe(375); // 75% of 500
    expect(data.currentPercentage).toBe(75);
    expect(data.pagesRead).toBe(375);
  });

  test("calculates pagesRead based on last progress", async () => {
    // Create initial progress
    await ProgressLog.create({
      bookId: testBook._id,
      currentPage: 100,
      currentPercentage: 20,
      progressDate: new Date("2025-11-01"),
      pagesRead: 100,
    });

    const request = createMockRequest("POST", "/api/books/123/progress", {
      currentPage: 250,
    });
    const params = { id: testBook._id.toString() };

    const response = await POST(request as NextRequest, { params });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.currentPage).toBe(250);
    expect(data.pagesRead).toBe(150); // 250 - 100 = 150 pages read
  });

  test("handles negative pagesRead (when going backwards)", async () => {
    // Create progress at page 300
    await ProgressLog.create({
      bookId: testBook._id,
      currentPage: 300,
      currentPercentage: 60,
      progressDate: new Date("2025-11-01"),
      pagesRead: 300,
    });

    // Log progress at page 250 (going back)
    const request = createMockRequest("POST", "/api/books/123/progress", {
      currentPage: 250,
    });
    const params = { id: testBook._id.toString() };

    const response = await POST(request as NextRequest, { params });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.pagesRead).toBe(0); // Math.max(0, 250 - 300) = 0
  });

  test("marks book as completed when progress reaches 100%", async () => {
    // Create initial reading status
    await ReadingStatus.create({
      bookId: testBook._id,
      status: "reading",
      startedDate: new Date("2025-11-01"),
    });

    const request = createMockRequest("POST", "/api/books/123/progress", {
      currentPage: 500, // 100%
    });
    const params = { id: testBook._id.toString() };

    const response = await POST(request as NextRequest, { params });
    expect(response.status).toBe(200);

    // Check status was updated
    const status = await ReadingStatus.findOne({ bookId: testBook._id });
    expect(status!.status).toBe("read");
    expect(status!.completedDate).toBeDefined();
  });

  test("creates completed status if none exists when book reaches 100%", async () => {
    const request = createMockRequest("POST", "/api/books/123/progress", {
      currentPercentage: 100,
    });
    const params = { id: testBook._id.toString() };

    const response = await POST(request as NextRequest, { params });
    expect(response.status).toBe(200);

    // Check status was created
    const status = await ReadingStatus.findOne({ bookId: testBook._id });
    expect(status).toBeDefined();
    expect(status!.status).toBe("read");
    expect(status!.completedDate).toBeDefined();
    expect(status!.startedDate).toBeDefined();
  });

  test("doesn't mark as complete for progress below 100%", async () => {
    await ReadingStatus.create({
      bookId: testBook._id,
      status: "reading",
      startedDate: new Date("2025-11-01"),
    });

    const request = createMockRequest("POST", "/api/books/123/progress", {
      currentPercentage: 99,
    });
    const params = { id: testBook._id.toString() };

    await POST(request as NextRequest, { params });

    // Status should still be "reading"
    const status = await ReadingStatus.findOne({ bookId: testBook._id });
    expect(status!.status).toBe("reading");
    expect(status!.completedDate).toBeUndefined();
  });

  test("returns 404 for non-existent book", async () => {
    const request = createMockRequest("POST", "/api/books/123/progress", {
      currentPage: 100,
    });
    const params = { id: "507f1f77bcf86cd799439011" }; // Valid ObjectId but doesn't exist

    const response = await POST(request as NextRequest, { params });
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe("Book not found");
  });

  test("returns 400 when neither currentPage nor currentPercentage provided", async () => {
    const request = createMockRequest("POST", "/api/books/123/progress", {
      notes: "Just a note",
    });
    const params = { id: testBook._id.toString() };

    const response = await POST(request as NextRequest, { params });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe("Either currentPage or currentPercentage is required");
  });

  test("handles book without totalPages (page-only mode)", async () => {
    const bookNoPages = await Book.create({
      calibreId: 2,
      title: "No Pages Book",
      authors: ["Author"],
      path: "No/Pages",
      orphaned: false,
      // No totalPages
    });

    const request = createMockRequest("POST", "/api/books/123/progress", {
      currentPage: 100,
    });
    const params = { id: bookNoPages._id.toString() };

    const response = await POST(request as NextRequest, { params });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.currentPage).toBe(100);
    expect(data.currentPercentage).toBe(0); // Can't calculate without total pages
  });

  test("rejects percentage input for book without totalPages", async () => {
    const bookNoPages = await Book.create({
      calibreId: 2,
      title: "No Pages Book",
      authors: ["Author"],
      path: "No/Pages",
      orphaned: false,
    });

    const request = createMockRequest("POST", "/api/books/123/progress", {
      currentPercentage: 50,
    });
    const params = { id: bookNoPages._id.toString() };

    const response = await POST(request as NextRequest, { params });
    const data = await response.json();

    // Without totalPages, percentage-only progress is not supported
    expect(response.status).toBe(400);
    expect(data.error).toBe("Either currentPage or currentPercentage is required");
  });

  test("stores progress date correctly", async () => {
    const beforeTime = new Date();

    const request = createMockRequest("POST", "/api/books/123/progress", {
      currentPage: 100,
    });
    const params = { id: testBook._id.toString() };

    await POST(request as NextRequest, { params });

    const afterTime = new Date();

    const log = await ProgressLog.findOne({ bookId: testBook._id });
    expect(log!.progressDate).toBeDefined();
    expect(log!.progressDate.getTime()).toBeGreaterThanOrEqual(beforeTime.getTime());
    expect(log!.progressDate.getTime()).toBeLessThanOrEqual(afterTime.getTime());
  });

  test("preserves notes when provided", async () => {
    const request = createMockRequest("POST", "/api/books/123/progress", {
      currentPage: 200,
      notes: "This is a great book!",
    });
    const params = { id: testBook._id.toString() };

    const response = await POST(request as NextRequest, { params });
    const data = await response.json();

    expect(data.notes).toBe("This is a great book!");

    const log = await ProgressLog.findOne({ bookId: testBook._id });
    expect(log!.notes).toBe("This is a great book!");
  });

  test("handles database errors gracefully", async () => {
    const request = createMockRequest("POST", "/api/books/123/progress", {
      currentPage: 100,
    });
    const params = { id: "invalid-id" };

    const response = await POST(request as NextRequest, { params });
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe("Failed to log progress");
  });
});
