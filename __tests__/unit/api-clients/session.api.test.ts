import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { sessionApi } from '@/lib/api/domains/session';
import { spyOnBaseApiClient } from '../../helpers/api-test-utils';

describe('sessionApi', () => {
  let apiSpies: ReturnType<typeof spyOnBaseApiClient>;

  beforeEach(() => {
    apiSpies = spyOnBaseApiClient();
  });

  afterEach(() => {
    apiSpies.restoreAll();
  });

  describe('update', () => {
    test('should call PATCH with correct endpoint and request body', async () => {
      const data = { startedDate: '2024-01-01T00:00:00.000Z' };
      const response = {
        success: true,
        data: {
          id: 456,
          bookId: 123,
          startedDate: '2024-01-01T00:00:00.000Z',
        },
      };
      apiSpies.patch.mockResolvedValue(response);

      const result = await sessionApi.update('123', 456, data);

      expect(apiSpies.patch).toHaveBeenCalledWith(
        '/api/books/123/sessions/456',
        data
      );
      expect(result).toEqual(response);
    });

    test('should handle numeric bookId values', async () => {
      const data = { startedDate: '2024-06-15T00:00:00.000Z' };
      const response = { success: true, data: { id: 789 } };
      apiSpies.patch.mockResolvedValue(response);

      await sessionApi.update('999', 789, data);

      expect(apiSpies.patch).toHaveBeenCalledWith(
        '/api/books/999/sessions/789',
        data
      );
    });

    test('should handle different session update fields', async () => {
      const data = {
        startedDate: '2024-01-01T00:00:00.000Z',
        completedDate: '2024-01-15T00:00:00.000Z',
      };
      apiSpies.patch.mockResolvedValue({ success: true, data: {} });

      await sessionApi.update('100', 200, data);

      expect(apiSpies.patch).toHaveBeenCalledWith(
        '/api/books/100/sessions/200',
        data
      );
    });

    test('should propagate errors from baseApiClient', async () => {
      const data = { startedDate: '2024-01-01T00:00:00.000Z' };
      const error = new Error('Session not found');
      apiSpies.patch.mockRejectedValue(error);

      await expect(sessionApi.update('123', 999, data)).rejects.toThrow('Session not found');
    });
  });
});
