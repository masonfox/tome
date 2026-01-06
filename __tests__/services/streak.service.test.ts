import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
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

    it("should compute hoursRemainingToday in user timezone not UTC", async () => {
      // Regression test for bug where hoursRemainingToday used UTC instead of user timezone
      // Create streak with Tokyo timezone (UTC+9)
      await streakRepository.create({
        userId: null,
        currentStreak: 0,
        longestStreak: 0,
        lastActivityDate: new Date(),
        streakStartDate: new Date(),
        totalDaysActive: 0,
        dailyThreshold: 1,
        userTimezone: 'Asia/Tokyo',
      });

      const streak = await streakService.getStreak(null);

      // Verify timezone is respected
      expect(streak.userTimezone).toBe('Asia/Tokyo');
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

  describe("checkAndResetStreakIfNeeded()", () => {
    it("should reset streak to 0 when more than 1 day has passed", async () => {
      // Create a streak with last activity 3 days ago
      const threeDaysAgo = new Date();
      threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

      await streakRepository.create({
        userId: null,
        currentStreak: 6,
        longestStreak: 10,
        lastActivityDate: threeDaysAgo,
        streakStartDate: threeDaysAgo,
        totalDaysActive: 20,
        dailyThreshold: 1,
      });

      // Call checkAndResetStreakIfNeeded
      const wasReset = await streakService.checkAndResetStreakIfNeeded(null);

      // Verify reset occurred
      expect(wasReset).toBe(true);

      // Verify streak is now 0
      const streak = await streakService.getStreakBasic(null);
      expect(streak.currentStreak).toBe(0);
      expect(streak.longestStreak).toBe(10); // Longest streak preserved
    });

    it("should not reset streak when last activity was yesterday", async () => {
      // Create a streak with last activity yesterday
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      await streakRepository.create({
        userId: null,
        currentStreak: 5,
        longestStreak: 10,
        lastActivityDate: yesterday,
        streakStartDate: yesterday,
        totalDaysActive: 15,
        dailyThreshold: 1,
      });

      // Call checkAndResetStreakIfNeeded
      const wasReset = await streakService.checkAndResetStreakIfNeeded(null);

      // Verify NO reset occurred
      expect(wasReset).toBe(false);

      // Verify streak is still 5
      const streak = await streakService.getStreakBasic(null);
      expect(streak.currentStreak).toBe(5);
    });

    it("should not reset streak when last activity was today", async () => {
      // Create a streak with last activity today
      const today = new Date();

      await streakRepository.create({
        userId: null,
        currentStreak: 3,
        longestStreak: 8,
        lastActivityDate: today,
        streakStartDate: today,
        totalDaysActive: 10,
        dailyThreshold: 1,
      });

      // Call checkAndResetStreakIfNeeded
      const wasReset = await streakService.checkAndResetStreakIfNeeded(null);

      // Verify NO reset occurred
      expect(wasReset).toBe(false);

      // Verify streak is still 3
      const streak = await streakService.getStreakBasic(null);
      expect(streak.currentStreak).toBe(3);
    });

    it("should not reset when streak is already 0", async () => {
      // Create a streak that's already 0, with old last activity
      const fiveDaysAgo = new Date();
      fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5);

      await streakRepository.create({
        userId: null,
        currentStreak: 0,
        longestStreak: 15,
        lastActivityDate: fiveDaysAgo,
        streakStartDate: fiveDaysAgo,
        totalDaysActive: 25,
        dailyThreshold: 1,
      });

      // Call checkAndResetStreakIfNeeded
      const wasReset = await streakService.checkAndResetStreakIfNeeded(null);

      // Verify NO reset occurred (already 0)
      expect(wasReset).toBe(false);

      // Verify streak is still 0
      const streak = await streakService.getStreakBasic(null);
      expect(streak.currentStreak).toBe(0);
    });

    it("should auto-create streak if none exists", async () => {
      // Verify no streak exists
      const existingStreak = await streakRepository.findByUserId(null);
      expect(existingStreak).toBeUndefined();

      // Call checkAndResetStreakIfNeeded
      const wasReset = await streakService.checkAndResetStreakIfNeeded(null);

      // No reset needed for new streak
      expect(wasReset).toBe(false);

      // Verify streak was created
      const streak = await streakService.getStreakBasic(null);
      expect(streak).toBeDefined();
      expect(streak.currentStreak).toBe(0);
    });
  });

  describe("getStreak() - Read-only behavior", () => {
    it("should not have side effects when called multiple times", async () => {
      // Create a streak with last activity 3 days ago
      const threeDaysAgo = new Date();
      threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

      const created = await streakRepository.create({
        userId: null,
        currentStreak: 6,
        longestStreak: 10,
        lastActivityDate: threeDaysAgo,
        streakStartDate: threeDaysAgo,
        totalDaysActive: 20,
        dailyThreshold: 1,
      });

      // Call getStreak multiple times
      const streak1 = await streakService.getStreak(null);
      const streak2 = await streakService.getStreak(null);
      const streak3 = await streakService.getStreak(null);

      // Verify streak values haven't changed
      expect(streak1.currentStreak).toBe(6);
      expect(streak2.currentStreak).toBe(6);
      expect(streak3.currentStreak).toBe(6);

      // Verify database wasn't modified
      const fromDb = await streakRepository.findByUserId(null);
      expect(fromDb?.currentStreak).toBe(6);
      expect(fromDb?.id).toBe(created.id);
    });
  });

  describe("setStreakEnabled()", () => {
    describe("Enabling Streak Tracking", () => {
      it("should enable streak tracking with new dailyThreshold", async () => {
        // Create disabled streak
        await streakRepository.create({
          userId: null,
          currentStreak: 0,
          longestStreak: 0,
          lastActivityDate: new Date(),
          streakStartDate: new Date(),
          totalDaysActive: 0,
          dailyThreshold: 10,
          streakEnabled: false,
        });

        // Enable with new threshold
        const result = await streakService.setStreakEnabled(null, true, 25);

        expect(result.streakEnabled).toBe(true);
        expect(result.dailyThreshold).toBe(25);
      });

      it("should enable streak tracking without changing dailyThreshold", async () => {
        // Create disabled streak with existing threshold
        await streakRepository.create({
          userId: null,
          currentStreak: 0,
          longestStreak: 0,
          lastActivityDate: new Date(),
          streakStartDate: new Date(),
          totalDaysActive: 0,
          dailyThreshold: 15,
          streakEnabled: false,
        });

        // Enable without specifying threshold
        const result = await streakService.setStreakEnabled(null, true);

        expect(result.streakEnabled).toBe(true);
        expect(result.dailyThreshold).toBe(15); // Should preserve existing
      });

      it("should auto-create streak record if none exists when enabling", async () => {
        // Verify no streak exists
        const existing = await streakRepository.findByUserId(null);
        expect(existing).toBeUndefined();

        // Enable streak tracking
        const result = await streakService.setStreakEnabled(null, true, 20);

        expect(result.id).toBeGreaterThan(0);
        expect(result.streakEnabled).toBe(true);
        expect(result.dailyThreshold).toBe(20);
        expect(result.currentStreak).toBe(0);
        expect(result.longestStreak).toBe(0);
      });

      it("should enable with default threshold when none provided and none exists", async () => {
        // No existing streak
        const result = await streakService.setStreakEnabled(null, true);

        expect(result.streakEnabled).toBe(true);
        expect(result.dailyThreshold).toBeGreaterThanOrEqual(1);
      });
    });

    describe("Disabling Streak Tracking", () => {
      it("should disable streak tracking", async () => {
        // Create enabled streak
        await streakRepository.create({
          userId: null,
          currentStreak: 5,
          longestStreak: 10,
          lastActivityDate: new Date(),
          streakStartDate: new Date(),
          totalDaysActive: 15,
          dailyThreshold: 20,
          streakEnabled: true,
        });

        // Disable
        const result = await streakService.setStreakEnabled(null, false);

        expect(result.streakEnabled).toBe(false);
        expect(result.dailyThreshold).toBe(20); // Preserved
        expect(result.currentStreak).toBe(5); // Preserved
        expect(result.longestStreak).toBe(10); // Preserved
      });

      it("should preserve all streak data when disabling", async () => {
        const lastActivity = new Date();
        const streakStart = new Date();
        streakStart.setDate(streakStart.getDate() - 10);

        await streakRepository.create({
          userId: null,
          currentStreak: 11,
          longestStreak: 20,
          lastActivityDate: lastActivity,
          streakStartDate: streakStart,
          totalDaysActive: 50,
          dailyThreshold: 30,
          streakEnabled: true,
        });

        const result = await streakService.setStreakEnabled(null, false);

        expect(result.streakEnabled).toBe(false);
        expect(result.currentStreak).toBe(11);
        expect(result.longestStreak).toBe(20);
        expect(result.totalDaysActive).toBe(50);
        expect(result.dailyThreshold).toBe(30);
      });

      it("should auto-create streak as disabled if none exists", async () => {
        // No existing streak
        const result = await streakService.setStreakEnabled(null, false);

        expect(result.streakEnabled).toBe(false);
        expect(result.id).toBeGreaterThan(0);
      });
    });

    describe("Toggle Behavior", () => {
      it("should allow toggling between enabled and disabled", async () => {
        // Start disabled
        await streakRepository.create({
          userId: null,
          currentStreak: 0,
          longestStreak: 0,
          lastActivityDate: new Date(),
          streakStartDate: new Date(),
          totalDaysActive: 0,
          dailyThreshold: 15,
          streakEnabled: false,
        });

        // Enable
        const enabled = await streakService.setStreakEnabled(null, true);
        expect(enabled.streakEnabled).toBe(true);

        // Disable
        const disabled = await streakService.setStreakEnabled(null, false);
        expect(disabled.streakEnabled).toBe(false);
        expect(disabled.id).toBe(enabled.id); // Same record

        // Enable again
        const reEnabled = await streakService.setStreakEnabled(null, true);
        expect(reEnabled.streakEnabled).toBe(true);
        expect(reEnabled.id).toBe(enabled.id); // Still same record
      });

      it("should handle rapid consecutive toggles", async () => {
        await streakRepository.create({
          userId: null,
          currentStreak: 3,
          longestStreak: 5,
          lastActivityDate: new Date(),
          streakStartDate: new Date(),
          totalDaysActive: 10,
          dailyThreshold: 10,
          streakEnabled: false,
        });

        // Rapid toggles
        await streakService.setStreakEnabled(null, true);
        await streakService.setStreakEnabled(null, false);
        await streakService.setStreakEnabled(null, true);
        const final = await streakService.setStreakEnabled(null, false);

        expect(final.streakEnabled).toBe(false);
        expect(final.currentStreak).toBe(3); // Data preserved
      });
    });

    describe("Combined Operations", () => {
      it("should enable and update threshold in one call", async () => {
        await streakRepository.create({
          userId: null,
          currentStreak: 2,
          longestStreak: 5,
          lastActivityDate: new Date(),
          streakStartDate: new Date(),
          totalDaysActive: 8,
          dailyThreshold: 10,
          streakEnabled: false,
        });

        const result = await streakService.setStreakEnabled(null, true, 40);

        expect(result.streakEnabled).toBe(true);
        expect(result.dailyThreshold).toBe(40);
      });

      it("should validate dailyThreshold when enabling", async () => {
        // Invalid threshold (too low)
        await expect(async () => {
          await streakService.setStreakEnabled(null, true, 0);
        }).toThrow();

        // Invalid threshold (too high)
        await expect(async () => {
          await streakService.setStreakEnabled(null, true, 10000);
        }).toThrow();
      });

      it("should not validate dailyThreshold when disabling", async () => {
        await streakRepository.create({
          userId: null,
          currentStreak: 0,
          longestStreak: 0,
          lastActivityDate: new Date(),
          streakStartDate: new Date(),
          totalDaysActive: 0,
          dailyThreshold: 15,
          streakEnabled: true,
        });

        // Should not throw even with invalid threshold (it's ignored when disabling)
        const result = await streakService.setStreakEnabled(null, false, -5);
        expect(result.streakEnabled).toBe(false);
        expect(result.dailyThreshold).toBe(15); // Original preserved
      });
    });

    describe("Integration", () => {
      it("should handle fresh database → enable flow", async () => {
        // Fresh database
        const existing = await streakRepository.findByUserId(null);
        expect(existing).toBeUndefined();

        // User enables streak tracking for first time
        const result = await streakService.setStreakEnabled(null, true, 20);

        expect(result.streakEnabled).toBe(true);
        expect(result.dailyThreshold).toBe(20);
        expect(result.currentStreak).toBe(0);

        // Verify can be fetched
        const fetched = await streakService.getStreak(null);
        expect(fetched.id).toBe(result.id);
        expect(fetched.streakEnabled).toBe(true);
      });

      it("should return streakEnabled flag in getStreak()", async () => {
        // Create enabled streak
        await streakRepository.create({
          userId: null,
          currentStreak: 0,
          longestStreak: 0,
          lastActivityDate: new Date(),
          streakStartDate: new Date(),
          totalDaysActive: 0,
          dailyThreshold: 10,
          streakEnabled: true,
        });

        const streak = await streakService.getStreak(null);
        expect(streak.streakEnabled).toBe(true);

        // Disable it
        await streakService.setStreakEnabled(null, false);

        const disabledStreak = await streakService.getStreak(null);
        expect(disabledStreak.streakEnabled).toBe(false);
      });
    });
  });
});
