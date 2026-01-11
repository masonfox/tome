import { toProgressDate, createProgressSequence } from '../../test-utils';
import { describe, test, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { setupTestDatabase, teardownTestDatabase, clearTestDatabase } from "../../helpers/db-setup";
import { bookRepository, sessionRepository, progressRepository } from "@/lib/repositories";
import { GET } from "@/app/api/journal/route";
import { createMockRequest } from "../../fixtures/test-data";

/**
 * Journal API Route Tests
 * 
 * Tests the GET /api/journal endpoint:
 * - Query parameter handling (timezone, limit, skip)
 * - Default values
 * - Response format validation
 * - HTTP status codes (200, 500)
 * - Date serialization (Date objects → ISO strings)
 * - Empty results
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

describe("GET /api/journal", () => {
  describe("query parameter handling", () => {
    test("should use default values when no parameters provided", async () => {
      // Arrange: Create some progress
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

      // Act: No query params
      const request = createMockRequest("GET", "/api/journal");
      const response = await GET(request as any);
      const data = await response.json();

      // Assert: Should use defaults (timezone=America/New_York, limit=50, skip=0)
      expect(response.status).toBe(200);
      expect(data.entries).toBeDefined();
      expect(data.total).toBe(1);
      expect(data.hasMore).toBe(false);
    });

    test("should respect limit parameter", async () => {
      // Arrange: Create 10 progress entries
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

      // Create 10 progress entries using helper
      await createProgressSequence(progressRepository, {
        bookId: book.id,
        sessionId: session.id,
        startDate: "2024-11-10",
        startPage: 10,
        pageIncrement: 10,
        count: 10,
        totalPages: 100,
      });

      // Act: Request with limit=3
      const request = createMockRequest("GET", "/api/journal?limit=3");
      const response = await GET(request as any);
      const data = await response.json();

      // Assert: Should return limited results
      expect(response.status).toBe(200);
      expect(data.total).toBe(10);
      expect(data.hasMore).toBe(true);
    });

    test("should respect skip parameter", async () => {
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

      // Act: Skip first 2
      const request = createMockRequest("GET", "/api/journal?skip=2&limit=2");
      const response = await GET(request as any);
      const data = await response.json();

      // Assert: Should skip first 2 and return next 2
      expect(response.status).toBe(200);
      expect(data.total).toBe(5);
      expect(data.hasMore).toBe(true);
    });

    test("should handle timezone parameter", async () => {
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

      // Act: Request with timezone
      const request = createMockRequest("GET", "/api/journal?timezone=America/Los_Angeles");
      const response = await GET(request as any);

      // Assert: Should accept timezone parameter (currently unused but stored for future)
      expect(response.status).toBe(200);
    });

    test("should handle invalid limit gracefully", async () => {
      // Act: Invalid limit (negative)
      const request = createMockRequest("GET", "/api/journal?limit=-5");
      const response = await GET(request as any);

      // Assert: Should still work (parseInt handles this)
      expect(response.status).toBe(200);
    });
  });

  describe("response format", () => {
    test("should return correctly structured response", async () => {
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
      const request = createMockRequest("GET", "/api/journal");
      const response = await GET(request as any);
      const data = await response.json();

      // Assert: Should have correct structure
      expect(data).toHaveProperty("entries");
      expect(data).toHaveProperty("total");
      expect(data).toHaveProperty("hasMore");
      expect(Array.isArray(data.entries)).toBe(true);
      expect(typeof data.total).toBe("number");
      expect(typeof data.hasMore).toBe("boolean");
    });

    test("should serialize dates as ISO strings", async () => {
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
      const request = createMockRequest("GET", "/api/journal");
      const response = await GET(request as any);
      const data = await response.json();

      // Assert: progressDate should be serialized as string in YYYY-MM-DD format
      const firstEntry = data.entries[0].books[0].entries[0];
      expect(typeof firstEntry.progressDate).toBe("string");
      expect(firstEntry.progressDate).toMatch(/^\d{4}-\d{2}-\d{2}$/); // YYYY-MM-DD format
    });

    test("should include all required entry fields", async () => {
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
        notes: "Test note",
      });

      // Act
      const request = createMockRequest("GET", "/api/journal");
      const response = await GET(request as any);
      const data = await response.json();

      // Assert: Entry should have all required fields
      const entry = data.entries[0].books[0].entries[0];
      expect(entry).toHaveProperty("id");
      expect(entry).toHaveProperty("bookId");
      expect(entry).toHaveProperty("bookTitle");
      expect(entry).toHaveProperty("bookAuthors");
      expect(entry).toHaveProperty("bookCalibreId");
      expect(entry).toHaveProperty("sessionId");
      expect(entry).toHaveProperty("currentPage");
      expect(entry).toHaveProperty("currentPercentage");
      expect(entry).toHaveProperty("progressDate");
      expect(entry).toHaveProperty("notes");
      expect(entry).toHaveProperty("pagesRead");
    });

    test("should include grouped structure (date → books → entries)", async () => {
      // Arrange: Create progress for 2 books on same date
      const book1 = await bookRepository.create({
        calibreId: 1,
        title: "Book 1",
        authors: ["Author 1"],
        tags: [],
        path: "Author 1/Book 1 (1)",
      });

      const book2 = await bookRepository.create({
        calibreId: 2,
        title: "Book 2",
        authors: ["Author 2"],
        tags: [],
        path: "Author 2/Book 2 (2)",
      });

      const session1 = await sessionRepository.create({
        bookId: book1.id,
        sessionNumber: 1,
        status: "reading",
        isActive: true,
      });

      const session2 = await sessionRepository.create({
        bookId: book2.id,
        sessionNumber: 1,
        status: "reading",
        isActive: true,
      });

      await progressRepository.create({
        bookId: book1.id,
        sessionId: session1.id,
        currentPage: 50,
        currentPercentage: 50,
        pagesRead: 50,
        progressDate: "2024-11-15",
      });

      await progressRepository.create({
        bookId: book2.id,
        sessionId: session2.id,
        currentPage: 75,
        currentPercentage: 75,
        pagesRead: 75,
        progressDate: "2024-11-15",
      });

      // Act
      const request = createMockRequest("GET", "/api/journal");
      const response = await GET(request as any);
      const data = await response.json();

      // Assert: Should have nested structure
      expect(data.entries).toHaveLength(1); // 1 date
      expect(data.entries[0]).toHaveProperty("date");
      expect(data.entries[0]).toHaveProperty("books");
      expect(data.entries[0].books).toHaveLength(2); // 2 books
      expect(data.entries[0].books[0]).toHaveProperty("bookId");
      expect(data.entries[0].books[0]).toHaveProperty("bookTitle");
      expect(data.entries[0].books[0]).toHaveProperty("entries");
    });
  });

  describe("empty results", () => {
    test("should return empty array when no progress logs exist", async () => {
      // Act: No data in database
      const request = createMockRequest("GET", "/api/journal");
      const response = await GET(request as any);
      const data = await response.json();

      // Assert
      expect(response.status).toBe(200);
      expect(data.entries).toHaveLength(0);
      expect(data.total).toBe(0);
      expect(data.hasMore).toBe(false);
    });

    test("should handle skip beyond total gracefully", async () => {
      // Arrange: Create 3 entries
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

      // Create 3 progress entries using helper
      await createProgressSequence(progressRepository, {
        bookId: book.id,
        sessionId: session.id,
        startDate: "2024-11-10",
        startPage: 30,
        pageIncrement: 30,
        count: 3,
        totalPages: 100,
      });

      // Act: Skip beyond total
      const request = createMockRequest("GET", "/api/journal?skip=10");
      const response = await GET(request as any);
      const data = await response.json();

      // Assert: Should return empty with correct metadata
      expect(response.status).toBe(200);
      expect(data.entries).toHaveLength(0);
      expect(data.total).toBe(3);
      expect(data.hasMore).toBe(false);
    });
  });

  describe("HTTP status codes", () => {
    test("should return 200 for successful request", async () => {
      // Act
      const request = createMockRequest("GET", "/api/journal");
      const response = await GET(request as any);

      // Assert
      expect(response.status).toBe(200);
    });

    test("should return 200 even with no data", async () => {
      // Act: Empty database
      const request = createMockRequest("GET", "/api/journal");
      const response = await GET(request as any);

      // Assert: Empty results are not an error
      expect(response.status).toBe(200);
    });
  });

  describe("pagination edge cases", () => {
    test("should handle limit=0", async () => {
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

      // Act: limit=0 (should default to 50)
      const request = createMockRequest("GET", "/api/journal?limit=0");
      const response = await GET(request as any);
      const data = await response.json();

      // Assert: Should default to limit=50 (invalid limit should be corrected)
      expect(response.status).toBe(200);
      expect(data.entries).toHaveLength(1); // Returns all available entries (up to default limit)
      expect(data.total).toBe(1);
    });

    test("should handle limit=1", async () => {
      // Arrange: Create 5 entries
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

      await createProgressSequence(progressRepository, {
        bookId: book.id,
        sessionId: session.id,
        startDate: "2024-11-10",
        startPage: 20,
        pageIncrement: 20,
        count: 5,
      });

      // Act: limit=1
      const request = createMockRequest("GET", "/api/journal?limit=1");
      const response = await GET(request as any);
      const data = await response.json();

      // Assert: Should return 1 entry
      expect(response.status).toBe(200);
      expect(data.total).toBe(5);
      expect(data.hasMore).toBe(true);
    });

    test("should handle limit > total", async () => {
      // Arrange: Create 3 entries
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

      await createProgressSequence(progressRepository, {
        bookId: book.id,
        sessionId: session.id,
        startDate: "2024-11-10",
        startPage: 30,
        pageIncrement: 30,
        count: 3,
      });

      // Act: limit=100 (more than total)
      const request = createMockRequest("GET", "/api/journal?limit=100");
      const response = await GET(request as any);
      const data = await response.json();

      // Assert: Should return all entries
      expect(response.status).toBe(200);
      expect(data.total).toBe(3);
      expect(data.hasMore).toBe(false);
    });
  });

  describe("date handling", () => {
    test("should handle dates at midnight boundary", async () => {
      // Arrange: Create progress just before and after midnight
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

      // 23:59:59 on Nov 15 EST = Nov 16 04:59:59 UTC
      await progressRepository.create({
        bookId: book.id,
        sessionId: session.id,
        currentPage: 50,
        currentPercentage: 50,
        pagesRead: 50,
        progressDate: "2024-11-15",
      });

      // 00:00:01 on Nov 16 EST = Nov 16 05:00:01 UTC
      await progressRepository.create({
        bookId: book.id,
        sessionId: session.id,
        currentPage: 75,
        currentPercentage: 75,
        pagesRead: 25,
        progressDate: "2024-11-16",
      });

      // Act
      const request = createMockRequest("GET", "/api/journal");
      const response = await GET(request as any);
      const data = await response.json();

      // Assert: Should be grouped into separate dates
      expect(response.status).toBe(200);
      expect(data.entries).toHaveLength(2);
      expect(data.entries[0].date).toBe("2024-11-16");
      expect(data.entries[1].date).toBe("2024-11-15");
    });
  });
});
