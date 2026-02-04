import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { statsApi } from '@/lib/api/domains/stats';
import { spyOnBaseApiClient } from '../../helpers/api-test-utils';

describe('statsApi', () => {
  let apiSpies: ReturnType<typeof spyOnBaseApiClient>;

  beforeEach(() => {
    apiSpies = spyOnBaseApiClient();
  });

  afterEach(() => {
    apiSpies.restoreAll();
  });

  describe('getOverview', () => {
    test('should call GET with correct endpoint', async () => {
      const mockStats = {
        booksRead: { thisYear: 25, allTime: 100 },
        pagesRead: { thisYear: 5000, allTime: 20000 },
        avgPagesPerDay: { thisYear: 20, allTime: 15 },
      };
      apiSpies.get.mockResolvedValue(mockStats);

      const result = await statsApi.getOverview();

      expect(apiSpies.get).toHaveBeenCalledWith('/api/stats/overview');
      expect(result).toEqual(mockStats);
    });

    test('should return stats data from baseApiClient', async () => {
      const expectedStats = {
        booksRead: { thisYear: 50, allTime: 200 },
        pagesRead: { thisYear: 10000, allTime: 50000 },
        avgPagesPerDay: { thisYear: 30, allTime: 25 },
      };
      apiSpies.get.mockResolvedValue(expectedStats);

      const result = await statsApi.getOverview();

      expect(result).toBe(expectedStats);
    });

    test('should propagate errors from baseApiClient', async () => {
      const error = new Error('Failed to fetch stats');
      apiSpies.get.mockRejectedValue(error);

      await expect(statsApi.getOverview()).rejects.toThrow('Failed to fetch stats');
    });
  });

  describe('getStreak', () => {
    test('should call GET with correct endpoint', async () => {
      const mockStreak = {
        currentStreak: 5,
        longestStreak: 15,
        dailyReadingThreshold: 20,
        timezone: 'America/New_York',
      };
      apiSpies.get.mockResolvedValue(mockStreak);

      const result = await statsApi.getStreak();

      expect(apiSpies.get).toHaveBeenCalledWith('/api/streaks');
      expect(result).toEqual(mockStreak);
    });

    test('should return streak data from baseApiClient', async () => {
      const expectedStreak = {
        currentStreak: 10,
        longestStreak: 25,
        dailyReadingThreshold: 30,
        timezone: 'UTC',
      };
      apiSpies.get.mockResolvedValue(expectedStreak);

      const result = await statsApi.getStreak();

      expect(result).toBe(expectedStreak);
    });

    test('should propagate errors from baseApiClient', async () => {
      const error = new Error('Failed to fetch streak');
      apiSpies.get.mockRejectedValue(error);

      await expect(statsApi.getStreak()).rejects.toThrow('Failed to fetch streak');
    });
  });
});
