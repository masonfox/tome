import { describe, test, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { PATCH, DELETE } from "@/app/api/books/[id]/progress/[progressId]/route";
import { bookRepository, progressRepository, sessionRepository } from "@/lib/repositories";
import { setupTestDatabase, teardownTestDatabase, clearTestDatabase } from "@/__tests__/helpers/db-setup";
import { createMockRequest } from "@/__tests__/fixtures/test-data";
import type { NextRequest } from "next/server";

/**
 * Progress Route Coverage Tests
 * 
 * Focus on improving patch coverage for app/api/books/[id]/progress/[progressId]/route.ts
 * Target uncovered lines:
 * - Line 94: Invalid progressId format in PATCH (NaN check)
 * - Line 117: Failed to delete progress entry (deleteProgress returns false)
 * - Lines 124-125: Generic error handling in DELETE
 */

/**
 * Mock Rationale: Prevent Next.js cache revalidation side effects during tests.
 * The progress API calls revalidatePath to update cached pages, but we don't need
 * to test Next.js's caching behavior - just our business logic.
 */
vi.mock("next/cache", () => ({
  revalidatePath: () => {},
}));

describe("Progress Route Coverage - PATCH /api/books/[id]/progress/[progressId]", () => {
  let testBook: any;
  let testSession: any;
  let testProgress: any;

  beforeAll(async () => {
    await setupTestDatabase(__filename);
  });

  afterAll(async () => {
    await teardownTestDatabase(__filename);
  });

  beforeEach(async () => {
    await clearTestDatabase(__filename);

    // Create test book with total pages
    testBook = await bookRepository.create({
      calibreId: 1,
      title: "Test Book",
      authors: ["Test Author"],
      tags: [],
      totalPages: 500,
      path: "Test/Book",
      orphaned: false,
    });

    // Create active reading session
    testSession = await sessionRepository.create({
      bookId: testBook.id,
      sessionNumber: 1,
      status: "reading",
      isActive: true,
      startedDate: "2025-11-01",
    });

    // Create progress entry
    testProgress = await progressRepository.create({
      bookId: testBook.id,
      sessionId: testSession.id,
      currentPage: 100,
      currentPercentage: 20,
      progressDate: "2025-11-01",
      pagesRead: 100,
    });
  });

  test("returns 400 for invalid progressId format (NaN)", async () => {
    // Line 94 coverage: isNaN(progressId) check
    const request = createMockRequest("PATCH", "/api/books/1/progress/invalid", {
      currentPage: 150,
    });

    const response = await PATCH(request as NextRequest, { 
      params: Promise.resolve({ id: testBook.id.toString(), progressId: "not-a-number" })
    });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe("Invalid book ID or progress ID format");
  });

  test("returns 400 for invalid bookId format (NaN)", async () => {
    const request = createMockRequest("PATCH", "/api/books/invalid/progress/1", {
      currentPage: 150,
    });

    const response = await PATCH(request as NextRequest, { 
      params: Promise.resolve({ id: "not-a-number", progressId: testProgress.id.toString() })
    });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe("Invalid book ID or progress ID format");
  });

  test("returns 403 when progress entry belongs to different book", async () => {
    // Create another book
    const otherBook = await bookRepository.create({
      calibreId: 2,
      title: "Other Book",
      authors: ["Other Author"],
      tags: [],
      totalPages: 300,
      path: "Other/Book",
      orphaned: false,
    });

    // Try to update testProgress using otherBook's ID
    const request = createMockRequest("PATCH", `/api/books/${otherBook.id}/progress/${testProgress.id}`, {
      currentPage: 150,
    });

    const response = await PATCH(request as NextRequest, { 
      params: Promise.resolve({ id: otherBook.id.toString(), progressId: testProgress.id.toString() })
    });
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.error).toBe("Progress entry does not belong to this book");
  });

  test("returns 400 for Zod validation errors", async () => {
    const request = createMockRequest("PATCH", `/api/books/${testBook.id}/progress/${testProgress.id}`, {
      currentPage: -50, // Invalid: negative page number
    });

    const response = await PATCH(request as NextRequest, { 
      params: Promise.resolve({ id: testBook.id.toString(), progressId: testProgress.id.toString() })
    });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain("Too small");
  });

  test("returns 404 when progress entry not found", async () => {
    const request = createMockRequest("PATCH", `/api/books/${testBook.id}/progress/999999`, {
      currentPage: 150,
    });

    const response = await PATCH(request as NextRequest, { 
      params: Promise.resolve({ id: testBook.id.toString(), progressId: "999999" })
    });
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toContain("not found");
  });

  test("returns 400 when update violates temporal validation", async () => {
    // Create another progress entry at page 200
    await progressRepository.create({
      bookId: testBook.id,
      sessionId: testSession.id,
      currentPage: 200,
      currentPercentage: 40,
      progressDate: "2025-11-02",
      pagesRead: 100,
    });

    // Try to update first entry to page 250 (would exceed next entry)
    const request = createMockRequest("PATCH", `/api/books/${testBook.id}/progress/${testProgress.id}`, {
      currentPage: 250,
    });

    const response = await PATCH(request as NextRequest, { 
      params: Promise.resolve({ id: testBook.id.toString(), progressId: testProgress.id.toString() })
    });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain("cannot exceed");
    expect(data.conflictingEntry).toBeDefined();
  });

  test("successfully updates progress entry", async () => {
    const request = createMockRequest("PATCH", `/api/books/${testBook.id}/progress/${testProgress.id}`, {
      currentPage: 150,
      notes: "Updated notes",
    });

    const response = await PATCH(request as NextRequest, { 
      params: Promise.resolve({ id: testBook.id.toString(), progressId: testProgress.id.toString() })
    });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.currentPage).toBe(150);
    expect(data.notes).toBe("Updated notes");
  });
});

