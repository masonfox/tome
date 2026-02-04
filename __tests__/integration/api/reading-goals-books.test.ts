import { toSessionDate } from '../../test-utils';
import { describe, test, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { bookRepository, sessionRepository } from "@/lib/repositories";
import { GET as GET_BOOKS } from "@/app/api/reading-goals/books/route";
import { createMockRequest } from "../../fixtures/test-data";
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

describe("Integration: Reading Goals Books API", () => {
  describe("GET /api/reading-goals/books - Parameter Validation", () => {
    test("should return 400 when year parameter is missing", async () => {
      const request = createMockRequest("GET", "/api/reading-goals/books") as any;
      const response = await GET_BOOKS(request);
      
      expect(response.status).toBe(400);
      
      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.error.code).toBe("MISSING_YEAR");
      expect(data.error.message).toContain("Year parameter is required");
    });

    test("should return 400 for invalid year format (non-numeric)", async () => {
      const request = createMockRequest("GET", "/api/reading-goals/books?year=abc") as any;
      const response = await GET_BOOKS(request);
      
      expect(response.status).toBe(400);
      
      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.error.code).toBe("INVALID_YEAR");
      expect(data.error.message).toContain("valid number");
    });

    test("should return 400 for year < 1900", async () => {
      const request = createMockRequest("GET", "/api/reading-goals/books?year=1899") as any;
      const response = await GET_BOOKS(request);
      
      expect(response.status).toBe(400);
      
      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.error.code).toBe("INVALID_YEAR");
      expect(data.error.message).toContain("between 1900 and 2100");
    });

    test("should return 400 for year > 2100", async () => {
      const request = createMockRequest("GET", "/api/reading-goals/books?year=2101") as any;
      const response = await GET_BOOKS(request);
      
      expect(response.status).toBe(400);
      
      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.error.code).toBe("INVALID_YEAR");
      expect(data.error.message).toContain("between 1900 and 2100");
    });

    test("should accept year at lower boundary (1900)", async () => {
      const request = createMockRequest("GET", "/api/reading-goals/books?year=1900") as any;
      const response = await GET_BOOKS(request);
      
      expect(response.status).toBe(200);
      
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.data.year).toBe(1900);
    });

    test("should accept year at upper boundary (2100)", async () => {
      const request = createMockRequest("GET", "/api/reading-goals/books?year=2100") as any;
      const response = await GET_BOOKS(request);
      
      expect(response.status).toBe(200);
      
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.data.year).toBe(2100);
    });
  });

  describe("GET /api/reading-goals/books - Data Retrieval", () => {
    test("should return empty array when no books completed", async () => {
      const request = createMockRequest("GET", "/api/reading-goals/books?year=2025") as any;
      const response = await GET_BOOKS(request);
      
      expect(response.status).toBe(200);
      
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.data.year).toBe(2025);
      expect(data.data.count).toBe(0);
      expect(data.data.books).toEqual([]);
    });

    test("should return books completed in specified year", async () => {
      const year = 2025;
      
      // Create books completed in 2025
      for (let i = 0; i < 3; i++) {
        const book = await bookRepository.create({
          calibreId: i + 1,
          path: `test/path/${i}`,
          title: `2025 Book ${i}`,
          authors: ["Test Author"],
          totalPages: 300,
        });
        
        await sessionRepository.create({
          bookId: book.id,
          sessionNumber: 1,
          status: "read",
          startedDate: toSessionDate(new Date(year, 0, 1)),
          completedDate: toSessionDate(new Date(year, 6, 15 + i)), // July 2025
          isActive: false,
        });
      }
      
      const request = createMockRequest("GET", `/api/reading-goals/books?year=${year}`) as any;
      const response = await GET_BOOKS(request);
      
      expect(response.status).toBe(200);
      
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.data.year).toBe(year);
      expect(data.data.count).toBe(3);
      expect(data.data.books).toHaveLength(3);
      
      // Verify all books are from 2025
      data.data.books.forEach((book: any) => {
        expect(book.title).toContain("2025");
        expect(book.completedDate).toBeDefined();
      });
    });

    test("should return correct book count matching array length", async () => {
      const year = 2024;
      
      // Create 5 books completed in 2024
      for (let i = 0; i < 5; i++) {
        const book = await bookRepository.create({
          calibreId: i + 1,
          path: `test/path/${i}`,
          title: `2024 Book ${i}`,
          authors: ["Test Author"],
          totalPages: 300,
        });
        
        await sessionRepository.create({
          bookId: book.id,
          sessionNumber: 1,
          status: "read",
          startedDate: toSessionDate(new Date(year, 0, 1)),
          completedDate: toSessionDate(new Date(year, 3, 10 + i)), // April 2024
          isActive: false,
        });
      }
      
      const request = createMockRequest("GET", `/api/reading-goals/books?year=${year}`) as any;
      const response = await GET_BOOKS(request);
      
      expect(response.status).toBe(200);
      
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.data.count).toBe(5);
      expect(data.data.books).toHaveLength(5);
      expect(data.data.count).toBe(data.data.books.length);
    });

    test("should include completion dates in response", async () => {
      const year = 2025;
      const completedDate = toSessionDate(new Date(year, 5, 20)); // June 20, 2025
      
      const book = await bookRepository.create({
        calibreId: 1,
        path: "test/path/1",
        title: "Test Book",
        authors: ["Test Author"],
        totalPages: 300,
      });
      
      await sessionRepository.create({
        bookId: book.id,
        sessionNumber: 1,
        status: "read",
        startedDate: toSessionDate(new Date(year, 5, 1)),
        completedDate,
        isActive: false,
      });
      
      const request = createMockRequest("GET", `/api/reading-goals/books?year=${year}`) as any;
      const response = await GET_BOOKS(request);
      
      expect(response.status).toBe(200);
      
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.data.books).toHaveLength(1);
      expect(data.data.books[0].completedDate).toBeDefined();
      expect(data.data.books[0].completedDate).not.toBeNull();
    });

    test("should order books by completion date descending", async () => {
      const year = 2025;
      
      // Create books with different completion dates
      const dates = [
        new Date(year, 0, 15),  // January
        new Date(year, 5, 10),  // June
        new Date(year, 2, 20),  // March
        new Date(year, 10, 5),  // November
      ];
      
      for (let i = 0; i < dates.length; i++) {
        const book = await bookRepository.create({
          calibreId: i + 1,
          path: `test/path/${i}`,
          title: `Book ${i}`,
          authors: ["Test Author"],
          totalPages: 300,
        });
        
        await sessionRepository.create({
          bookId: book.id,
          sessionNumber: 1,
          status: "read",
          startedDate: toSessionDate(new Date(year, 0, 1)),
          completedDate: toSessionDate(dates[i]),
          isActive: false,
        });
      }
      
      const request = createMockRequest("GET", `/api/reading-goals/books?year=${year}`) as any;
      const response = await GET_BOOKS(request);
      
      expect(response.status).toBe(200);
      
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.data.books).toHaveLength(4);
      
      // Verify descending order (most recent first)
      const completionTimes = data.data.books.map((book: any) => 
        new Date(book.completedDate).getTime()
      );
      
      for (let i = 0; i < completionTimes.length - 1; i++) {
        expect(completionTimes[i]).toBeGreaterThanOrEqual(completionTimes[i + 1]);
      }
    });

    test("should not include books from other years", async () => {
      const targetYear = 2025;
      
      // Create book completed in target year
      const book2025 = await bookRepository.create({
        calibreId: 1,
        path: "test/path/1",
        title: "2025 Book",
        authors: ["Test Author"],
        totalPages: 300,
      });
      
      await sessionRepository.create({
        bookId: book2025.id,
        sessionNumber: 1,
        status: "read",
        startedDate: toSessionDate(new Date(targetYear, 0, 1)),
        completedDate: toSessionDate(new Date(targetYear, 6, 15)),
        isActive: false,
      });
      
      // Create books completed in other years
      const book2024 = await bookRepository.create({
        calibreId: 2,
        path: "test/path/2",
        title: "2024 Book",
        authors: ["Test Author"],
        totalPages: 300,
      });
      
      await sessionRepository.create({
        bookId: book2024.id,
        sessionNumber: 1,
        status: "read",
        startedDate: toSessionDate(new Date(2024, 0, 1)),
        completedDate: toSessionDate(new Date(2024, 6, 15)),
        isActive: false,
      });
      
      const book2026 = await bookRepository.create({
        calibreId: 3,
        path: "test/path/3",
        title: "2026 Book",
        authors: ["Test Author"],
        totalPages: 300,
      });
      
      await sessionRepository.create({
        bookId: book2026.id,
        sessionNumber: 1,
        status: "read",
        startedDate: toSessionDate(new Date(2026, 0, 1)),
        completedDate: toSessionDate(new Date(2026, 6, 15)),
        isActive: false,
      });
      
      const request = createMockRequest("GET", `/api/reading-goals/books?year=${targetYear}`) as any;
      const response = await GET_BOOKS(request);
      
      expect(response.status).toBe(200);
      
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.data.count).toBe(1);
      expect(data.data.books).toHaveLength(1);
      expect(data.data.books[0].title).toBe("2025 Book");
    });

    test("should handle books with multiple completion sessions in same year", async () => {
      const year = 2025;
      
      // Create a book that was read twice in 2025 (re-read)
      const book = await bookRepository.create({
        calibreId: 1,
        path: "test/path/1",
        title: "Re-read Book",
        authors: ["Test Author"],
        totalPages: 300,
      });
      
      // First read in January
      await sessionRepository.create({
        bookId: book.id,
        sessionNumber: 1,
        status: "read",
        startedDate: toSessionDate(new Date(year, 0, 1)),
        completedDate: toSessionDate(new Date(year, 0, 15)),
        isActive: false,
      });
      
      // Second read (re-read) in July
      await sessionRepository.create({
        bookId: book.id,
        sessionNumber: 2,
        status: "read",
        startedDate: toSessionDate(new Date(year, 6, 1)),
        completedDate: toSessionDate(new Date(year, 6, 15)),
        isActive: false,
      });
      
      const request = createMockRequest("GET", `/api/reading-goals/books?year=${year}`) as any;
      const response = await GET_BOOKS(request);
      
      expect(response.status).toBe(200);
      
      const data = await response.json();
      expect(data.success).toBe(true);
      // Should count both sessions as separate completions
      expect(data.data.count).toBe(2);
      expect(data.data.books).toHaveLength(2);
      
      // Both should be the same book
      expect(data.data.books[0].title).toBe("Re-read Book");
      expect(data.data.books[1].title).toBe("Re-read Book");
      
      // Should be ordered by completion date descending (July then January)
      const date1 = new Date(data.data.books[0].completedDate).getTime();
      const date2 = new Date(data.data.books[1].completedDate).getTime();
      expect(date1).toBeGreaterThan(date2);
    });

    test("should only include completed books (not in-progress)", async () => {
      const year = 2025;
      
      // Create completed book
      const completedBook = await bookRepository.create({
        calibreId: 1,
        path: "test/path/1",
        title: "Completed Book",
        authors: ["Test Author"],
        totalPages: 300,
      });
      
      await sessionRepository.create({
        bookId: completedBook.id,
        sessionNumber: 1,
        status: "read",
        startedDate: toSessionDate(new Date(year, 0, 1)),
        completedDate: toSessionDate(new Date(year, 6, 15)),
        isActive: false,
      });
      
      // Create in-progress book (no completion date)
      const inProgressBook = await bookRepository.create({
        calibreId: 2,
        path: "test/path/2",
        title: "In Progress Book",
        authors: ["Test Author"],
        totalPages: 300,
      });
      
      await sessionRepository.create({
        bookId: inProgressBook.id,
        sessionNumber: 1,
        status: "reading",
        startedDate: toSessionDate(new Date(year, 6, 1)),
        completedDate: null,
        isActive: true,
      });
      
      const request = createMockRequest("GET", `/api/reading-goals/books?year=${year}`) as any;
      const response = await GET_BOOKS(request);
      
      expect(response.status).toBe(200);
      
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.data.count).toBe(1);
      expect(data.data.books).toHaveLength(1);
      expect(data.data.books[0].title).toBe("Completed Book");
    });
  });

  describe("GET /api/reading-goals/books - Response Structure", () => {
    test("should return proper response structure", async () => {
      const year = 2025;
      
      const book = await bookRepository.create({
        calibreId: 1,
        path: "test/path/1",
        title: "Test Book",
        authors: ["Test Author"],
        totalPages: 300,
      });
      
      await sessionRepository.create({
        bookId: book.id,
        sessionNumber: 1,
        status: "read",
        startedDate: toSessionDate(new Date(year, 0, 1)),
        completedDate: toSessionDate(new Date(year, 6, 15)),
        isActive: false,
      });
      
      const request = createMockRequest("GET", `/api/reading-goals/books?year=${year}`) as any;
      const response = await GET_BOOKS(request);
      
      expect(response.status).toBe(200);
      
      const data = await response.json();
      expect(data).toHaveProperty("success");
      expect(data).toHaveProperty("data");
      expect(data.success).toBe(true);
      expect(data.data).toHaveProperty("year");
      expect(data.data).toHaveProperty("count");
      expect(data.data).toHaveProperty("books");
      expect(Array.isArray(data.data.books)).toBe(true);
    });

    test("should include all book fields in response", async () => {
      const year = 2025;
      
      const book = await bookRepository.create({
        calibreId: 1,
        path: "test/path/1",
        title: "Complete Book",
        authors: ["Author One", "Author Two"],
        totalPages: 450,
        isbn: "9781234567890",
        publisher: "Test Publisher",
        series: "Test Series",
        tags: ["fiction", "fantasy"],
      });
      
      await sessionRepository.create({
        bookId: book.id,
        sessionNumber: 1,
        status: "read",
        startedDate: toSessionDate(new Date(year, 0, 1)),
        completedDate: toSessionDate(new Date(year, 6, 15)),
        isActive: false,
      });
      
      const request = createMockRequest("GET", `/api/reading-goals/books?year=${year}`) as any;
      const response = await GET_BOOKS(request);
      
      expect(response.status).toBe(200);
      
      const data = await response.json();
      expect(data.data.books).toHaveLength(1);
      
      const returnedBook = data.data.books[0];
      expect(returnedBook).toHaveProperty("id");
      expect(returnedBook).toHaveProperty("title");
      expect(returnedBook).toHaveProperty("authors");
      expect(returnedBook).toHaveProperty("totalPages");
      expect(returnedBook).toHaveProperty("completedDate");
      expect(returnedBook.title).toBe("Complete Book");
      expect(returnedBook.authors).toEqual(["Author One", "Author Two"]);
      expect(returnedBook.totalPages).toBe(450);
    });
  });
});
