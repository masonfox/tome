import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { journalApi } from '@/lib/api/domains/journal';
import { spyOnBaseApiClient } from '../../helpers/api-test-utils';

describe('journalApi', () => {
  let apiSpies: ReturnType<typeof spyOnBaseApiClient>;

  beforeEach(() => {
    apiSpies = spyOnBaseApiClient();
  });

  afterEach(() => {
    apiSpies.restoreAll();
  });

  describe('listEntries', () => {
    test('should call GET with correct endpoint and default query params', async () => {
      const mockResponse = { entries: [], total: 0 };
      apiSpies.get.mockResolvedValue(mockResponse);

      const result = await journalApi.listEntries();

      expect(apiSpies.get).toHaveBeenCalledWith(
        '/api/journal?timezone=America%2FNew_York&limit=50&skip=0'
      );
      expect(result).toEqual(mockResponse);
    });

    test('should construct query params with custom values', async () => {
      const mockResponse = { entries: [], total: 0 };
      apiSpies.get.mockResolvedValue(mockResponse);

      await journalApi.listEntries({
        timezone: 'Europe/London',
        limit: 25,
        skip: 10,
      });

      expect(apiSpies.get).toHaveBeenCalledWith(
        '/api/journal?timezone=Europe%2FLondon&limit=25&skip=10'
      );
    });

    test('should handle timezone with forward slashes correctly', async () => {
      apiSpies.get.mockResolvedValue({ entries: [], total: 0 });

      await journalApi.listEntries({ timezone: 'America/Los_Angeles' });

      expect(apiSpies.get).toHaveBeenCalledWith(
        '/api/journal?timezone=America%2FLos_Angeles&limit=50&skip=0'
      );
    });

    test('should handle partial params with defaults', async () => {
      apiSpies.get.mockResolvedValue({ entries: [], total: 0 });

      await journalApi.listEntries({ limit: 100 });

      expect(apiSpies.get).toHaveBeenCalledWith(
        '/api/journal?timezone=America%2FNew_York&limit=100&skip=0'
      );
    });

    test('should propagate errors from baseApiClient', async () => {
      const error = new Error('Failed to fetch entries');
      apiSpies.get.mockRejectedValue(error);

      await expect(journalApi.listEntries()).rejects.toThrow('Failed to fetch entries');
    });
  });

  describe('getArchive', () => {
    test('should call GET with correct endpoint and default timezone', async () => {
      const mockArchive = { years: [] };
      apiSpies.get.mockResolvedValue(mockArchive);

      const result = await journalApi.getArchive();

      expect(apiSpies.get).toHaveBeenCalledWith(
        '/api/journal/archive?timezone=America%2FNew_York'
      );
      expect(result).toEqual(mockArchive);
    });

    test('should construct query params with custom timezone', async () => {
      const mockArchive = { years: [] };
      apiSpies.get.mockResolvedValue(mockArchive);

      await journalApi.getArchive({ timezone: 'UTC' });

      expect(apiSpies.get).toHaveBeenCalledWith(
        '/api/journal/archive?timezone=UTC'
      );
    });

    test('should handle timezone with forward slashes correctly', async () => {
      apiSpies.get.mockResolvedValue({ years: [] });

      await journalApi.getArchive({ timezone: 'Asia/Tokyo' });

      expect(apiSpies.get).toHaveBeenCalledWith(
        '/api/journal/archive?timezone=Asia%2FTokyo'
      );
    });

    test('should propagate errors from baseApiClient', async () => {
      const error = new Error('Failed to fetch archive');
      apiSpies.get.mockRejectedValue(error);

      await expect(journalApi.getArchive()).rejects.toThrow('Failed to fetch archive');
    });
  });
});
