import { describe, test, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { streakRepository } from '@/lib/repositories/streak.repository';
import { setupTestDatabase, teardownTestDatabase, clearTestDatabase } from '../../helpers/db-setup';
import type { TestDatabaseInstance } from '../../helpers/db-setup';

/**
 * StreakRepository Integration Tests
 *
 * Tests the StreakRepository class with a real SQLite database.
 * Covers:
 * - findByUserId with null userId (single-user mode)
 * - findByUserId with specific userId
 * - getOrCreate behavior
 * - incrementStreak updates
 * - resetCurrentStreak behavior
 * - updateThreshold validation
 * - setTimezone validation with Intl API
 * - upsert create and update paths
 */

let testDb: TestDatabaseInstance;

beforeAll(async () => {
  testDb = await setupTestDatabase(__filename);
});

afterAll(async () => {
  await teardownTestDatabase(testDb);
});

beforeEach(async () => {
  await clearTestDatabase(testDb);
});

describe('StreakRepository', () => {
  // ============================================================================
  // findByUserId
  // ============================================================================

  describe('findByUserId()', () => {
    test('should return undefined when no streak exists for null userId (single-user mode)', async () => {
      const streak = await streakRepository.findByUserId(null);
      expect(streak).toBeUndefined();
    });

    test('should return undefined when no streak exists for specific userId', async () => {
      const streak = await streakRepository.findByUserId(123);
      expect(streak).toBeUndefined();
    });

    test('should find streak for null userId', async () => {
      // Create a streak for single-user mode
      await streakRepository.create({
        userId: null,
        currentStreak: 5,
        longestStreak: 10,
        lastActivityDate: '2025-01-15',
        streakStartDate: '2025-01-10',
        totalDaysActive: 15,
      });

      const streak = await streakRepository.findByUserId(null);
      expect(streak).toBeDefined();
      expect(streak?.currentStreak).toBe(5);
      expect(streak?.longestStreak).toBe(10);
    });

    test('should find streak for specific userId', async () => {
      const userId = 42;
      await streakRepository.create({
        userId,
        currentStreak: 3,
        longestStreak: 7,
        lastActivityDate: '2025-01-15',
        streakStartDate: '2025-01-12',
        totalDaysActive: 10,
      });

      const streak = await streakRepository.findByUserId(userId);
      expect(streak).toBeDefined();
      expect(streak?.userId).toBe(userId);
      expect(streak?.currentStreak).toBe(3);
    });

    test('should not mix up null and specific userIds', async () => {
      // Create streaks for both null and specific userId
      await streakRepository.create({
        userId: null,
        currentStreak: 5,
        longestStreak: 5,
        lastActivityDate: '2025-01-15',
        streakStartDate: '2025-01-10',
        totalDaysActive: 5,
      });

      await streakRepository.create({
        userId: 123,
        currentStreak: 10,
        longestStreak: 10,
        lastActivityDate: '2025-01-15',
        streakStartDate: '2025-01-05',
        totalDaysActive: 10,
      });

      const nullStreak = await streakRepository.findByUserId(null);
      const userStreak = await streakRepository.findByUserId(123);

      expect(nullStreak?.currentStreak).toBe(5);
      expect(userStreak?.currentStreak).toBe(10);
    });
  });

  // ============================================================================
  // getOrCreate
  // ============================================================================

  describe('getOrCreate()', () => {
    test('should create new streak on first call', async () => {
      const streak = await streakRepository.getOrCreate(null);

      expect(streak).toBeDefined();
      expect(streak.id).toBeGreaterThan(0);
      expect(streak.currentStreak).toBe(0);
      expect(streak.longestStreak).toBe(0);
      expect(streak.totalDaysActive).toBe(0);
    });

    test('should return existing streak on subsequent calls', async () => {
      const streak1 = await streakRepository.getOrCreate(null);
      const streak2 = await streakRepository.getOrCreate(null);

      expect(streak1.id).toBe(streak2.id);
    });

    test('should set initial dates to today', async () => {
      const streak = await streakRepository.getOrCreate(null);
      const today = new Date().toISOString().split('T')[0];

      expect(streak.lastActivityDate).toBe(today);
      expect(streak.streakStartDate).toBe(today);
    });

    test('should create separate streaks for different userIds', async () => {
      const streak1 = await streakRepository.getOrCreate(null);
      const streak2 = await streakRepository.getOrCreate(123);

      expect(streak1.id).not.toBe(streak2.id);
      expect(streak1.userId).toBeNull();
      expect(streak2.userId).toBe(123);
    });
  });

  // ============================================================================
  // incrementStreak
  // ============================================================================

  describe('incrementStreak()', () => {
    test('should increment currentStreak by 1', async () => {
      // First create a streak
      await streakRepository.getOrCreate(null);

      const updated = await streakRepository.incrementStreak(null);

      expect(updated.currentStreak).toBe(1);
    });

    test('should update longestStreak when currentStreak exceeds it', async () => {
      const streak = await streakRepository.getOrCreate(null);
      expect(streak.longestStreak).toBe(0);

      const updated = await streakRepository.incrementStreak(null);

      expect(updated.currentStreak).toBe(1);
      expect(updated.longestStreak).toBe(1);
    });

    test('should not update longestStreak when currentStreak is less', async () => {
      // Create streak with higher longest streak
      await streakRepository.create({
        userId: null,
        currentStreak: 2,
        longestStreak: 10,
        lastActivityDate: '2025-01-15',
        streakStartDate: '2025-01-13',
        totalDaysActive: 5,
      });

      const updated = await streakRepository.incrementStreak(null);

      expect(updated.currentStreak).toBe(3);
      expect(updated.longestStreak).toBe(10); // Unchanged
    });

    test('should increment totalDaysActive', async () => {
      await streakRepository.create({
        userId: null,
        currentStreak: 5,
        longestStreak: 5,
        lastActivityDate: '2025-01-15',
        streakStartDate: '2025-01-10',
        totalDaysActive: 20,
      });

      const updated = await streakRepository.incrementStreak(null);

      expect(updated.totalDaysActive).toBe(21);
    });

    test('should update lastActivityDate to today', async () => {
      await streakRepository.create({
        userId: null,
        currentStreak: 5,
        longestStreak: 5,
        lastActivityDate: '2025-01-10',
        streakStartDate: '2025-01-05',
        totalDaysActive: 10,
      });

      const updated = await streakRepository.incrementStreak(null);
      const today = new Date().toISOString().split('T')[0];

      expect(updated.lastActivityDate).toBe(today);
    });
  });

  // ============================================================================
  // resetCurrentStreak
  // ============================================================================

  describe('resetCurrentStreak()', () => {
    test('should reset currentStreak to 1', async () => {
      await streakRepository.create({
        userId: null,
        currentStreak: 15,
        longestStreak: 20,
        lastActivityDate: '2025-01-10',
        streakStartDate: '2024-12-26',
        totalDaysActive: 30,
      });

      const updated = await streakRepository.resetCurrentStreak(null);

      expect(updated.currentStreak).toBe(1);
    });

    test('should preserve longestStreak', async () => {
      await streakRepository.create({
        userId: null,
        currentStreak: 15,
        longestStreak: 25,
        lastActivityDate: '2025-01-10',
        streakStartDate: '2024-12-26',
        totalDaysActive: 30,
      });

      const updated = await streakRepository.resetCurrentStreak(null);

      expect(updated.longestStreak).toBe(25);
    });

    test('should update streakStartDate to today', async () => {
      await streakRepository.create({
        userId: null,
        currentStreak: 15,
        longestStreak: 20,
        lastActivityDate: '2025-01-10',
        streakStartDate: '2024-12-26',
        totalDaysActive: 30,
      });

      const updated = await streakRepository.resetCurrentStreak(null);
      const today = new Date().toISOString().split('T')[0];

      expect(updated.streakStartDate).toBe(today);
    });

    test('should increment totalDaysActive', async () => {
      await streakRepository.create({
        userId: null,
        currentStreak: 15,
        longestStreak: 20,
        lastActivityDate: '2025-01-10',
        streakStartDate: '2024-12-26',
        totalDaysActive: 30,
      });

      const updated = await streakRepository.resetCurrentStreak(null);

      expect(updated.totalDaysActive).toBe(31);
    });

    test('should update lastActivityDate to today', async () => {
      await streakRepository.create({
        userId: null,
        currentStreak: 15,
        longestStreak: 20,
        lastActivityDate: '2025-01-10',
        streakStartDate: '2024-12-26',
        totalDaysActive: 30,
      });

      const updated = await streakRepository.resetCurrentStreak(null);
      const today = new Date().toISOString().split('T')[0];

      expect(updated.lastActivityDate).toBe(today);
    });
  });

  // ============================================================================
  // updateThreshold
  // ============================================================================

  describe('updateThreshold()', () => {
    test('should update dailyThreshold to valid value', async () => {
      await streakRepository.getOrCreate(null);

      const updated = await streakRepository.updateThreshold(null, 50);

      expect(updated.dailyThreshold).toBe(50);
    });

    test('should accept minimum threshold of 1', async () => {
      await streakRepository.getOrCreate(null);

      const updated = await streakRepository.updateThreshold(null, 1);

      expect(updated.dailyThreshold).toBe(1);
    });

    test('should accept maximum threshold of 9999', async () => {
      await streakRepository.getOrCreate(null);

      const updated = await streakRepository.updateThreshold(null, 9999);

      expect(updated.dailyThreshold).toBe(9999);
    });

    test('should throw error for threshold less than 1', async () => {
      await streakRepository.getOrCreate(null);

      await expect(streakRepository.updateThreshold(null, 0)).rejects.toThrow(
        'Daily threshold must be between 1 and 9999'
      );
    });

    test('should throw error for threshold greater than 9999', async () => {
      await streakRepository.getOrCreate(null);

      await expect(streakRepository.updateThreshold(null, 10000)).rejects.toThrow(
        'Daily threshold must be between 1 and 9999'
      );
    });

    test('should throw error for non-integer threshold', async () => {
      await streakRepository.getOrCreate(null);

      await expect(streakRepository.updateThreshold(null, 50.5)).rejects.toThrow(
        'Daily threshold must be an integer'
      );
    });

    test('should throw error for negative threshold', async () => {
      await streakRepository.getOrCreate(null);

      await expect(streakRepository.updateThreshold(null, -10)).rejects.toThrow(
        'Daily threshold must be between 1 and 9999'
      );
    });
  });

  // ============================================================================
  // setTimezone
  // ============================================================================

  describe('setTimezone()', () => {
    test('should set valid timezone', async () => {
      await streakRepository.getOrCreate(null);

      const updated = await streakRepository.setTimezone(null, 'America/New_York');

      expect(updated.userTimezone).toBe('America/New_York');
    });

    test('should accept various valid timezones', async () => {
      await streakRepository.getOrCreate(null);

      // Test various valid timezones
      const timezones = ['UTC', 'America/Los_Angeles', 'Europe/London', 'Asia/Tokyo', 'Pacific/Auckland'];

      for (const tz of timezones) {
        const updated = await streakRepository.setTimezone(null, tz);
        expect(updated.userTimezone).toBe(tz);
      }
    });

    test('should throw error for invalid timezone', async () => {
      await streakRepository.getOrCreate(null);

      await expect(streakRepository.setTimezone(null, 'Invalid/Timezone')).rejects.toThrow(
        'Invalid timezone: Invalid/Timezone'
      );
    });

    test('should throw error for empty timezone', async () => {
      await streakRepository.getOrCreate(null);

      await expect(streakRepository.setTimezone(null, '')).rejects.toThrow('Invalid timezone:');
    });

    test('should throw error for random string', async () => {
      await streakRepository.getOrCreate(null);

      await expect(streakRepository.setTimezone(null, 'not_a_timezone')).rejects.toThrow(
        'Invalid timezone: not_a_timezone'
      );
    });
  });

  // ============================================================================
  // getTimezone
  // ============================================================================

  describe('getTimezone()', () => {
    test('should return default timezone when no streak exists', async () => {
      const timezone = await streakRepository.getTimezone(null);
      expect(timezone).toBe('America/New_York');
    });

    test('should return stored timezone', async () => {
      await streakRepository.getOrCreate(null);
      await streakRepository.setTimezone(null, 'Europe/Paris');

      const timezone = await streakRepository.getTimezone(null);
      expect(timezone).toBe('Europe/Paris');
    });

    test('should return default when userTimezone is not set', async () => {
      await streakRepository.getOrCreate(null);

      const timezone = await streakRepository.getTimezone(null);
      expect(timezone).toBe('America/New_York');
    });
  });

  // ============================================================================
  // upsert
  // ============================================================================

  describe('upsert()', () => {
    test('should create new streak when none exists', async () => {
      const streak = await streakRepository.upsert(null, {
        currentStreak: 5,
        longestStreak: 10,
      });

      expect(streak.id).toBeGreaterThan(0);
      expect(streak.currentStreak).toBe(5);
      expect(streak.longestStreak).toBe(10);
    });

    test('should update existing streak', async () => {
      // Create initial streak
      const initial = await streakRepository.create({
        userId: null,
        currentStreak: 3,
        longestStreak: 5,
        lastActivityDate: '2025-01-15',
        streakStartDate: '2025-01-12',
        totalDaysActive: 10,
      });

      // Upsert with updates
      const updated = await streakRepository.upsert(null, {
        currentStreak: 7,
      });

      expect(updated.id).toBe(initial.id);
      expect(updated.currentStreak).toBe(7);
      expect(updated.longestStreak).toBe(5); // Unchanged
    });

    test('should set default values for new streak', async () => {
      const streak = await streakRepository.upsert(null, {});

      expect(streak.currentStreak).toBe(0);
      expect(streak.longestStreak).toBe(0);
      expect(streak.totalDaysActive).toBe(0);
    });

    test('should handle userId correctly', async () => {
      const streak = await streakRepository.upsert(123, {
        currentStreak: 5,
      });

      expect(streak.userId).toBe(123);
      expect(streak.currentStreak).toBe(5);
    });
  });

  // ============================================================================
  // updateLastActivity
  // ============================================================================

  describe('updateLastActivity()', () => {
    test('should update lastActivityDate', async () => {
      await streakRepository.create({
        userId: null,
        currentStreak: 5,
        longestStreak: 5,
        lastActivityDate: '2025-01-10',
        streakStartDate: '2025-01-05',
        totalDaysActive: 10,
      });

      const testDate = new Date('2025-01-20');
      const updated = await streakRepository.updateLastActivity(null, testDate);

      expect(updated.lastActivityDate).toBe('2025-01-20');
    });

    test('should use current date by default', async () => {
      await streakRepository.create({
        userId: null,
        currentStreak: 5,
        longestStreak: 5,
        lastActivityDate: '2025-01-10',
        streakStartDate: '2025-01-05',
        totalDaysActive: 10,
      });

      const updated = await streakRepository.updateLastActivity(null);
      const today = new Date().toISOString().split('T')[0];

      expect(updated.lastActivityDate).toBe(today);
    });
  });
});
