import { describe, test, expect, beforeAll, afterAll, beforeEach } from "bun:test";
import { GET } from "@/app/api/books/[id]/sessions/route";
import { bookRepository, sessionRepository, progressRepository } from "@/lib/repositories";
import { setupTestDatabase, teardownTestDatabase, clearTestDatabase } from "@/__tests__/helpers/db-setup";
import {
  mockBook1,
  mockSessionRead,
  mockSessionReading,
  mockProgressLog1,
  mockProgressLog2,
  createMockRequest,
} from "../fixtures/test-data";
import type { NextRequest } from "next/server";

beforeAll(async () => {
  await setupTestDatabase(__filename);
});

afterAll(async () => {
  await teardownTestDatabase(__filename);
});

beforeEach(async () => {
  await clearTestDatabase(__filename);
});

describe("GET /api/books/[id]/sessions", () => {
  // ============================================================================
  // SUCCESS CASES
  // ============================================================================

  test("should return all sessions sorted by sessionNumber descending", async () => {
    // Arrange: Create book with 3 sessions
    const book = await bookRepository.create(mockBook1);
    await sessionRepository.create({
      ...mockSessionRead,
      bookId: book.id,
      sessionNumber: 1,
      isActive: false,
    });
    await sessionRepository.create({
      ...mockSessionRead,
      bookId: book.id,
      sessionNumber: 2,
      isActive: false,
    });
    await sessionRepository.create({
      ...mockSessionReading,
      bookId: book.id,
      sessionNumber: 3,
      isActive: true,
    });

    // Act: Fetch all sessions
    const request = createMockRequest("GET", `/api/books/${book.id}/sessions`);
    const response = await GET(request as NextRequest, { params: { id: book.id.toString() } });
    const data = await response.json();

    // Assert: Sessions returned in descending order
    expect(response.status).toBe(200);
    expect(data.length).toBe(3);
    expect(data[0].sessionNumber).toBe(3);
    expect(data[1].sessionNumber).toBe(2);
    expect(data[2].sessionNumber).toBe(1);
  });

  test("should include progress summary for each session", async () => {
    // Arrange: Create book, session, and 2 progress logs
    const book = await bookRepository.create(mockBook1);
    const session = await sessionRepository.create({
      ...mockSessionRead,
      bookId: book.id,
      sessionNumber: 1,
      isActive: true,
    });
    await progressRepository.create({
      ...mockProgressLog1,
      bookId: book.id,
      sessionId: session.id,
      pagesRead: 100,
      progressDate: new Date("2025-11-15"),
    });
    await progressRepository.create({
      ...mockProgressLog2,
      bookId: book.id,
      sessionId: session.id,
      pagesRead: 150,
      progressDate: new Date("2025-11-16"),
    });

    // Act: Fetch sessions
    const request = createMockRequest("GET", `/api/books/${book.id}/sessions`);
    const response = await GET(request as NextRequest, { params: { id: book.id.toString() } });
    const data = await response.json();

    // Assert: Progress summary included with correct aggregations
    expect(response.status).toBe(200);
    expect(data.length).toBe(1);

    const progressSummary = data[0].progressSummary;
    expect(progressSummary).toBeDefined();
    expect(progressSummary.totalEntries).toBe(2);
    expect(progressSummary.totalPagesRead).toBe(250); // 100 + 150
    expect(progressSummary.latestProgress).toBeDefined();
    expect(progressSummary.latestProgress.currentPage).toBe(250);
    expect(progressSummary.firstProgressDate).toBeDefined();
    expect(progressSummary.lastProgressDate).toBeDefined();
  });

  test("should return empty progress summary for session with no progress", async () => {
    // Arrange: Create book and session without progress logs
    const book = await bookRepository.create(mockBook1);
    await sessionRepository.create({
      ...mockSessionRead,
      bookId: book.id,
      sessionNumber: 1,
      isActive: true,
    });

    // Act: Fetch sessions
    const request = createMockRequest("GET", `/api/books/${book.id}/sessions`);
    const response = await GET(request as NextRequest, { params: { id: book.id.toString() } });
    const data = await response.json();

    // Assert: Progress summary shows zero values
    expect(response.status).toBe(200);
    expect(data.length).toBe(1);

    const progressSummary = data[0].progressSummary;
    expect(progressSummary.totalEntries).toBe(0);
    expect(progressSummary.totalPagesRead).toBe(0);
    expect(progressSummary.latestProgress).toBeNull();
    expect(progressSummary.firstProgressDate).toBeNull();
    expect(progressSummary.lastProgressDate).toBeNull();
  });

  test("should return empty array if book has no sessions", async () => {
    // Arrange: Create book without sessions
    const book = await bookRepository.create(mockBook1);

    // Act: Fetch sessions
    const request = createMockRequest("GET", `/api/books/${book.id}/sessions`);
    const response = await GET(request as NextRequest, { params: { id: book.id.toString() } });
    const data = await response.json();

    // Assert: Empty array returned
    expect(response.status).toBe(200);
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBe(0);
  });

  test("should include all session fields in response", async () => {
    const book = await bookRepository.create(mockBook1);
    await sessionRepository.create({
      ...mockSessionRead,
      bookId: book.id,
      sessionNumber: 1,
      status: "read",
      startedDate: new Date("2025-11-01"),
      completedDate: new Date("2025-11-16"),
      review: "Great book!",
      isActive: true,
    });

    const request = createMockRequest("GET", `/api/books/${book.id}/sessions`);
    const response = await GET(request as NextRequest, { params: { id: book.id.toString() } });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.length).toBe(1);

    const session = data[0];
    expect(session.id).toBeDefined();
    expect(session.bookId).toBe(book.id);
    expect(session.sessionNumber).toBe(1);
    expect(session.status).toBe("read");
    expect(session.startedDate).toBeDefined();
    expect(session.completedDate).toBeDefined();
    expect(session.review).toBe("Great book!");
    expect(session.isActive).toBe(true);
    expect(session.createdAt).toBeDefined();
    expect(session.updatedAt).toBeDefined();
  });

  test("should calculate correct progress summary with multiple logs", async () => {
    // Arrange: Create book, session, and 5 progress logs across different dates
    const book = await bookRepository.create(mockBook1);
    const session = await sessionRepository.create({
      ...mockSessionRead,
      bookId: book.id,
      sessionNumber: 1,
      isActive: true,
    });

    const dates = [
      "2025-11-10",
      "2025-11-12",
      "2025-11-14",
      "2025-11-16",
      "2025-11-18",
    ];

    for (let i = 0; i < 5; i++) {
      await progressRepository.create({
        bookId: book.id,
        sessionId: session.id,
        currentPage: (i + 1) * 100,
        currentPercentage: ((i + 1) * 100) / 1040,
        pagesRead: 100,
        progressDate: new Date(dates[i]),
      });
    }

    // Act: Fetch sessions with progress summary
    const request = createMockRequest("GET", `/api/books/${book.id}/sessions`);
    const response = await GET(request as NextRequest, { params: { id: book.id.toString() } });
    const data = await response.json();

    // Assert: Progress summary correctly aggregates all 5 logs
    expect(response.status).toBe(200);

    const progressSummary = data[0].progressSummary;
    expect(progressSummary.totalEntries).toBe(5);
    expect(progressSummary.totalPagesRead).toBe(500);
    expect(progressSummary.latestProgress.currentPage).toBe(500);
    expect(new Date(progressSummary.firstProgressDate).toISOString().split("T")[0]).toBe("2025-11-10");
    expect(new Date(progressSummary.lastProgressDate).toISOString().split("T")[0]).toBe("2025-11-18");
  });

  // ============================================================================
  // ERROR CASES
  // ============================================================================

  test("should return 404 if book not found", async () => {
    const fakeId = 999999;
    const request = createMockRequest("GET", `/api/books/${fakeId}/sessions`);
    const response = await GET(request as NextRequest, { params: { id: fakeId.toString() } });
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe("Book not found");
  });

  test("should return 400 with invalid book ID format", async () => {
    const request = createMockRequest("GET", "/api/books/invalid-id/sessions");
    const response = await GET(request as NextRequest, { params: { id: "invalid-id" } });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBeDefined();
  });

  // ============================================================================
  // EDGE CASES
  // ============================================================================

  test("should only return sessions for specified book", async () => {
    const book1 = await bookRepository.create(mockBook1);
    const book2 = await bookRepository.create({ ...mockBook1, calibreId: 999, title: "Other Book" });

    // Create sessions for both books
    await sessionRepository.create({
      ...mockSessionRead,
      bookId: book1.id,
      sessionNumber: 1,
    });
    await sessionRepository.create({
      ...mockSessionRead,
      bookId: book2.id,
      sessionNumber: 1,
    });

    const request = createMockRequest("GET", `/api/books/${book1.id}/sessions`);
    const response = await GET(request as NextRequest, { params: { id: book1.id.toString() } });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.length).toBe(1);
    expect(data[0].bookId).toBe(book1.id);
  });

  test("should handle large number of sessions efficiently", async () => {
    const book = await bookRepository.create(mockBook1);

    // Create 100 sessions
    for (let i = 1; i <= 100; i++) {
      await sessionRepository.create({
        ...mockSessionRead,
        bookId: book.id,
        sessionNumber: i,
        isActive: i === 100,
      });
    }

    const request = createMockRequest("GET", `/api/books/${book.id}/sessions`);
    const response = await GET(request as NextRequest, { params: { id: book.id.toString() } });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.length).toBe(100);
    expect(data[0].sessionNumber).toBe(100); // Most recent first
    expect(data[99].sessionNumber).toBe(1); // Oldest last
  });

  test("should isolate progress logs by session", async () => {
    const book = await bookRepository.create(mockBook1);

    const session1 = await sessionRepository.create({
      ...mockSessionRead,
      bookId: book.id,
      sessionNumber: 1,
      isActive: false,
    });

    const session2 = await sessionRepository.create({
      ...mockSessionReading,
      bookId: book.id,
      sessionNumber: 2,
      isActive: true,
    });

    // Add progress to session 1
    await progressRepository.create({
      ...mockProgressLog1,
      bookId: book.id,
      sessionId: session1.id,
      pagesRead: 100,
    });
    await progressRepository.create({
      ...mockProgressLog2,
      bookId: book.id,
      sessionId: session1.id,
      pagesRead: 150,
    });

    // Add progress to session 2
    await progressRepository.create({
      ...mockProgressLog1,
      bookId: book.id,
      sessionId: session2.id,
      pagesRead: 50,
    });

    const request = createMockRequest("GET", `/api/books/${book.id}/sessions`);
    const response = await GET(request as NextRequest, { params: { id: book.id.toString() } });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.length).toBe(2);

    // Session 2 should be first (most recent)
    expect(data[0].sessionNumber).toBe(2);
    expect(data[0].progressSummary.totalEntries).toBe(1);
    expect(data[0].progressSummary.totalPagesRead).toBe(50);

    // Session 1 should be second
    expect(data[1].sessionNumber).toBe(1);
    expect(data[1].progressSummary.totalEntries).toBe(2);
    expect(data[1].progressSummary.totalPagesRead).toBe(250);
  });

  test("should handle sessions with partial data", async () => {
    const book = await bookRepository.create(mockBook1);

    // Create sessions with different levels of completeness
    await sessionRepository.create({
      bookId: book.id,
      sessionNumber: 1,
      status: "to-read",
      isActive: false,
    });

    await sessionRepository.create({
      bookId: book.id,
      sessionNumber: 2,
      status: "reading",
      startedDate: new Date("2025-11-15"),
      isActive: false,
    });

    await sessionRepository.create({
      bookId: book.id,
      sessionNumber: 3,
      status: "read",
      startedDate: new Date("2025-11-01"),
      completedDate: new Date("2025-11-16"),
      rating: 5,
      review: "Great!",
      isActive: true,
    });

    const request = createMockRequest("GET", `/api/books/${book.id}/sessions`);
    const response = await GET(request as NextRequest, { params: { id: book.id.toString() } });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.length).toBe(3);

    // All sessions should return successfully with their respective data
    expect(data[0].status).toBe("read");
    expect(data[1].status).toBe("reading");
    expect(data[2].status).toBe("to-read");
  });

  test("should not include progress from unlinked logs", async () => {
    const book = await bookRepository.create(mockBook1);
    const session = await sessionRepository.create({
      ...mockSessionRead,
      bookId: book.id,
      sessionNumber: 1,
      isActive: true,
    });

    // Create a progress log with sessionId
    await progressRepository.create({
      ...mockProgressLog1,
      bookId: book.id,
      sessionId: session.id,
      pagesRead: 100,
    });

    // Create a progress log without sessionId (legacy/orphaned)
    await progressRepository.create({
      ...mockProgressLog2,
      bookId: book.id,
      sessionId: null,
      pagesRead: 200,
    });

    const request = createMockRequest("GET", `/api/books/${book.id}/sessions`);
    const response = await GET(request as NextRequest, { params: { id: book.id.toString() } });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.length).toBe(1);

    const progressSummary = data[0].progressSummary;
    expect(progressSummary.totalEntries).toBe(1);
    expect(progressSummary.totalPagesRead).toBe(100); // Only the linked progress
  });
});
