import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { streakApi } from '@/lib/api/domains/streak';
import { spyOnBaseApiClient } from '../../helpers/api-test-utils';

describe('streakApi', () => {
  let apiSpies: ReturnType<typeof spyOnBaseApiClient>;

  beforeEach(() => {
    apiSpies = spyOnBaseApiClient();
  });

  afterEach(() => {
    apiSpies.restoreAll();
  });

  describe('rebuild', () => {
    test('should call POST with correct endpoint', async () => {
      const mockResponse = {
        success: true,
        data: {
          currentStreak: 10,
          longestStreak: 25,
        },
      };
      apiSpies.post.mockResolvedValue(mockResponse);

      const result = await streakApi.rebuild();

      expect(apiSpies.post).toHaveBeenCalledWith('/api/streak/rebuild', undefined);
      expect(result).toEqual(mockResponse);
    });

    test('should return rebuild response from baseApiClient', async () => {
      const expectedResponse = {
        success: true,
        data: {
          currentStreak: 5,
          longestStreak: 15,
        },
      };
      apiSpies.post.mockResolvedValue(expectedResponse);

      const result = await streakApi.rebuild();

      expect(result).toBe(expectedResponse);
    });

    test('should propagate errors from baseApiClient', async () => {
      const error = new Error('Failed to rebuild streak');
      apiSpies.post.mockRejectedValue(error);

      await expect(streakApi.rebuild()).rejects.toThrow('Failed to rebuild streak');
    });
  });

  describe('updateThreshold', () => {
    test('should call PATCH with correct endpoint and request body', async () => {
      const request = { dailyThreshold: 20 };
      const response = {
        success: true,
        data: {
          currentStreak: 5,
          longestStreak: 10,
          dailyReadingThreshold: 20,
        },
      };
      apiSpies.patch.mockResolvedValue(response);

      const result = await streakApi.updateThreshold(request);

      expect(apiSpies.patch).toHaveBeenCalledWith('/api/streak', request);
      expect(result).toEqual(response);
    });

    test('should handle different threshold values', async () => {
      const request = { dailyThreshold: 50 };
      const response = {
        success: true,
        data: {
          currentStreak: 0,
          longestStreak: 5,
          dailyReadingThreshold: 50,
        },
      };
      apiSpies.patch.mockResolvedValue(response);

      await streakApi.updateThreshold(request);

      expect(apiSpies.patch).toHaveBeenCalledWith('/api/streak', request);
    });

    test('should handle low threshold values', async () => {
      const request = { dailyThreshold: 1 };
      apiSpies.patch.mockResolvedValue({ success: true, data: {} });

      await streakApi.updateThreshold(request);

      expect(apiSpies.patch).toHaveBeenCalledWith('/api/streak', request);
    });

    test('should propagate errors from baseApiClient', async () => {
      const request = { dailyThreshold: 20 };
      const error = new Error('Invalid threshold');
      apiSpies.patch.mockRejectedValue(error);

      await expect(streakApi.updateThreshold(request)).rejects.toThrow('Invalid threshold');
    });
  });

  describe('updateTimezone', () => {
    test('should call PATCH with correct endpoint and request body', async () => {
      const request = { timezone: 'America/New_York' };
      const response = {
        success: true,
        data: {
          currentStreak: 8,
          longestStreak: 20,
          timezone: 'America/New_York',
        },
      };
      apiSpies.patch.mockResolvedValue(response);

      const result = await streakApi.updateTimezone(request);

      expect(apiSpies.patch).toHaveBeenCalledWith('/api/streak/timezone', request);
      expect(result).toEqual(response);
    });

    test('should handle different timezone values', async () => {
      const request = { timezone: 'Europe/London' };
      const response = {
        success: true,
        data: {
          currentStreak: 3,
          longestStreak: 12,
          timezone: 'Europe/London',
        },
      };
      apiSpies.patch.mockResolvedValue(response);

      await streakApi.updateTimezone(request);

      expect(apiSpies.patch).toHaveBeenCalledWith('/api/streak/timezone', request);
    });

    test('should handle UTC timezone', async () => {
      const request = { timezone: 'UTC' };
      apiSpies.patch.mockResolvedValue({ success: true, data: { timezone: 'UTC' } });

      await streakApi.updateTimezone(request);

      expect(apiSpies.patch).toHaveBeenCalledWith('/api/streak/timezone', request);
    });

    test('should propagate errors from baseApiClient', async () => {
      const request = { timezone: 'Invalid/Timezone' };
      const error = new Error('Invalid timezone');
      apiSpies.patch.mockRejectedValue(error);

      await expect(streakApi.updateTimezone(request)).rejects.toThrow('Invalid timezone');
    });
  });

  describe('enableStreak', () => {
    test('should call PATCH with correct endpoint and request body when enabling', async () => {
      const request = { streakEnabled: true, dailyThreshold: 10 };
      const response = {
        success: true,
        data: {
          streakEnabled: true,
          currentStreak: 0,
          longestStreak: 0,
          dailyReadingThreshold: 10,
        },
      };
      apiSpies.patch.mockResolvedValue(response);

      const result = await streakApi.enableStreak(request);

      expect(apiSpies.patch).toHaveBeenCalledWith('/api/streak', request);
      expect(result).toEqual(response);
    });

    test('should call PATCH when disabling streak', async () => {
      const request = { streakEnabled: false };
      const response = {
        success: true,
        data: {
          streakEnabled: false,
          currentStreak: 0,
          longestStreak: 0,
        },
      };
      apiSpies.patch.mockResolvedValue(response);

      const result = await streakApi.enableStreak(request);

      expect(apiSpies.patch).toHaveBeenCalledWith('/api/streak', request);
      expect(result).toEqual(response);
    });

    test('should handle enabling streak with threshold', async () => {
      const request = { streakEnabled: true, dailyThreshold: 5 };
      const response = {
        success: true,
        data: {
          streakEnabled: true,
          dailyReadingThreshold: 5,
        },
      };
      apiSpies.patch.mockResolvedValue(response);

      await streakApi.enableStreak(request);

      expect(apiSpies.patch).toHaveBeenCalledWith('/api/streak', request);
    });

    test('should handle enabling streak without threshold', async () => {
      const request = { streakEnabled: true };
      apiSpies.patch.mockResolvedValue({ 
        success: true, 
        data: { streakEnabled: true } 
      });

      await streakApi.enableStreak(request);

      expect(apiSpies.patch).toHaveBeenCalledWith('/api/streak', request);
    });

    test('should return enable response from baseApiClient', async () => {
      const expectedResponse = {
        success: true,
        data: {
          streakEnabled: true,
          currentStreak: 5,
          longestStreak: 10,
        },
      };
      apiSpies.patch.mockResolvedValue(expectedResponse);

      const result = await streakApi.enableStreak({ 
        streakEnabled: true, 
        dailyThreshold: 15 
      });

      expect(result).toBe(expectedResponse);
    });

    test('should propagate errors from baseApiClient', async () => {
      const request = { streakEnabled: true, dailyThreshold: 10 };
      const error = new Error('Failed to enable streak');
      apiSpies.patch.mockRejectedValue(error);

      await expect(streakApi.enableStreak(request)).rejects.toThrow('Failed to enable streak');
    });
  });
});