describe("Progress Route Coverage - DELETE /api/books/[id]/progress/[progressId]", () => {
  let testBook: any;
  let testSession: any;
  let testProgress: any;

  beforeAll(async () => {
    await setupTestDatabase(__filename);
  });

  afterAll(async () => {
    await teardownTestDatabase(__filename);
  });

  beforeEach(async () => {
    await clearTestDatabase(__filename);

    // Create test book
    testBook = await bookRepository.create({
      calibreId: 1,
      title: "Test Book",
      authors: ["Test Author"],
      tags: [],
      totalPages: 500,
      path: "Test/Book",
      orphaned: false,
    });

    // Create active reading session
    testSession = await sessionRepository.create({
      bookId: testBook.id,
      sessionNumber: 1,
      status: "reading",
      isActive: true,
      startedDate: "2025-11-01",
    });

    // Create progress entry
    testProgress = await progressRepository.create({
      bookId: testBook.id,
      sessionId: testSession.id,
      currentPage: 100,
      currentPercentage: 20,
      progressDate: "2025-11-01",
      pagesRead: 100,
    });
  });

  test("returns 400 for invalid progressId format (NaN)", async () => {
    const request = createMockRequest("DELETE", "/api/books/1/progress/invalid");

    const response = await DELETE(request as NextRequest, { 
      params: Promise.resolve({ id: testBook.id.toString(), progressId: "not-a-number" })
    });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe("Invalid book ID or progress ID format");
  });

  test("returns 400 for invalid bookId format (NaN)", async () => {
    const request = createMockRequest("DELETE", "/api/books/invalid/progress/1");

    const response = await DELETE(request as NextRequest, { 
      params: Promise.resolve({ id: "not-a-number", progressId: testProgress.id.toString() })
    });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe("Invalid book ID or progress ID format");
  });

  test("returns 404 when progress entry not found", async () => {
    const request = createMockRequest("DELETE", "/api/books/1/progress/999999");

    const response = await DELETE(request as NextRequest, { 
      params: Promise.resolve({ id: testBook.id.toString(), progressId: "999999" })
    });
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe("Progress entry not found");
  });

  test("returns 403 when progress entry belongs to different book", async () => {
    // Create another book
    const otherBook = await bookRepository.create({
      calibreId: 2,
      title: "Other Book",
      authors: ["Other Author"],
      tags: [],
      totalPages: 300,
      path: "Other/Book",
      orphaned: false,
    });

    // Try to delete testProgress using otherBook's ID
    const request = createMockRequest("DELETE", `/api/books/${otherBook.id}/progress/${testProgress.id}`);

    const response = await DELETE(request as NextRequest, { 
      params: Promise.resolve({ id: otherBook.id.toString(), progressId: testProgress.id.toString() })
    });
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.error).toBe("Progress entry does not belong to this book");
  });

  test("returns 500 when deleteProgress returns false (Line 117)", async () => {
    // Mock ProgressService.deleteProgress to return false
    const { ProgressService } = await import("@/lib/services/progress.service");
    const deleteProgressSpy = vi.spyOn(ProgressService.prototype, 'deleteProgress').mockResolvedValue(false);

    const request = createMockRequest("DELETE", `/api/books/${testBook.id}/progress/${testProgress.id}`);

    const response = await DELETE(request as NextRequest, { 
      params: Promise.resolve({ id: testBook.id.toString(), progressId: testProgress.id.toString() })
    });
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe("Failed to delete progress entry");

    deleteProgressSpy.mockRestore();
  });

  test("returns 500 when delete throws unexpected error (Lines 124-125)", async () => {
    // Mock progressRepository.findById to throw an unexpected error
    vi.spyOn(progressRepository, 'findById').mockRejectedValue(new Error("Unexpected database error"));

    const request = createMockRequest("DELETE", `/api/books/${testBook.id}/progress/${testProgress.id}`);

    const response = await DELETE(request as NextRequest, { 
      params: Promise.resolve({ id: testBook.id.toString(), progressId: testProgress.id.toString() })
    });
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe("Failed to delete progress");

    vi.restoreAllMocks();
  });

  test("successfully deletes progress entry", async () => {
    const request = createMockRequest("DELETE", `/api/books/${testBook.id}/progress/${testProgress.id}`);

    const response = await DELETE(request as NextRequest, { 
      params: Promise.resolve({ id: testBook.id.toString(), progressId: testProgress.id.toString() })
    });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.message).toBe("Progress entry deleted");

    // Verify entry was deleted
    const deleted = await progressRepository.findById(testProgress.id);
    expect(deleted).toBeUndefined();
  });
});
