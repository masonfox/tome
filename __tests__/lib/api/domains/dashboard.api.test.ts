import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { dashboardApi } from '@/lib/api/domains/dashboard';
import { spyOnBaseApiClient } from '../../../helpers/api-test-utils';

describe('dashboardApi', () => {
  let apiSpies: ReturnType<typeof spyOnBaseApiClient>;

  beforeEach(() => {
    apiSpies = spyOnBaseApiClient();
  });

  afterEach(() => {
    apiSpies.restoreAll();
  });

  describe('get', () => {
    test('should call GET with correct endpoint', async () => {
      const mockDashboard = {
        stats: { totalBooks: 100, booksRead: 50 },
        streak: { currentStreak: 5, longestStreak: 10 },
        currentlyReading: [],
        readNext: [],
      };
      apiSpies.get.mockResolvedValue(mockDashboard);

      const result = await dashboardApi.get();

      expect(apiSpies.get).toHaveBeenCalledWith('/api/dashboard');
      expect(result).toEqual(mockDashboard);
    });

    test('should return dashboard data from baseApiClient', async () => {
      const expectedData = {
        stats: { totalBooks: 250, booksRead: 120 },
        streak: { currentStreak: 15, longestStreak: 30 },
        currentlyReading: [{ id: 1, title: 'Test Book' }],
        readNext: [{ id: 2, title: 'Next Book' }],
      };
      apiSpies.get.mockResolvedValue(expectedData);

      const result = await dashboardApi.get();

      expect(result).toBe(expectedData);
    });

    test('should propagate errors from baseApiClient', async () => {
      const error = new Error('Network error');
      apiSpies.get.mockRejectedValue(error);

      await expect(dashboardApi.get()).rejects.toThrow('Network error');
    });
  });
});
