import { createProgressSequence } from '../../../test-utils';
import { describe, test, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { setupTestDatabase, teardownTestDatabase, clearTestDatabase } from "../../../helpers/db-setup";
import { bookRepository, sessionRepository, progressRepository } from "@/lib/repositories";
import { GET } from "@/app/api/journal/archive/route";
import { createMockRequest } from "../../../fixtures/test-data";

/**
 * Journal Archive API Route Tests
 * 
 * Tests the GET /api/journal/archive endpoint:
 * - Returns year/month/week hierarchy
 * - Correct counts at all levels
 * - Descending sort order
 * - Empty results handling
 * - HTTP status codes
 */

beforeAll(async () => {
  await setupTestDatabase(__filename);
});

afterAll(async () => {
  await teardownTestDatabase(__filename);
});

beforeEach(async () => {
  await clearTestDatabase(__filename);
});

describe("GET /api/journal/archive", () => {
  describe("hierarchy structure", () => {
    test("should return year/month/week hierarchy", async () => {
      // Arrange: Create progress in November
      const book = await bookRepository.create({
        calibreId: 1,
        title: "Test Book",
        authors: ["Test Author"],
        tags: [],
        path: "Test Author/Test Book (1)",
      });

      const session = await sessionRepository.create({
        bookId: book.id,
        sessionNumber: 1,
        status: "reading",
        isActive: true,
      });

      await progressRepository.create({
        bookId: book.id,
        sessionId: session.id,
        currentPage: 50,
        currentPercentage: 50,
        pagesRead: 50,
        progressDate: "2024-11-15",
      });

      // Act
      const response = await GET(createMockRequest("GET", "/api/journal/archive") as any);
      const data = await response.json();

      // Assert: Should have hierarchy structure
      expect(response.status).toBe(200);
      expect(Array.isArray(data)).toBe(true);
      expect(data).toHaveLength(1); // 1 year
      expect(data[0].type).toBe("year");
      expect(data[0].children).toBeDefined();
      expect(data[0].children.length).toBeGreaterThan(0);
      expect(data[0].children[0].type).toBe("month");
      expect(data[0].children[0].children).toBeDefined();
      expect(data[0].children[0].children[0].type).toBe("week");
    });

    test("should include all required node properties", async () => {
      // Arrange: Create progress
      const book = await bookRepository.create({
        calibreId: 1,
        title: "Test Book",
        authors: ["Test Author"],
        tags: [],
        path: "Test Author/Test Book (1)",
      });

      const session = await sessionRepository.create({
        bookId: book.id,
        sessionNumber: 1,
        status: "reading",
        isActive: true,
      });

      await progressRepository.create({
        bookId: book.id,
        sessionId: session.id,
        currentPage: 50,
        currentPercentage: 50,
        pagesRead: 50,
        progressDate: "2024-11-15",
      });

      // Act
      const response = await GET(createMockRequest("GET", "/api/journal/archive") as any);
      const data = await response.json();

      // Assert: Year node should have all properties
      const yearNode = data[0];
      expect(yearNode).toHaveProperty("id");
      expect(yearNode).toHaveProperty("type");
      expect(yearNode).toHaveProperty("label");
      expect(yearNode).toHaveProperty("dateKey");
      expect(yearNode).toHaveProperty("startDate");
      expect(yearNode).toHaveProperty("endDate");
      expect(yearNode).toHaveProperty("count");
      expect(yearNode).toHaveProperty("children");

      // Month node should have same properties
      const monthNode = yearNode.children[0];
      expect(monthNode).toHaveProperty("id");
      expect(monthNode).toHaveProperty("type");
      expect(monthNode).toHaveProperty("label");
      expect(monthNode).toHaveProperty("dateKey");
      expect(monthNode).toHaveProperty("startDate");
      expect(monthNode).toHaveProperty("endDate");
      expect(monthNode).toHaveProperty("count");
      expect(monthNode).toHaveProperty("children");

      // Week node should have same properties (except children)
      const weekNode = monthNode.children[0];
      expect(weekNode).toHaveProperty("id");
      expect(weekNode).toHaveProperty("type");
      expect(weekNode).toHaveProperty("label");
      expect(weekNode).toHaveProperty("dateKey");
      expect(weekNode).toHaveProperty("startDate");
      expect(weekNode).toHaveProperty("endDate");
      expect(weekNode).toHaveProperty("count");
    });
  });

  describe("counts", () => {
    test("should aggregate counts correctly at year level", async () => {
      // Arrange: Create 5 progress entries
      const book = await bookRepository.create({
        calibreId: 1,
        title: "Test Book",
        authors: ["Test Author"],
        tags: [],
        path: "Test Author/Test Book (1)",
      });

      const session = await sessionRepository.create({
        bookId: book.id,
        sessionNumber: 1,
        status: "reading",
        isActive: true,
      });

      // Create 5 progress entries using helper
      await createProgressSequence(progressRepository, {
        bookId: book.id,
        sessionId: session.id,
        startDate: "2024-11-10",
        startPage: 20,
        pageIncrement: 20,
        count: 5,
        totalPages: 100,
      });

      // Act
      const response = await GET(createMockRequest("GET", "/api/journal/archive") as any);
      const data = await response.json();

      // Assert: Year count should be 5
      expect(data[0].count).toBe(5);
    });

    test("should aggregate counts correctly at month level", async () => {
      // Arrange: Create 3 entries in November, 2 in December
      const book = await bookRepository.create({
        calibreId: 1,
        title: "Test Book",
        authors: ["Test Author"],
        tags: [],
        path: "Test Author/Test Book (1)",
      });

      const session = await sessionRepository.create({
        bookId: book.id,
        sessionNumber: 1,
        status: "reading",
        isActive: true,
      });

      // November entries (3 entries)
      await createProgressSequence(progressRepository, {
        bookId: book.id,
        sessionId: session.id,
        startDate: "2024-11-10",
        startPage: 20,
        pageIncrement: 20,
        count: 3,
        totalPages: 100,
      });

      // December entries (2 entries)
      await createProgressSequence(progressRepository, {
        bookId: book.id,
        sessionId: session.id,
        startDate: "2024-12-10",
        startPage: 80,
        pageIncrement: 20,
        count: 2,
        totalPages: 100,
      });

      // Act
      const response = await GET(createMockRequest("GET", "/api/journal/archive") as any);
      const data = await response.json();

      // Assert: Year should have 5, months should have 3 and 2
      expect(data[0].count).toBe(5);
      expect(data[0].children[0].count).toBe(2); // December (sorted first)
      expect(data[0].children[1].count).toBe(3); // November
    });
  });

  describe("sorting", () => {
    test("should sort years in descending order", async () => {
      // Arrange: Create entries in 2023 and 2024
      const book = await bookRepository.create({
        calibreId: 1,
        title: "Test Book",
        authors: ["Test Author"],
        tags: [],
        path: "Test Author/Test Book (1)",
      });

      const session = await sessionRepository.create({
        bookId: book.id,
        sessionNumber: 1,
        status: "reading",
        isActive: true,
      });

      await progressRepository.create({
        bookId: book.id,
        sessionId: session.id,
        currentPage: 50,
        currentPercentage: 50,
        pagesRead: 50,
        progressDate: "2023-06-15",
      });

      await progressRepository.create({
        bookId: book.id,
        sessionId: session.id,
        currentPage: 100,
        currentPercentage: 100,
        pagesRead: 50,
        progressDate: "2024-06-15",
      });

      // Act
      const response = await GET(createMockRequest("GET", "/api/journal/archive") as any);
      const data = await response.json();

      // Assert: 2024 should come before 2023
      expect(data[0].label).toBe("2024");
      expect(data[1].label).toBe("2023");
    });

    test("should sort months in descending order", async () => {
      // Arrange: Create entries in Jan, Mar, Nov
      const book = await bookRepository.create({
        calibreId: 1,
        title: "Test Book",
        authors: ["Test Author"],
        tags: [],
        path: "Test Author/Test Book (1)",
      });

      const session = await sessionRepository.create({
        bookId: book.id,
        sessionNumber: 1,
        status: "reading",
        isActive: true,
      });

      await progressRepository.create({
        bookId: book.id,
        sessionId: session.id,
        currentPage: 33,
        currentPercentage: 33,
        pagesRead: 33,
        progressDate: "2024-01-15",
      });

      await progressRepository.create({
        bookId: book.id,
        sessionId: session.id,
        currentPage: 66,
        currentPercentage: 66,
        pagesRead: 33,
        progressDate: "2024-03-15",
      });

      await progressRepository.create({
        bookId: book.id,
        sessionId: session.id,
        currentPage: 100,
        currentPercentage: 100,
        pagesRead: 34,
        progressDate: "2024-11-15",
      });

      // Act
      const response = await GET(createMockRequest("GET", "/api/journal/archive") as any);
      const data = await response.json();

      // Assert: Nov, Mar, Jan
      const months = data[0].children;
      expect(months[0].dateKey).toBe("2024-11");
      expect(months[1].dateKey).toBe("2024-03");
      expect(months[2].dateKey).toBe("2024-01");
    });

    test("should sort weeks in descending order", async () => {
      // Arrange: Create entries in weeks 1, 3, 5
      const book = await bookRepository.create({
        calibreId: 1,
        title: "Test Book",
        authors: ["Test Author"],
        tags: [],
        path: "Test Author/Test Book (1)",
      });

      const session = await sessionRepository.create({
        bookId: book.id,
        sessionNumber: 1,
        status: "reading",
        isActive: true,
      });

      await progressRepository.create({
        bookId: book.id,
        sessionId: session.id,
        currentPage: 33,
        currentPercentage: 33,
        pagesRead: 33,
        progressDate: "2024-11-01", // W1
      });

      await progressRepository.create({
        bookId: book.id,
        sessionId: session.id,
        currentPage: 66,
        currentPercentage: 66,
        pagesRead: 33,
        progressDate: "2024-11-15", // W3
      });

      await progressRepository.create({
        bookId: book.id,
        sessionId: session.id,
        currentPage: 100,
        currentPercentage: 100,
        pagesRead: 34,
        progressDate: "2024-11-29", // W5
      });

      // Act
      const response = await GET(createMockRequest("GET", "/api/journal/archive") as any);
      const data = await response.json();

      // Assert: W5, W3, W1
      const weeks = data[0].children[0].children;
      expect(weeks[0].dateKey).toBe("2024-11-W5");
      expect(weeks[1].dateKey).toBe("2024-11-W3");
      expect(weeks[2].dateKey).toBe("2024-11-W1");
    });
  });

  describe("empty results", () => {
    test("should return empty array when no progress logs exist", async () => {
      // Act: No data in database
      const response = await GET(createMockRequest("GET", "/api/journal/archive") as any);
      const data = await response.json();

      // Assert
      expect(response.status).toBe(200);
      expect(Array.isArray(data)).toBe(true);
      expect(data).toHaveLength(0);
    });
  });

  describe("HTTP status codes", () => {
    test("should return 200 for successful request", async () => {
      // Arrange: Create some data
      const book = await bookRepository.create({
        calibreId: 1,
        title: "Test Book",
        authors: ["Test Author"],
        tags: [],
        path: "Test Author/Test Book (1)",
      });

      const session = await sessionRepository.create({
        bookId: book.id,
        sessionNumber: 1,
        status: "reading",
        isActive: true,
      });

      await progressRepository.create({
        bookId: book.id,
        sessionId: session.id,
        currentPage: 50,
        currentPercentage: 50,
        pagesRead: 50,
        progressDate: "2024-11-15",
      });

      // Act
      const response = await GET(createMockRequest("GET", "/api/journal/archive") as any);

      // Assert
      expect(response.status).toBe(200);
    });

    test("should return 200 even with no data", async () => {
      // Act: Empty database
      const response = await GET(createMockRequest("GET", "/api/journal/archive") as any);

      // Assert: Empty results are not an error
      expect(response.status).toBe(200);
    });
  });

  describe("date boundary handling", () => {
    test("should handle entries spanning multiple years", async () => {
      // Arrange: Create entries in 2023 and 2024
      const book = await bookRepository.create({
        calibreId: 1,
        title: "Test Book",
        authors: ["Test Author"],
        tags: [],
        path: "Test Author/Test Book (1)",
      });

      const session = await sessionRepository.create({
        bookId: book.id,
        sessionNumber: 1,
        status: "reading",
        isActive: true,
      });

      await progressRepository.create({
        bookId: book.id,
        sessionId: session.id,
        currentPage: 50,
        currentPercentage: 50,
        pagesRead: 50,
        progressDate: "2023-12-31",
      });

      await progressRepository.create({
        bookId: book.id,
        sessionId: session.id,
        currentPage: 100,
        currentPercentage: 100,
        pagesRead: 50,
        progressDate: "2024-01-01",
      });

      // Act
      const response = await GET(createMockRequest("GET", "/api/journal/archive") as any);
      const data = await response.json();

      // Assert: Should create 2 separate years
      expect(data).toHaveLength(2);
      expect(data[0].label).toBe("2024");
      expect(data[1].label).toBe("2023");
    });

    test("should handle leap year dates (Feb 29)", async () => {
      // Arrange: Create entry on Feb 29, 2024
      const book = await bookRepository.create({
        calibreId: 1,
        title: "Test Book",
        authors: ["Test Author"],
        tags: [],
        path: "Test Author/Test Book (1)",
      });

      const session = await sessionRepository.create({
        bookId: book.id,
        sessionNumber: 1,
        status: "reading",
        isActive: true,
      });

      await progressRepository.create({
        bookId: book.id,
        sessionId: session.id,
        currentPage: 50,
        currentPercentage: 50,
        pagesRead: 50,
        progressDate: "2024-02-29",
      });

      // Act
      const response = await GET(createMockRequest("GET", "/api/journal/archive") as any);
      const data = await response.json();

      // Assert: Should handle correctly
      expect(response.status).toBe(200);
      expect(data[0].children[0].label).toBe("February");
      expect(data[0].children[0].endDate).toBe("2024-02-29");
    });
  });
});
