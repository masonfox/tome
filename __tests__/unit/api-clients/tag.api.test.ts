import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { tagApi } from '@/lib/api/domains/tag';
import { spyOnBaseApiClient } from '../../helpers/api-test-utils';

describe('tagApi', () => {
  let apiSpies: ReturnType<typeof spyOnBaseApiClient>;

  beforeEach(() => {
    apiSpies = spyOnBaseApiClient();
  });

  afterEach(() => {
    apiSpies.restoreAll();
  });

  describe('getStats', () => {
    test('should call GET with correct endpoint', async () => {
      const mockStats = { tags: [], totalBooks: 0 };
      apiSpies.get.mockResolvedValue(mockStats);

      const result = await tagApi.getStats();

      expect(apiSpies.get).toHaveBeenCalledWith('/api/tags/stats');
      expect(result).toEqual(mockStats);
    });

    test('should propagate errors from baseApiClient', async () => {
      const error = new Error('Failed to fetch tag stats');
      apiSpies.get.mockRejectedValue(error);

      await expect(tagApi.getStats()).rejects.toThrow('Failed to fetch tag stats');
    });
  });

  describe('rename', () => {
    test('should call PATCH with correct endpoint and request body', async () => {
      const response = { success: true, successCount: 5, failureCount: 0 };
      apiSpies.patch.mockResolvedValue(response);

      const result = await tagApi.rename('fiction', 'Fiction');

      expect(apiSpies.patch).toHaveBeenCalledWith('/api/tags/fiction', { newName: 'Fiction' });
      expect(result).toEqual(response);
    });

    test('should encode tag names with spaces', async () => {
      apiSpies.patch.mockResolvedValue({ success: true, successCount: 3, failureCount: 0 });

      await tagApi.rename('Science Fiction', 'Sci-Fi');

      expect(apiSpies.patch).toHaveBeenCalledWith(
        '/api/tags/Science%20Fiction',
        { newName: 'Sci-Fi' }
      );
    });

    test('should encode special characters in tag names', async () => {
      apiSpies.patch.mockResolvedValue({ success: true, successCount: 1, failureCount: 0 });

      await tagApi.rename('tag/with/slashes', 'new-tag');

      expect(apiSpies.patch).toHaveBeenCalledWith(
        '/api/tags/tag%2Fwith%2Fslashes',
        { newName: 'new-tag' }
      );
    });

    test('should propagate errors from baseApiClient', async () => {
      const error = new Error('Tag already exists');
      apiSpies.patch.mockRejectedValue(error);

      await expect(tagApi.rename('old-tag', 'existing-tag')).rejects.toThrow('Tag already exists');
    });
  });

  describe('delete', () => {
    test('should call DELETE with correct endpoint', async () => {
      const response = { success: true, successCount: 10, failureCount: 0 };
      apiSpies.delete.mockResolvedValue(response);

      const result = await tagApi.delete('deprecated');

      expect(apiSpies.delete).toHaveBeenCalledWith('/api/tags/deprecated');
      expect(result).toEqual(response);
    });

    test('should encode tag names with spaces', async () => {
      apiSpies.delete.mockResolvedValue({ success: true, successCount: 5, failureCount: 0 });

      await tagApi.delete('Old Tag');

      expect(apiSpies.delete).toHaveBeenCalledWith('/api/tags/Old%20Tag');
    });

    test('should propagate errors from baseApiClient', async () => {
      const error = new Error('Tag not found');
      apiSpies.delete.mockRejectedValue(error);

      await expect(tagApi.delete('nonexistent')).rejects.toThrow('Tag not found');
    });
  });

  describe('merge', () => {
    test('should call POST with correct endpoint and request body', async () => {
      const response = { success: true, successCount: 15, failureCount: 0 };
      apiSpies.post.mockResolvedValue(response);

      const result = await tagApi.merge(['tag1', 'tag2'], 'merged-tag');

      expect(apiSpies.post).toHaveBeenCalledWith('/api/tags/merge', {
        sourceTags: ['tag1', 'tag2'],
        targetTag: 'merged-tag',
      });
      expect(result).toEqual(response);
    });

    test('should handle multiple source tags', async () => {
      apiSpies.post.mockResolvedValue({ success: true, successCount: 20, failureCount: 0 });

      await tagApi.merge(['fiction', 'sci-fi', 'fantasy'], 'speculative-fiction');

      expect(apiSpies.post).toHaveBeenCalledWith('/api/tags/merge', {
        sourceTags: ['fiction', 'sci-fi', 'fantasy'],
        targetTag: 'speculative-fiction',
      });
    });

    test('should propagate errors from baseApiClient', async () => {
      const error = new Error('Merge failed');
      apiSpies.post.mockRejectedValue(error);

      await expect(tagApi.merge(['tag1'], 'tag2')).rejects.toThrow('Merge failed');
    });
  });

  describe('listBooks', () => {
    test('should call GET with correct endpoint for tag name', async () => {
      const mockResponse = { books: [], total: 0 };
      apiSpies.get.mockResolvedValue(mockResponse);

      const result = await tagApi.listBooks('fantasy');

      expect(apiSpies.get).toHaveBeenCalledWith('/api/tags/fantasy', undefined);
      expect(result).toEqual(mockResponse);
    });

    test('should encode tag names with spaces', async () => {
      apiSpies.get.mockResolvedValue({ books: [], total: 0 });

      await tagApi.listBooks('Science Fiction');

      expect(apiSpies.get).toHaveBeenCalledWith('/api/tags/Science%20Fiction', undefined);
    });

    test('should construct query params with limit', async () => {
      apiSpies.get.mockResolvedValue({ books: [], total: 0 });

      await tagApi.listBooks('fiction', { limit: 50 });

      expect(apiSpies.get).toHaveBeenCalledWith('/api/tags/fiction?limit=50', undefined);
    });

    test('should construct query params with limit and skip', async () => {
      apiSpies.get.mockResolvedValue({ books: [], total: 0 });

      await tagApi.listBooks('fiction', { limit: 25, skip: 10 });

      expect(apiSpies.get).toHaveBeenCalledWith('/api/tags/fiction?limit=25&skip=10', undefined);
    });

    test('should handle skip only', async () => {
      apiSpies.get.mockResolvedValue({ books: [], total: 0 });

      await tagApi.listBooks('fiction', { skip: 20 });

      expect(apiSpies.get).toHaveBeenCalledWith('/api/tags/fiction?skip=20', undefined);
    });

    test('should pass AbortSignal in requestOptions', async () => {
      const controller = new AbortController();
      apiSpies.get.mockResolvedValue({ books: [], total: 0 });

      await tagApi.listBooks('fiction', {}, { signal: controller.signal });

      expect(apiSpies.get).toHaveBeenCalledWith('/api/tags/fiction', { signal: controller.signal });
    });

    test('should combine pagination and AbortSignal', async () => {
      const controller = new AbortController();
      apiSpies.get.mockResolvedValue({ books: [], total: 0 });

      await tagApi.listBooks('fiction', { limit: 50, skip: 10 }, { signal: controller.signal });

      expect(apiSpies.get).toHaveBeenCalledWith(
        '/api/tags/fiction?limit=50&skip=10',
        { signal: controller.signal }
      );
    });

    test('should propagate errors from baseApiClient', async () => {
      const error = new Error('Tag not found');
      apiSpies.get.mockRejectedValue(error);

      await expect(tagApi.listBooks('nonexistent')).rejects.toThrow('Tag not found');
    });
  });

  describe('bulkOperation', () => {
    test('should call POST with correct endpoint and request body for add', async () => {
      const response = { success: true };
      apiSpies.post.mockResolvedValue(response);

      const result = await tagApi.bulkOperation([1, 2, 3], ['new-tag'], 'add');

      expect(apiSpies.post).toHaveBeenCalledWith('/api/tags/bulk', {
        bookIds: [1, 2, 3],
        tags: ['new-tag'],
        action: 'add',
      });
      expect(result).toEqual(response);
    });

    test('should call POST with correct endpoint and request body for remove', async () => {
      apiSpies.post.mockResolvedValue({ success: true });

      await tagApi.bulkOperation([4, 5], ['old-tag'], 'remove');

      expect(apiSpies.post).toHaveBeenCalledWith('/api/tags/bulk', {
        bookIds: [4, 5],
        tags: ['old-tag'],
        action: 'remove',
      });
    });

    test('should handle multiple book IDs and tags', async () => {
      apiSpies.post.mockResolvedValue({ success: true });

      await tagApi.bulkOperation([1, 2, 3, 4, 5], ['tag1', 'tag2', 'tag3'], 'add');

      expect(apiSpies.post).toHaveBeenCalledWith('/api/tags/bulk', {
        bookIds: [1, 2, 3, 4, 5],
        tags: ['tag1', 'tag2', 'tag3'],
        action: 'add',
      });
    });

    test('should propagate errors from baseApiClient', async () => {
      const error = new Error('Bulk operation failed');
      apiSpies.post.mockRejectedValue(error);

      await expect(tagApi.bulkOperation([1], ['tag'], 'add')).rejects.toThrow('Bulk operation failed');
    });
  });
});
