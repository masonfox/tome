import { toProgressDate, toSessionDate } from '../test-utils';
import { describe, test, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { GET } from "@/app/api/reading-goals/books/route";
import { bookRepository, sessionRepository, readingGoalRepository } from "@/lib/repositories";
import { setupTestDatabase, teardownTestDatabase, clearTestDatabase } from "@/__tests__/helpers/db-setup";
import { createMockRequest, createTestBook } from "@/__tests__/fixtures/test-data";
import type { NextRequest } from "next/server";

/**
 * Reading Goals Books API Tests - /api/reading-goals/books
 * 
 * Tests the endpoint for retrieving books completed in a specific year:
 * - GET: Fetching all books completed in a given year
 * 
 * Coverage:
 * - Success cases (200)
 * - Error cases (400, 500)
 * - Input validation (year parameter)
 * - Data aggregation (books by completion year)
 */

describe("Reading Goals Books API - GET /api/reading-goals/books", () => {
  beforeAll(async () => {
    await setupTestDatabase(__filename);
  });

  afterAll(async () => {
    await teardownTestDatabase(__filename);
  });

  beforeEach(async () => {
    await clearTestDatabase(__filename);
  });

  describe("GET - Success cases", () => {
    test("returns 200 with empty list when no books completed", async () => {
      const request = createMockRequest("GET", "/api/reading-goals/books?year=2024");
      const response = await GET(request as NextRequest);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.year).toBe(2024);
      expect(data.data.count).toBe(0);
      expect(data.data.books).toEqual([]);
    });

    test("returns books completed in specified year", async () => {
      // Create books completed in 2024
      const book1 = await bookRepository.create(createTestBook({
        calibreId: 1,
        title: "Book 1",
        authors: ["Author 1"],
        path: "Book1",
        orphaned: false,
      }));
      await sessionRepository.create({
        bookId: book1.id,
        sessionNumber: 1,
        status: "read",
        startedDate: "2024-01-05",
        completedDate: "2024-01-15",
        isActive: false,
        userId: null,
      });

      const book2 = await bookRepository.create(createTestBook({
        calibreId: 2,
        title: "Book 2",
        authors: ["Author 2"],
        path: "Book2",
        orphaned: false,
      }));
      await sessionRepository.create({
        bookId: book2.id,
        sessionNumber: 1,
        status: "read",
        startedDate: "2024-06-10",
        completedDate: "2024-06-20",
        isActive: false,
        userId: null,
      });

      const request = createMockRequest("GET", "/api/reading-goals/books?year=2024");
      const response = await GET(request as NextRequest);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.year).toBe(2024);
      expect(data.data.count).toBe(2);
      expect(data.data.books).toHaveLength(2);
      expect(data.data.books[0]).toHaveProperty("title");
      expect(data.data.books[0]).toHaveProperty("completedDate");
    });

    test("only includes books from specified year", async () => {
      // Create books in different years
      const book2023 = await bookRepository.create(createTestBook({
        calibreId: 1,
        title: "2023 Book",
        path: "Book2023",
        orphaned: false,
      }));
      await sessionRepository.create({
        bookId: book2023.id,
        sessionNumber: 1,
        status: "read",
        startedDate: "2023-12-01",
        completedDate: "2023-12-31",
        isActive: false,
        userId: null,
      });

      const book2024 = await bookRepository.create(createTestBook({
        calibreId: 2,
        title: "2024 Book",
        path: "Book2024",
        orphaned: false,
      }));
      await sessionRepository.create({
        bookId: book2024.id,
        sessionNumber: 1,
        status: "read",
        startedDate: "2024-01-01",
        completedDate: "2024-01-15",
        isActive: false,
        userId: null,
      });

      const request = createMockRequest("GET", "/api/reading-goals/books?year=2024");
      const response = await GET(request as NextRequest);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.count).toBe(1);
      expect(data.data.books[0].title).toBe("2024 Book");
    });

    test("handles multiple books completed in same year", async () => {
      // Create 5 books completed in 2024
      for (let i = 1; i <= 5; i++) {
        const book = await bookRepository.create(createTestBook({
          calibreId: i,
          title: `Book ${i}`,
          authors: [`Author ${i}`],
          path: `Book${i}`,
          orphaned: false,
        }));
        await sessionRepository.create({
          bookId: book.id,
          sessionNumber: 1,
          status: "read",
          startedDate: toSessionDate(new Date(`2024-0${i}-01`)),
          completedDate: toSessionDate(new Date(`2024-0${i}-15`)),
          isActive: false,
          userId: null,
        });
      }

      const request = createMockRequest("GET", "/api/reading-goals/books?year=2024");
      const response = await GET(request as NextRequest);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.count).toBe(5);
      expect(data.data.books).toHaveLength(5);
    });

    test("includes completedDate in book data", async () => {
      const book = await bookRepository.create(createTestBook({
        calibreId: 1,
        title: "Test Book",
        path: "TestBook",
        orphaned: false,
      }));
      const completedDate = "2024-03-15";
      await sessionRepository.create({
        bookId: book.id,
        sessionNumber: 1,
        status: "read",
        startedDate: "2024-03-01",
        completedDate,
        isActive: false,
        userId: null,
      });

      const request = createMockRequest("GET", "/api/reading-goals/books?year=2024");
      const response = await GET(request as NextRequest);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.books[0]).toHaveProperty("completedDate");
      expect(new Date(data.data.books[0].completedDate).getFullYear()).toBe(2024);
      expect(new Date(data.data.books[0].completedDate).getMonth()).toBe(2); // March is month 2 (0-indexed)
    });

    test("handles minimum valid year (1900)", async () => {
      const request = createMockRequest("GET", "/api/reading-goals/books?year=1900");
      const response = await GET(request as NextRequest);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.year).toBe(1900);
      expect(data.data.count).toBe(0);
    });

    test("handles maximum valid year (2100)", async () => {
      const request = createMockRequest("GET", "/api/reading-goals/books?year=2100");
      const response = await GET(request as NextRequest);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.year).toBe(2100);
      expect(data.data.count).toBe(0);
    });

    test("handles current year", async () => {
      const currentYear = new Date().getFullYear();
      const request = createMockRequest("GET", `/api/reading-goals/books?year=${currentYear}`);
      const response = await GET(request as NextRequest);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.year).toBe(currentYear);
    });
  });

  describe("GET - Validation errors", () => {
    test("returns 400 when year parameter is missing", async () => {
      const request = createMockRequest("GET", "/api/reading-goals/books");
      const response = await GET(request as NextRequest);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error.code).toBe("MISSING_YEAR");
      expect(data.error.message).toContain("Year parameter is required");
    });

    test("returns 400 for invalid year (non-numeric)", async () => {
      const request = createMockRequest("GET", "/api/reading-goals/books?year=invalid");
      const response = await GET(request as NextRequest);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error.code).toBe("INVALID_YEAR");
      expect(data.error.message).toContain("must be a valid number");
    });

    test("returns 400 for year below minimum (1899)", async () => {
      const request = createMockRequest("GET", "/api/reading-goals/books?year=1899");
      const response = await GET(request as NextRequest);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error.code).toBe("INVALID_YEAR");
      expect(data.error.message).toContain("between 1900 and 2100");
    });

    test("returns 400 for year above maximum (2101)", async () => {
      const request = createMockRequest("GET", "/api/reading-goals/books?year=2101");
      const response = await GET(request as NextRequest);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error.code).toBe("INVALID_YEAR");
    });

    test("returns 400 for empty year parameter", async () => {
      const request = createMockRequest("GET", "/api/reading-goals/books?year=");
      const response = await GET(request as NextRequest);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error.code).toBe("MISSING_YEAR");
    });

    test("returns 400 for non-numeric year", async () => {
      const request = createMockRequest("GET", "/api/reading-goals/books?year=invalid");
      const response = await GET(request as NextRequest);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error.code).toBe("INVALID_YEAR");
    });
  });

  describe("GET - Error handling", () => {
    test("returns 500 on internal error", async () => {
      // Mock the repository to throw an error
      const originalGetBooks = readingGoalRepository.getBooksByCompletionYear;
      readingGoalRepository.getBooksByCompletionYear = (() => {
        throw new Error("Database connection failed");
      }) as any;

      const request = createMockRequest("GET", "/api/reading-goals/books?year=2024");
      const response = await GET(request as NextRequest);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.error.code).toBe("INTERNAL_ERROR");
      expect(data.error).toHaveProperty("errorId");

      // Restore original function
      readingGoalRepository.getBooksByCompletionYear = originalGetBooks;
    });
  });
});
