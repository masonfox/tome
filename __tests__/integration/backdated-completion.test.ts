import { describe, test, expect, beforeAll, afterAll, beforeEach, mock } from "bun:test";
import { setupTestDatabase, teardownTestDatabase, clearTestDatabase } from "@/__tests__/helpers/db-setup";
import { bookRepository, sessionRepository, progressRepository } from "@/lib/repositories";
import { POST as progressPost } from "@/app/api/books/[id]/progress/route";
import { POST as statusPost } from "@/app/api/books/[id]/status/route";
import { createMockRequest } from "@/__tests__/fixtures/test-data";
import type { NextRequest } from "next/server";

/**
 * Integration Tests: Backdated Progress Completion Date
 * 
 * Tests the complete flow of logging progress to 100% with a backdated date
 * and ensuring that date is used as the completedDate when marking the book as read.
 * 
 * Bug Fix Context:
 * Previously, logging progress to 100% with a backdated date (e.g., 2 weeks ago)
 * would incorrectly set the book's completedDate to today instead of the backdated
 * progress date.
 * 
 * Solution:
 * 1. Progress service returns completionDate in the result when shouldShowCompletionModal is true
 * 2. Hook captures and returns the completionDate from the progress log API response
 * 3. LogProgressModal passes completedDate in the body when calling status API
 */

/**
 * Mock Rationale: Prevent Next.js cache revalidation side effects during tests.
 */
mock.module("next/cache", () => ({
  revalidatePath: mock(() => {}),
}));

