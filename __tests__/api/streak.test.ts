import { describe, test, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { GET, PATCH } from "@/app/api/streak/route";
import { streakRepository } from "@/lib/repositories";
import { setupTestDatabase, teardownTestDatabase, clearTestDatabase } from "@/__tests__/helpers/db-setup";
import { createMockRequest } from "@/__tests__/fixtures/test-data";
import type { NextRequest } from "next/server";
import { subDays } from "date-fns";

/**
 * Streak API Tests - /api/streak
 * 
 * Tests the streak endpoint for:
 * - GET: Retrieving current streak data with auto-reset functionality
 * - PATCH: Updating daily threshold
 * 
 * Coverage:
 * - Success cases (200)
 * - Error cases (400, 500)
 * - Input validation
 * - Auto-creation of streak records
 * - Streak reset logic
 * - Threshold validation
 * 
 * Note: Tests for streakEnabled (enable/disable) are in streak-enabled.test.ts
 */

describe("Streak API - GET /api/streak", () => {
  beforeAll(async () => {
    await setupTestDatabase(__filename);
  });

  afterAll(async () => {
    await teardownTestDatabase(__filename);
  });

  beforeEach(async () => {
    await clearTestDatabase(__filename);
  });

  describe("GET - Success cases", () => {
    test("returns 200 with streak data when streak exists", async () => {
      await streakRepository.create({
        currentStreak: 5,
        longestStreak: 10,
        dailyThreshold: 15,
        lastActivityDate: new Date(),
        streakStartDate: subDays(new Date(), 5),
        totalDaysActive: 20,
        streakEnabled: true,
        userId: null,
      });

      const request = createMockRequest("GET", "/api/streak");
      const response = await GET(request as NextRequest);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data).toHaveProperty("currentStreak");
      expect(data.data).toHaveProperty("longestStreak");
      expect(data.data).toHaveProperty("dailyThreshold");
      expect(data.data).toHaveProperty("lastActivityDate");
      expect(data.data).toHaveProperty("streakEnabled");
      expect(data.data.currentStreak).toBe(5);
      expect(data.data.longestStreak).toBe(10);
      expect(data.data.dailyThreshold).toBe(15);
    });

    test("auto-creates streak record if it doesn't exist", async () => {
      const request = createMockRequest("GET", "/api/streak");
      const response = await GET(request as NextRequest);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data).toHaveProperty("currentStreak");
      expect(data.data.currentStreak).toBe(0); // New streak starts at 0

      // Verify streak was created in database
      const streak = await streakRepository.findByUserId(null);
      expect(streak).toBeDefined();
    });

    test("returns streak with enhanced data including hoursRemainingToday", async () => {
      await streakRepository.create({
        currentStreak: 3,
        longestStreak: 5,
        dailyThreshold: 10,
        lastActivityDate: new Date(),
        streakStartDate: subDays(new Date(), 3),
        totalDaysActive: 10,
        streakEnabled: true,
        userId: null,
      });

      const request = createMockRequest("GET", "/api/streak");
      const response = await GET(request as NextRequest);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data).toHaveProperty("hoursRemainingToday");
      expect(typeof data.data.hoursRemainingToday).toBe("number");
      expect(data.data.hoursRemainingToday).toBeGreaterThanOrEqual(0);
      expect(data.data.hoursRemainingToday).toBeLessThanOrEqual(24);
    });

    test("resets streak if days have been missed", async () => {
      // Create a streak with last activity 3 days ago
      await streakRepository.create({
        currentStreak: 5,
        longestStreak: 10,
        dailyThreshold: 15,
        lastActivityDate: subDays(new Date(), 3), // 3 days ago (missed)
        streakStartDate: subDays(new Date(), 8),
        totalDaysActive: 20,
        streakEnabled: true,
        userId: null,
      });

      const request = createMockRequest("GET", "/api/streak");
      const response = await GET(request as NextRequest);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.currentStreak).toBe(0); // Should be reset
      expect(data.data.longestStreak).toBe(10); // Longest should remain
    });

    test("maintains streak if activity was yesterday", async () => {
      // Create a streak with last activity yesterday
      await streakRepository.create({
        currentStreak: 5,
        longestStreak: 10,
        dailyThreshold: 15,
        lastActivityDate: subDays(new Date(), 1), // Yesterday
        streakStartDate: subDays(new Date(), 5),
        totalDaysActive: 20,
        streakEnabled: true,
        userId: null,
      });

      const request = createMockRequest("GET", "/api/streak");
      const response = await GET(request as NextRequest);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.currentStreak).toBe(5); // Should maintain
      expect(data.data.longestStreak).toBe(10);
    });

    test("maintains streak if activity was today", async () => {
      // Create a streak with last activity today
      await streakRepository.create({
        currentStreak: 5,
        longestStreak: 10,
        dailyThreshold: 15,
        lastActivityDate: new Date(), // Today
        streakStartDate: subDays(new Date(), 5),
        totalDaysActive: 20,
        streakEnabled: true,
        userId: null,
      });

      const request = createMockRequest("GET", "/api/streak");
      const response = await GET(request as NextRequest);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.currentStreak).toBe(5); // Should maintain
    });

    test("handles disabled streak", async () => {
      await streakRepository.create({
        currentStreak: 0,
        longestStreak: 0,
        dailyThreshold: 15,
        lastActivityDate: new Date(),
        streakStartDate: new Date(),
        totalDaysActive: 0,
        streakEnabled: false, // Disabled
        userId: null,
      });

      const request = createMockRequest("GET", "/api/streak");
      const response = await GET(request as NextRequest);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.streakEnabled).toBe(false);
      expect(data.data.currentStreak).toBe(0);
    });
  });

  describe("GET - Error handling", () => {
    test("returns 500 on internal error", async () => {
      // Mock the service to throw an error
      const originalGetStreak = streakRepository.findByUserId;
      streakRepository.findByUserId = vi.fn(() => {
        throw new Error("Database connection failed");
      });

      const request = createMockRequest("GET", "/api/streak");
      const response = await GET(request as NextRequest);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.error.code).toBe("INTERNAL_ERROR");
      expect(data.error.message).toContain("unexpected error");

      // Restore original function
      streakRepository.findByUserId = originalGetStreak;
    });
  });
});

