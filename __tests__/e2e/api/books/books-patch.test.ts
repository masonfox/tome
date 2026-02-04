import { test, expect, describe, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { PATCH } from "@/app/api/books/[id]/route";
import { bookRepository, sessionRepository, progressRepository } from "@/lib/repositories";
import { setupTestDatabase, teardownTestDatabase, clearTestDatabase } from "@/__tests__/helpers/db-setup";
import { createMockRequest, createTestBook, createTestSession, createTestProgress } from "@/__tests__/fixtures/test-data";
import type { NextRequest } from "next/server";

/**
 * Mock Rationale: Prevent Next.js cache revalidation side effects during tests.
 * Book detail API calls revalidatePath on updates, but we don't need to test
 * Next.js's caching behavior - just our business logic.
 */
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));

beforeAll(async () => {
  await setupTestDatabase(__filename);
});

afterAll(async () => {
  await teardownTestDatabase(__filename);
});

beforeEach(async () => {
  await clearTestDatabase(__filename);
});

describe("PATCH /api/books/[id] - Page Count Update", () => {
  describe("Success Cases", () => {
    test("should return 200 with updated book on successful page count update", async () => {
      const book = await bookRepository.create(createTestBook({
        calibreId: 1,
        title: "Test Book",
        authors: ["Author One"],
        totalPages: 300,
        path: "Author One/Test Book (1)",
      }));

      const request = createMockRequest("PATCH", `/api/books/${book.id}`, { totalPages: 400 });
      const response = await PATCH(request as NextRequest, { params: { id: book.id.toString() } });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.totalPages).toBe(400);
      expect(data.id).toBe(book.id);
      expect(data.title).toBe("Test Book");
    });

    test("should update null totalPages to non-null value", async () => {
      const book = await bookRepository.create(createTestBook({
        calibreId: 2,
        title: "Book Without Pages",
        authors: ["Author Two"],
        totalPages: null,
        path: "Author Two/Book (2)",
      }));

      const request = createMockRequest("PATCH", `/api/books/${book.id}`, { totalPages: 250 });
      const response = await PATCH(request as NextRequest, { params: { id: book.id.toString() } });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.totalPages).toBe(250);
    });

    test("should recalculate active session progress percentages", async () => {
      const book = await bookRepository.create(createTestBook({
        calibreId: 3,
        title: "Active Reading Book",
        authors: ["Author Three"],
        totalPages: 200,
        path: "Author Three/Book (3)",
      }));

      const session = await sessionRepository.create(createTestSession({
        bookId: book.id,
        sessionNumber: 1,
        status: "reading",
        isActive: true,
      }));

      await progressRepository.create(createTestProgress({
        bookId: book.id,
        sessionId: session.id,
        currentPage: 100,
        currentPercentage: 50, // 100/200 = 50%
        pagesRead: 100,
      }));

      const request = createMockRequest("PATCH", `/api/books/${book.id}`, { totalPages: 400 });
      const response = await PATCH(request as NextRequest, { params: { id: book.id.toString() } });
      expect(response.status).toBe(200);

      // Verify percentage recalculated
      const progress = await progressRepository.findBySessionId(session.id);
      expect(progress[0].currentPercentage).toBe(25); // 100/400 = 25%
    });
  });

  describe("Validation Errors (400)", () => {
    test("should return 400 for invalid book ID format", async () => {
      const request = createMockRequest("PATCH", "/api/books/invalid", { totalPages: 300 });
      const response = await PATCH(request as NextRequest, { params: { id: "invalid" } });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Invalid book ID format");
    });

    test("should return 400 for zero total pages", async () => {
      const book = await bookRepository.create(createTestBook({
        calibreId: 4,
        title: "Test Book",
        authors: ["Author"],
        totalPages: 300,
        path: "Author/Book (4)",
      }));

      const request = createMockRequest("PATCH", `/api/books/${book.id}`, { totalPages: 0 });
      const response = await PATCH(request as NextRequest, { params: { id: book.id.toString() } });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Total pages must be a positive number");
    });

    test("should return 400 for negative total pages", async () => {
      const book = await bookRepository.create(createTestBook({
        calibreId: 5,
        title: "Test Book",
        authors: ["Author"],
        totalPages: 300,
        path: "Author/Book (5)",
      }));

      const request = createMockRequest("PATCH", `/api/books/${book.id}`, { totalPages: -100 });
      const response = await PATCH(request as NextRequest, { params: { id: book.id.toString() } });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Total pages must be a positive number");
    });

    test("should return 400 when reducing page count below active session progress", async () => {
      const book = await bookRepository.create(createTestBook({
        calibreId: 6,
        title: "Book With Progress",
        authors: ["Author"],
        totalPages: 500,
        path: "Author/Book (6)",
      }));

      const session = await sessionRepository.create(createTestSession({
        bookId: book.id,
        sessionNumber: 1,
        status: "reading",
        isActive: true,
      }));

      await progressRepository.create(createTestProgress({
        bookId: book.id,
        sessionId: session.id,
        currentPage: 400,
        currentPercentage: 80,
        pagesRead: 400,
      }));

      const request = createMockRequest("PATCH", `/api/books/${book.id}`, { totalPages: 350 });
      const response = await PATCH(request as NextRequest, { params: { id: book.id.toString() } });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain("Cannot reduce page count to 350");
      expect(data.error).toContain("You've already logged progress up to page 400");
    });

    test("should return 400 for page count reduction validation with descriptive message", async () => {
      const book = await bookRepository.create(createTestBook({
        calibreId: 7,
        title: "Book At 250 Pages",
        authors: ["Author"],
        totalPages: 600,
        path: "Author/Book (7)",
      }));

      const session = await sessionRepository.create(createTestSession({
        bookId: book.id,
        sessionNumber: 1,
        status: "reading",
        isActive: true,
      }));

      await progressRepository.create(createTestProgress({
        bookId: book.id,
        sessionId: session.id,
        currentPage: 250,
        currentPercentage: 41,
        pagesRead: 250,
      }));

      const request = createMockRequest("PATCH", `/api/books/${book.id}`, { totalPages: 200 });
      const response = await PATCH(request as NextRequest, { params: { id: book.id.toString() } });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toMatch(/Cannot reduce page count to 200/);
      expect(data.error).toMatch(/already logged progress up to page 250/);
      expect(data.error).toMatch(/Please adjust your progress or use a higher page count/);
    });
  });

  describe("Not Found Errors (404)", () => {
    test("should return 404 for non-existent book", async () => {
      const request = createMockRequest("PATCH", "/api/books/99999", { totalPages: 300 });
      const response = await PATCH(request as NextRequest, { params: { id: "99999" } });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe("Book not found");
    });
  });

  describe("Server Errors (500)", () => {
    test("should return 500 for malformed JSON body", async () => {
      const book = await bookRepository.create(createTestBook({
        calibreId: 8,
        title: "Test Book",
        authors: ["Author"],
        totalPages: 300,
        path: "Author/Book (8)",
      }));

      // Create a request with invalid JSON manually
      const request = new Request(`http://localhost:3000/api/books/${book.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: "invalid json{",
      }) as any;
      request.nextUrl = new URL(`http://localhost:3000/api/books/${book.id}`);

      const response = await PATCH(request as NextRequest, { params: { id: book.id.toString() } });
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe("Failed to update book");
    });
  });

  describe("Edge Cases", () => {
    test("should handle book with no sessions", async () => {
      const book = await bookRepository.create(createTestBook({
        calibreId: 9,
        title: "Lonely Book",
        authors: ["Author"],
        totalPages: 300,
        path: "Author/Book (9)",
      }));

      const request = createMockRequest("PATCH", `/api/books/${book.id}`, { totalPages: 500 });
      const response = await PATCH(request as NextRequest, { params: { id: book.id.toString() } });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.totalPages).toBe(500);
    });

    test("should NOT recalculate completed session progress", async () => {
      const book = await bookRepository.create(createTestBook({
        calibreId: 10,
        title: "Completed Book",
        authors: ["Author"],
        totalPages: 300,
        path: "Author/Book (10)",
      }));

      const session = await sessionRepository.create(createTestSession({
        bookId: book.id,
        sessionNumber: 1,
        status: "read",
        isActive: false,
        completedDate: "2024-01-01",
      }));

      await progressRepository.create(createTestProgress({
        bookId: book.id,
        sessionId: session.id,
        currentPage: 300,
        currentPercentage: 100,
        pagesRead: 300,
      }));

      const request = createMockRequest("PATCH", `/api/books/${book.id}`, { totalPages: 400 });
      const response = await PATCH(request as NextRequest, { params: { id: book.id.toString() } });
      expect(response.status).toBe(200);

      // Verify completed session percentage UNCHANGED
      const progress = await progressRepository.findBySessionId(session.id);
      expect(progress[0].currentPercentage).toBe(100); // Still 100%, not recalculated
    });

    test("should allow reduction below completed session progress", async () => {
      const book = await bookRepository.create(createTestBook({
        calibreId: 11,
        title: "Completed Book",
        authors: ["Author"],
        totalPages: 500,
        path: "Author/Book (11)",
      }));

      const session = await sessionRepository.create(createTestSession({
        bookId: book.id,
        sessionNumber: 1,
        status: "read",
        isActive: false,
        completedDate: "2024-01-01",
      }));

      await progressRepository.create(createTestProgress({
        bookId: book.id,
        sessionId: session.id,
        currentPage: 500,
        currentPercentage: 100,
        pagesRead: 500,
      }));

      // Reduce to 400 (below completed progress) - should work because session is completed
      const request = createMockRequest("PATCH", `/api/books/${book.id}`, { totalPages: 400 });
      const response = await PATCH(request as NextRequest, { params: { id: book.id.toString() } });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.totalPages).toBe(400);
    });

    test("should handle multiple progress logs in active session", async () => {
      const book = await bookRepository.create(createTestBook({
        calibreId: 12,
        title: "Multi Progress Book",
        authors: ["Author"],
        totalPages: 400,
        path: "Author/Book (12)",
      }));

      const session = await sessionRepository.create(createTestSession({
        bookId: book.id,
        sessionNumber: 1,
        status: "reading",
        isActive: true,
      }));

      await progressRepository.create(createTestProgress({
        bookId: book.id,
        sessionId: session.id,
        currentPage: 100,
        currentPercentage: 25,
        pagesRead: 100,
        progressDate: "2024-01-01",
      }));

      await progressRepository.create(createTestProgress({
        bookId: book.id,
        sessionId: session.id,
        currentPage: 200,
        currentPercentage: 50,
        pagesRead: 100,
        progressDate: "2024-01-02",
      }));

      await progressRepository.create(createTestProgress({
        bookId: book.id,
        sessionId: session.id,
        currentPage: 300,
        currentPercentage: 75,
        pagesRead: 100,
        progressDate: "2024-01-03",
      }));

      const request = createMockRequest("PATCH", `/api/books/${book.id}`, { totalPages: 600 });
      const response = await PATCH(request as NextRequest, { params: { id: book.id.toString() } });
      expect(response.status).toBe(200);

      // Verify all progress logs recalculated
      const progress = await progressRepository.findBySessionId(session.id);
      expect(progress).toHaveLength(3);

      // Find by currentPage since order might vary
      const log100 = progress.find(p => p.currentPage === 100);
      const log200 = progress.find(p => p.currentPage === 200);
      const log300 = progress.find(p => p.currentPage === 300);

      expect(log100?.currentPercentage).toBe(16); // 100/600 = 16.66% → 16%
      expect(log200?.currentPercentage).toBe(33); // 200/600 = 33.33% → 33%
      expect(log300?.currentPercentage).toBe(50); // 300/600 = 50%
    });
  });

  describe("Request Format Validation", () => {
    test("should require totalPages field in request body", async () => {
      const book = await bookRepository.create(createTestBook({
        calibreId: 13,
        title: "Test Book",
        authors: ["Author"],
        totalPages: 300,
        path: "Author/Book (13)",
      }));

      const request = createMockRequest("PATCH", `/api/books/${book.id}`, {});
      const response = await PATCH(request as NextRequest, { params: { id: book.id.toString() } });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Total pages must be a positive number");
    });

    test("should validate totalPages is a valid number after parsing", async () => {
      const book = await bookRepository.create(createTestBook({
        calibreId: 14,
        title: "Test Book",
        authors: ["Author"],
        totalPages: 300,
        path: "Author/Book (14)",
      }));

      // Pass null to trigger validation (null/undefined are falsy)
      const request = createMockRequest("PATCH", `/api/books/${book.id}`, { totalPages: null });
      const response = await PATCH(request as NextRequest, { params: { id: book.id.toString() } });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Total pages must be a positive number");
    });
  });
});