describe("Backdated Progress Completion Integration", () => {
  let testBook: any;

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
    await sessionRepository.create({
      bookId: testBook.id,
      sessionNumber: 1,
      status: "reading",
      isActive: true,
      startedDate: new Date("2025-11-01"),
    });
  });

  describe("Full Flow: Progress to 100% → Mark as Read", () => {
    test("should use backdated progress date as completedDate when marking book as read", async () => {
      // Step 1: Log progress to 100% with backdated date (2 weeks ago)
      const twoWeeksAgo = new Date();
      twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
      twoWeeksAgo.setHours(15, 30, 0, 0);

      const progressRequest = createMockRequest("POST", "/api/books/123/progress", {
        currentPage: 500, // 100%
        progressDate: twoWeeksAgo.toISOString(),
      });
      const progressParams = { id: testBook.id.toString() };

      const progressResponse = await progressPost(progressRequest as NextRequest, { params: progressParams });
      const progressData = await progressResponse.json();

      // Verify progress API returns completion flag and date
      expect(progressResponse.status).toBe(200);
      expect(progressData.shouldShowCompletionModal).toBe(true);
      expect(progressData.completionDate).toBeDefined();
      expect(new Date(progressData.completionDate).toISOString()).toBe(twoWeeksAgo.toISOString());

      // Step 2: Mark book as read using the returned completionDate
      const statusRequest = createMockRequest("POST", `/api/books/${testBook.id}/status`, {
        status: "read",
        completedDate: progressData.completionDate, // Use date from progress API
      });
      const statusParams = { id: testBook.id.toString() };

      const statusResponse = await statusPost(statusRequest as NextRequest, { params: statusParams });
      const statusData = await statusResponse.json();

      // Verify status API accepted the backdated completedDate
      expect(statusResponse.status).toBe(200);
      expect(statusData.status).toBe("read");
      expect(statusData.completedDate).toBeDefined();
      expect(new Date(statusData.completedDate).toISOString()).toBe(twoWeeksAgo.toISOString());

      // Step 3: Verify database has correct completedDate
      // Note: When marked as "read", the session is archived (isActive = false)
      const sessions = await sessionRepository.findAllByBookId(testBook.id);
      const completedSession = sessions.find((s: any) => s.status === "read");
      expect(completedSession).toBeDefined();
      expect(completedSession!.status).toBe("read");
      expect(completedSession!.completedDate).toBeDefined();
      
      // Account for SQLite second precision
      const storedDate = new Date(completedSession!.completedDate!);
      const expectedDate = new Date(twoWeeksAgo);
      expect(Math.abs(storedDate.getTime() - expectedDate.getTime())).toBeLessThan(2000);
    });

    test("should use backdated progress percentage date as completedDate", async () => {
      // Step 1: Log progress to 100% by percentage with backdated date
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
      oneWeekAgo.setHours(9, 15, 0, 0);

      const progressRequest = createMockRequest("POST", "/api/books/123/progress", {
        currentPercentage: 100,
        progressDate: oneWeekAgo.toISOString(),
        notes: "Finished last week",
      });
      const progressParams = { id: testBook.id.toString() };

      const progressResponse = await progressPost(progressRequest as NextRequest, { params: progressParams });
      const progressData = await progressResponse.json();

      expect(progressResponse.status).toBe(200);
      expect(progressData.shouldShowCompletionModal).toBe(true);
      expect(progressData.completionDate).toBeDefined();

      // Step 2: Mark book as read
      const statusRequest = createMockRequest("POST", `/api/books/${testBook.id}/status`, {
        status: "read",
        completedDate: progressData.completionDate,
      });
      const statusParams = { id: testBook.id.toString() };

      const statusResponse = await statusPost(statusRequest as NextRequest, { params: statusParams });
      const statusData = await statusResponse.json();

      expect(statusResponse.status).toBe(200);
      expect(new Date(statusData.completedDate).toISOString()).toBe(oneWeekAgo.toISOString());
    });

    test("should use current date as completedDate when no backdated progress", async () => {
      const beforeTime = new Date();

      // Step 1: Log progress to 100% without backdating
      const progressRequest = createMockRequest("POST", "/api/books/123/progress", {
        currentPage: 500,
      });
      const progressParams = { id: testBook.id.toString() };

      const progressResponse = await progressPost(progressRequest as NextRequest, { params: progressParams });
      const progressData = await progressResponse.json();

      const afterTime = new Date();

      expect(progressResponse.status).toBe(200);
      expect(progressData.shouldShowCompletionModal).toBe(true);
      expect(progressData.completionDate).toBeDefined();

      const returnedDate = new Date(progressData.completionDate);
      expect(returnedDate.getTime()).toBeGreaterThanOrEqual(beforeTime.getTime() - 1000);
      expect(returnedDate.getTime()).toBeLessThanOrEqual(afterTime.getTime() + 1000);

      // Step 2: Mark book as read
      const statusRequest = createMockRequest("POST", `/api/books/${testBook.id}/status`, {
        status: "read",
        completedDate: progressData.completionDate,
      });
      const statusParams = { id: testBook.id.toString() };

      const statusResponse = await statusPost(statusRequest as NextRequest, { params: statusParams });
      const statusData = await statusResponse.json();

      expect(statusResponse.status).toBe(200);
      const completedDate = new Date(statusData.completedDate);
      expect(completedDate.getTime()).toBeGreaterThanOrEqual(beforeTime.getTime() - 1000);
      expect(completedDate.getTime()).toBeLessThanOrEqual(afterTime.getTime() + 1000);
    });

    test("should handle backdated completion from progress with existing prior progress", async () => {
      // Add some prior progress
      const session = await sessionRepository.findActiveByBookId(testBook.id);
      await progressRepository.create({
        bookId: testBook.id,
        sessionId: session!.id,
        currentPage: 250,
        currentPercentage: 50,
        progressDate: new Date("2025-11-15"),
        pagesRead: 250,
      });

      // Log completion progress with backdated date
      const completionDate = new Date("2025-11-20T14:00:00.000Z");

      const progressRequest = createMockRequest("POST", "/api/books/123/progress", {
        currentPage: 500,
        progressDate: completionDate.toISOString(),
        notes: "Finally finished!",
      });
      const progressParams = { id: testBook.id.toString() };

      const progressResponse = await progressPost(progressRequest as NextRequest, { params: progressParams });
      const progressData = await progressResponse.json();

      expect(progressResponse.status).toBe(200);
      expect(progressData.shouldShowCompletionModal).toBe(true);
      expect(new Date(progressData.completionDate).toISOString()).toBe(completionDate.toISOString());

      // Mark as read
      const statusRequest = createMockRequest("POST", `/api/books/${testBook.id}/status`, {
        status: "read",
        completedDate: progressData.completionDate,
      });
      const statusParams = { id: testBook.id.toString() };

      const statusResponse = await statusPost(statusRequest as NextRequest, { params: statusParams });
      const statusData = await statusResponse.json();

      expect(statusResponse.status).toBe(200);
      expect(new Date(statusData.completedDate).toISOString()).toBe(completionDate.toISOString());
    });
  });

  describe("Edge Cases", () => {
    test("should not return completionDate for progress below 100%", async () => {
      const backdatedDate = new Date("2025-11-10T12:00:00.000Z");

      const progressRequest = createMockRequest("POST", "/api/books/123/progress", {
        currentPage: 450, // 90%
        progressDate: backdatedDate.toISOString(),
      });
      const progressParams = { id: testBook.id.toString() };

      const progressResponse = await progressPost(progressRequest as NextRequest, { params: progressParams });
      const progressData = await progressResponse.json();

      expect(progressResponse.status).toBe(200);
      expect(progressData.shouldShowCompletionModal).toBe(false);
      expect(progressData.completionDate).toBeUndefined();
    });

    test("should handle multiple progress logs before completion", async () => {
      const session = await sessionRepository.findActiveByBookId(testBook.id);

      // Log progress at 25%
      await progressRepository.create({
        bookId: testBook.id,
        sessionId: session!.id,
        currentPage: 125,
        currentPercentage: 25,
        progressDate: new Date("2025-11-10"),
        pagesRead: 125,
      });

      // Log progress at 50%
      await progressRepository.create({
        bookId: testBook.id,
        sessionId: session!.id,
        currentPage: 250,
        currentPercentage: 50,
        progressDate: new Date("2025-11-15"),
        pagesRead: 125,
      });

      // Log progress at 75%
      await progressRepository.create({
        bookId: testBook.id,
        sessionId: session!.id,
        currentPage: 375,
        currentPercentage: 75,
        progressDate: new Date("2025-11-18"),
        pagesRead: 125,
      });

      // Complete with backdated date
      const completionDate = new Date("2025-11-20T18:30:00.000Z");

      const progressRequest = createMockRequest("POST", "/api/books/123/progress", {
        currentPage: 500,
        progressDate: completionDate.toISOString(),
      });
      const progressParams = { id: testBook.id.toString() };

      const progressResponse = await progressPost(progressRequest as NextRequest, { params: progressParams });
      const progressData = await progressResponse.json();

      expect(progressResponse.status).toBe(200);
      expect(progressData.shouldShowCompletionModal).toBe(true);
      expect(new Date(progressData.completionDate).toISOString()).toBe(completionDate.toISOString());

      // Verify all progress logs are intact
      const allProgress = await progressRepository.findBySessionId(session!.id);
      expect(allProgress).toHaveLength(4);
    });

    test("should handle book without totalPages completing by percentage", async () => {
      // Create book without totalPages
      const bookNoPages = await bookRepository.create({
        calibreId: 2,
        title: "No Pages Book",
        authors: ["Author"],
        tags: [],
        path: "No/Pages",
        orphaned: false,
      });

      // Create active session
      await sessionRepository.create({
        bookId: bookNoPages.id,
        sessionNumber: 1,
        status: "reading",
        isActive: true,
        startedDate: new Date("2025-11-01"),
      });

      const backdatedDate = new Date("2025-11-12T10:00:00.000Z");

      const progressRequest = createMockRequest("POST", "/api/books/123/progress", {
        currentPercentage: 100,
        progressDate: backdatedDate.toISOString(),
      });
      const progressParams = { id: bookNoPages.id.toString() };

      const progressResponse = await progressPost(progressRequest as NextRequest, { params: progressParams });
      const progressData = await progressResponse.json();

      expect(progressResponse.status).toBe(200);
      expect(progressData.shouldShowCompletionModal).toBe(true);
      expect(new Date(progressData.completionDate).toISOString()).toBe(backdatedDate.toISOString());
    });
  });

  describe("Regression Tests", () => {
    test("should prevent backdated completedDate being overridden with today's date", async () => {
      // This is the specific bug we're testing for
      const twoWeeksAgo = new Date();
      twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
      twoWeeksAgo.setHours(12, 0, 0, 0);

      // Step 1: Log progress to 100% with backdated date
      const progressRequest = createMockRequest("POST", "/api/books/123/progress", {
        currentPage: 500,
        progressDate: twoWeeksAgo.toISOString(),
      });
      const progressParams = { id: testBook.id.toString() };

      const progressResponse = await progressPost(progressRequest as NextRequest, { params: progressParams });
      const progressData = await progressResponse.json();

      // Step 2: Mark as read with the backdated completionDate
      const statusRequest = createMockRequest("POST", `/api/books/${testBook.id}/status`, {
        status: "read",
        completedDate: progressData.completionDate,
      });
      const statusParams = { id: testBook.id.toString() };

      const statusResponse = await statusPost(statusRequest as NextRequest, { params: statusParams });
      const statusData = await statusResponse.json();

      // Verify the completedDate is NOT today
      const completedDate = new Date(statusData.completedDate);
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // The completed date should be approximately 2 weeks ago, not today
      const daysDifference = Math.abs(
        (today.getTime() - completedDate.getTime()) / (1000 * 60 * 60 * 24)
      );
      expect(daysDifference).toBeGreaterThan(10); // Should be ~14 days difference
    });

    test("should preserve time component of backdated completion", async () => {
      // Specific time is important for accurate historical tracking
      const specificTime = new Date("2025-10-15T14:23:45.000Z");

      const progressRequest = createMockRequest("POST", "/api/books/123/progress", {
        currentPercentage: 100,
        progressDate: specificTime.toISOString(),
      });
      const progressParams = { id: testBook.id.toString() };

      const progressResponse = await progressPost(progressRequest as NextRequest, { params: progressParams });
      const progressData = await progressResponse.json();

      expect(new Date(progressData.completionDate).toISOString()).toBe(specificTime.toISOString());

      // Mark as read
      const statusRequest = createMockRequest("POST", `/api/books/${testBook.id}/status`, {
        status: "read",
        completedDate: progressData.completionDate,
      });
      const statusParams = { id: testBook.id.toString() };

      const statusResponse = await statusPost(statusRequest as NextRequest, { params: statusParams });
      const statusData = await statusResponse.json();

      // Time component should be preserved (within SQLite second precision)
      const returnedTime = new Date(statusData.completedDate);
      expect(Math.abs(returnedTime.getTime() - specificTime.getTime())).toBeLessThan(2000);
    });
  });
});