describe("Streak API - PATCH /api/streak (dailyThreshold)", () => {
  beforeAll(async () => {
    await setupTestDatabase(__filename);
  });

  afterAll(async () => {
    await teardownTestDatabase(__filename);
  });

  beforeEach(async () => {
    await clearTestDatabase(__filename);
  });

  describe("PATCH - Update daily threshold", () => {
    test("returns 200 and updates threshold with valid value", async () => {
      await streakRepository.create({
        currentStreak: 5,
        longestStreak: 10,
        dailyThreshold: 15,
        lastActivityDate: new Date(),
        streakStartDate: subDays(new Date(), 5),
        totalDaysActive: 20,
        streakEnabled: true,
        userId: null,
      });

      const request = createMockRequest("PATCH", "/api/streak", {
        dailyThreshold: 25,
      });
      const response = await PATCH(request as NextRequest);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.dailyThreshold).toBe(25);
      expect(data.data.currentStreak).toBe(5); // Should not change

      // Verify in database
      const streak = await streakRepository.findByUserId(null);
      expect(streak?.dailyThreshold).toBe(25);
    });

    test("auto-creates streak record if it doesn't exist", async () => {
      const request = createMockRequest("PATCH", "/api/streak", {
        dailyThreshold: 30,
      });
      const response = await PATCH(request as NextRequest);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.dailyThreshold).toBe(30);

      // Verify streak was created
      const streak = await streakRepository.findByUserId(null);
      expect(streak).toBeDefined();
      expect(streak?.dailyThreshold).toBe(30);
    });

    test("allows minimum threshold value (1)", async () => {
      const request = createMockRequest("PATCH", "/api/streak", {
        dailyThreshold: 1,
      });
      const response = await PATCH(request as NextRequest);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.dailyThreshold).toBe(1);
    });

    test("allows maximum threshold value (9999)", async () => {
      const request = createMockRequest("PATCH", "/api/streak", {
        dailyThreshold: 9999,
      });
      const response = await PATCH(request as NextRequest);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.dailyThreshold).toBe(9999);
    });

    test("allows common threshold values", async () => {
      const commonThresholds = [5, 10, 15, 20, 25, 30, 50, 100];
      
      for (const threshold of commonThresholds) {
        await clearTestDatabase(__filename);
        
        const request = createMockRequest("PATCH", "/api/streak", {
          dailyThreshold: threshold,
        });
        const response = await PATCH(request as NextRequest);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.data.dailyThreshold).toBe(threshold);
      }
    });
  });

  describe("PATCH - Validation errors", () => {
    test("returns 400 for threshold less than 1", async () => {
      const request = createMockRequest("PATCH", "/api/streak", {
        dailyThreshold: 0,
      });
      const response = await PATCH(request as NextRequest);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error.code).toBe("INVALID_THRESHOLD");
      expect(data.error.message).toContain("must be between");
      expect(data.error.details.min).toBe(1);
      expect(data.error.details.max).toBe(9999);
    });

    test("returns 400 for negative threshold", async () => {
      const request = createMockRequest("PATCH", "/api/streak", {
        dailyThreshold: -5,
      });
      const response = await PATCH(request as NextRequest);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error.code).toBe("INVALID_THRESHOLD");
    });

    test("returns 400 for threshold greater than 9999", async () => {
      const request = createMockRequest("PATCH", "/api/streak", {
        dailyThreshold: 10000,
      });
      const response = await PATCH(request as NextRequest);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error.code).toBe("INVALID_THRESHOLD");
    });

    test("returns 400 for non-integer threshold", async () => {
      const request = createMockRequest("PATCH", "/api/streak", {
        dailyThreshold: 15.5,
      });
      const response = await PATCH(request as NextRequest);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error.code).toBe("INVALID_THRESHOLD");
      expect(data.error.message).toContain("must be an integer");
    });

    test("returns 400 when dailyThreshold is not a number", async () => {
      const request = createMockRequest("PATCH", "/api/streak", {
        dailyThreshold: "20",
      });
      const response = await PATCH(request as NextRequest);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error.code).toBe("INVALID_TYPE");
      expect(data.error.message).toContain("dailyThreshold must be a number");
      expect(data.error.details.expected).toBe("number");
      expect(data.error.details.provided).toBe("string");
    });

    test("returns 400 when dailyThreshold is null", async () => {
      const request = createMockRequest("PATCH", "/api/streak", {
        dailyThreshold: null,
      });
      const response = await PATCH(request as NextRequest);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error.code).toBe("INVALID_TYPE");
    });

    test("returns 400 when dailyThreshold is boolean", async () => {
      const request = createMockRequest("PATCH", "/api/streak", {
        dailyThreshold: true,
      });
      const response = await PATCH(request as NextRequest);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error.code).toBe("INVALID_TYPE");
    });

    test("returns 400 when no fields provided", async () => {
      const request = createMockRequest("PATCH", "/api/streak", {});
      const response = await PATCH(request as NextRequest);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error.code).toBe("MISSING_FIELD");
      expect(data.error.message).toContain("dailyThreshold or streakEnabled is required");
    });

    test("returns 400 when body is empty", async () => {
      const request = createMockRequest("PATCH", "/api/streak", {});
      const response = await PATCH(request as NextRequest);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error.code).toBe("MISSING_FIELD");
    });
  });

  describe("PATCH - Error handling", () => {
    test("returns 500 on internal error", async () => {
      // Mock the service to throw an unexpected error
      const originalUpdate = streakRepository.update;
      streakRepository.update = vi.fn(() => {
        throw new Error("Database connection failed");
      });

      const request = createMockRequest("PATCH", "/api/streak", {
        dailyThreshold: 20,
      });
      const response = await PATCH(request as NextRequest);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.error.code).toBe("INTERNAL_ERROR");

      // Restore original function
      streakRepository.update = originalUpdate;
    });

    test("handles malformed JSON body", async () => {
      const request = new Request("http://localhost/api/streak", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: "{ invalid json",
      }) as NextRequest;

      // Add nextUrl property
      (request as any).nextUrl = new URL("http://localhost/api/streak");

      const response = await PATCH(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.error.code).toBe("INTERNAL_ERROR");
    });
  });
});
