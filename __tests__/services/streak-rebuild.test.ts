import { test, expect, describe, beforeAll, afterAll, beforeEach, mock } from "bun:test";
import { progressService } from "@/lib/services";
import { bookRepository, sessionRepository, progressRepository, streakRepository } from "@/lib/repositories";
import { setupTestDatabase, teardownTestDatabase, clearTestDatabase } from "@/__tests__/helpers/db-setup";

/**
 * Test suite for streak rebuild logic in progress mutations
 * 
 * Focus area: Ensuring that ALL progress mutations (create, update, delete)
 * call rebuildStreak() to keep streak data accurate and self-correcting
 */

/**
 * Mock Rationale: Prevent Next.js cache revalidation side effects during tests.
 * Progress service calls revalidatePath on mutations, but we don't need to test
 * Next.js's caching behavior - just our business logic.
 */
mock.module("next/cache", () => ({ revalidatePath: () => {} }));

beforeAll(async () => {
  await setupTestDatabase(__filename);
});

afterAll(async () => {
  await teardownTestDatabase(__filename);
});

beforeEach(async () => {
  await clearTestDatabase(__filename);
});

// Helper to get relative dates (always in UTC)
function getDaysAgo(days: number): Date {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - days);
  date.setUTCHours(12, 0, 0, 0); // Noon UTC
  return date;
}

