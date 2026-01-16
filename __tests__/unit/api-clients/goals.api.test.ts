import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { goalsApi } from '@/lib/api/domains/goals';
import { spyOnBaseApiClient } from '../../helpers/api-test-utils';

describe('goalsApi', () => {
  let apiSpies: ReturnType<typeof spyOnBaseApiClient>;

  beforeEach(() => {
    apiSpies = spyOnBaseApiClient();
  });

  afterEach(() => {
    apiSpies.restoreAll();
  });

  describe('list', () => {
    test('should call GET with correct endpoint', async () => {
      const mockResponse = { data: [{ id: 1, year: 2024, booksGoal: 50 }] };
      apiSpies.get.mockResolvedValue(mockResponse);

      const result = await goalsApi.list();

      expect(apiSpies.get).toHaveBeenCalledWith('/api/reading-goals');
      expect(result).toEqual(mockResponse);
    });

    test('should return empty array when no goals exist', async () => {
      const mockResponse = { data: [] };
      apiSpies.get.mockResolvedValue(mockResponse);

      const result = await goalsApi.list();

      expect(result.data).toEqual([]);
    });

    test('should propagate errors from baseApiClient', async () => {
      const error = new Error('Network error');
      apiSpies.get.mockRejectedValue(error);

      await expect(goalsApi.list()).rejects.toThrow('Network error');
    });
  });

  describe('create', () => {
    test('should call POST with correct endpoint and request body', async () => {
      const request = { year: 2024, booksGoal: 50 };
      const response = { success: true, data: { id: 1, ...request } };
      apiSpies.post.mockResolvedValue(response);

      const result = await goalsApi.create(request);

      expect(apiSpies.post).toHaveBeenCalledWith('/api/reading-goals', request);
      expect(result).toEqual(response);
    });

    test('should handle different booksGoal values', async () => {
      const request = { year: 2025, booksGoal: 100 };
      const response = { success: true, data: { id: 2, ...request } };
      apiSpies.post.mockResolvedValue(response);

      await goalsApi.create(request);

      expect(apiSpies.post).toHaveBeenCalledWith('/api/reading-goals', request);
    });

    test('should handle low booksGoal values', async () => {
      const request = { year: 2025, booksGoal: 1 };
      const response = { success: true, data: { id: 3, ...request } };
      apiSpies.post.mockResolvedValue(response);

      await goalsApi.create(request);

      expect(apiSpies.post).toHaveBeenCalledWith('/api/reading-goals', request);
    });

    test('should propagate errors from baseApiClient', async () => {
      const request = { year: 2024, booksGoal: 50 };
      const error = new Error('Duplicate year');
      apiSpies.post.mockRejectedValue(error);

      await expect(goalsApi.create(request)).rejects.toThrow('Duplicate year');
    });
  });

  describe('update', () => {
    test('should call PATCH with goalId in URL', async () => {
      const request = { booksGoal: 75 };
      const response = { success: true, data: { id: 1, year: 2024, booksGoal: 75 } };
      apiSpies.patch.mockResolvedValue(response);

      const result = await goalsApi.update(1, request);

      expect(apiSpies.patch).toHaveBeenCalledWith('/api/reading-goals/1', request);
      expect(result).toEqual(response);
    });

    test('should handle different goalId values', async () => {
      const request = { booksGoal: 100 };
      const response = { success: true, data: { id: 42, year: 2025, booksGoal: 100 } };
      apiSpies.patch.mockResolvedValue(response);

      await goalsApi.update(42, request);

      expect(apiSpies.patch).toHaveBeenCalledWith('/api/reading-goals/42', request);
    });

    test('should handle booksGoal updates', async () => {
      const request = { booksGoal: 200 };
      apiSpies.patch.mockResolvedValue({ success: true, data: { id: 5, year: 2026, booksGoal: 200 } });

      await goalsApi.update(5, request);

      expect(apiSpies.patch).toHaveBeenCalledWith('/api/reading-goals/5', request);
    });

    test('should propagate errors from baseApiClient', async () => {
      const request = { booksGoal: 75 };
      const error = new Error('Goal not found');
      apiSpies.patch.mockRejectedValue(error);

      await expect(goalsApi.update(999, request)).rejects.toThrow('Goal not found');
    });
  });

  describe('delete', () => {
    test('should call DELETE with goalId in URL', async () => {
      const response = { success: true };
      apiSpies.delete.mockResolvedValue(response);

      const result = await goalsApi.delete(1);

      expect(apiSpies.delete).toHaveBeenCalledWith('/api/reading-goals/1');
      expect(result).toEqual(response);
    });

    test('should handle different goalId values', async () => {
      const response = { success: true };
      apiSpies.delete.mockResolvedValue(response);

      await goalsApi.delete(99);

      expect(apiSpies.delete).toHaveBeenCalledWith('/api/reading-goals/99');
    });

    test('should propagate errors from baseApiClient', async () => {
      const error = new Error('Goal not found');
      apiSpies.delete.mockRejectedValue(error);

      await expect(goalsApi.delete(999)).rejects.toThrow('Goal not found');
    });
  });
});
