import { describe, test, expect, beforeAll, afterAll, beforeEach, mock } from "bun:test";
import { POST } from "@/app/api/books/[id]/status/route";
import { bookRepository, sessionRepository } from "@/lib/repositories";
import { setupTestDatabase, teardownTestDatabase, clearTestDatabase } from "@/__tests__/helpers/db-setup";
import { createMockRequest } from "../fixtures/test-data";
import type { NextRequest } from "next/server";

// Mock revalidatePath (Next.js cache revalidation)
mock.module("next/cache", () => ({
  revalidatePath: () => {},
}));

// Track calls to updateCalibreRating for verification
let calibreRatingCalls: Array<{ calibreId: number; rating: number | null }> = [];

// Mock the calibre-write module to capture calls
mock.module("@/lib/db/calibre-write", () => ({
  updateCalibreRating: (calibreId: number, rating: number | null) => {
    calibreRatingCalls.push({ calibreId, rating });
  },
  readCalibreRating: () => null,
  getCalibreWriteDB: () => ({}),
  closeCalibreWriteDB: () => {},
}));

beforeAll(async () => {
  await setupTestDatabase();
});

afterAll(async () => {
  await teardownTestDatabase();
});

beforeEach(async () => {
  await clearTestDatabase();
  calibreRatingCalls = [];
});

