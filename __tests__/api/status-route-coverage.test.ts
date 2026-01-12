import { describe, test, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { GET, POST } from "@/app/api/books/[id]/status/route";
import { bookRepository, sessionRepository } from "@/lib/repositories";
import { setupTestDatabase, teardownTestDatabase, clearTestDatabase } from "@/__tests__/helpers/db-setup";
import {
  createMockRequest,
  createTestBook,
  createTestSession,
} from "../fixtures/test-data";
import type { NextRequest } from "next/server";

/**
 * Status Route Coverage Tests
 * 
 * Focus on improving coverage for app/api/books/[id]/status/route.ts:
 * - Uncovered lines: 27, 46, 52, 96, 103
 * - Error handling paths
 * - Edge cases
 * - Date validation errors
 */

vi.mock("next/cache", () => ({
  revalidatePath: () => {},
}));

vi.mock("@/lib/services/calibre.service", () => ({
  calibreService: {
    updateRating: () => {},
    readRating: () => null,
    updateTags: () => {},
    readTags: () => [],
  },
  CalibreService: class {},
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

describe("GET /api/books/[id]/status - Coverage", () => {
  test("should return null status when no session exists (line 21)", async () => {
    const book = await bookRepository.create(createTestBook());

    const request = createMockRequest("GET", `/api/books/${book.id}/status`);
    const response = await GET(request as NextRequest, { 
      params: Promise.resolve({ id: book.id.toString() }) 
    });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.status).toBeNull();
  });

  test("should return 400 for invalid book ID format (line 15)", async () => {
    const request = createMockRequest("GET", "/api/books/invalid/status");
    const response = await GET(request as NextRequest, { 
      params: Promise.resolve({ id: "invalid" }) 
    });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain("Invalid book ID format");
  });

  test("should return 500 when database error occurs (line 27)", async () => {
    // Mock repository to throw error
    const originalFind = sessionRepository.findActiveByBookId;
    vi.spyOn(sessionRepository, 'findActiveByBookId').mockRejectedValueOnce(
      new Error("Database connection error")
    );

    const request = createMockRequest("GET", "/api/books/123/status");
    const response = await GET(request as NextRequest, { 
      params: Promise.resolve({ id: "123" }) 
    });
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toContain("Failed to fetch status");

    // Restore
    vi.restoreAllMocks();
  });
});

describe("POST /api/books/[id]/status - Date Validation Coverage", () => {
  test("should return 400 for invalid startedDate format (line 46-49)", async () => {
    const book = await bookRepository.create(createTestBook());

    const request = createMockRequest("POST", `/api/books/${book.id}/status`, {
      status: "reading",
      startedDate: "invalid-date", // Not YYYY-MM-DD
    });

    const response = await POST(request as NextRequest, { 
      params: Promise.resolve({ id: book.id.toString() }) 
    });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain("Invalid startedDate format");
  });

  test("should return 400 for invalid completedDate format (line 51-55)", async () => {
    const book = await bookRepository.create(createTestBook());
    await sessionRepository.create(createTestSession({
      bookId: book.id,
      status: "reading",
      isActive: true,
      sessionNumber: 1,
    }));

    const request = createMockRequest("POST", `/api/books/${book.id}/status`, {
      status: "read",
      completedDate: "2024/01/15", // Wrong format
    });

    const response = await POST(request as NextRequest, { 
      params: Promise.resolve({ id: book.id.toString() }) 
    });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain("Invalid completedDate format");
  });

  test("should accept valid YYYY-MM-DD date formats", async () => {
    const book = await bookRepository.create(createTestBook({ totalPages: 300 }));
    
    const request = createMockRequest("POST", `/api/books/${book.id}/status`, {
      status: "reading",
      startedDate: "2024-01-15", // Valid format
    });

    const response = await POST(request as NextRequest, { 
      params: Promise.resolve({ id: book.id.toString() }) 
    });

    expect(response.status).toBe(200);
  });
});

describe("POST /api/books/[id]/status - Error Handling Coverage", () => {
  test("should return 404 when error message contains 'not found' (line 96)", async () => {
    // Non-existent book
    const request = createMockRequest("POST", "/api/books/99999/status", {
      status: "reading",
    });

    const response = await POST(request as NextRequest, { 
      params: Promise.resolve({ id: "99999" }) 
    });
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toContain("not found");
  });

  test("should return 400 when error message contains 'Invalid status' (line 99)", async () => {
    const book = await bookRepository.create(createTestBook());

    const request = createMockRequest("POST", `/api/books/${book.id}/status`, {
      status: "invalid-status",
    });

    const response = await POST(request as NextRequest, { 
      params: Promise.resolve({ id: book.id.toString() }) 
    });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain("Invalid status");
  });

  test("should return 400 with PAGES_REQUIRED code (line 89-92)", async () => {
    // Book without totalPages
    const book = await bookRepository.create(createTestBook({
      totalPages: null,
    }));

    const request = createMockRequest("POST", `/api/books/${book.id}/status`, {
      status: "reading",
    });

    const response = await POST(request as NextRequest, { 
      params: Promise.resolve({ id: book.id.toString() }) 
    });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain("Page count required");
    expect(data.code).toBe("PAGES_REQUIRED");
  });

  test("should return 500 for generic errors (line 103)", async () => {
    const book = await bookRepository.create(createTestBook({ totalPages: 300 }));

    // Mock sessionService.updateStatus to throw generic error
    const { SessionService } = await import("@/lib/services/session.service");
    vi.spyOn(SessionService.prototype, 'updateStatus').mockRejectedValueOnce(
      new Error("Unexpected database error")
    );

    const request = createMockRequest("POST", `/api/books/${book.id}/status`, {
      status: "reading",
    });

    const response = await POST(request as NextRequest, { 
      params: Promise.resolve({ id: book.id.toString() }) 
    });
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toContain("Failed to update status");

    vi.restoreAllMocks();
  });
});

describe("POST /api/books/[id]/status - Session Archival Response", () => {
  test("should return archival info when session archived (line 72-77)", async () => {
    const book = await bookRepository.create(createTestBook({ totalPages: 300 }));
    const session = await sessionRepository.create(createTestSession({
      bookId: book.id,
      status: "reading",
      isActive: true,
      sessionNumber: 1,
    }));

    // Add progress to trigger archival
    const { progressRepository } = await import("@/lib/repositories");
    await progressRepository.create({
      bookId: book.id,
      sessionId: session.id,
      currentPage: 50,
      currentPercentage: 16.67,
      pagesRead: 50,
      progressDate: "2024-01-15",
    });

    const request = createMockRequest("POST", `/api/books/${book.id}/status`, {
      status: "to-read", // Backward movement
    });

    const response = await POST(request as NextRequest, { 
      params: Promise.resolve({ id: book.id.toString() }) 
    });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.sessionArchived).toBe(true);
    expect(data.archivedSessionNumber).toBe(1);
  });

  test("should return normal response when session not archived (line 80)", async () => {
    const book = await bookRepository.create(createTestBook({ totalPages: 300 }));
    
    const request = createMockRequest("POST", `/api/books/${book.id}/status`, {
      status: "reading",
    });

    const response = await POST(request as NextRequest, { 
      params: Promise.resolve({ id: book.id.toString() }) 
    });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.sessionArchived).toBeUndefined();
    expect(data.status).toBe("reading");
  });
});

describe("POST /api/books/[id]/status - Invalid Book ID", () => {
  test("should return 400 for non-numeric book ID (line 37)", async () => {
    const request = createMockRequest("POST", "/api/books/abc/status", {
      status: "reading",
    });

    const response = await POST(request as NextRequest, { 
      params: Promise.resolve({ id: "abc" }) 
    });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain("Invalid book ID format");
  });

  test("should return 400 for empty book ID", async () => {
    const request = createMockRequest("POST", "/api/books//status", {
      status: "reading",
    });

    const response = await POST(request as NextRequest, { 
      params: Promise.resolve({ id: "" }) 
    });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain("Invalid book ID format");
  });
});

describe("POST /api/books/[id]/status - Date Format Edge Cases", () => {
  test("should reject date with time component", async () => {
    const book = await bookRepository.create(createTestBook({ totalPages: 300 }));

    const request = createMockRequest("POST", `/api/books/${book.id}/status`, {
      status: "reading",
      startedDate: "2024-01-15T10:30:00", // Has time
    });

    const response = await POST(request as NextRequest, { 
      params: Promise.resolve({ id: book.id.toString() }) 
    });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain("Invalid startedDate format");
  });

  test("should reject date with single-digit month/day", async () => {
    const book = await bookRepository.create(createTestBook({ totalPages: 300 }));

    const request = createMockRequest("POST", `/api/books/${book.id}/status`, {
      status: "reading",
      startedDate: "2024-1-5", // Not zero-padded
    });

    const response = await POST(request as NextRequest, { 
      params: Promise.resolve({ id: book.id.toString() }) 
    });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain("Invalid startedDate format");
  });

  test("should accept date at year boundaries", async () => {
    const book = await bookRepository.create(createTestBook({ totalPages: 300 }));

    const request1 = createMockRequest("POST", `/api/books/${book.id}/status`, {
      status: "reading",
      startedDate: "2024-01-01", // January 1st
    });

    const response1 = await POST(request1 as NextRequest, { 
      params: Promise.resolve({ id: book.id.toString() }) 
    });

    expect(response1.status).toBe(200);

    const request2 = createMockRequest("POST", `/api/books/${book.id}/status`, {
      status: "read",
      completedDate: "2024-12-31", // December 31st
    });

    const response2 = await POST(request2 as NextRequest, { 
      params: Promise.resolve({ id: book.id.toString() }) 
    });

    expect(response2.status).toBe(200);
  });
});
