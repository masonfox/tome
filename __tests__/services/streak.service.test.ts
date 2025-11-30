import { describe, it, expect, beforeAll, afterAll, beforeEach } from "bun:test";
import { streakService } from "@/lib/services/streak.service";
import { streakRepository } from "@/lib/repositories/streak.repository";
import { setupTestDatabase, teardownTestDatabase, clearTestDatabase } from "@/__tests__/helpers/db-setup";
import { getDatabase } from "@/lib/db/context";
import { streaks } from "@/lib/db/schema/streaks";

describe("StreakService - Auto-initialization", () => {
  beforeAll(async () => {
    await setupTestDatabase(__filename);
  });

  afterAll(async () => {
    await teardownTestDatabase(__filename);
  });

  beforeEach(async () => {
    await clearTestDatabase(__filename);
  });

  describe("getStreak()", () => {
    it("should auto-create streak record when none exists", async () => {
      // Verify no streak exists
      const existingStreak = await streakRepository.findByUserId(null);
      expect(existingStreak).toBeUndefined();

      // Call getStreak - should auto-create
      const streak = await streakService.getStreak(null);

      // Verify streak was created with defaults
      expect(streak).toBeDefined();
      expect(streak.id).toBeGreaterThan(0);
      expect(streak.currentStreak).toBe(0);
      expect(streak.longestStreak).toBe(0);
      expect(streak.totalDaysActive).toBe(0);
      expect(streak.dailyThreshold).toBe(1);
      expect(streak.userId).toBeNull();
      expect(streak.lastActivityDate).toBeInstanceOf(Date);
      expect(streak.streakStartDate).toBeInstanceOf(Date);
      expect(streak.hoursRemainingToday).toBeGreaterThanOrEqual(0);
      expect(streak.hoursRemainingToday).toBeLessThanOrEqual(24);
    });

    it("should return existing streak if one already exists", async () => {
      // Create initial streak
      const initialStreak = await streakRepository.create({
        userId: null,
        currentStreak: 5,
        longestStreak: 10,
        lastActivityDate: new Date(),
        streakStartDate: new Date(),
        totalDaysActive: 15,
        dailyThreshold: 25,
      });

      // Call getStreak - should return existing
      const streak = await streakService.getStreak(null);

      // Verify it's the same streak
      expect(streak.id).toBe(initialStreak.id);
      expect(streak.currentStreak).toBe(5);
      expect(streak.longestStreak).toBe(10);
      expect(streak.totalDaysActive).toBe(15);
      expect(streak.dailyThreshold).toBe(25);
    });

    it("should compute hoursRemainingToday correctly", async () => {
      const streak = await streakService.getStreak(null);

      // Hours remaining should be between 0 and 24
      expect(streak.hoursRemainingToday).toBeGreaterThanOrEqual(0);
      expect(streak.hoursRemainingToday).toBeLessThanOrEqual(24);
      expect(Number.isInteger(streak.hoursRemainingToday)).toBe(true);
    });

    it("should handle multiple calls without creating duplicates", async () => {
      // First call - creates streak
      const streak1 = await streakService.getStreak(null);
      expect(streak1).toBeDefined();

      // Second call - returns same streak
      const streak2 = await streakService.getStreak(null);
      expect(streak2.id).toBe(streak1.id);

      // Third call - still same streak
      const streak3 = await streakService.getStreak(null);
      expect(streak3.id).toBe(streak1.id);

      // Verify only one streak exists in DB
      const allStreaks = await getDatabase().select().from(streaks);
      expect(allStreaks.length).toBe(1);
    });
  });

  describe("updateThreshold()", () => {
    it("should auto-create streak when updating threshold on fresh database", async () => {
      // Verify no streak exists
      const existingStreak = await streakRepository.findByUserId(null);
      expect(existingStreak).toBeUndefined();

      // Update threshold - should auto-create streak
      const updated = await streakService.updateThreshold(null, 30);

      // Verify streak was created with new threshold
      expect(updated).toBeDefined();
      expect(updated.id).toBeGreaterThan(0);
      expect(updated.dailyThreshold).toBe(30);
      expect(updated.currentStreak).toBe(0);
      expect(updated.longestStreak).toBe(0);
      expect(updated.totalDaysActive).toBe(0);
    });

    it("should update existing streak threshold", async () => {
      // Create initial streak with default threshold
      const initialStreak = await streakRepository.create({
        userId: null,
        currentStreak: 3,
        longestStreak: 5,
        lastActivityDate: new Date(),
        streakStartDate: new Date(),
        totalDaysActive: 8,
        dailyThreshold: 1,
      });

      // Update threshold
      const updated = await streakService.updateThreshold(null, 50);

      // Verify same streak ID but updated threshold
      expect(updated.id).toBe(initialStreak.id);
      expect(updated.dailyThreshold).toBe(50);
      expect(updated.currentStreak).toBe(3); // Unchanged
      expect(updated.longestStreak).toBe(5); // Unchanged
      expect(updated.totalDaysActive).toBe(8); // Unchanged
    });

    it("should validate threshold is an integer", async () => {
      await expect(
        streakService.updateThreshold(null, 10.5)
      ).rejects.toThrow("Daily threshold must be an integer");
    });

    it("should validate threshold is at least 1", async () => {
      await expect(
        streakService.updateThreshold(null, 0)
      ).rejects.toThrow("Daily threshold must be between 1 and 9999");

      await expect(
        streakService.updateThreshold(null, -5)
      ).rejects.toThrow("Daily threshold must be between 1 and 9999");
    });

    it("should validate threshold is at most 9999", async () => {
      await expect(
        streakService.updateThreshold(null, 10000)
      ).rejects.toThrow("Daily threshold must be between 1 and 9999");

      await expect(
        streakService.updateThreshold(null, 50000)
      ).rejects.toThrow("Daily threshold must be between 1 and 9999");
    });

    it("should accept valid threshold values", async () => {
      // Test boundary values
      const threshold1 = await streakService.updateThreshold(null, 1);
      expect(threshold1.dailyThreshold).toBe(1);

      const threshold9999 = await streakService.updateThreshold(null, 9999);
      expect(threshold9999.dailyThreshold).toBe(9999);

      // Test mid-range value
      const threshold50 = await streakService.updateThreshold(null, 50);
      expect(threshold50.dailyThreshold).toBe(50);
    });

    it("should handle multiple threshold updates correctly", async () => {
      // First update - creates streak
      const streak1 = await streakService.updateThreshold(null, 10);
      expect(streak1.dailyThreshold).toBe(10);

      // Second update - updates same streak
      const streak2 = await streakService.updateThreshold(null, 20);
      expect(streak2.id).toBe(streak1.id);
      expect(streak2.dailyThreshold).toBe(20);

      // Third update - still same streak
      const streak3 = await streakService.updateThreshold(null, 30);
      expect(streak3.id).toBe(streak1.id);
      expect(streak3.dailyThreshold).toBe(30);

      // Verify only one streak exists
      const allStreaks = await getDatabase().select().from(streaks);
      expect(allStreaks.length).toBe(1);
    });
  });

  describe("Integration - Settings Page Flow", () => {
    it("should handle fresh database → settings page → update threshold flow", async () => {
      // Simulate fresh database (no streak)
      const existingStreak = await streakRepository.findByUserId(null);
      expect(existingStreak).toBeUndefined();

      // Simulate settings page loading (calls getStreak)
      const initialStreak = await streakService.getStreak(null);
      expect(initialStreak.dailyThreshold).toBe(1); // Default

      // Simulate user updating threshold
      const updated = await streakService.updateThreshold(null, 25);
      expect(updated.id).toBe(initialStreak.id);
      expect(updated.dailyThreshold).toBe(25);

      // Verify page reload shows updated threshold
      const reloaded = await streakService.getStreak(null);
      expect(reloaded.id).toBe(initialStreak.id);
      expect(reloaded.dailyThreshold).toBe(25);
    });

    it("should handle update threshold without prior getStreak call", async () => {
      // Fresh database - user goes straight to settings and updates
      const existingStreak = await streakRepository.findByUserId(null);
      expect(existingStreak).toBeUndefined();

      // User updates threshold directly (no prior getStreak)
      const updated = await streakService.updateThreshold(null, 40);
      expect(updated.dailyThreshold).toBe(40);

      // Verify streak was created properly
      expect(updated.id).toBeGreaterThan(0);
      expect(updated.currentStreak).toBe(0);
      expect(updated.longestStreak).toBe(0);

      // Subsequent getStreak should return same streak
      const fetched = await streakService.getStreak(null);
      expect(fetched.id).toBe(updated.id);
      expect(fetched.dailyThreshold).toBe(40);
    });
  });
});
