import { describe, test, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { GET, POST } from "@/app/api/books/[id]/progress/route";
import { bookRepository, progressRepository, sessionRepository } from "@/lib/repositories";
import { setupTestDatabase, teardownTestDatabase, clearTestDatabase, getTestSqlite } from "@/__tests__/helpers/db-setup";
import { createMockRequest } from "@/__tests__/fixtures/test-data";
import type { NextRequest } from "next/server";
import { formatInTimeZone } from "date-fns-tz";

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

/**
 * Helper function to get date in EST timezone (for test assertions)
 * Extracts just the date part (YYYY-MM-DD) from a UTC timestamp stored in the database.
 */
function getDateInEST(date: Date): string {
  return formatInTimeZone(date, "America/New_York", "yyyy-MM-dd");
}

/**
 * Mock Rationale: Prevent Next.js cache revalidation side effects during tests.
 * The progress API calls revalidatePath to update cached pages, but we don't need
 * to test Next.js's caching behavior - just our business logic.
 */
vi.mock("next/cache", () => ({
  revalidatePath: () => {},
}));

// Note: We don't mock updateStreaks - let it run with the real test database
// This ensures better test isolation and doesn't leak mocks to other test files

describe("Progress API - GET /api/books/[id]/progress", () => {
  let testBook: any;

  beforeAll(async () => {
    await setupTestDatabase(__filename);
  });

  afterAll(async () => {
    await teardownTestDatabase(__filename);
  });

  beforeEach(async () => {
    await clearTestDatabase(__filename);

    // Create test book
    testBook = await bookRepository.create({
      calibreId: 1,
      title: "Test Book",
      authors: ["Test Author"],
      tags: [],
      totalPages: 500,
      path: "Test/Book",
      orphaned: false,
    });

    // Create a session for the progress logs
    const session = await sessionRepository.create({
      bookId: testBook.id,
      sessionNumber: 1,
      status: "reading",
      isActive: true,
    });

    // Create some progress logs
    await progressRepository.create({
      bookId: testBook.id,
      sessionId: session.id,
      currentPage: 100,
      currentPercentage: 20,
      progressDate: new Date("2025-11-01"),
      pagesRead: 100,
    });

    await progressRepository.create({
      bookId: testBook.id,
      sessionId: session.id,
      currentPage: 250,
      currentPercentage: 50,
      progressDate: new Date("2025-11-05"),
      pagesRead: 150,
      notes: "Great chapter!",
    });

    await progressRepository.create({
      bookId: testBook.id,
      sessionId: session.id,
      currentPage: 400,
      currentPercentage: 80,
      progressDate: new Date("2025-11-10"),
      pagesRead: 150,
    });
  });

  test("fetches all progress logs for a book", async () => {
    // Arrange: Test book with 3 progress logs created in beforeEach
    const request = createMockRequest("GET", "/api/books/123/progress");
    const params = { id: testBook.id.toString() };

    // Act: Fetch all progress logs
    const response = await GET(request as NextRequest, { params });
    const data = await response.json();

    // Assert: All 3 logs returned
    expect(response.status).toBe(200);
    expect(data).toHaveLength(3);
  });

  test("sorts progress logs by date descending (most recent first)", async () => {
    // Arrange: Test book with 3 progress logs on different dates
    const request = createMockRequest("GET", "/api/books/123/progress");
    const params = { id: testBook.id.toString() };

    // Act: Fetch all progress logs
    const response = await GET(request as NextRequest, { params });
    const data = await response.json();

    // Assert: Logs returned in descending date order (most recent first)
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
    // Arrange: Create book without any progress logs
    const newBook = await bookRepository.create({
      calibreId: 2,
      title: "New Book",
      authors: ["Author"],
      tags: [],
      path: "New/Book",
      orphaned: false,
    });

    // Act: Fetch progress for book with no logs
    const request = createMockRequest("GET", "/api/books/123/progress");
    const params = { id: newBook.id.toString() };

    const response = await GET(request as NextRequest, { params });
    const data = await response.json();

    // Assert: Empty array returned
    expect(response.status).toBe(200);
    expect(data).toHaveLength(0);
  });

  test("handles database errors gracefully", async () => {
    const request = createMockRequest("GET", "/api/books/123/progress");
    const params = { id: "invalid-id" };

    const response = await GET(request as NextRequest, { params });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe("Invalid book ID format");
  });
});

describe("Progress API - POST /api/books/[id]/progress", () => {
  let testBook: any;

  beforeAll(async () => {
    await setupTestDatabase(__filename);
  });

  afterAll(async () => {
    await teardownTestDatabase(__filename);
  });

  beforeEach(async () => {
    await clearTestDatabase(__filename);

    // Create test book with total pages
    testBook = await bookRepository.create({
      calibreId: 1,
      title: "Test Book",
      authors: ["Test Author"],
      tags: [],
      totalPages: 500,
      path: "Test/Book",
      orphaned: false,
    });

    // Create active reading session (required for logging progress)
    await sessionRepository.create({
      bookId: testBook.id,
      sessionNumber: 1,
      status: "reading",
      isActive: true,
      startedDate: new Date("2025-11-01"),
    });
  });

  test("creates progress log with page number and calculates percentage", async () => {
    const request = createMockRequest("POST", "/api/books/123/progress", {
      currentPage: 250,
      notes: "Halfway there!",
    });
    const params = { id: testBook.id.toString() };

    const response = await POST(request as NextRequest, { params });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.progressLog.currentPage).toBe(250);
    expect(data.progressLog.currentPercentage).toBe(50);
    expect(data.progressLog.notes).toBe("Halfway there!");
    expect(data.progressLog.pagesRead).toBe(250); // First entry, so all pages are "read"
    expect(data.shouldShowCompletionModal).toBe(false);
  });

  test("creates progress log with percentage and calculates page number", async () => {
    const request = createMockRequest("POST", "/api/books/123/progress", {
      currentPercentage: 75,
    });
    const params = { id: testBook.id.toString() };

    const response = await POST(request as NextRequest, { params });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.progressLog.currentPage).toBe(375); // 75% of 500
    expect(data.progressLog.currentPercentage).toBe(75);
    expect(data.progressLog.pagesRead).toBe(375);
    expect(data.shouldShowCompletionModal).toBe(false);
  });

  test("calculates pagesRead based on last progress", async () => {
    // Get the active session
    const session = await sessionRepository.findActiveByBookId(testBook.id);

    // Create initial progress
    await progressRepository.create({
      bookId: testBook.id,
      sessionId: session!.id,
      currentPage: 100,
      currentPercentage: 20,
      progressDate: new Date("2025-11-01"),
      pagesRead: 100,
    });

    const request = createMockRequest("POST", "/api/books/123/progress", {
      currentPage: 250,
    });
    const params = { id: testBook.id.toString() };

    const response = await POST(request as NextRequest, { params });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.progressLog.currentPage).toBe(250);
    expect(data.progressLog.pagesRead).toBe(150); // 250 - 100 = 150 pages read
    expect(data.shouldShowCompletionModal).toBe(false);
  });

  test("rejects backward progress without backdating", async () => {
    // Get the active session
    const session = await sessionRepository.findActiveByBookId(testBook.id);

    // Create progress at page 300 on Nov 1
    await progressRepository.create({
      bookId: testBook.id,
      sessionId: session!.id,
      currentPage: 300,
      currentPercentage: 60,
      progressDate: new Date("2025-11-01"),
      pagesRead: 300,
    });

    // Try to log progress at page 250 (going back) with current date - should be rejected
    const request = createMockRequest("POST", "/api/books/123/progress", {
      currentPage: 250,
    });
    const params = { id: testBook.id.toString() };

    const response = await POST(request as NextRequest, { params });
    const data = await response.json();

    // New behavior: temporal validation rejects backward progress with current date
    expect(response.status).toBe(400);
    expect(data.error).toContain("Progress must be at least page 300");
  });

  test("returns completion flag when progress reaches 100%", async () => {
    const request = createMockRequest("POST", "/api/books/123/progress", {
      currentPage: 500, // 100%
    });
    const params = { id: testBook.id.toString() };

    const response = await POST(request as NextRequest, { params });
    const data = await response.json();
    
    expect(response.status).toBe(200);
    expect(data.shouldShowCompletionModal).toBe(true);

    // Check session status WAS auto-updated to "read" (auto-completion)
    const readSessions = await sessionRepository.findAllByBookId(testBook.id);
    const completedSession = readSessions.find((s: any) => s.status === "read");
    expect(completedSession).toBeDefined();
    expect(completedSession!.completedDate).toBeDefined();
    
    // There should no longer be an active "reading" session
    const activeSession = await sessionRepository.findActiveByBookId(testBook.id);
    expect(activeSession).toBeUndefined();
  });

  test("returns completion flag when percentage reaches 100%", async () => {
    const request = createMockRequest("POST", "/api/books/123/progress", {
      currentPercentage: 100,
    });
    const params = { id: testBook.id.toString() };

    const response = await POST(request as NextRequest, { params });
    const data = await response.json();
    
    expect(response.status).toBe(200);
    expect(data.shouldShowCompletionModal).toBe(true);

    // Check session status WAS auto-updated to "read" (auto-completion)
    const readSessions = await sessionRepository.findAllByBookId(testBook.id);
    const completedSession = readSessions.find((s: any) => s.status === "read");
    expect(completedSession).toBeDefined();
    expect(completedSession!.completedDate).toBeDefined();
    
    // There should no longer be an active "reading" session
    const activeSession = await sessionRepository.findActiveByBookId(testBook.id);
    expect(activeSession).toBeUndefined();
  });

  test("doesn't mark as complete for progress below 100%", async () => {
    const request = createMockRequest("POST", "/api/books/123/progress", {
      currentPercentage: 99,
    });
    const params = { id: testBook.id.toString() };

    await POST(request as NextRequest, { params });

    // Session status should still be "reading"
    const session = await sessionRepository.findActiveByBookId(testBook.id);
    expect(session!.status).toBe("reading");
    expect(session!.completedDate).toBeNull();
  });

  test("returns 404 for non-existent book", async () => {
    const request = createMockRequest("POST", "/api/books/123/progress", {
      currentPage: 100,
    });
    const params = { id: "999999" }; // Non-existent ID

    const response = await POST(request as NextRequest, { params });
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe("Book not found");
  });

  test("returns 400 when neither currentPage nor currentPercentage provided", async () => {
    const request = createMockRequest("POST", "/api/books/123/progress", {
      notes: "Just a note",
    });
    const params = { id: testBook.id.toString() };

    const response = await POST(request as NextRequest, { params });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe("Either currentPage or currentPercentage is required");
  });

  test("handles book without totalPages (page-only mode)", async () => {
    const bookNoPages = await bookRepository.create({
      calibreId: 2,
      title: "No Pages Book",
      authors: ["Author"],
      tags: [],
      path: "No/Pages",
      orphaned: false,
      // No totalPages
    });

    // Create active session for this book
    await sessionRepository.create({
      bookId: bookNoPages.id,
      sessionNumber: 1,
      status: "reading",
      isActive: true,
      startedDate: new Date("2025-11-01"),
    });

    const request = createMockRequest("POST", "/api/books/123/progress", {
      currentPage: 100,
    });
    const params = { id: bookNoPages.id.toString() };

    const response = await POST(request as NextRequest, { params });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.progressLog.currentPage).toBe(100);
    expect(data.progressLog.currentPercentage).toBe(0); // Can't calculate without total pages
    expect(data.shouldShowCompletionModal).toBe(false);
  });

  test("accepts percentage input for book without totalPages", async () => {
    const bookNoPages = await bookRepository.create({
      calibreId: 2,
      title: "No Pages Book",
      authors: ["Author"],
      tags: [],
      path: "No/Pages",
      orphaned: false,
    });

    // Create active session for this book
    await sessionRepository.create({
      bookId: bookNoPages.id,
      sessionNumber: 1,
      status: "reading",
      isActive: true,
      startedDate: new Date("2025-11-01"),
    });

    const request = createMockRequest("POST", "/api/books/123/progress", {
      currentPercentage: 50,
    });
    const params = { id: bookNoPages.id.toString() };

    const response = await POST(request as NextRequest, { params });
    const data = await response.json();

    // Service layer accepts percentage-only progress (calculates currentPage as 0)
    expect(response.status).toBe(200);
    expect(data.progressLog.currentPercentage).toBe(50);
    expect(data.progressLog.currentPage).toBe(0); // Without totalPages, page is 0
    expect(data.shouldShowCompletionModal).toBe(false);
  });

  test("stores progress date correctly", async () => {
    const todayEST = formatInTimeZone(new Date(), "America/New_York", "yyyy-MM-dd");

    const request = createMockRequest("POST", "/api/books/123/progress", {
      currentPage: 100,
    });
    const params = { id: testBook.id.toString() };

    await POST(request as NextRequest, { params });

    const logs = await progressRepository.findByBookId(testBook.id);
    const log = logs[0];
    expect(log!.progressDate).toBeDefined();
    // Progress date should be today's date (midnight in user's timezone)
    expect(getDateInEST(log!.progressDate)).toBe(todayEST);
  });

  test("preserves notes when provided", async () => {
    const request = createMockRequest("POST", "/api/books/123/progress", {
      currentPage: 200,
      notes: "This is a great book!",
    });
    const params = { id: testBook.id.toString() };

    const response = await POST(request as NextRequest, { params });
    const data = await response.json();

    expect(data.progressLog.notes).toBe("This is a great book!");

    const logs = await progressRepository.findByBookId(testBook.id);
    const log = logs.find(l => l.notes === "This is a great book!");
    expect(log!.notes).toBe("This is a great book!");
  });

  test("handles database errors gracefully", async () => {
    const request = createMockRequest("POST", "/api/books/123/progress", {
      currentPage: 100,
    });
    const params = { id: "invalid-id" };

    const response = await POST(request as NextRequest, { params });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe("Invalid book ID format");
  });

   test("updates session updatedAt timestamp when logging progress", async () => {
     // Arrange: Find the session created in beforeEach and set old timestamp
     const oldTime = new Date(Date.now() - 60000); // 1 minute ago
     const session = await sessionRepository.findActiveByBookId(testBook.id);
     expect(session).toBeTruthy();

     // Update the session with an old timestamp using direct SQL (in seconds)
     const sqlite = getTestSqlite(__filename);
     sqlite.exec(`UPDATE reading_sessions SET updated_at = ${Math.floor(oldTime.getTime() / 1000)} WHERE id = ${session!.id}`);

     // Verify the old timestamp is set
     // Note: SQLite stores timestamps as seconds, so when Drizzle reads back it's in milliseconds
     // but only accurate to the second (000ms), allowing up to 1 second of precision loss
     const sessionBefore = await sessionRepository.findById(session!.id);
     const sessionBeforeTime = sessionBefore?.updatedAt.getTime() || 0;
     expect(sessionBeforeTime).toBeLessThanOrEqual(oldTime.getTime() + 2000); // Allow 2 second variance for second precision

     // Wait a bit to ensure different timestamp
     await new Promise(resolve => setTimeout(resolve, 10));

     // Act: Log progress
     const request = createMockRequest("POST", `/api/books/${testBook.id}/progress`, {
       currentPage: 100,
     });
     const params = { id: testBook.id.toString() };

     const response = await POST(request as NextRequest, { params });
     expect(response.status).toBe(200);

     // Assert: Session updatedAt should be newer
     const sessionAfter = await sessionRepository.findById(session!.id);
     expect(sessionAfter).toBeTruthy();
     expect(sessionAfter?.updatedAt.getTime()).toBeGreaterThan(oldTime.getTime());
     expect(sessionAfter?.updatedAt.getTime()).toBeGreaterThan(Date.now() - 5000); // Within last 5 seconds
   });
});
