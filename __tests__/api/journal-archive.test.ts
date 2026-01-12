import { describe, test, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { GET } from "@/app/api/journal/archive/route";
import { bookRepository, progressRepository } from "@/lib/repositories";
import { journalService } from "@/lib/services/journal.service";
import { setupTestDatabase, teardownTestDatabase, clearTestDatabase } from "@/__tests__/helpers/db-setup";
import { createMockRequest, createTestBook } from "@/__tests__/fixtures/test-data";
import type { NextRequest } from "next/server";

/**
 * Journal Archive API Tests - /api/journal/archive
 * 
 * Tests the endpoint for retrieving journal archive metadata:
 * - GET: Fetching hierarchical archive structure (years → months → weeks)
 * 
 * Coverage:
 * - Success cases (200)
 * - Timezone handling
 * - Empty state (no progress entries)
 * - Hierarchical structure validation
 * - Error handling (500)
 */

describe("Journal Archive API - GET /api/journal/archive", () => {
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
    test("returns 200 status code with empty array when no progress exists", async () => {
      const request = createMockRequest("GET", "/api/journal/archive");
      const response = await GET(request as NextRequest);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBe(0);
    });

    test("returns archive hierarchy with progress entries", async () => {
      // Create progress entries for different dates
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
        progressDate: "2024-01-20",
      });

      const request = createMockRequest("GET", "/api/journal/archive");
      const response = await GET(request as NextRequest);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBeGreaterThan(0);

      // Verify archive node structure
      const yearNode = data[0];
      expect(yearNode).toHaveProperty("id");
      expect(yearNode).toHaveProperty("type", "year");
      expect(yearNode).toHaveProperty("label");
      expect(yearNode).toHaveProperty("dateKey");
      expect(yearNode).toHaveProperty("startDate");
      expect(yearNode).toHaveProperty("endDate");
      expect(yearNode).toHaveProperty("count");
      expect(yearNode).toHaveProperty("children");
    });

    test("returns correct count for progress entries", async () => {
      // Create 3 progress entries
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
        progressDate: "2024-01-20",
      });

      await progressRepository.create({
        bookId: testBook.id,
        currentPage: 150,
        currentPercentage: 50.0,
        pagesRead: 50,
        progressDate: "2024-01-25",
      });

      const request = createMockRequest("GET", "/api/journal/archive");
      const response = await GET(request as NextRequest);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.length).toBeGreaterThan(0);
      
      const yearNode = data[0];
      expect(yearNode.count).toBe(3);
    });

    test("groups entries by month correctly", async () => {
      // Create progress entries in different months
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
        progressDate: "2024-02-15",
      });

      const request = createMockRequest("GET", "/api/journal/archive");
      const response = await GET(request as NextRequest);
      const data = await response.json();

      expect(response.status).toBe(200);
      const yearNode = data[0];
      expect(yearNode.children).toBeDefined();
      expect(yearNode.children.length).toBeGreaterThanOrEqual(2);
      
      // Verify month nodes have correct structure
      const monthNode = yearNode.children[0];
      expect(monthNode.type).toBe("month");
      expect(monthNode).toHaveProperty("children");
    });

    test("includes week nodes under months", async () => {
      await progressRepository.create({
        bookId: testBook.id,
        currentPage: 50,
        currentPercentage: 16.67,
        pagesRead: 50,
        progressDate: "2024-01-15",
      });

      const request = createMockRequest("GET", "/api/journal/archive");
      const response = await GET(request as NextRequest);
      const data = await response.json();

      expect(response.status).toBe(200);
      const yearNode = data[0];
      const monthNode = yearNode.children[0];
      
      expect(monthNode.children).toBeDefined();
      expect(monthNode.children.length).toBeGreaterThan(0);
      
      const weekNode = monthNode.children[0];
      expect(weekNode.type).toBe("week");
      expect(weekNode).toHaveProperty("startDate");
      expect(weekNode).toHaveProperty("endDate");
    });
  });

  describe("GET - Timezone handling", () => {
    test("accepts timezone query parameter", async () => {
      await progressRepository.create({
        bookId: testBook.id,
        currentPage: 50,
        currentPercentage: 16.67,
        pagesRead: 50,
        progressDate: "2024-01-15",
      });

      const request = createMockRequest("GET", "/api/journal/archive?timezone=Asia/Tokyo");
      const response = await GET(request as NextRequest);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(Array.isArray(data)).toBe(true);
    });

    test("defaults to America/New_York when no timezone provided", async () => {
      await progressRepository.create({
        bookId: testBook.id,
        currentPage: 50,
        currentPercentage: 16.67,
        pagesRead: 50,
        progressDate: "2024-01-15",
      });

      const request = createMockRequest("GET", "/api/journal/archive");
      const response = await GET(request as NextRequest);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(Array.isArray(data)).toBe(true);
    });
  });

  describe("GET - Error handling", () => {
    test("returns 500 on internal error", async () => {
      // Mock journalService to throw an error
      const originalGetArchiveMetadata = journalService.getArchiveMetadata;
      journalService.getArchiveMetadata = (() => {
        throw new Error("Database connection failed");
      }) as any;

      const request = createMockRequest("GET", "/api/journal/archive");
      const response = await GET(request as NextRequest);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data).toHaveProperty("error");
      expect(data.error).toBe("Failed to fetch archive metadata");

      // Restore original function
      journalService.getArchiveMetadata = originalGetArchiveMetadata;
    });
  });
});