describe("Progress Mutations - Streak Rebuild Integration", () => {
  test("should rebuild streak when creating new progress log", async () => {
    // Create book and session
    const book = await bookRepository.create({
      calibreId: 1,
      title: "Test Book",
      authors: ["Author One"],
      totalPages: 300,
      tags: [],
      path: "Author One/Test Book (1)",
    });

    const session = await sessionRepository.create({
      bookId: book.id,
      sessionNumber: 1,
      status: "reading",
      isActive: true,
    });

    const today = getDaysAgo(0);
    const yesterday = getDaysAgo(1);

    // Create initial streak (incorrect state)
    await streakRepository.create({
      currentStreak: 0,
      longestStreak: 0,
      lastActivityDate: yesterday,
      dailyThreshold: 1,
      totalDaysActive: 0,
    });

    // Log progress today - this should rebuild streak
    const progress = await progressService.logProgress(book.id, {
      currentPage: 50,
      progressDate: today,
    });

    // Verify streak was rebuilt correctly
    const streak = await streakRepository.findByUserId(null);
    expect(streak).not.toBeNull();
    expect(streak!.currentStreak).toBe(1); // Should be 1 (corrected from 0)
    expect(streak!.totalDaysActive).toBe(1);
  });

  test("should rebuild streak when updating progress log", async () => {
    // Create book and session
    const book = await bookRepository.create({
      calibreId: 2,
      title: "Update Test Book",
      authors: ["Author Two"],
      totalPages: 400,
      tags: [],
      path: "Author Two/Update Test Book (2)",
    });

    const session = await sessionRepository.create({
      bookId: book.id,
      sessionNumber: 1,
      status: "reading",
      isActive: true,
    });

    const day3Ago = getDaysAgo(3);
    const day2Ago = getDaysAgo(2);

    // Create progress 3 days ago
    const progress = await progressRepository.create({
      bookId: book.id,
      sessionId: session.id,
      currentPage: 50,
      currentPercentage: 12.5,
      progressDate: day3Ago,
      pagesRead: 50,
    });

    // Create streak (should be 1 day active)
    await streakRepository.create({
      currentStreak: 1,
      longestStreak: 1,
      lastActivityDate: day3Ago,
      dailyThreshold: 1,
      totalDaysActive: 1,
    });

    // Update progress to a different date (2 days ago)
    await progressService.updateProgress(progress.id, {
      currentPage: 100,
      progressDate: day2Ago,
    });

    // Verify streak was rebuilt correctly
    const streak = await streakRepository.findByUserId(null);
    expect(streak).not.toBeNull();
    // Streak should still reflect accurate data based on actual progress dates
    expect(streak!.totalDaysActive).toBe(1); // Only one day (2 days ago) now
  });

  test("should rebuild streak when deleting progress log", async () => {
    // Create book and session
    const book = await bookRepository.create({
      calibreId: 3,
      title: "Delete Test Book",
      authors: ["Author Three"],
      totalPages: 350,
      tags: [],
      path: "Author Three/Delete Test Book (3)",
    });

    const session = await sessionRepository.create({
      bookId: book.id,
      sessionNumber: 1,
      status: "reading",
      isActive: true,
    });

    const day2Ago = getDaysAgo(2);
    const day1Ago = getDaysAgo(1);

    // Create progress on 2 consecutive days
    const progress1 = await progressRepository.create({
      bookId: book.id,
      sessionId: session.id,
      currentPage: 50,
      currentPercentage: 14.29,
      progressDate: day2Ago,
      pagesRead: 50,
    });

    await progressRepository.create({
      bookId: book.id,
      sessionId: session.id,
      currentPage: 100,
      currentPercentage: 28.57,
      progressDate: day1Ago,
      pagesRead: 50,
    });

    // Create streak (2 days active)
    await streakRepository.create({
      currentStreak: 2,
      longestStreak: 2,
      lastActivityDate: day1Ago,
      dailyThreshold: 1,
      totalDaysActive: 2,
    });

    // Delete first progress log
    await progressService.deleteProgress(progress1.id);

    // Verify streak was rebuilt correctly
    const streak = await streakRepository.findByUserId(null);
    expect(streak).not.toBeNull();
    expect(streak!.totalDaysActive).toBe(1); // Only 1 day ago remains
  });

  test("should self-correct incorrect streak data on progress create", async () => {
    // Simulate scenario where streak initialization was wrong
    const book = await bookRepository.create({
      calibreId: 4,
      title: "Self-Correction Book",
      authors: ["Author Four"],
      totalPages: 300,
      tags: [],
      path: "Author Four/Self-Correction Book (4)",
    });

    const session = await sessionRepository.create({
      bookId: book.id,
      sessionNumber: 1,
      status: "reading",
      isActive: true,
    });

    // Create historical progress (last 4 days)
    const day3Ago = getDaysAgo(3);
    const day2Ago = getDaysAgo(2);
    const day1Ago = getDaysAgo(1);
    const today = getDaysAgo(0);

    await progressRepository.create({
      bookId: book.id,
      sessionId: session.id,
      currentPage: 50,
      currentPercentage: 16.67,
      progressDate: day3Ago,
      pagesRead: 50,
    });

    await progressRepository.create({
      bookId: book.id,
      sessionId: session.id,
      currentPage: 100,
      currentPercentage: 33.33,
      progressDate: day2Ago,
      pagesRead: 50,
    });

    await progressRepository.create({
      bookId: book.id,
      sessionId: session.id,
      currentPage: 150,
      currentPercentage: 50.0,
      progressDate: day1Ago,
      pagesRead: 50,
    });

    // Create streak with WRONG data (only 1 day instead of 3)
    await streakRepository.create({
      currentStreak: 1,
      longestStreak: 1,
      lastActivityDate: day1Ago,
      dailyThreshold: 1,
      totalDaysActive: 1,
    });

    // Log new progress today - this should rebuild and self-correct
    await progressService.logProgress(book.id, {
      currentPage: 200,
      progressDate: today,
    });

    // Verify streak was self-corrected
    const streak = await streakRepository.findByUserId(null);
    expect(streak).not.toBeNull();
    expect(streak!.currentStreak).toBe(4); // Should be 4, not 2
    expect(streak!.totalDaysActive).toBe(4); // Should be 4, not 2
  });

  test("should handle streak rebuild failures gracefully", async () => {
    // This test ensures that if streak rebuild fails, the progress mutation still succeeds
    const book = await bookRepository.create({
      calibreId: 5,
      title: "Error Handling Book",
      authors: ["Author Five"],
      totalPages: 300,
      tags: [],
      path: "Author Five/Error Handling Book (5)",
    });

    const session = await sessionRepository.create({
      bookId: book.id,
      sessionNumber: 1,
      status: "reading",
      isActive: true,
    });

    const day2Ago = getDaysAgo(2);

    // Don't create a streak - this might cause rebuildStreak to fail

    // Log progress - should succeed even if streak rebuild encounters issues
    const result = await progressService.logProgress(book.id, {
      currentPage: 50,
      progressDate: day2Ago,
    });
    const progress = result.progressLog;

    expect(progress).not.toBeNull();
    expect(progress.currentPage).toBe(50);

    // Progress should be saved regardless of streak system
    const savedProgress = await progressRepository.findById(progress.id);
    expect(savedProgress).not.toBeNull();
    expect(savedProgress!.currentPage).toBe(50);
  });

  test("should rebuild streak correctly after multiple sequential mutations", async () => {
    // Test that streak stays accurate through a sequence of operations
    const book = await bookRepository.create({
      calibreId: 6,
      title: "Sequential Mutations Book",
      authors: ["Author Six"],
      totalPages: 400,
      tags: [],
      path: "Author Six/Sequential Mutations Book (6)",
    });

    const session = await sessionRepository.create({
      bookId: book.id,
      sessionNumber: 1,
      status: "reading",
      isActive: true,
    });

    const day4Ago = getDaysAgo(4);
    const day3Ago = getDaysAgo(3);
    const day2Ago = getDaysAgo(2);
    const day1Ago = getDaysAgo(1);

    // Initial streak
    await streakRepository.create({
      currentStreak: 0,
      longestStreak: 0,
      lastActivityDate: day4Ago,
      dailyThreshold: 1,
      totalDaysActive: 0,
    });

    // Create progress 3 days ago
    const result1 = await progressService.logProgress(book.id, {
      currentPage: 50,
      progressDate: day3Ago,
    });
    const progress1 = result1.progressLog;

    let streak = await streakRepository.findByUserId(null);
    expect(streak!.totalDaysActive).toBe(1);

    // Create progress 2 days ago
    const result2 = await progressService.logProgress(book.id, {
      currentPage: 100,
      progressDate: day2Ago,
    });
    const progress2 = result2.progressLog;

    streak = await streakRepository.findByUserId(null);
    expect(streak!.totalDaysActive).toBe(2);

    // Update progress2 to a different page
    await progressService.updateProgress(progress2.id, {
      currentPage: 120,
    });

    streak = await streakRepository.findByUserId(null);
    expect(streak!.totalDaysActive).toBe(2); // Should still be 2

    // Delete progress1
    await progressService.deleteProgress(progress1.id);

    streak = await streakRepository.findByUserId(null);
    expect(streak!.totalDaysActive).toBe(1); // Now should be 1 (only 2 days ago)

    // Create new progress 1 day ago
    await progressService.logProgress(book.id, {
      currentPage: 150,
      progressDate: day1Ago,
    });

    streak = await streakRepository.findByUserId(null);
    expect(streak!.totalDaysActive).toBe(2); // 2 days ago + 1 day ago
  });
});

