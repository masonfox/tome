import { describe, test, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import {
  setupTestDatabase,
  teardownTestDatabase,
  clearTestDatabase,
} from "@/__tests__/helpers/db-setup";
import { PATCH, DELETE } from "@/app/api/books/[id]/progress/[progressId]/route";
import { bookRepository, sessionRepository, progressRepository } from "@/lib/repositories";
import { type NewBook } from "@/lib/db/schema/books";
import { createMockRequest , createTestBook, createTestSession, createTestProgress } from "@/__tests__/fixtures/test-data";

/**
 * Mock Rationale: Prevent Next.js cache revalidation side effects during tests.
 * The progress edit API calls revalidatePath to update cached pages, but we don't
 * need to test Next.js's caching behavior - just our business logic.
 */
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(() => {}),
}));

describe("Progress Edit API", () => {
  // Test book data
  const testBook: NewBook = {
    calibreId: 1,
    title: "Test Book",
    path: "Test Author/Test Book (1)",
    totalPages: 400,
    authors: ["Test Author"],
  };

  beforeAll(async () => {
    await setupTestDatabase(__filename);
  });

  afterAll(async () => {
    await teardownTestDatabase(__filename);
  });

  beforeEach(async () => {
    await clearTestDatabase(__filename);
  });

  describe("PATCH /api/books/[id]/progress/[progressId]", () => {
    test("should update progress entry with valid data", async () => {
      // Setup: Create book, session, and progress entry
      const book = await bookRepository.create(testBook);
      const session = await sessionRepository.create({
        bookId: book.id,
        sessionNumber: 1,
        status: "reading",
        isActive: true,
        startedDate: "2025-11-01",
      });

      const progress = await progressRepository.create({
        bookId: book.id,
        sessionId: session.id,
        currentPage: 100,
        currentPercentage: 25,
        pagesRead: 100,
        progressDate: "2025-11-05",
      });

      // Test: Update progress to 150 pages
      const request = createMockRequest(
        "PATCH",
        `/api/books/${book.id}/progress/${progress.id}`,
        {
          currentPage: 150,
          notes: "Updated progress",
        }
      ) as any;

      const response = await PATCH(request, {
        params: { id: book.id.toString(), progressId: progress.id.toString() },
      });

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.currentPage).toBe(150);
      expect(data.currentPercentage).toBe(37); // Math.floor(150/400 * 100) = 37
      expect(data.notes).toBe("Updated progress");
    });

    test("should update progress entry with new date", async () => {
      // Setup: Create book, session, and progress entry
      const book = await bookRepository.create(testBook);
      const session = await sessionRepository.create({
        bookId: book.id,
        sessionNumber: 1,
        status: "reading",
        isActive: true,
        startedDate: "2025-11-01",
      });

      const progress = await progressRepository.create({
        bookId: book.id,
        sessionId: session.id,
        currentPage: 100,
        currentPercentage: 25,
        pagesRead: 100,
        progressDate: "2025-11-05",
      });

      // Test: Update date to Nov 10
      const request = createMockRequest(
        "PATCH",
        `/api/books/${book.id}/progress/${progress.id}`,
        {
          currentPage: 150,
          progressDate: "2025-11-10",
        }
      ) as any;

      const response = await PATCH(request, {
        params: { id: book.id.toString(), progressId: progress.id.toString() },
      });

      expect(response.status).toBe(200);

      const data = await response.json();
      // Compare date string in EST
      expect(data.progressDate).toMatch(/^2025-11-10/);
    });

    test("should reject edit that violates temporal order (before)", async () => {
      // Setup: Create book, session, and progress entries
      const book = await bookRepository.create(testBook);
      const session = await sessionRepository.create({
        bookId: book.id,
        sessionNumber: 1,
        status: "reading",
        isActive: true,
        startedDate: "2025-11-01",
      });

      await progressRepository.create({
        bookId: book.id,
        sessionId: session.id,
        currentPage: 150,
        currentPercentage: 37.5,
        pagesRead: 150,
        progressDate: "2025-11-05",
      });

      const progressToEdit = await progressRepository.create({
        bookId: book.id,
        sessionId: session.id,
        currentPage: 200,
        currentPercentage: 50,
        pagesRead: 50,
        progressDate: "2025-11-10",
      });

      // Test: Try to edit to 100 pages (less than previous 150)
      const request = createMockRequest(
        "PATCH",
        `/api/books/${book.id}/progress/${progressToEdit.id}`,
        {
          currentPage: 100,
        }
      ) as any;

      const response = await PATCH(request, {
        params: { id: book.id.toString(), progressId: progressToEdit.id.toString() },
      });

      expect(response.status).toBe(400);

      const data = await response.json();
      expect(data.error).toContain("must be at least page 150");
      expect(data.conflictingEntry).toBeDefined();
    });

    test("should reject edit that violates temporal order (after)", async () => {
      // Setup: Create book, session, and progress entries
      const book = await bookRepository.create(testBook);
      const session = await sessionRepository.create({
        bookId: book.id,
        sessionNumber: 1,
        status: "reading",
        isActive: true,
        startedDate: "2025-11-01",
      });

      const progressToEdit = await progressRepository.create({
        bookId: book.id,
        sessionId: session.id,
        currentPage: 100,
        currentPercentage: 25,
        pagesRead: 100,
        progressDate: "2025-11-05",
      });

      await progressRepository.create({
        bookId: book.id,
        sessionId: session.id,
        currentPage: 200,
        currentPercentage: 50,
        pagesRead: 100,
        progressDate: "2025-11-15",
      });

      // Test: Try to edit to 250 pages (more than future 200)
      const request = createMockRequest(
        "PATCH",
        `/api/books/${book.id}/progress/${progressToEdit.id}`,
        {
          currentPage: 250,
        }
      ) as any;

      const response = await PATCH(request, {
        params: { id: book.id.toString(), progressId: progressToEdit.id.toString() },
      });

      expect(response.status).toBe(400);

      const data = await response.json();
      expect(data.error).toContain("cannot exceed page 200");
      // Note: Service layer doesn't include conflictingEntry in error response
    });

    test("should recalculate pagesRead based on previous entry", async () => {
      // Setup: Create book, session, and progress entries
      const book = await bookRepository.create(testBook);
      const session = await sessionRepository.create({
        bookId: book.id,
        sessionNumber: 1,
        status: "reading",
        isActive: true,
        startedDate: "2025-11-01",
      });

      await progressRepository.create({
        bookId: book.id,
        sessionId: session.id,
        currentPage: 100,
        currentPercentage: 25,
        pagesRead: 100,
        progressDate: "2025-11-05",
      });

      const progressToEdit = await progressRepository.create({
        bookId: book.id,
        sessionId: session.id,
        currentPage: 200,
        currentPercentage: 50,
        pagesRead: 100,
        progressDate: "2025-11-10",
      });

      // Test: Update to 250 pages
      const request = createMockRequest(
        "PATCH",
        `/api/books/${book.id}/progress/${progressToEdit.id}`,
        {
          currentPage: 250,
        }
      ) as any;

      const response = await PATCH(request, {
        params: { id: book.id.toString(), progressId: progressToEdit.id.toString() },
      });

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.currentPage).toBe(250);
      expect(data.pagesRead).toBe(150); // 250 - 100 (previous entry)
    });

    test("should return 404 for non-existent progress entry", async () => {
      // Setup: Create book only
      const book = await bookRepository.create(testBook);

      // Test: Try to update non-existent progress
      const request = createMockRequest(
        "PATCH",
        `/api/books/${book.id}/progress/999`,
        {
          currentPage: 100,
        }
      ) as any;

      const response = await PATCH(request, {
        params: { id: book.id.toString(), progressId: "999" },
      });

      expect(response.status).toBe(404);

      const data = await response.json();
      expect(data.error).toBe("Progress entry not found");
    });

    test("should return 403 when progress entry does not belong to book", async () => {
      // Setup: Create two books with sessions
      const book1 = await bookRepository.create(testBook);
      const book2 = await bookRepository.create(createTestBook({
        ...testBook,
        calibreId: 2,
        path: "Test Author/Another Book (2)",
      }));

      const session1 = await sessionRepository.create({
        bookId: book1.id,
        sessionNumber: 1,
        status: "reading",
        isActive: true,
        startedDate: "2025-11-01",
      });

      const progress1 = await progressRepository.create({
        bookId: book1.id,
        sessionId: session1.id,
        currentPage: 100,
        currentPercentage: 25,
        pagesRead: 100,
        progressDate: "2025-11-05",
      });

      // Test: Try to update book1's progress using book2's ID
      const request = createMockRequest(
        "PATCH",
        `/api/books/${book2.id}/progress/${progress1.id}`,
        {
          currentPage: 150,
        }
      ) as any;

      const response = await PATCH(request, {
        params: { id: book2.id.toString(), progressId: progress1.id.toString() },
      });

      expect(response.status).toBe(403);

      const data = await response.json();
      expect(data.error).toBe("Progress entry does not belong to this book");
    });
  });

  describe("DELETE /api/books/[id]/progress/[progressId]", () => {
    test("should delete progress entry successfully", async () => {
      // Setup: Create book, session, and progress entry
      const book = await bookRepository.create(testBook);
      const session = await sessionRepository.create({
        bookId: book.id,
        sessionNumber: 1,
        status: "reading",
        isActive: true,
        startedDate: "2025-11-01",
      });

      const progress = await progressRepository.create({
        bookId: book.id,
        sessionId: session.id,
        currentPage: 100,
        currentPercentage: 25,
        pagesRead: 100,
        progressDate: "2025-11-05",
      });

      // Test: Delete progress entry
      const request = createMockRequest(
        "DELETE",
        `/api/books/${book.id}/progress/${progress.id}`
      ) as any;

      const response = await DELETE(request, {
        params: { id: book.id.toString(), progressId: progress.id.toString() },
      });

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.message).toBe("Progress entry deleted");

      // Verify deletion
      const deletedEntry = await progressRepository.findById(progress.id);
      expect(deletedEntry).toBeUndefined();
    });

    test("should return 404 for non-existent progress entry", async () => {
      // Setup: Create book only
      const book = await bookRepository.create(testBook);

      // Test: Try to delete non-existent progress
      const request = createMockRequest(
        "DELETE",
        `/api/books/${book.id}/progress/999`
      ) as any;

      const response = await DELETE(request, {
        params: { id: book.id.toString(), progressId: "999" },
      });

      expect(response.status).toBe(404);

      const data = await response.json();
      expect(data.error).toBe("Progress entry not found");
    });

    test("should return 403 when progress entry does not belong to book", async () => {
      // Setup: Create two books with sessions
      const book1 = await bookRepository.create(testBook);
      const book2 = await bookRepository.create(createTestBook({
        ...testBook,
        calibreId: 2,
        path: "Test Author/Another Book (2)",
      }));

      const session1 = await sessionRepository.create({
        bookId: book1.id,
        sessionNumber: 1,
        status: "reading",
        isActive: true,
        startedDate: "2025-11-01",
      });

      const progress1 = await progressRepository.create({
        bookId: book1.id,
        sessionId: session1.id,
        currentPage: 100,
        currentPercentage: 25,
        pagesRead: 100,
        progressDate: "2025-11-05",
      });

      // Test: Try to delete book1's progress using book2's ID
      const request = createMockRequest(
        "DELETE",
        `/api/books/${book2.id}/progress/${progress1.id}`
      ) as any;

      const response = await DELETE(request, {
        params: { id: book2.id.toString(), progressId: progress1.id.toString() },
      });

      expect(response.status).toBe(403);

      const data = await response.json();
      expect(data.error).toBe("Progress entry does not belong to this book");
    });
  });

  describe("PATCH - stable sort with same-date entries (issue #399)", () => {
    test("should calculate pagesRead correctly when moving entry with same-date siblings", async () => {
      // Reproduce the exact scenario from issue #399
      const book = await bookRepository.create(testBook);
      const session = await sessionRepository.create({
        bookId: book.id,
        sessionNumber: 1,
        status: "reading",
        isActive: true,
        startedDate: "2026-03-08",
      });

      // Create the exact entries from the bug report
      // Entry 1: Mar 8, page 43
      const entry1 = await progressRepository.create({
        bookId: book.id,
        sessionId: session.id,
        currentPage: 43,
        currentPercentage: 9,
        pagesRead: 43,
        progressDate: "2026-03-08",
      });

      // Entry 2: Mar 8, page 57 (stable sort uses ID as tiebreaker)
      const entry2 = await progressRepository.create({
        bookId: book.id,
        sessionId: session.id,
        currentPage: 57,
        currentPercentage: 13,
        pagesRead: 14,
        progressDate: "2026-03-08",
      });

      // Entry 3: Mar 9, page 122 (should read 65 pages: 122 - 57)
      const entry3 = await progressRepository.create({
        bookId: book.id,
        sessionId: session.id,
        currentPage: 122,
        currentPercentage: 28,
        pagesRead: 65,
        progressDate: "2026-03-09",
      });

      // Step 1: Move entry3 from Mar 9 to Mar 8
      const request1 = createMockRequest(
        "PATCH",
        `/api/books/${book.id}/progress/${entry3.id}`,
        { progressDate: "2026-03-08" }
      ) as any;

      const response1 = await PATCH(request1, {
        params: { id: book.id.toString(), progressId: entry3.id.toString() },
      });

      expect(response1.status).toBe(200);
      const data1 = await response1.json();
      expect(data1.progressDate).toBe("2026-03-08");
      // pagesRead should be calculated consistently
      
      // Step 2: Move entry3 back from Mar 8 to Mar 9
      const request2 = createMockRequest(
        "PATCH",
        `/api/books/${book.id}/progress/${entry3.id}`,
        { progressDate: "2026-03-09" }
      ) as any;

      const response2 = await PATCH(request2, {
        params: { id: book.id.toString(), progressId: entry3.id.toString() },
      });

      expect(response2.status).toBe(200);
      const data2 = await response2.json();
      
      // Critical assertion: Should be 65 pages (122 - 57), not 79 (122 - 43)
      expect(data2.progressDate).toBe("2026-03-09");
      expect(data2.currentPage).toBe(122);
      expect(data2.pagesRead).toBe(65); // This was the bug - it returned 79
    });
  });
});
