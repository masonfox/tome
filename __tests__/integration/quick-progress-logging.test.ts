import { describe, test, expect, beforeEach, beforeAll, afterAll } from "bun:test";
import { setupTestDatabase, teardownTestDatabase, clearTestDatabase } from "@/__tests__/helpers/db-setup";
import { bookRepository, sessionRepository, progressRepository } from "@/lib/repositories";
import { ProgressService } from "@/lib/services/progress.service";
import { createTestBook, createTestSession } from "../fixtures/test-data";

/**
 * Integration tests for the Quick Progress Logging feature
 * 
 * Tests the service layer for:
 * - Logging progress by page/percentage
 * - Completion detection (100% progress)
 * - Progress validation
 */

const progressService = new ProgressService();

beforeAll(async () => {
  await setupTestDatabase(__filename);
});

afterAll(async () => {
  await teardownTestDatabase(__filename);
});

beforeEach(async () => {
  await clearTestDatabase(__filename);
});

describe("Integration: Quick Progress Logging Flow", () => {
  test("should log progress from dashboard and update book state", async () => {
    // ARRANGE: Create a book that user is currently reading
    const book = await bookRepository.create(createTestBook({
      calibreId: 1,
      title: "Dashboard Test Book",
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

    // User has already read 100 pages
    await progressRepository.create({
      bookId: book.id,
      sessionId: session.id,
      currentPage: 100,
      currentPercentage: 33,
      pagesRead: 100,
      progressDate: new Date("2025-12-20"),
    });

    // ACT: User logs progress to page 150
    const result = await progressService.logProgress(book.id, {
      currentPage: 150,
      progressDate: new Date("2025-12-21"),
    });

    // ASSERT: Progress logged successfully
    expect(result.progressLog).toBeDefined();
    expect(result.progressLog.currentPage).toBe(150);
    expect(result.progressLog.currentPercentage).toBe(50); // 150/300
    expect(result.progressLog.pagesRead).toBe(50); // 150 - 100
    expect(result.shouldShowCompletionModal).toBe(false); // Not at 100% yet

    // ASSERT: Progress is persisted in database
    const allProgress = await progressRepository.findBySessionId(session.id);
    expect(allProgress).toHaveLength(2);
    
    const latestProgress = allProgress.sort((a, b) => 
      new Date(b.progressDate).getTime() - new Date(a.progressDate).getTime()
    )[0];
    
    expect(latestProgress.currentPage).toBe(150);
    expect(latestProgress.pagesRead).toBe(50);
  });

  test("should handle logging progress by percentage", async () => {
    // ARRANGE
    const book = await bookRepository.create(createTestBook({
      calibreId: 2,
      title: "Percentage Test Book",
      authors: ["Test Author"],
      totalPages: 500,
      path: "Test/Book2",
    }));

    await sessionRepository.create(createTestSession({
      bookId: book.id,
      sessionNumber: 1,
      status: "reading",
      isActive: true,
    }));

    // ACT: Log progress by percentage
    const result = await progressService.logProgress(book.id, {
      currentPercentage: 60,
      progressDate: new Date("2025-12-21"),
    });

    // ASSERT
    expect(result.progressLog.currentPercentage).toBe(60);
    expect(result.progressLog.currentPage).toBe(300); // 60% of 500
    expect(result.shouldShowCompletionModal).toBe(false);
  });

  test("should handle multiple quick progress logs in sequence", async () => {
    // ARRANGE
    const book = await bookRepository.create(createTestBook({
      calibreId: 5,
      title: "Sequential Progress Book",
      authors: ["Test Author"],
      totalPages: 500,
      path: "Test/Book5",
    }));

    const session = await sessionRepository.create(createTestSession({
      bookId: book.id,
      sessionNumber: 1,
      status: "reading",
      isActive: true,
    }));

    // ACT: Log progress 3 times over 3 days
    await progressService.logProgress(book.id, {
      currentPage: 100,
      progressDate: new Date("2025-12-19"),
    });

    await progressService.logProgress(book.id, {
      currentPage: 250,
      progressDate: new Date("2025-12-20"),
    });

    const finalResult = await progressService.logProgress(book.id, {
      currentPage: 400,
      progressDate: new Date("2025-12-21"),
    });

    // ASSERT
    expect(finalResult.progressLog.currentPage).toBe(400);
    expect(finalResult.progressLog.pagesRead).toBe(150); // 400 - 250

    // Check all progress entries
    const allProgress = await progressRepository.findBySessionId(session.id);
    expect(allProgress).toHaveLength(3);

    const sorted = allProgress.sort((a, b) => a.currentPage - b.currentPage);
    expect(sorted[0].pagesRead).toBe(100); // First entry
    expect(sorted[1].pagesRead).toBe(150); // 250 - 100
    expect(sorted[2].pagesRead).toBe(150); // 400 - 250
  });

  test("should include notes when logging progress", async () => {
    // ARRANGE
    const book = await bookRepository.create(createTestBook({
      calibreId: 6,
      title: "Notes Test Book",
      authors: ["Test Author"],
      totalPages: 300,
      path: "Test/Book6",
    }));

    await sessionRepository.create(createTestSession({
      bookId: book.id,
      sessionNumber: 1,
      status: "reading",
      isActive: true,
    }));

    // ACT: Log progress with notes
    const notes = "Great chapter! The plot twist was unexpected.";
    const result = await progressService.logProgress(book.id, {
      currentPage: 150,
      notes: notes,
      progressDate: new Date("2025-12-21"),
    });

    // ASSERT
    expect(result.progressLog.notes).toBe(notes);
  });
});

describe("Integration: Completion Flow", () => {
  test("should trigger completion modal when logging to 100%", async () => {
    // ARRANGE
    const book = await bookRepository.create(createTestBook({
      calibreId: 10,
      title: "Completion Test Book",
      authors: ["Test Author"],
      totalPages: 300,
      path: "Test/Book10",
    }));

    const session = await sessionRepository.create(createTestSession({
      bookId: book.id,
      sessionNumber: 1,
      status: "reading",
      isActive: true,
    }));

    // User at 90%
    await progressRepository.create({
      bookId: book.id,
      sessionId: session.id,
      currentPage: 270,
      currentPercentage: 90,
      pagesRead: 270,
      progressDate: new Date("2025-12-20"),
    });

    // ACT: Log progress to 100%
    const result = await progressService.logProgress(book.id, {
      currentPage: 300,
      progressDate: new Date("2025-12-21"),
    });

    // ASSERT: Should indicate completion modal should show
    expect(result.progressLog.currentPage).toBe(300);
    expect(result.progressLog.currentPercentage).toBe(100);
    expect(result.shouldShowCompletionModal).toBe(true);
  });

  test("should show completion modal when logging by percentage to 100%", async () => {
    // ARRANGE
    const book = await bookRepository.create(createTestBook({
      calibreId: 12,
      title: "Percentage Completion Book",
      authors: ["Test Author"],
      totalPages: 400,
      path: "Test/Book12",
    }));

    await sessionRepository.create(createTestSession({
      bookId: book.id,
      sessionNumber: 1,
      status: "reading",
      isActive: true,
    }));

    // ACT: Log 100% by percentage
    const result = await progressService.logProgress(book.id, {
      currentPercentage: 100,
      progressDate: new Date("2025-12-21"),
    });

    // ASSERT
    expect(result.progressLog.currentPercentage).toBe(100);
    expect(result.progressLog.currentPage).toBe(400);
    expect(result.shouldShowCompletionModal).toBe(true);
  });

  test("should not show completion modal at 99%", async () => {
    // ARRANGE
    const book = await bookRepository.create(createTestBook({
      calibreId: 13,
      title: "99% Book",
      authors: ["Test Author"],
      totalPages: 300,
      path: "Test/Book13",
    }));

    await sessionRepository.create(createTestSession({
      bookId: book.id,
      sessionNumber: 1,
      status: "reading",
      isActive: true,
    }));

    // ACT: Log to 99%
    const result = await progressService.logProgress(book.id, {
      currentPage: 297, // 99%
      progressDate: new Date("2025-12-21"),
    });

    // ASSERT
    expect(result.progressLog.currentPercentage).toBe(99);
    expect(result.shouldShowCompletionModal).toBe(false);
  });

  test("should handle user choosing to continue reading after 100%", async () => {
    // ARRANGE
    const book = await bookRepository.create(createTestBook({
      calibreId: 14,
      title: "Continue Reading Book",
      authors: ["Test Author"],
      totalPages: 300,
      path: "Test/Book14",
    }));

    const session = await sessionRepository.create(createTestSession({
      bookId: book.id,
      sessionNumber: 1,
      status: "reading",
      isActive: true,
    }));

    // Log to 100% - auto-completes the book
    const result = await progressService.logProgress(book.id, {
      currentPage: 300,
      progressDate: new Date("2025-12-21"),
    });

    // ASSERT: Book is auto-completed
    expect(result.shouldShowCompletionModal).toBe(true);
    
    // Session is now marked as "read" (auto-completed)
    const completedSession = await sessionRepository.findById(session.id);
    expect(completedSession?.status).toBe("read");
    expect(completedSession?.completedDate).toBeDefined();
    
    // ACT: User wants to continue reading - they need to change status back to "reading"
    // This creates a new reading session
    await sessionRepository.create(createTestSession({
      bookId: book.id,
      sessionNumber: 2,
      status: "reading",
      isActive: true,
    }));
    
    // Now they can log more progress
    const additionalResult = await progressService.logProgress(book.id, {
      currentPage: 300,
      notes: "Re-reading favorite chapter",
      progressDate: new Date("2025-12-22"),
    });

    // ASSERT: Should allow additional progress in new session
    expect(additionalResult).toBeDefined();
    expect(additionalResult.progressLog).toBeDefined();
  });
});