describe("POST /api/books/[id]/status - Rating Sync to Calibre", () => {
  test("should sync rating to Calibre when marking book as 'read' with rating", async () => {
    // Arrange
    const book = await bookRepository.create({
      calibreId: 1,
      title: "Test Book",
      authors: ["Test Author"],
      tags: [],
      path: "Test/Book",
      orphaned: false,
    } as any);
    
    await sessionRepository.create({
      bookId: book.id,
      sessionNumber: 1,
      status: "reading",
      isActive: true,
    } as any);

    // Act
    const request = createMockRequest("POST", `/api/books/${book.id}/status`, {
      status: "read",
      rating: 5,
    });
    const response = await POST(request as NextRequest, {
      params: { id: book.id.toString() },
    });
    const data = await response.json();

    // Assert - Response successful
    expect(response.status).toBe(200);
    expect(data.status).toBe("read");

    // Assert - Calibre was updated
    expect(calibreRatingCalls).toHaveLength(1);
    expect(calibreRatingCalls[0].calibreId).toBe(book.calibreId);
    expect(calibreRatingCalls[0].rating).toBe(5);

    // Assert - Tome DB also updated
    const updatedBook = await bookRepository.findById(book.id);
    expect(updatedBook?.rating).toBe(5);
  });

  test("should remove rating from Calibre when marking as 'read' with rating=null", async () => {
    // Arrange - Book with existing rating
    const book = await bookRepository.create({
      calibreId: 2,
      title: "Test Book 2",
      authors: ["Test Author"],
      tags: [],
      path: "Test/Book2",
      orphaned: false,
      rating: 4,
    } as any);
    
    await sessionRepository.create({
      bookId: book.id,
      sessionNumber: 1,
      status: "reading",
      isActive: true,
    } as any);

    // Act - Mark as read with null rating
    const request = createMockRequest("POST", `/api/books/${book.id}/status`, {
      status: "read",
      rating: null,
    });
    const response = await POST(request as NextRequest, {
      params: { id: book.id.toString() },
    });

    // Assert - Calibre was updated with null
    expect(calibreRatingCalls).toHaveLength(1);
    expect(calibreRatingCalls[0].calibreId).toBe(book.calibreId);
    expect(calibreRatingCalls[0].rating).toBe(null);

    // Assert - Tome DB also updated to null
    const updatedBook = await bookRepository.findById(book.id);
    expect(updatedBook?.rating).toBe(null);
  });

  test("should NOT call updateCalibreRating when rating is not provided", async () => {
    // Arrange
    const book = await bookRepository.create({
      calibreId: 3,
      title: "Test Book 3",
      authors: ["Test Author"],
      tags: [],
      path: "Test/Book3",
      orphaned: false,
    } as any);
    
    await sessionRepository.create({
      bookId: book.id,
      sessionNumber: 1,
      status: "reading",
      isActive: true,
    } as any);

    // Act - Mark as read WITHOUT rating
    const request = createMockRequest("POST", `/api/books/${book.id}/status`, {
      status: "read",
    });
    const response = await POST(request as NextRequest, {
      params: { id: book.id.toString() },
    });

    // Assert - Calibre was NOT called
    expect(calibreRatingCalls).toHaveLength(0);
  });

  test("should sync all rating values (1-5 stars) to Calibre", async () => {
    // Test all possible rating values
    const testCases = [
      { rating: 1, calibreId: 10 },
      { rating: 2, calibreId: 11 },
      { rating: 3, calibreId: 12 },
      { rating: 4, calibreId: 13 },
      { rating: 5, calibreId: 14 },
    ];

    for (const testCase of testCases) {
      // Arrange
      const book = await bookRepository.create({
        calibreId: testCase.calibreId,
        title: `Test Book ${testCase.rating}`,
        authors: ["Test Author"],
        tags: [],
        path: `Test/Book${testCase.rating}`,
        orphaned: false,
      } as any);
      
      await sessionRepository.create({
        bookId: book.id,
        sessionNumber: 1,
        status: "reading",
        isActive: true,
      } as any);

      // Act
      const request = createMockRequest("POST", `/api/books/${book.id}/status`, {
        status: "read",
        rating: testCase.rating,
      });
      await POST(request as NextRequest, {
        params: { id: book.id.toString() },
      });

      // Assert
      expect(calibreRatingCalls).toHaveLength(1);
      expect(calibreRatingCalls[0].rating).toBe(testCase.rating);
      expect(calibreRatingCalls[0].calibreId).toBe(testCase.calibreId);

      // Reset for next iteration
      calibreRatingCalls = [];
    }
  });

  test("should update Tome DB even if Calibre sync throws error", async () => {
    // Arrange - Book with session
    const book = await bookRepository.create({
      calibreId: 20,
      title: "Test Book Error",
      authors: ["Test Author"],
      tags: [],
      path: "Test/BookError",
      orphaned: false,
    } as any);
    
    await sessionRepository.create({
      bookId: book.id,
      sessionNumber: 1,
      status: "reading",
      isActive: true,
    } as any);

    // Mock Calibre write to throw error
    let calibreSyncAttempted = false;
    mock.module("@/lib/db/calibre-write", () => ({
      updateCalibreRating: (calibreId: number, rating: number | null) => {
        calibreSyncAttempted = true;
        throw new Error("Calibre database unavailable");
      },
      readCalibreRating: () => null,
      getCalibreWriteDB: () => ({}),
      closeCalibreWriteDB: () => {},
    }));

    // Act
    const request = createMockRequest("POST", `/api/books/${book.id}/status`, {
      status: "read",
      rating: 5,
    });
    const response = await POST(request as NextRequest, {
      params: { id: book.id.toString() },
    });
    const data = await response.json();

    // Assert - Status update still succeeded
    expect(response.status).toBe(200);
    expect(data.status).toBe("read");
    expect(data.isActive).toBe(false);

    // Assert - Tome DB was still updated with rating
    const updatedBook = await bookRepository.findById(book.id);
    expect(updatedBook?.rating).toBe(5);

    // Assert - Calibre sync was attempted
    expect(calibreSyncAttempted).toBe(true);

    // Restore normal mock
    mock.module("@/lib/db/calibre-write", () => ({
      updateCalibreRating: (calibreId: number, rating: number | null) => {
        calibreRatingCalls.push({ calibreId, rating });
      },
      readCalibreRating: () => null,
      getCalibreWriteDB: () => ({}),
      closeCalibreWriteDB: () => {},
    }));
  });
});
