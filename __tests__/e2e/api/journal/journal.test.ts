import { createProgressSequence } from '../../../test-utils';
import { describe, test, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { GET } from "@/app/api/journal/route";
import { bookRepository, progressRepository } from "@/lib/repositories";
import { journalService } from "@/lib/services/journal.service";
import { setupTestDatabase, teardownTestDatabase, clearTestDatabase } from "@/__tests__/helpers/db-setup";
import { createMockRequest, createTestBook } from "@/__tests__/fixtures/test-data";
import type { NextRequest } from "next/server";

/**
 * Journal API Tests - /api/journal
 * 
 * Tests the endpoint for retrieving journal entries:
 * - GET: Fetching paginated journal entries grouped by date and book
 * 
 * Coverage:
 * - Success cases (200)
 * - Query parameter validation (limit, skip, timezone)
 * - Pagination (limit, skip, hasMore)
 * - Empty state (no progress entries)
 * - Error handling (500)
 */

describe("Journal API - GET /api/journal", () => {
  let testBook: any;

  beforeAll(async () => {
    await setupTestDatabase(__filename);
  });

  afterAll(async () => {
    await teardownTestDatabase(__filename);
  });

  beforeEach(async () => {
    await clearTestDatabase(__filename);

    // Create a test book for progress entries
    testBook = await bookRepository.create(createTestBook({
      calibreId: 1,
      title: "Test Book",
      authors: ["Test Author"],
      totalPages: 300,
      path: "TestBook",
      orphaned: false,
    }));
  });

  describe("GET - Success cases", () => {
    test("returns 200 status code with empty entries when no progress exists", async () => {
      const request = createMockRequest("GET", "/api/journal");
      const response = await GET(request as NextRequest);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveProperty("entries");
      expect(data).toHaveProperty("total");
      expect(data).toHaveProperty("hasMore");
      expect(Array.isArray(data.entries)).toBe(true);
      expect(data.entries.length).toBe(0);
      expect(data.total).toBe(0);
      expect(data.hasMore).toBe(false);
    });

    test("returns journal entries with correct structure", async () => {
      // Create progress entries
      await progressRepository.create({
        bookId: testBook.id,
        currentPage: 50,
        currentPercentage: 16.67,
        pagesRead: 50,
        progressDate: "2024-01-15",
        notes: "Test note",
      });

      const request = createMockRequest("GET", "/api/journal");
      const response = await GET(request as NextRequest);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.entries.length).toBeGreaterThan(0);
      expect(data.total).toBe(1);
      expect(data.hasMore).toBe(false);

      // Verify entry structure
      const entry = data.entries[0];
      expect(entry).toHaveProperty("date");
      expect(entry).toHaveProperty("books");
      expect(Array.isArray(entry.books)).toBe(true);
    });

    test("groups entries by date correctly", async () => {
      // Create progress entries on the same day
      await progressRepository.create({
        bookId: testBook.id,
        currentPage: 50,
        currentPercentage: 16.67,
        pagesRead: 50,
        progressDate: "2024-01-15",
      });

      await progressRepository.create({
        bookId: testBook.id,
        currentPage: 100,
        currentPercentage: 33.33,
        pagesRead: 50,
        progressDate: "2024-01-15",
      });

      const request = createMockRequest("GET", "/api/journal");
      const response = await GET(request as NextRequest);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.entries.length).toBe(1); // Should be grouped into one date
      expect(data.total).toBe(2);
    });

    test("includes book information in entries", async () => {
      await progressRepository.create({
        bookId: testBook.id,
        currentPage: 50,
        currentPercentage: 16.67,
        pagesRead: 50,
        progressDate: "2024-01-15",
      });

      const request = createMockRequest("GET", "/api/journal");
      const response = await GET(request as NextRequest);
      const data = await response.json();

      expect(response.status).toBe(200);
      const bookEntry = data.entries[0].books[0];
      expect(bookEntry).toHaveProperty("bookId");
      expect(bookEntry).toHaveProperty("bookTitle");
      expect(bookEntry).toHaveProperty("bookAuthors");
      expect(bookEntry).toHaveProperty("entries");
    });
  });

  describe("GET - Query parameter validation", () => {
    test("defaults to limit=50 when not provided", async () => {
      const request = createMockRequest("GET", "/api/journal");
      const response = await GET(request as NextRequest);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveProperty("entries");
    });

    test("accepts valid limit parameter", async () => {
      await progressRepository.create({
        bookId: testBook.id,
        currentPage: 50,
        currentPercentage: 16.67,
        pagesRead: 50,
        progressDate: "2024-01-15",
      });

      const request = createMockRequest("GET", "/api/journal?limit=10");
      const response = await GET(request as NextRequest);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.entries.length).toBeLessThanOrEqual(10);
    });

    test("defaults to 50 for invalid limit", async () => {
      const request = createMockRequest("GET", "/api/journal?limit=invalid");
      const response = await GET(request as NextRequest);

      expect(response.status).toBe(200);
    });

    test("defaults to 50 for negative limit", async () => {
      const request = createMockRequest("GET", "/api/journal?limit=-5");
      const response = await GET(request as NextRequest);

      expect(response.status).toBe(200);
    });

    test("caps limit at 200", async () => {
      const request = createMockRequest("GET", "/api/journal?limit=500");
      const response = await GET(request as NextRequest);

      expect(response.status).toBe(200);
    });

    test("defaults to skip=0 when not provided", async () => {
      const request = createMockRequest("GET", "/api/journal");
      const response = await GET(request as NextRequest);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveProperty("entries");
    });

    test("accepts valid skip parameter", async () => {
      // Create 3 progress entries using helper
      await createProgressSequence(progressRepository, {
        bookId: testBook.id,
        startDate: "2024-01-15",
        startPage: 50,
        pageIncrement: 10,
        count: 3,
        totalPages: 300,
      });

      const request = createMockRequest("GET", "/api/journal?skip=1");
      const response = await GET(request as NextRequest);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.total).toBe(3);
      expect(data.entries.length).toBeLessThanOrEqual(2);
    });

    test("defaults to 0 for invalid skip", async () => {
      const request = createMockRequest("GET", "/api/journal?skip=invalid");
      const response = await GET(request as NextRequest);

      expect(response.status).toBe(200);
    });

    test("defaults to 0 for negative skip", async () => {
      const request = createMockRequest("GET", "/api/journal?skip=-5");
      const response = await GET(request as NextRequest);

      expect(response.status).toBe(200);
    });

    test("accepts timezone parameter", async () => {
      await progressRepository.create({
        bookId: testBook.id,
        currentPage: 50,
        currentPercentage: 16.67,
        pagesRead: 50,
        progressDate: "2024-01-15",
      });

      const request = createMockRequest("GET", "/api/journal?timezone=Asia/Tokyo");
      const response = await GET(request as NextRequest);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.entries.length).toBeGreaterThan(0);
    });

    test("defaults to America/New_York when no timezone provided", async () => {
      await progressRepository.create({
        bookId: testBook.id,
        currentPage: 50,
        currentPercentage: 16.67,
        pagesRead: 50,
        progressDate: "2024-01-15",
      });

      const request = createMockRequest("GET", "/api/journal");
      const response = await GET(request as NextRequest);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.entries.length).toBeGreaterThan(0);
    });
  });

  describe("GET - Pagination", () => {
    test("returns hasMore=false when all entries fetched", async () => {
      await progressRepository.create({
        bookId: testBook.id,
        currentPage: 50,
        currentPercentage: 16.67,
        pagesRead: 50,
        progressDate: "2024-01-15",
      });

      const request = createMockRequest("GET", "/api/journal?limit=50");
      const response = await GET(request as NextRequest);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.hasMore).toBe(false);
    });

    test("returns hasMore=true when more entries available", async () => {
      // Create 3 progress entries using helper
      await createProgressSequence(progressRepository, {
        bookId: testBook.id,
        startDate: "2024-01-15",
        startPage: 50,
        pageIncrement: 10,
        count: 3,
        totalPages: 300,
      });

      const request = createMockRequest("GET", "/api/journal?limit=1");
      const response = await GET(request as NextRequest);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.total).toBe(3);
      expect(data.hasMore).toBe(true);
    });
  });

  describe("GET - Error handling", () => {
    test("returns 500 on internal error", async () => {
      // Mock journalService to throw an error
      const originalGetJournalEntries = journalService.getJournalEntries;
      journalService.getJournalEntries = (() => {
        throw new Error("Database connection failed");
      }) as any;

      const request = createMockRequest("GET", "/api/journal");
      const response = await GET(request as NextRequest);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data).toHaveProperty("error");
      expect(data.error).toBe("Failed to fetch journal entries");

      // Restore original function
      journalService.getJournalEntries = originalGetJournalEntries;
    });
  });
});
