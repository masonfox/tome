import { describe, test, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { bookRepository, sessionRepository, progressRepository } from "@/lib/repositories";
import { PATCH as PATCH_BOOK } from "@/app/api/books/[id]/route";
import { POST as POST_PROGRESS } from "@/app/api/books/[id]/progress/route";
import { createMockRequest, createTestBook, createTestSession, createTestProgress } from "../fixtures/test-data";
import { setupTestDatabase, teardownTestDatabase, clearTestDatabase } from "@/__tests__/helpers/db-setup";
import type { NextRequest } from "next/server";

/**
 * Integration Test: Page Edit Then Progress Log Bug
 * 
 * Reproduces the bug reported in GitHub issue:
 * "I'm pretty sure there's a bug with progress log state after editing page count on the book detail page.
 * To reproduce, edit the pages of a book and then submit a progress log. 
 * You should see that the incremental page count for the new log is incorrect."
 * 
 * Expected behavior:
 * 1. User has a book at page 100 (with totalPages: 300)
 * 2. User edits totalPages to 350
 * 3. User logs new progress to page 150
 * 4. The pagesRead should be 50 (150 - 100), not based on stale data
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

describe("Integration: Page Edit Then Progress Log Bug", () => {
  test("should calculate correct incremental page count after editing totalPages", async () => {
    // ========================================================================
    // SETUP: Book with 300 pages, currently at page 100
    // ========================================================================
    
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
      startedDate: new Date("2025-12-01"),
    }));

    // User has logged progress to page 100
    await progressRepository.create(createTestProgress({
      bookId: book.id,
      sessionId: session.id,
      currentPage: 100,
      currentPercentage: 33, // 100/300 = 33.33% → 33%
      pagesRead: 100,
      progressDate: new Date("2025-12-08T10:00:00Z"),
    }));

    // ========================================================================
    // STEP 1: User edits page count from 300 to 350
    // ========================================================================
    
    const patchRequest = createMockRequest("PATCH", `/api/books/${book.id}`, {
      totalPages: 350,
    }) as NextRequest;
    
    const patchResponse = await PATCH_BOOK(patchRequest, { params: { id: book.id.toString() } });
    expect(patchResponse.status).toBe(200);

    // Verify page count updated
    const updatedBook = await bookRepository.findById(book.id);
    expect(updatedBook?.totalPages).toBe(350);

    // ========================================================================
    // STEP 2: User logs new progress to page 150 (50 pages read since last log)
    // ========================================================================
    
    const progressRequest = createMockRequest("POST", `/api/books/${book.id}/progress`, {
      currentPage: 150,
      progressDate: new Date("2025-12-08T14:00:00Z").toISOString(),
    }) as NextRequest;
    
    const progressResponse = await POST_PROGRESS(progressRequest, { params: { id: book.id.toString() } });
    expect(progressResponse.status).toBe(200);

    const result = await progressResponse.json();
    const progressData = result.progressLog;

    // ========================================================================
    // ASSERTIONS: Verify correct calculations
    // ========================================================================
    
    // Assert: New progress log has correct page
    expect(progressData.currentPage).toBe(150);
    
    // Assert: New progress log has correct percentage based on NEW total (350)
    expect(progressData.currentPercentage).toBe(42); // 150/350 = 42.85% → 42%
    
    // Assert: CRITICAL - pagesRead should be 50 (150 - 100), not based on old totalPages
    expect(progressData.pagesRead).toBe(50);

    // Double-check by fetching all progress logs
    const allProgress = await progressRepository.findBySessionId(session.id);
    expect(allProgress).toHaveLength(2);
    
    const sorted = allProgress.sort((a, b) => 
      new Date(a.progressDate).getTime() - new Date(b.progressDate).getTime()
    );
    
    // First log: page 100, 28% of 350 (recalculated)
    expect(sorted[0].currentPage).toBe(100);
    expect(sorted[0].currentPercentage).toBe(28); // 100/350 = 28.57% → 28%
    expect(sorted[0].pagesRead).toBe(100);
    
    // Second log: page 150, 42% of 350, 50 pages read since last
    expect(sorted[1].currentPage).toBe(150);
    expect(sorted[1].currentPercentage).toBe(42); // 150/350 = 42.85% → 42%
    expect(sorted[1].pagesRead).toBe(50); // THIS IS THE BUG - might be incorrect if using stale data
  });

  test("should calculate correct percentage when logging by percentage after page edit", async () => {
    // ========================================================================
    // SETUP: Book with 400 pages, currently at 50%
    // ========================================================================
    
    const book = await bookRepository.create(createTestBook({
      calibreId: 2,
      title: "Percentage Test Book",
      authors: ["Test Author"],
      totalPages: 400,
      path: "Test/Book2",
    }));

    const session = await sessionRepository.create(createTestSession({
      bookId: book.id,
      sessionNumber: 1,
      status: "reading",
      isActive: true,
    }));

    // User has logged progress to 50% (200 pages)
    await progressRepository.create(createTestProgress({
      bookId: book.id,
      sessionId: session.id,
      currentPage: 200,
      currentPercentage: 50,
      pagesRead: 200,
      progressDate: new Date("2025-12-07"),
    }));

    // ========================================================================
    // STEP 1: User edits page count to 500
    // ========================================================================
    
    const patchRequest = createMockRequest("PATCH", `/api/books/${book.id}`, {
      totalPages: 500,
    }) as NextRequest;
    
    await PATCH_BOOK(patchRequest, { params: { id: book.id.toString() } });

    // ========================================================================
    // STEP 2: User logs progress at 60% (should be page 300 of 500)
    // ========================================================================
    
    const progressRequest = createMockRequest("POST", `/api/books/${book.id}/progress`, {
      currentPercentage: 60,
      progressDate: new Date("2025-12-08").toISOString(),
    }) as NextRequest;
    
    const progressResponse = await POST_PROGRESS(progressRequest, { params: { id: book.id.toString() } });
    expect(progressResponse.status).toBe(200);

    const result = await progressResponse.json();
    const progressData = result.progressLog;

    // ========================================================================
    // ASSERTIONS: Verify correct calculations
    // ========================================================================
    
    // Assert: Percentage correctly set
    expect(progressData.currentPercentage).toBe(60);
    
    // Assert: Page calculated from NEW totalPages (500 * 0.60 = 300)
    expect(progressData.currentPage).toBe(300);
    
    // Assert: pagesRead is difference from last progress (300 - 200 = 100)
    expect(progressData.pagesRead).toBe(100);
  });

  test("should handle multiple page edits followed by progress logs", async () => {
    // ========================================================================
    // SETUP: Book with initial page count
    // ========================================================================
    
    const book = await bookRepository.create(createTestBook({
      calibreId: 3,
      title: "Multiple Edit Test",
      authors: ["Test Author"],
      totalPages: 200,
      path: "Test/Book3",
    }));

    const session = await sessionRepository.create(createTestSession({
      bookId: book.id,
      sessionNumber: 1,
      status: "reading",
      isActive: true,
    }));

    // Initial progress: page 50 of 200
    await progressRepository.create(createTestProgress({
      bookId: book.id,
      sessionId: session.id,
      currentPage: 50,
      currentPercentage: 25,
      pagesRead: 50,
      progressDate: new Date("2025-12-01"),
    }));

    // ========================================================================
    // STEP 1: Edit to 300 pages, log progress to 100
    // ========================================================================
    
    await PATCH_BOOK(
      createMockRequest("PATCH", `/api/books/${book.id}`, { totalPages: 300 }) as NextRequest,
      { params: { id: book.id.toString() } }
    );

    await POST_PROGRESS(
      createMockRequest("POST", `/api/books/${book.id}/progress`, {
        currentPage: 100,
        progressDate: new Date("2025-12-02").toISOString(),
      }) as NextRequest,
      { params: { id: book.id.toString() } }
    );

    // ========================================================================
    // STEP 2: Edit to 350 pages, log progress to 150
    // ========================================================================
    
    await PATCH_BOOK(
      createMockRequest("PATCH", `/api/books/${book.id}`, { totalPages: 350 }) as NextRequest,
      { params: { id: book.id.toString() } }
    );

    const finalProgressResponse = await POST_PROGRESS(
      createMockRequest("POST", `/api/books/${book.id}/progress`, {
        currentPage: 150,
        progressDate: new Date("2025-12-03").toISOString(),
      }) as NextRequest,
      { params: { id: book.id.toString() } }
    );

    const finalResult = await finalProgressResponse.json();
    const finalProgressData = finalResult.progressLog;

    // ========================================================================
    // ASSERTIONS: Final progress should use current totalPages (350)
    // ========================================================================
    
    expect(finalProgressData.currentPage).toBe(150);
    expect(finalProgressData.currentPercentage).toBe(42); // 150/350 = 42.85% → 42%
    expect(finalProgressData.pagesRead).toBe(50); // 150 - 100 = 50

    // Verify all progress logs have consistent data
    const allProgress = await progressRepository.findBySessionId(session.id);
    expect(allProgress).toHaveLength(3);
    
    const sorted = allProgress.sort((a, b) => 
      new Date(a.progressDate).getTime() - new Date(b.progressDate).getTime()
    );
    
    // All percentages should be recalculated based on FINAL totalPages (350)
    expect(sorted[0].currentPercentage).toBe(14); // 50/350 = 14.28% → 14%
    expect(sorted[1].currentPercentage).toBe(28); // 100/350 = 28.57% → 28%
    expect(sorted[2].currentPercentage).toBe(42); // 150/350 = 42.85% → 42%
    
    // pagesRead should be correct increments
    expect(sorted[0].pagesRead).toBe(50);  // First entry
    expect(sorted[1].pagesRead).toBe(50);  // 100 - 50 = 50
    expect(sorted[2].pagesRead).toBe(50);  // 150 - 100 = 50
  });
});
