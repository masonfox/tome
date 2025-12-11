import { test, expect, describe, beforeAll, afterAll, beforeEach } from "bun:test";
import type { NextRequest } from "next/server";
import { PATCH } from "@/app/api/streak/route";
import { bookRepository, sessionRepository, progressRepository, streakRepository } from "@/lib/repositories";
import { setupTestDatabase, teardownTestDatabase, clearTestDatabase } from "@/__tests__/helpers/db-setup";
import { createMockRequest } from "@/__tests__/fixtures/test-data";

/**
 * Test suite for PATCH /api/streak with streakEnabled parameter
 * 
 * Focus areas:
 * 1. Enabling streak tracking with dailyThreshold
 * 2. Enabling streak tracking without dailyThreshold (uses existing)
 * 3. Disabling streak tracking
 * 4. Validation of streakEnabled parameter
 * 5. Streak rebuilding from historical data when enabled
 */

beforeAll(async () => {
  await setupTestDatabase(__filename);
});

afterAll(async () => {
  await teardownTestDatabase(__filename);
});

beforeEach(async () => {
  await clearTestDatabase(__filename);
});

// Helper to get relative dates in America/New_York timezone
function getDaysAgo(days: number): Date {
  const { toZonedTime, fromZonedTime } = require('date-fns-tz');
  const { subDays } = require('date-fns');
  
  const nowInEst = toZonedTime(new Date(), 'America/New_York');
  const targetDate = subDays(nowInEst, days);
  targetDate.setHours(12, 0, 0, 0);
  
  return fromZonedTime(targetDate, 'America/New_York');
}

