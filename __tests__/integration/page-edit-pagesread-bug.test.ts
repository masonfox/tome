import { describe, test, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { bookRepository, sessionRepository, progressRepository } from "@/lib/repositories";
import { PATCH as PATCH_BOOK } from "@/app/api/books/[id]/route";
import { POST as POST_PROGRESS } from "@/app/api/books/[id]/progress/route";
import { createMockRequest, createTestBook, createTestSession, createTestProgress } from "../fixtures/test-data";
import { setupTestDatabase, teardownTestDatabase, clearTestDatabase } from "@/__tests__/helpers/db-setup";
import type { NextRequest } from "next/server";

/**
 * Test to identify the specific bug with pagesRead after page count edit
 * 
 * This test checks if there's an issue with how pagesRead is calculated
 * when progress is logged immediately after editing totalPages.
 */

// Mock Next.js cache revalidation
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

describe("Page Edit pagesRead Bug Investigation", () => {
  test("should verify pagesRead is NOT recalculated for existing logs after page edit", async () => {
    // This test verifies the CURRENT behavior: pagesRead values in existing
    // progress logs are NOT updated when totalPages changes. This is actually
    // CORRECT behavior since pagesRead represents actual reading increments.
    
    const book = await bookRepository.create(createTestBook({
      calibreId: 1,
      title: "Test Book",
      authors: ["Test Author"],
      totalPages: 300,
      path: "Test/Book",
    }));

    const session = await sessionRepository.create(createTestSession({
      bookId: book.id,
      sessionNumber: 1,
      status: "reading",
      isActive: true,
    }));

    // Log initial progress
    await progressRepository.create(createTestProgress({
      bookId: book.id,
      sessionId: session.id,
      currentPage: 50,
      currentPercentage: 16, // 50/300 = 16.66% → 16%
      pagesRead: 50,
      progressDate: new Date("2025-12-01"),
    }));

    await progressRepository.create(createTestProgress({
      bookId: book.id,
      sessionId: session.id,
      currentPage: 100,
      currentPercentage: 33, // 100/300 = 33.33% → 33%
      pagesRead: 50, // 100 - 50 = 50
      progressDate: new Date("2025-12-02"),
    }));

    // Edit page count
    await PATCH_BOOK(
      createMockRequest("PATCH", `/api/books/${book.id}`, { totalPages: 400 }) as NextRequest,
      { params: { id: book.id.toString() } }
    );

    // Check existing progress logs
    const existingProgress = await progressRepository.findBySessionId(session.id);
    const sorted = existingProgress.sort((a, b) => a.currentPage - b.currentPage);
    
    // Percentages should be recalculated
    expect(sorted[0].currentPercentage).toBe(12); // 50/400 = 12.5% → 12%
    expect(sorted[1].currentPercentage).toBe(25); // 100/400 = 25%
    
    // BUT pagesRead should stay the same (this is correct!)
    expect(sorted[0].pagesRead).toBe(50); // First entry, 50 pages read from start
    expect(sorted[1].pagesRead).toBe(50); // Second entry, 50 pages read since last (100 - 50)
  });

  test("should check if pagesRead calculation uses stale lastProgress.currentPage", async () => {
    // This test checks if there's a race condition where lastProgress
    // has stale currentPage data after page edit
    
    const book = await bookRepository.create(createTestBook({
      calibreId: 2,
      title: "Race Condition Test",
      authors: ["Test Author"],
      totalPages: 200,
      path: "Test/Book2",
    }));

    const session = await sessionRepository.create(createTestSession({
      bookId: book.id,
      sessionNumber: 1,
      status: "reading",
      isActive: true,
    }));

    // User at page 80
    await progressRepository.create(createTestProgress({
      bookId: book.id,
      sessionId: session.id,
      currentPage: 80,
      currentPercentage: 40, // 80/200
      pagesRead: 80,
      progressDate: new Date("2025-12-01"),
    }));

    // Edit pages to 250
    await PATCH_BOOK(
      createMockRequest("PATCH", `/api/books/${book.id}`, { totalPages: 250 }) as NextRequest,
      { params: { id: book.id.toString() } }
    );

    // Immediately log new progress to page 120
    const progressResponse = await POST_PROGRESS(
      createMockRequest("POST", `/api/books/${book.id}/progress`, {
        currentPage: 120,
        progressDate: new Date("2025-12-02").toISOString(),
      }) as NextRequest,
      { params: { id: book.id.toString() } }
    );

    expect(progressResponse.status).toBe(200);
    const result = await progressResponse.json();
    const newProgress = result.progressLog;

    // The NEW progress should have correct calculations
    expect(newProgress.currentPage).toBe(120);
    expect(newProgress.currentPercentage).toBe(48); // 120/250 = 48%
    expect(newProgress.pagesRead).toBe(40); // 120 - 80 = 40 (CORRECT!)

    // This verifies that pagesRead is calculated from currentPage values,
    // not from percentage, so editing totalPages doesn't break the calculation
  });

  test("should identify if pagesRead uses wrong book data in calculateProgressMetrics", async () => {
    // This test checks if calculateProgressMetrics receives stale book data
    // when called immediately after PATCH
    
    const book = await bookRepository.create(createTestBook({
      calibreId: 3,
      title: "Stale Data Test",
      authors: ["Test Author"],
      totalPages: 300,
      path: "Test/Book3",
    }));

    const session = await sessionRepository.create(createTestSession({
      bookId: book.id,
      sessionNumber: 1,
      status: "reading",
      isActive: true,
    }));

    await progressRepository.create(createTestProgress({
      bookId: book.id,
      sessionId: session.id,
      currentPage: 100,
      currentPercentage: 33, // 100/300
      pagesRead: 100,
      progressDate: new Date("2025-12-01"),
    }));

    // Edit to 400 pages
    const patchResponse = await PATCH_BOOK(
      createMockRequest("PATCH", `/api/books/${book.id}`, { totalPages: 400 }) as NextRequest,
      { params: { id: book.id.toString() } }
    );
    expect(patchResponse.status).toBe(200);

    // Log progress immediately
    const progressResponse = await POST_PROGRESS(
      createMockRequest("POST", `/api/books/${book.id}/progress`, {
        currentPage: 150,
        progressDate: new Date("2025-12-02").toISOString(),
      }) as NextRequest,
      { params: { id: book.id.toString() } }
    );

    expect(progressResponse.status).toBe(200);
    const result = await progressResponse.json();
    const newProgress = result.progressLog;

    // Verify calculations use NEW totalPages (400)
    expect(newProgress.currentPage).toBe(150);
    expect(newProgress.currentPercentage).toBe(37); // 150/400 = 37.5% → 37%
    expect(newProgress.pagesRead).toBe(50); // 150 - 100 = 50
  });

  test("should check if frontend state causes incorrect pagesRead display", async () => {
    // This test simulates what might happen in the frontend:
    // User sees old progress data, then logs new progress
    
    const book = await bookRepository.create(createTestBook({
      calibreId: 4,
      title: "Frontend State Test",
      authors: ["Test Author"],
      totalPages: 300,
      path: "Test/Book4",
    }));

    const session = await sessionRepository.create(createTestSession({
      bookId: book.id,
      sessionNumber: 1,
      status: "reading",
      isActive: true,
    }));

    const oldProgress = await progressRepository.create(createTestProgress({
      bookId: book.id,
      sessionId: session.id,
      currentPage: 100,
      currentPercentage: 33, // 100/300
      pagesRead: 100,
      progressDate: new Date("2025-12-01"),
    }));

    // Simulate page edit
    await PATCH_BOOK(
      createMockRequest("PATCH", `/api/books/${book.id}`, { totalPages: 350 }) as NextRequest,
      { params: { id: book.id.toString() } }
    );

    // Frontend fetches progress again
    const progressList = await progressRepository.findBySessionId(session.id);
    const latestProgress = progressList[0];

    // Check what the frontend sees
    console.log("Frontend sees after page edit:", {
      currentPage: latestProgress.currentPage,
      currentPercentage: latestProgress.currentPercentage,
      pagesRead: latestProgress.pagesRead,
    });

    expect(latestProgress.currentPage).toBe(100); // Unchanged
    expect(latestProgress.currentPercentage).toBe(28); // Recalculated: 100/350 = 28.57% → 28%
    expect(latestProgress.pagesRead).toBe(100); // Unchanged (correct!)

    // Now log new progress
    const newProgressResponse = await POST_PROGRESS(
      createMockRequest("POST", `/api/books/${book.id}/progress`, {
        currentPage: 150,
        progressDate: new Date("2025-12-02").toISOString(),
      }) as NextRequest,
      { params: { id: book.id.toString() } }
    );

    const result = await newProgressResponse.json();
    const newProgressData = result.progressLog;

    // The new progress should calculate pagesRead from currentPage difference
    expect(newProgressData.currentPage).toBe(150);
    expect(newProgressData.currentPercentage).toBe(42); // 150/350 = 42.85% → 42%
    expect(newProgressData.pagesRead).toBe(50); // 150 - 100 = 50 (CORRECT!)
    
    // So where's the bug? Let's check if it's about displaying old progress
    // entries with their unchanged pagesRead values...
  });
});
