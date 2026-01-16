import { describe, test, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { POST } from "@/app/api/books/[id]/progress/route";
import { bookRepository, sessionRepository } from "@/lib/repositories";
import { setupTestDatabase, teardownTestDatabase, clearTestDatabase } from "@/__tests__/helpers/db-setup";
import { createMockRequest } from "@/__tests__/fixtures/test-data";
import { format, addDays } from 'date-fns';
import type { NextRequest } from "next/server";

/**
 * Progress API - Date Input Validation Tests
 * 
 * CRITICAL TEST SUITE: Validates the data entry path where timezone/date confusion could corrupt data.
 * 
 * ## Purpose
 * 
 * This is the ONLY place in the architecture where date corruption can occur:
 * When a user's intended "calendar day" is converted to a YYYY-MM-DD string.
 * 
 * If this conversion is wrong (timezone confusion, validation failure), 
 * data is corrupted PERMANENTLY (strings in database cannot "heal").
 * 
 * ## What We Test
 * 
 * 1. **Format Validation** - Only YYYY-MM-DD accepted
 * 2. **Calendar Date Validation** - Reject impossible dates (Feb 31, Month 13)
 * 3. **Leap Year Handling** - Feb 29 valid in leap years only
 * 4. **Boundary Cases** - Zero padding, edge dates
 * 
 * ## Why This Matters
 * 
 * With the new string storage architecture:
 * - ✅ Display bugs are impossible (strings displayed as-is)
 * - ✅ Timezone shift bugs are impossible (no conversion layer)
 * - ❌ Input validation is the ONLY attack surface
 * 
 * If bad data gets past validation, it's stored forever.
 */

vi.mock("next/cache", () => ({
  revalidatePath: () => {},
}));

describe("Progress API - Date Input Validation (POST /api/books/[id]/progress)", () => {
  let testBook: any;

  beforeAll(async () => {
    await setupTestDatabase(__filename);
  });

  afterAll(async () => {
    await teardownTestDatabase(__filename);
  });

  beforeEach(async () => {
    await clearTestDatabase(__filename);

    // Create test book with known total pages
    testBook = await bookRepository.create({
      calibreId: 1,
      title: "Test Book",
      authors: ["Test Author"],
      tags: [],
      totalPages: 300,
      path: "Test/Book",
      orphaned: false,
    });

    // Create active session for progress logging
    await sessionRepository.create({
      bookId: testBook.id,
      sessionNumber: 1,
      status: "reading",
      isActive: true,
      startedDate: "2025-01-01",
    });
  });

  describe("Valid Date Formats", () => {
    test("accepts valid YYYY-MM-DD format", async () => {
      const request = createMockRequest("POST", "/api/books/123/progress", {
        currentPage: 50,
        progressDate: "2025-01-08",
      });
      const params = { id: testBook.id.toString() };

      const response = await POST(request as NextRequest, { params });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.progressLog.progressDate).toBe("2025-01-08");
    });

    test("accepts date without progressDate (defaults to today)", async () => {
      const request = createMockRequest("POST", "/api/books/123/progress", {
        currentPage: 50,
        // progressDate omitted - should default to today
      });
      const params = { id: testBook.id.toString() };

      const response = await POST(request as NextRequest, { params });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.progressLog.progressDate).toMatch(/^\d{4}-\d{2}-\d{2}$/); // Should be YYYY-MM-DD format
    });

    test("accepts past dates", async () => {
      const pastDate = format(addDays(new Date(), -30), 'yyyy-MM-dd');
      
      const request = createMockRequest("POST", "/api/books/123/progress", {
        currentPage: 50,
        progressDate: pastDate,
      });
      const params = { id: testBook.id.toString() };

      const response = await POST(request as NextRequest, { params });
      
      expect(response.status).toBe(200);
    });

    test("accepts today's date", async () => {
      const today = format(new Date(), 'yyyy-MM-dd');
      
      const request = createMockRequest("POST", "/api/books/123/progress", {
        currentPage: 50,
        progressDate: today,
      });
      const params = { id: testBook.id.toString() };

      const response = await POST(request as NextRequest, { params });
      
      expect(response.status).toBe(200);
    });
  });

  describe("Invalid Date Formats (Reject with 400)", () => {
    test("rejects US format (MM/DD/YYYY)", async () => {
      const request = createMockRequest("POST", "/api/books/123/progress", {
        currentPage: 50,
        progressDate: "01/08/2025",
      });
      const params = { id: testBook.id.toString() };

      const response = await POST(request as NextRequest, { params });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain("YYYY-MM-DD");
    });

    test("rejects date without zero padding (YYYY-M-D)", async () => {
      const request = createMockRequest("POST", "/api/books/123/progress", {
        currentPage: 50,
        progressDate: "2025-1-8", // Missing zero padding
      });
      const params = { id: testBook.id.toString() };

      const response = await POST(request as NextRequest, { params });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain("YYYY-MM-DD");
    });

    test("rejects ISO timestamp format", async () => {
      const request = createMockRequest("POST", "/api/books/123/progress", {
        currentPage: 50,
        progressDate: "2025-01-08T10:30:00.000Z",
      });
      const params = { id: testBook.id.toString() };

      const response = await POST(request as NextRequest, { params });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain("YYYY-MM-DD");
    });

    test("rejects human-readable format (Jan 8, 2025)", async () => {
      const request = createMockRequest("POST", "/api/books/123/progress", {
        currentPage: 50,
        progressDate: "Jan 8, 2025",
      });
      const params = { id: testBook.id.toString() };

      const response = await POST(request as NextRequest, { params });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain("YYYY-MM-DD");
    });

    test("rejects completely invalid string", async () => {
      const request = createMockRequest("POST", "/api/books/123/progress", {
        currentPage: 50,
        progressDate: "not-a-date",
      });
      const params = { id: testBook.id.toString() };

      const response = await POST(request as NextRequest, { params });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain("YYYY-MM-DD");
    });

    test("rejects empty string", async () => {
      const request = createMockRequest("POST", "/api/books/123/progress", {
        currentPage: 50,
        progressDate: "",
      });
      const params = { id: testBook.id.toString() };

      const response = await POST(request as NextRequest, { params });
      const data = await response.json();

      expect(response.status).toBe(400);
    });
  });

  describe("Invalid Calendar Dates (Reject with 400)", () => {
    test("rejects February 31 (non-existent date)", async () => {
      const request = createMockRequest("POST", "/api/books/123/progress", {
        currentPage: 50,
        progressDate: "2025-02-31", // February only has 28/29 days
      });
      const params = { id: testBook.id.toString() };

      const response = await POST(request as NextRequest, { params });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain("valid calendar date");
    });

    test("rejects February 30 (non-existent date)", async () => {
      const request = createMockRequest("POST", "/api/books/123/progress", {
        currentPage: 50,
        progressDate: "2025-02-30",
      });
      const params = { id: testBook.id.toString() };

      const response = await POST(request as NextRequest, { params });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain("valid calendar date");
    });

    test("rejects month 13 (non-existent month)", async () => {
      const request = createMockRequest("POST", "/api/books/123/progress", {
        currentPage: 50,
        progressDate: "2025-13-01", // Months are 01-12
      });
      const params = { id: testBook.id.toString() };

      const response = await POST(request as NextRequest, { params });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain("valid calendar date");
    });

    test("rejects month 00 (non-existent month)", async () => {
      const request = createMockRequest("POST", "/api/books/123/progress", {
        currentPage: 50,
        progressDate: "2025-00-01",
      });
      const params = { id: testBook.id.toString() };

      const response = await POST(request as NextRequest, { params });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain("valid calendar date");
    });

    test("rejects day 32 (non-existent day)", async () => {
      const request = createMockRequest("POST", "/api/books/123/progress", {
        currentPage: 50,
        progressDate: "2025-01-32", // January has 31 days
      });
      const params = { id: testBook.id.toString() };

      const response = await POST(request as NextRequest, { params });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain("valid calendar date");
    });

    test("rejects day 00 (non-existent day)", async () => {
      const request = createMockRequest("POST", "/api/books/123/progress", {
        currentPage: 50,
        progressDate: "2025-01-00",
      });
      const params = { id: testBook.id.toString() };

      const response = await POST(request as NextRequest, { params });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain("valid calendar date");
    });

    test("rejects April 31 (April has 30 days)", async () => {
      const request = createMockRequest("POST", "/api/books/123/progress", {
        currentPage: 50,
        progressDate: "2025-04-31",
      });
      const params = { id: testBook.id.toString() };

      const response = await POST(request as NextRequest, { params });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain("valid calendar date");
    });
  });

  describe("Leap Year Handling", () => {
    test("accepts February 29 in leap year (2024)", async () => {
      const request = createMockRequest("POST", "/api/books/123/progress", {
        currentPage: 50,
        progressDate: "2024-02-29", // 2024 is a leap year
      });
      const params = { id: testBook.id.toString() };

      const response = await POST(request as NextRequest, { params });
      
      expect(response.status).toBe(200);
    });

    test("rejects February 29 in non-leap year (2025)", async () => {
      const request = createMockRequest("POST", "/api/books/123/progress", {
        currentPage: 50,
        progressDate: "2025-02-29", // 2025 is NOT a leap year
      });
      const params = { id: testBook.id.toString() };

      const response = await POST(request as NextRequest, { params });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain("valid calendar date");
    });

    test("accepts February 29 in century leap year (2000)", async () => {
      const request = createMockRequest("POST", "/api/books/123/progress", {
        currentPage: 50,
        progressDate: "2000-02-29", // 2000 is divisible by 400 = leap year
      });
      const params = { id: testBook.id.toString() };

      const response = await POST(request as NextRequest, { params });
      
      expect(response.status).toBe(200);
    });

    test("rejects February 29 in century non-leap year (1900)", async () => {
      const request = createMockRequest("POST", "/api/books/123/progress", {
        currentPage: 50,
        progressDate: "1900-02-29", // 1900 is NOT divisible by 400 = not leap year
      });
      const params = { id: testBook.id.toString() };

      const response = await POST(request as NextRequest, { params });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain("valid calendar date");
    });
  });

  describe("Edge Cases and Boundary Values", () => {
    test("accepts date at year boundary (Dec 31)", async () => {
      const request = createMockRequest("POST", "/api/books/123/progress", {
        currentPage: 50,
        progressDate: "2024-12-31",
      });
      const params = { id: testBook.id.toString() };

      const response = await POST(request as NextRequest, { params });
      
      expect(response.status).toBe(200);
    });

    test("accepts date at year boundary (Jan 1)", async () => {
      const request = createMockRequest("POST", "/api/books/123/progress", {
        currentPage: 50,
        progressDate: "2025-01-01",
      });
      const params = { id: testBook.id.toString() };

      const response = await POST(request as NextRequest, { params });
      
      expect(response.status).toBe(200);
    });

    test("accepts very old date (year 2000)", async () => {
      const request = createMockRequest("POST", "/api/books/123/progress", {
        currentPage: 50,
        progressDate: "2000-01-01",
      });
      const params = { id: testBook.id.toString() };

      const response = await POST(request as NextRequest, { params });
      
      expect(response.status).toBe(200);
    });

    test("rejects year with wrong number of digits (YY-MM-DD)", async () => {
      const request = createMockRequest("POST", "/api/books/123/progress", {
        currentPage: 50,
        progressDate: "25-01-08", // 2-digit year
      });
      const params = { id: testBook.id.toString() };

      const response = await POST(request as NextRequest, { params });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain("YYYY-MM-DD");
    });

    test("rejects date with extra characters", async () => {
      const request = createMockRequest("POST", "/api/books/123/progress", {
        currentPage: 50,
        progressDate: "2025-01-08 extra",
      });
      const params = { id: testBook.id.toString() };

      const response = await POST(request as NextRequest, { params });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain("YYYY-MM-DD");
    });
  });

  describe("Data Integrity - Date Storage Verification", () => {
    test("stored date matches submitted date exactly (no timezone conversion)", async () => {
      const submittedDate = "2025-01-08";
      
      const request = createMockRequest("POST", "/api/books/123/progress", {
        currentPage: 50,
        progressDate: submittedDate,
      });
      const params = { id: testBook.id.toString() };

      const response = await POST(request as NextRequest, { params });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.progressLog.progressDate).toBe(submittedDate); // EXACT match - no conversion
    });

    test("multiple submissions with different dates maintain independence", async () => {
      // Submit progress on three different dates
      const dates = ["2025-01-05", "2025-01-08", "2025-01-10"];
      
      for (const progressDate of dates) {
        const request = createMockRequest("POST", "/api/books/123/progress", {
          currentPage: 50,
          progressDate,
        });
        const params = { id: testBook.id.toString() };

        const response = await POST(request as NextRequest, { params });
        expect(response.status).toBe(200);
      }

      // All three dates should have been stored independently
      // (Verification via GET endpoint would be in a separate test)
    });
  });
});