describe("Progress Mutations - Data Integrity", () => {
  test("progress create should maintain data integrity even if streak update fails", async () => {
    // Ensure that progress is saved correctly regardless of streak system state
    const book = await bookRepository.create({
      calibreId: 7,
      title: "Integrity Test Book",
      authors: ["Author Seven"],
      totalPages: 300,
      tags: [],
      path: "Author Seven/Integrity Test Book (7)",
    });

    const session = await sessionRepository.create({
      bookId: book.id,
      sessionNumber: 1,
      status: "reading",
      isActive: true,
    });

    const day1Ago = getDaysAgo(1);

    // Log progress
    const result = await progressService.logProgress(book.id, {
      currentPage: 75,
      progressDate: day1Ago,
    });
    const progress = result.progressLog;

    // Verify progress was saved correctly
    expect(progress.currentPage).toBe(75);
    expect(progress.bookId).toBe(book.id);
    expect(progress.sessionId).toBe(session.id);

    // Verify it's persisted in database
    const savedProgress = await progressRepository.findById(progress.id);
    expect(savedProgress).not.toBeNull();
    expect(savedProgress!.currentPage).toBe(75);
  });

  test("progress update should maintain data integrity even if streak update fails", async () => {
    const book = await bookRepository.create({
      calibreId: 8,
      title: "Update Integrity Book",
      authors: ["Author Eight"],
      totalPages: 400,
      tags: [],
      path: "Author Eight/Update Integrity Book (8)",
    });

    const session = await sessionRepository.create({
      bookId: book.id,
      sessionNumber: 1,
      status: "reading",
      isActive: true,
    });

    const day2Ago = getDaysAgo(2);

    // Create initial progress
    const progress = await progressRepository.create({
      bookId: book.id,
      sessionId: session.id,
      currentPage: 50,
      currentPercentage: 12.5,
      progressDate: day2Ago,
      pagesRead: 50,
    });

    // Update progress
    const updated = await progressService.updateProgress(progress.id, {
      currentPage: 150,
    });

    // Verify update was applied correctly
    expect(updated.currentPage).toBe(150);

    // Verify it's persisted in database
    const savedProgress = await progressRepository.findById(progress.id);
    expect(savedProgress).not.toBeNull();
    expect(savedProgress!.currentPage).toBe(150);
  });

  test("progress delete should maintain data integrity even if streak update fails", async () => {
    const book = await bookRepository.create({
      calibreId: 9,
      title: "Delete Integrity Book",
      authors: ["Author Nine"],
      totalPages: 300,
      tags: [],
      path: "Author Nine/Delete Integrity Book (9)",
    });

    const session = await sessionRepository.create({
      bookId: book.id,
      sessionNumber: 1,
      status: "reading",
      isActive: true,
    });

    const day3Ago = getDaysAgo(3);

    // Create progress
    const progress = await progressRepository.create({
      bookId: book.id,
      sessionId: session.id,
      currentPage: 100,
      currentPercentage: 33.33,
      progressDate: day3Ago,
      pagesRead: 100,
    });

    // Delete progress
    const result = await progressService.deleteProgress(progress.id);
    expect(result).toBe(true);

    // Verify it's deleted from database
    const deletedProgress = await progressRepository.findById(progress.id);
    expect(deletedProgress).toBeUndefined();
  });
});
