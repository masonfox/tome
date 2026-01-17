import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { bookApi } from '@/lib/api/domains/book';
import { spyOnBaseApiClient } from '../../helpers/api-test-utils';

describe('bookApi', () => {
  let apiSpies: ReturnType<typeof spyOnBaseApiClient>;

  beforeEach(() => {
    apiSpies = spyOnBaseApiClient();
  });

  afterEach(() => {
    apiSpies.restoreAll();
  });

  describe('updateStatus', () => {
    test('should call POST with correct endpoint and request body', async () => {
      const request = { status: 'reading' as const };
      const response = { success: true, sessionId: 123 };
      apiSpies.post.mockResolvedValue(response);

      const result = await bookApi.updateStatus('456', request);

      expect(apiSpies.post).toHaveBeenCalledWith('/api/books/456/status', request);
      expect(result).toEqual(response);
    });

    test('should handle numeric bookId', async () => {
      const request = { status: 'read' as const };
      apiSpies.post.mockResolvedValue({ success: true });

      await bookApi.updateStatus(789, request);

      expect(apiSpies.post).toHaveBeenCalledWith('/api/books/789/status', request);
    });

    test('should handle different status values', async () => {
      const request = { status: 'to-read' as const };
      apiSpies.post.mockResolvedValue({ success: true });

      await bookApi.updateStatus('123', request);

      expect(apiSpies.post).toHaveBeenCalledWith('/api/books/123/status', request);
    });
  });

  describe('createProgress', () => {
    test('should call POST with correct endpoint and request body', async () => {
      const request = { currentPage: 150, notes: 'Great chapter!' };
      const response = { success: true, shouldShowCompletionModal: false };
      apiSpies.post.mockResolvedValue(response);

      const result = await bookApi.createProgress('123', request);

      expect(apiSpies.post).toHaveBeenCalledWith('/api/books/123/progress', request);
      expect(result).toEqual(response);
    });

    test('should handle numeric bookId', async () => {
      const request = { currentPage: 200 };
      apiSpies.post.mockResolvedValue({ success: true, shouldShowCompletionModal: false });

      await bookApi.createProgress(456, request);

      expect(apiSpies.post).toHaveBeenCalledWith('/api/books/456/progress', request);
    });

    test('should handle progress with percentage', async () => {
      const request = { percentComplete: 75 };
      apiSpies.post.mockResolvedValue({ success: true, shouldShowCompletionModal: false });

      await bookApi.createProgress('789', request);

      expect(apiSpies.post).toHaveBeenCalledWith('/api/books/789/progress', request);
    });
  });

  describe('listProgress', () => {
    test('should call GET with correct endpoint when no params', async () => {
      const mockProgress = [{ id: 1, currentPage: 50 }];
      apiSpies.get.mockResolvedValue(mockProgress);

      const result = await bookApi.listProgress('123');

      expect(apiSpies.get).toHaveBeenCalledWith('/api/books/123/progress');
      expect(result).toEqual(mockProgress);
    });

    test('should construct query params with sessionId', async () => {
      apiSpies.get.mockResolvedValue([]);

      await bookApi.listProgress('123', { sessionId: 456 });

      expect(apiSpies.get).toHaveBeenCalledWith('/api/books/123/progress?sessionId=456');
    });

    test('should handle numeric bookId', async () => {
      apiSpies.get.mockResolvedValue([]);

      await bookApi.listProgress(789);

      expect(apiSpies.get).toHaveBeenCalledWith('/api/books/789/progress');
    });

    test('should handle numeric bookId with sessionId param', async () => {
      apiSpies.get.mockResolvedValue([]);

      await bookApi.listProgress(999, { sessionId: 111 });

      expect(apiSpies.get).toHaveBeenCalledWith('/api/books/999/progress?sessionId=111');
    });
  });

  describe('updateProgress', () => {
    test('should call PATCH with correct endpoint and request body', async () => {
      const request = { currentPage: 175, notes: 'Updated notes' };
      const response = { success: true };
      apiSpies.patch.mockResolvedValue(response);

      const result = await bookApi.updateProgress('123', 789, request);

      expect(apiSpies.patch).toHaveBeenCalledWith('/api/books/123/progress/789', request);
      expect(result).toEqual(response);
    });

    test('should handle numeric bookId', async () => {
      const request = { currentPage: 200 };
      apiSpies.patch.mockResolvedValue({ success: true });

      await bookApi.updateProgress(456, 999, request);

      expect(apiSpies.patch).toHaveBeenCalledWith('/api/books/456/progress/999', request);
    });
  });

  describe('deleteProgress', () => {
    test('should call DELETE with correct endpoint', async () => {
      const response = { success: true };
      apiSpies.delete.mockResolvedValue(response);

      const result = await bookApi.deleteProgress('123', 789);

      expect(apiSpies.delete).toHaveBeenCalledWith('/api/books/123/progress/789');
      expect(result).toEqual(response);
    });

    test('should handle numeric bookId', async () => {
      apiSpies.delete.mockResolvedValue({ success: true });

      await bookApi.deleteProgress(456, 999);

      expect(apiSpies.delete).toHaveBeenCalledWith('/api/books/456/progress/999');
    });
  });

  describe('updateRating', () => {
    test('should call PATCH with correct endpoint and request body', async () => {
      const request = { rating: 5 };
      apiSpies.patch.mockResolvedValue(undefined);

      await bookApi.updateRating('123', request);

      expect(apiSpies.patch).toHaveBeenCalledWith('/api/books/123/rating', request);
    });

    test('should handle numeric bookId', async () => {
      const request = { rating: 4 };
      apiSpies.patch.mockResolvedValue(undefined);

      await bookApi.updateRating(456, request);

      expect(apiSpies.patch).toHaveBeenCalledWith('/api/books/456/rating', request);
    });

    test('should handle different rating values', async () => {
      const request = { rating: 1 };
      apiSpies.patch.mockResolvedValue(undefined);

      await bookApi.updateRating('789', request);

      expect(apiSpies.patch).toHaveBeenCalledWith('/api/books/789/rating', request);
    });
  });

  describe('updateSessionReview', () => {
    test('should call PATCH with correct endpoint and request body', async () => {
      const request = { review: 'An amazing read!' };
      apiSpies.patch.mockResolvedValue(undefined);

      await bookApi.updateSessionReview('123', 456, request);

      expect(apiSpies.patch).toHaveBeenCalledWith('/api/books/123/sessions/456', request);
    });

    test('should handle numeric bookId', async () => {
      const request = { review: 'Great book!' };
      apiSpies.patch.mockResolvedValue(undefined);

      await bookApi.updateSessionReview(789, 111, request);

      expect(apiSpies.patch).toHaveBeenCalledWith('/api/books/789/sessions/111', request);
    });
  });

  describe('getSessions', () => {
    test('should call GET with correct endpoint', async () => {
      const mockSessions = [{ id: 1, status: 'reading' }];
      apiSpies.get.mockResolvedValue(mockSessions);

      const result = await bookApi.getSessions('123');

      expect(apiSpies.get).toHaveBeenCalledWith('/api/books/123/sessions');
      expect(result).toEqual(mockSessions);
    });

    test('should handle numeric bookId', async () => {
      apiSpies.get.mockResolvedValue([]);

      await bookApi.getSessions(456);

      expect(apiSpies.get).toHaveBeenCalledWith('/api/books/456/sessions');
    });
  });

  describe('markAsRead', () => {
    test('should call POST with correct endpoint and request body', async () => {
      const request = { rating: 5, review: 'Amazing book!' };
      const response = {
        success: true,
        progressCreated: true,
        ratingUpdated: true,
        reviewUpdated: true,
      };
      apiSpies.post.mockResolvedValue(response);

      const result = await bookApi.markAsRead('123', request);

      expect(apiSpies.post).toHaveBeenCalledWith('/api/books/123/mark-as-read', request);
      expect(result).toEqual(response);
    });

    test('should handle numeric bookId', async () => {
      const request = { rating: 4 };
      apiSpies.post.mockResolvedValue({ success: true });

      await bookApi.markAsRead(456, request);

      expect(apiSpies.post).toHaveBeenCalledWith('/api/books/456/mark-as-read', request);
    });

    test('should handle request without rating or review', async () => {
      const request = {};
      apiSpies.post.mockResolvedValue({ success: true });

      await bookApi.markAsRead('789', request);

      expect(apiSpies.post).toHaveBeenCalledWith('/api/books/789/mark-as-read', request);
    });
  });

  describe('startReread', () => {
    test('should call POST with correct endpoint', async () => {
      const response = { success: true, newSessionId: 123, archivedSessionId: 456 };
      apiSpies.post.mockResolvedValue(response);

      const result = await bookApi.startReread('123');

      expect(apiSpies.post).toHaveBeenCalledWith('/api/books/123/reread', undefined);
      expect(result).toEqual(response);
    });

    test('should handle numeric bookId', async () => {
      const response = { success: true, newSessionId: 789 };
      apiSpies.post.mockResolvedValue(response);

      await bookApi.startReread(456);

      expect(apiSpies.post).toHaveBeenCalledWith('/api/books/456/reread', undefined);
    });
  });

  describe('completeBook', () => {
    test('should call POST with correct endpoint and request body', async () => {
      const request = {
        totalPages: 350,
        startDate: '2024-01-01',
        endDate: '2024-01-15',
        rating: 5,
        review: 'Amazing book!',
      };
      const response = { success: true };
      apiSpies.post.mockResolvedValue(response);

      const result = await bookApi.completeBook('123', request);

      expect(apiSpies.post).toHaveBeenCalledWith('/api/books/123/complete', request);
      expect(result).toEqual(response);
    });

    test('should handle numeric bookId', async () => {
      const request = { startDate: '2024-01-01', endDate: '2024-01-15' };
      apiSpies.post.mockResolvedValue({ success: true });

      await bookApi.completeBook(456, request);

      expect(apiSpies.post).toHaveBeenCalledWith('/api/books/456/complete', request);
    });

    test('should handle request without rating or review', async () => {
      const request = { startDate: '2024-01-01', endDate: '2024-01-15' };
      apiSpies.post.mockResolvedValue({ success: true });

      await bookApi.completeBook('789', request);

      expect(apiSpies.post).toHaveBeenCalledWith('/api/books/789/complete', request);
    });
  });

  describe('getDetail', () => {
    test('should call GET with correct endpoint', async () => {
      const mockBook = { id: 123, title: 'Test Book', authors: ['Author'] };
      apiSpies.get.mockResolvedValue(mockBook);

      const result = await bookApi.getDetail('123');

      expect(apiSpies.get).toHaveBeenCalledWith('/api/books/123');
      expect(result).toEqual(mockBook);
    });

    test('should handle numeric bookId', async () => {
      const mockBook = { id: 456, title: 'Another Book' };
      apiSpies.get.mockResolvedValue(mockBook);

      await bookApi.getDetail(456);

      expect(apiSpies.get).toHaveBeenCalledWith('/api/books/456');
    });
  });

  describe('updateBook', () => {
    test('should call PATCH with correct endpoint and request body', async () => {
      const request = { totalPages: 350 };
      const response = { success: true, data: { id: 123, totalPages: 350 } };
      apiSpies.patch.mockResolvedValue(response);

      const result = await bookApi.updateBook('123', request);

      expect(apiSpies.patch).toHaveBeenCalledWith('/api/books/123', request);
      expect(result).toEqual(response);
    });

    test('should handle numeric bookId', async () => {
      const request = { totalPages: 400 };
      apiSpies.patch.mockResolvedValue({ success: true });

      await bookApi.updateBook(456, request);

      expect(apiSpies.patch).toHaveBeenCalledWith('/api/books/456', request);
    });
  });

  describe('updateTags', () => {
    test('should call PATCH with correct endpoint and request body', async () => {
      const request = { tags: ['fiction', 'fantasy'] };
      const response = { success: true, data: { id: 123, tags: ['fiction', 'fantasy'] } };
      apiSpies.patch.mockResolvedValue(response);

      const result = await bookApi.updateTags('123', request);

      expect(apiSpies.patch).toHaveBeenCalledWith('/api/books/123/tags', request);
      expect(result).toEqual(response);
    });

    test('should handle numeric bookId', async () => {
      const request = { tags: ['non-fiction'] };
      apiSpies.patch.mockResolvedValue({ success: true });

      await bookApi.updateTags(456, request);

      expect(apiSpies.patch).toHaveBeenCalledWith('/api/books/456/tags', request);
    });

    test('should handle empty tags array', async () => {
      const request = { tags: [] };
      apiSpies.patch.mockResolvedValue({ success: true });

      await bookApi.updateTags('789', request);

      expect(apiSpies.patch).toHaveBeenCalledWith('/api/books/789/tags', request);
    });
  });
});