describe("PATCH /api/streak - Enable/Disable Streak Tracking", () => {
  describe("Enabling Streak Tracking", () => {
    test("should enable streak tracking with dailyThreshold", async () => {
      // Create streak record (disabled by default)
      await streakRepository.create({
        currentStreak: 0,
        longestStreak: 0,
        dailyThreshold: 10,
        streakEnabled: false,
      });

      const request = createMockRequest("PATCH", "/api/streak", {
        streakEnabled: true,
        dailyThreshold: 20,
      });

      const response = await PATCH(request as NextRequest);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.streakEnabled).toBe(true);
      expect(data.data.dailyThreshold).toBe(20);
    });

    test("should enable streak tracking without dailyThreshold (uses existing)", async () => {
      // Create streak record with existing threshold
      await streakRepository.create({
        currentStreak: 0,
        longestStreak: 0,
        dailyThreshold: 15,
        streakEnabled: false,
      });

      const request = createMockRequest("PATCH", "/api/streak", {
        streakEnabled: true,
      });

      const response = await PATCH(request as NextRequest);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.streakEnabled).toBe(true);
      expect(data.data.dailyThreshold).toBe(15); // Should keep existing threshold
    });

    test("should rebuild streak from historical data when enabled", async () => {
      // Create a book and session
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

      // Create progress entries for last 3 days (20 pages each day)
      const day3Ago = getDaysAgo(3);
      const day2Ago = getDaysAgo(2);
      const day1Ago = getDaysAgo(1);

      await progressRepository.create({
        bookId: book.id,
        sessionId: session.id,
        pagesRead: 20,
        progressDate: day3Ago,
      });

      await progressRepository.create({
        bookId: book.id,
        sessionId: session.id,
        pagesRead: 20,
        progressDate: day2Ago,
      });

      await progressRepository.create({
        bookId: book.id,
        sessionId: session.id,
        pagesRead: 20,
        progressDate: day1Ago,
      });

      // Create disabled streak
      await streakRepository.create({
        currentStreak: 0,
        longestStreak: 0,
        dailyThreshold: 10,
        streakEnabled: false,
      });

      // Enable streak tracking
      const request = createMockRequest("PATCH", "/api/streak", {
        streakEnabled: true,
      });

      const response = await PATCH(request as NextRequest);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.streakEnabled).toBe(true);
      
      // Streak should be rebuilt from historical data
      // We had 3 consecutive days of 20 pages (exceeding 10 page threshold)
      expect(data.data.currentStreak).toBeGreaterThan(0);
      expect(data.data.longestStreak).toBeGreaterThan(0);
    });

    test("should auto-create streak record if it doesn't exist", async () => {
      // Don't create a streak record - it should be auto-created

      const request = createMockRequest("PATCH", "/api/streak", {
        streakEnabled: true,
        dailyThreshold: 25,
      });

      const response = await PATCH(request as NextRequest);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.streakEnabled).toBe(true);
      expect(data.data.dailyThreshold).toBe(25);
    });
  });

  describe("Disabling Streak Tracking", () => {
    test("should disable streak tracking", async () => {
      // Create enabled streak
      await streakRepository.create({
        currentStreak: 5,
        longestStreak: 10,
        lastActivityDate: getDaysAgo(0),
        dailyThreshold: 10,
        streakEnabled: true,
      });

      const request = createMockRequest("PATCH", "/api/streak", {
        streakEnabled: false,
      });

      const response = await PATCH(request as NextRequest);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.streakEnabled).toBe(false);
      
      // Streak data should be preserved (not reset)
      expect(data.data.currentStreak).toBe(5);
      expect(data.data.longestStreak).toBe(10);
    });

    test("should preserve dailyThreshold when disabling", async () => {
      await streakRepository.create({
        currentStreak: 3,
        longestStreak: 5,
        lastActivityDate: getDaysAgo(0),
        dailyThreshold: 15,
        streakEnabled: true,
      });

      const request = createMockRequest("PATCH", "/api/streak", {
        streakEnabled: false,
      });

      const response = await PATCH(request as NextRequest);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.streakEnabled).toBe(false);
      expect(data.data.dailyThreshold).toBe(15);
    });
  });

  describe("Validation", () => {
    test("should reject non-boolean streakEnabled", async () => {
      const request = createMockRequest("PATCH", "/api/streak", {
        streakEnabled: "true", // String instead of boolean
      });

      const response = await PATCH(request as NextRequest);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error.code).toBe("INVALID_TYPE");
      expect(data.error.message).toContain("must be a boolean");
    });

    test("should reject null streakEnabled", async () => {
      const request = createMockRequest("PATCH", "/api/streak", {
        streakEnabled: null,
      });

      const response = await PATCH(request as NextRequest);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error.code).toBe("INVALID_TYPE");
    });

    test("should reject number streakEnabled", async () => {
      const request = createMockRequest("PATCH", "/api/streak", {
        streakEnabled: 1,
      });

      const response = await PATCH(request as NextRequest);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error.code).toBe("INVALID_TYPE");
    });
  });

  describe("Combined Operations", () => {
    test("should update both streakEnabled and dailyThreshold", async () => {
      await streakRepository.create({
        currentStreak: 2,
        longestStreak: 5,
        lastActivityDate: getDaysAgo(0),
        dailyThreshold: 10,
        streakEnabled: false,
      });

      const request = createMockRequest("PATCH", "/api/streak", {
        streakEnabled: true,
        dailyThreshold: 30,
      });

      const response = await PATCH(request as NextRequest);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.streakEnabled).toBe(true);
      expect(data.data.dailyThreshold).toBe(30);
    });

    test("should handle enabling with invalid dailyThreshold gracefully", async () => {
      // The service layer should validate the dailyThreshold
      const request = createMockRequest("PATCH", "/api/streak", {
        streakEnabled: true,
        dailyThreshold: -5, // Invalid threshold
      });

      const response = await PATCH(request as NextRequest);
      const data = await response.json();

      // Should return an error because validation happens in service layer
      expect(response.status).toBeGreaterThanOrEqual(400);
      expect(data.success).toBe(false);
    });
  });

  describe("Toggle Behavior", () => {
    test("should allow toggling streak on and off", async () => {
      // Start disabled
      await streakRepository.create({
        currentStreak: 0,
        longestStreak: 0,
        dailyThreshold: 10,
        streakEnabled: false,
      });

      // Enable
      let request = createMockRequest("PATCH", "/api/streak", {
        streakEnabled: true,
      });

      let response = await PATCH(request as NextRequest);
      let data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.streakEnabled).toBe(true);

      // Disable
      request = createMockRequest("PATCH", "/api/streak", {
        streakEnabled: false,
      });

      response = await PATCH(request as NextRequest);
      data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.streakEnabled).toBe(false);

      // Enable again
      request = createMockRequest("PATCH", "/api/streak", {
        streakEnabled: true,
      });

      response = await PATCH(request as NextRequest);
      data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.streakEnabled).toBe(true);
    });
  });
});
