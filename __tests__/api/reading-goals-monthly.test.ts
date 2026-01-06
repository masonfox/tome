import { describe, test, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { GET } from "@/app/api/reading-goals/monthly/route";
import { readingGoalRepository, bookRepository, sessionRepository } from "@/lib/repositories";
import { setupTestDatabase, teardownTestDatabase, clearTestDatabase } from "@/__tests__/helpers/db-setup";
import { createMockRequest, createTestBook } from "@/__tests__/fixtures/test-data";
import type { NextRequest } from "next/server";

/**
 * Reading Goals Monthly API Tests - /api/reading-goals/monthly
 * 
 * Tests the monthly breakdown endpoint for:
 * - GET: Retrieving monthly breakdown of books completed for a specific year
 * 
 * Coverage:
 * - Success cases (200)
 * - Error cases (400, 500)
 * - Input validation
 * - Monthly data aggregation
 * - Goal data inclusion
 */

describe("Reading Goals Monthly API - GET /api/reading-goals/monthly", () => {
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
    test("returns 200 with monthly breakdown for valid year", async () => {
      const request = createMockRequest("GET", "/api/reading-goals/monthly?year=2024");
      const response = await GET(request as NextRequest);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data).toHaveProperty("year");
      expect(data.data).toHaveProperty("goal");
      expect(data.data).toHaveProperty("monthlyData");
      expect(data.data.year).toBe(2024);
      expect(Array.isArray(data.data.monthlyData)).toBe(true);
    });

    test("returns monthly data with completed books", async () => {
      // Create a goal for 2024
      await readingGoalRepository.create({ userId: null, year: 2024, booksGoal: 50 });

      // Create books completed in different months of 2024
      const book1 = await bookRepository.create(createTestBook({
        calibreId: 1,
        title: "January Book",
        path: "Book1",
        orphaned: false,
      }));
      await sessionRepository.create({
        bookId: book1.id,
        sessionNumber: 1,
        status: "read",
        startedDate: new Date("2024-01-05"),
        completedDate: new Date("2024-01-15"),
        isActive: false,
        userId: null,
      });

      const book2 = await bookRepository.create(createTestBook({
        calibreId: 2,
        title: "January Book 2",
        path: "Book2",
        orphaned: false,
      }));
      await sessionRepository.create({
        bookId: book2.id,
        sessionNumber: 1,
        status: "read",
        startedDate: new Date("2024-01-20"),
        completedDate: new Date("2024-01-25"),
        isActive: false,
        userId: null,
      });

      const book3 = await bookRepository.create(createTestBook({
        calibreId: 3,
        title: "February Book",
        path: "Book3",
        orphaned: false,
      }));
      await sessionRepository.create({
        bookId: book3.id,
        sessionNumber: 1,
        status: "read",
        startedDate: new Date("2024-02-10"),
        completedDate: new Date("2024-02-15"),
        isActive: false,
        userId: null,
      });

      const request = createMockRequest("GET", "/api/reading-goals/monthly?year=2024");
      const response = await GET(request as NextRequest);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.year).toBe(2024);
      expect(data.data.goal).not.toBeNull();
      expect(data.data.goal.booksGoal).toBe(50);
      
      // Check monthly data contains entries
      expect(data.data.monthlyData).toBeInstanceOf(Array);
      expect(data.data.monthlyData.length).toBeGreaterThan(0);
      
      // Verify monthly counts (month is 1-indexed: 1 = January, 2 = February, etc.)
      const januaryData = data.data.monthlyData.find((m: any) => m.month === 1);
      const februaryData = data.data.monthlyData.find((m: any) => m.month === 2);
      
      expect(januaryData).toBeDefined();
      expect(januaryData.count).toBe(2); // 2 books completed in January
      expect(februaryData).toBeDefined();
      expect(februaryData.count).toBe(1); // 1 book completed in February
    });

    test("returns null goal when no goal exists for year", async () => {
      // Create completed books but no goal
      const book1 = await bookRepository.create(createTestBook({
        calibreId: 1,
        title: "Book Without Goal",
        path: "Book1",
        orphaned: false,
      }));
      await sessionRepository.create({
        bookId: book1.id,
        sessionNumber: 1,
        status: "read",
        startedDate: new Date("2024-01-05"),
        completedDate: new Date("2024-01-15"),
        isActive: false,
        userId: null,
      });

      const request = createMockRequest("GET", "/api/reading-goals/monthly?year=2024");
      const response = await GET(request as NextRequest);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.goal).toBeNull();
      expect(data.data.monthlyData).toBeInstanceOf(Array);
    });

    test("returns empty monthly data when no books completed", async () => {
      // Create a goal but no completed books
      await readingGoalRepository.create({ userId: null, year: 2024, booksGoal: 50 });

      const request = createMockRequest("GET", "/api/reading-goals/monthly?year=2024");
      const response = await GET(request as NextRequest);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.goal).not.toBeNull();
      expect(data.data.monthlyData).toBeInstanceOf(Array);
      // All months should have 0 count if no books completed
      expect(data.data.monthlyData.length).toBe(12);
      expect(data.data.monthlyData.every((m: any) => m.count === 0)).toBe(true);
    });

    test("only includes books completed in specified year", async () => {
      // Create books completed in different years
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
        startedDate: new Date("2023-12-01"),
        completedDate: new Date("2023-12-31"),
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
        startedDate: new Date("2024-01-01"),
        completedDate: new Date("2024-01-15"),
        isActive: false,
        userId: null,
      });

      const request = createMockRequest("GET", "/api/reading-goals/monthly?year=2024");
      const response = await GET(request as NextRequest);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      
      // Should only count the 2024 book
      const januaryData = data.data.monthlyData.find((m: any) => m.month === 1);
      expect(januaryData.count).toBe(1);
    });

    test("handles multiple books in same month", async () => {
      // Create 5 books completed in March 2024
      for (let i = 1; i <= 5; i++) {
        const book = await bookRepository.create(createTestBook({
          calibreId: i,
          title: `March Book ${i}`,
          path: `Book${i}`,
          orphaned: false,
        }));
        await sessionRepository.create({
          bookId: book.id,
          sessionNumber: 1,
          status: "read",
          startedDate: new Date(`2024-03-0${i}`),
          completedDate: new Date(`2024-03-${10 + i}`),
          isActive: false,
          userId: null,
        });
      }

      const request = createMockRequest("GET", "/api/reading-goals/monthly?year=2024");
      const response = await GET(request as NextRequest);
      const data = await response.json();

      expect(response.status).toBe(200);
      const marchData = data.data.monthlyData.find((m: any) => m.month === 3);
      expect(marchData).toBeDefined();
      expect(marchData.count).toBe(5);
    });
  });

  describe("GET - Validation errors", () => {
    test("returns 400 when year parameter is missing", async () => {
      const request = createMockRequest("GET", "/api/reading-goals/monthly");
      const response = await GET(request as NextRequest);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error.code).toBe("MISSING_PARAMETER");
      expect(data.error.message).toContain("year parameter is required");
    });

    test("returns 400 for invalid year parameter", async () => {
      const request = createMockRequest("GET", "/api/reading-goals/monthly?year=invalid");
      const response = await GET(request as NextRequest);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error.code).toBe("INVALID_YEAR");
      expect(data.error.message).toContain("Year must be a valid number");
    });

    test("returns 400 for non-numeric year", async () => {
      const request = createMockRequest("GET", "/api/reading-goals/monthly?year=abc");
      const response = await GET(request as NextRequest);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error.code).toBe("INVALID_YEAR");
    });

    test("returns 400 for year outside valid range (too low)", async () => {
      const request = createMockRequest("GET", "/api/reading-goals/monthly?year=1800");
      const response = await GET(request as NextRequest);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error.code).toBe("INVALID_INPUT");
      expect(data.error.message).toContain("between");
    });

    test("returns 400 for year outside valid range (too high)", async () => {
      const request = createMockRequest("GET", "/api/reading-goals/monthly?year=10000");
      const response = await GET(request as NextRequest);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error.code).toBe("INVALID_INPUT");
      expect(data.error.message).toContain("between");
    });

    test("returns 400 for empty year parameter", async () => {
      const request = createMockRequest("GET", "/api/reading-goals/monthly?year=");
      const response = await GET(request as NextRequest);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error.code).toBe("MISSING_PARAMETER");
    });
  });

  describe("GET - Edge cases", () => {
    test("handles leap year correctly", async () => {
      // 2024 is a leap year
      const request = createMockRequest("GET", "/api/reading-goals/monthly?year=2024");
      const response = await GET(request as NextRequest);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.year).toBe(2024);
      expect(data.data.monthlyData).toHaveLength(12);
    });

    test("handles non-leap year correctly", async () => {
      // 2023 is not a leap year
      const request = createMockRequest("GET", "/api/reading-goals/monthly?year=2023");
      const response = await GET(request as NextRequest);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.year).toBe(2023);
      expect(data.data.monthlyData).toHaveLength(12);
    });

    test("handles current year", async () => {
      const currentYear = new Date().getFullYear();
      const request = createMockRequest("GET", `/api/reading-goals/monthly?year=${currentYear}`);
      const response = await GET(request as NextRequest);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.year).toBe(currentYear);
      expect(data.data.monthlyData).toHaveLength(12);
    });
  });

  describe("GET - Error handling", () => {
    test("returns 500 on internal error", async () => {
      // Mock the service to throw an unexpected error
      const originalGetMonthlyBreakdown = readingGoalRepository.getBooksCompletedByMonth;
      readingGoalRepository.getBooksCompletedByMonth = vi.fn(() => {
        throw new Error("Database connection failed");
      });

      const request = createMockRequest("GET", "/api/reading-goals/monthly?year=2024");
      const response = await GET(request as NextRequest);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.error.code).toBe("INTERNAL_ERROR");
      expect(data.error.message).toContain("unexpected error");

      // Restore original function
      readingGoalRepository.getBooksCompletedByMonth = originalGetMonthlyBreakdown;
    });
  });
});
