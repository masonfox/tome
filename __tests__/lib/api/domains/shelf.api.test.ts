import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { shelfApi } from '@/lib/api/domains/shelf';
import { ApiError } from '@/lib/api/base-client';
import { spyOnBaseApiClient } from '../../../helpers/api-test-utils';
import type {
  Shelf,
  ShelfWithBookCount,
  ShelfWithBookCountAndCovers,
  ShelfWithBooks,
} from '@/lib/api/domains/shelf/types';

describe('shelfApi', () => {
  let apiSpies: ReturnType<typeof spyOnBaseApiClient>;

  beforeEach(() => {
    apiSpies = spyOnBaseApiClient();
  });

  afterEach(() => {
    apiSpies.restoreAll();
  });

  describe('list', () => {
    const mockShelf: Shelf = {
      id: 1,
      name: 'Favorites',
      description: 'My favorite books',
      color: '#3b82f6',
      icon: '⭐',
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
    };

    test('should call GET with correct endpoint when no params', async () => {
      const response = { success: true, data: [mockShelf] };
      apiSpies.get.mockResolvedValue(response);

      const result = await shelfApi.list();

      expect(apiSpies.get).toHaveBeenCalledWith('/api/shelves');
      expect(result).toEqual([mockShelf]);
    });

    test('should construct query params with withCounts', async () => {
      const mockShelfWithCount: ShelfWithBookCount = {
        ...mockShelf,
        bookCount: 5,
      };
      const response = { success: true, data: [mockShelfWithCount] };
      apiSpies.get.mockResolvedValue(response);

      const result = await shelfApi.list({ withCounts: true });

      expect(apiSpies.get).toHaveBeenCalledWith('/api/shelves?withCounts=true');
      expect(result).toEqual([mockShelfWithCount]);
    });

    test('should construct query params with withCovers', async () => {
      const mockShelfWithCovers: ShelfWithBookCountAndCovers = {
        ...mockShelf,
        bookCount: 3,
        bookCoverIds: [1, 2, 3],
      };
      const response = { success: true, data: [mockShelfWithCovers] };
      apiSpies.get.mockResolvedValue(response);

      const result = await shelfApi.list({ withCovers: true });

      expect(apiSpies.get).toHaveBeenCalledWith('/api/shelves?withCovers=true');
      expect(result).toEqual([mockShelfWithCovers]);
    });

    test('should handle both withCounts and withCovers params', async () => {
      const mockShelfWithBoth: ShelfWithBookCountAndCovers = {
        ...mockShelf,
        bookCount: 2,
        bookCoverIds: [10, 20],
      };
      const response = { success: true, data: [mockShelfWithBoth] };
      apiSpies.get.mockResolvedValue(response);

      await shelfApi.list({ withCounts: true, withCovers: true });

      expect(apiSpies.get).toHaveBeenCalledWith(
        '/api/shelves?withCounts=true&withCovers=true'
      );
    });

    test('should return empty array when no shelves exist', async () => {
      const response = { success: true, data: [] };
      apiSpies.get.mockResolvedValue(response);

      const result = await shelfApi.list();

      expect(result).toEqual([]);
    });

    test('should unwrap response and return data array', async () => {
      const shelves = [mockShelf, { ...mockShelf, id: 2, name: 'Read Later' }];
      const response = { success: true, data: shelves };
      apiSpies.get.mockResolvedValue(response);

      const result = await shelfApi.list();

      expect(result).toEqual(shelves);
      expect(result).not.toHaveProperty('success');
    });

    test('should propagate ApiError from baseApiClient', async () => {
      const error = new ApiError('Network error', 0, '/api/shelves');
      apiSpies.get.mockRejectedValue(error);

      await expect(shelfApi.list()).rejects.toThrow(ApiError);
      await expect(shelfApi.list()).rejects.toThrow('Network error');
    });
  });

  describe('get', () => {
    const mockShelf: Shelf = {
      id: 1,
      name: 'Favorites',
      description: 'My favorite books',
      color: '#3b82f6',
      icon: '⭐',
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
    };

    test('should call GET with correct endpoint when no params', async () => {
      const response = { success: true, data: mockShelf };
      apiSpies.get.mockResolvedValue(response);

      const result = await shelfApi.get(1);

      expect(apiSpies.get).toHaveBeenCalledWith('/api/shelves/1');
      expect(result).toEqual(mockShelf);
    });

    test('should construct query params with withBooks', async () => {
      const mockShelfWithBooks: ShelfWithBooks = {
        ...mockShelf,
        books: [
          {
            id: 1,
            calibreId: 10,
            title: 'Test Book',
            authors: ['Test Author'],
            sortOrder: 1,
            totalPages: 300,
            publisher: 'Test Publisher',
            pubDate: '2024-01-01',
            series: 'Test Series',
            seriesIndex: 1,
            tags: ['fiction'],
            rating: 5,
          },
        ],
      };
      const response = { success: true, data: mockShelfWithBooks };
      apiSpies.get.mockResolvedValue(response);

      const result = await shelfApi.get(1, { withBooks: true });

      expect(apiSpies.get).toHaveBeenCalledWith('/api/shelves/1?withBooks=true');
      expect(result).toEqual(mockShelfWithBooks);
    });

    test('should construct query params with orderBy', async () => {
      apiSpies.get.mockResolvedValue({ success: true, data: mockShelf });

      await shelfApi.get(1, { withBooks: true, orderBy: 'title' });

      expect(apiSpies.get).toHaveBeenCalledWith(
        '/api/shelves/1?withBooks=true&orderBy=title'
      );
    });

    test('should construct query params with direction', async () => {
      apiSpies.get.mockResolvedValue({ success: true, data: mockShelf });

      await shelfApi.get(1, { withBooks: true, direction: 'desc' });

      expect(apiSpies.get).toHaveBeenCalledWith(
        '/api/shelves/1?withBooks=true&direction=desc'
      );
    });

    test('should construct query params with all options', async () => {
      apiSpies.get.mockResolvedValue({ success: true, data: mockShelf });

      await shelfApi.get(1, {
        withBooks: true,
        orderBy: 'rating',
        direction: 'desc',
      });

      expect(apiSpies.get).toHaveBeenCalledWith(
        '/api/shelves/1?withBooks=true&orderBy=rating&direction=desc'
      );
    });

    test('should handle different orderBy values', async () => {
      apiSpies.get.mockResolvedValue({ success: true, data: mockShelf });

      const orderByValues = [
        'sortOrder',
        'title',
        'author',
        'series',
        'rating',
        'pages',
        'dateAdded',
      ] as const;

      for (const orderBy of orderByValues) {
        await shelfApi.get(1, { withBooks: true, orderBy });

        expect(apiSpies.get).toHaveBeenCalledWith(
          `/api/shelves/1?withBooks=true&orderBy=${orderBy}`
        );
      }
    });

    test('should unwrap response and return data', async () => {
      const response = { success: true, data: mockShelf };
      apiSpies.get.mockResolvedValue(response);

      const result = await shelfApi.get(1);

      expect(result).toEqual(mockShelf);
      expect(result).not.toHaveProperty('success');
    });

    test('should propagate 404 ApiError when shelf not found', async () => {
      const error = new ApiError('Shelf not found', 404, '/api/shelves/999');
      apiSpies.get.mockRejectedValue(error);

      await expect(shelfApi.get(999)).rejects.toThrow(ApiError);
      await expect(shelfApi.get(999)).rejects.toThrow('Shelf not found');
    });
  });

  describe('create', () => {
    test('should call POST with correct endpoint and request body', async () => {
      const request = {
        name: 'New Shelf',
        description: 'A new shelf',
        color: '#10b981',
        icon: '📚',
      };
      const createdShelf: Shelf = {
        id: 1,
        ...request,
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
      };
      const response = { success: true, data: createdShelf };
      apiSpies.post.mockResolvedValue(response);

      const result = await shelfApi.create(request);

      expect(apiSpies.post).toHaveBeenCalledWith('/api/shelves', request);
      expect(result).toEqual(createdShelf);
    });

    test('should handle minimal request (name only)', async () => {
      const request = { name: 'Simple Shelf' };
      const createdShelf: Shelf = {
        id: 2,
        name: 'Simple Shelf',
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
      };
      const response = { success: true, data: createdShelf };
      apiSpies.post.mockResolvedValue(response);

      const result = await shelfApi.create(request);

      expect(apiSpies.post).toHaveBeenCalledWith('/api/shelves', request);
      expect(result).toEqual(createdShelf);
    });

    test('should unwrap response and return data', async () => {
      const request = { name: 'Test Shelf' };
      const createdShelf: Shelf = {
        id: 3,
        name: 'Test Shelf',
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
      };
      const response = { success: true, data: createdShelf };
      apiSpies.post.mockResolvedValue(response);

      const result = await shelfApi.create(request);

      expect(result).toEqual(createdShelf);
      expect(result).not.toHaveProperty('success');
    });

    test('should propagate 409 ApiError for duplicate name', async () => {
      const request = { name: 'Existing Shelf' };
      const error = new ApiError(
        'A shelf with this name already exists',
        409,
        '/api/shelves',
        { error: 'A shelf with this name already exists' }
      );
      apiSpies.post.mockRejectedValue(error);

      await expect(shelfApi.create(request)).rejects.toThrow(ApiError);
      await expect(shelfApi.create(request)).rejects.toThrow(
        'A shelf with this name already exists'
      );
    });

    test('should propagate 400 ApiError for validation errors', async () => {
      const request = { name: '' };
      const error = new ApiError(
        'Validation error: name is required',
        400,
        '/api/shelves',
        { error: 'Validation error: name is required' }
      );
      apiSpies.post.mockRejectedValue(error);

      await expect(shelfApi.create(request)).rejects.toThrow(ApiError);
      await expect(shelfApi.create(request)).rejects.toThrow('Validation error');
    });
  });

  describe('update', () => {
    test('should call PATCH with correct endpoint and request body', async () => {
      const request = {
        name: 'Updated Shelf',
        description: 'Updated description',
        color: '#ef4444',
        icon: '🔥',
      };
      const updatedShelf: Shelf = {
        id: 1,
        ...request,
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-02T00:00:00.000Z',
      };
      const response = { success: true, data: updatedShelf };
      apiSpies.patch.mockResolvedValue(response);

      const result = await shelfApi.update(1, request);

      expect(apiSpies.patch).toHaveBeenCalledWith('/api/shelves/1', request);
      expect(result).toEqual(updatedShelf);
    });

    test('should handle partial updates (name only)', async () => {
      const request = { name: 'New Name' };
      const updatedShelf: Shelf = {
        id: 1,
        name: 'New Name',
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-02T00:00:00.000Z',
      };
      const response = { success: true, data: updatedShelf };
      apiSpies.patch.mockResolvedValue(response);

      const result = await shelfApi.update(1, request);

      expect(apiSpies.patch).toHaveBeenCalledWith('/api/shelves/1', request);
      expect(result).toEqual(updatedShelf);
    });

    test('should handle partial updates (color only)', async () => {
      const request = { color: '#8b5cf6' };
      apiSpies.patch.mockResolvedValue({
        success: true,
        data: {
          id: 1,
          name: 'Shelf',
          color: '#8b5cf6',
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-02T00:00:00.000Z',
        },
      });

      await shelfApi.update(1, request);

      expect(apiSpies.patch).toHaveBeenCalledWith('/api/shelves/1', request);
    });

    test('should unwrap response and return data', async () => {
      const request = { description: 'New description' };
      const updatedShelf: Shelf = {
        id: 1,
        name: 'Shelf',
        description: 'New description',
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-02T00:00:00.000Z',
      };
      const response = { success: true, data: updatedShelf };
      apiSpies.patch.mockResolvedValue(response);

      const result = await shelfApi.update(1, request);

      expect(result).toEqual(updatedShelf);
      expect(result).not.toHaveProperty('success');
    });

    test('should propagate 404 ApiError when shelf not found', async () => {
      const request = { name: 'Updated Name' };
      const error = new ApiError('Shelf not found', 404, '/api/shelves/999');
      apiSpies.patch.mockRejectedValue(error);

      await expect(shelfApi.update(999, request)).rejects.toThrow(ApiError);
      await expect(shelfApi.update(999, request)).rejects.toThrow('Shelf not found');
    });

    test('should propagate 409 ApiError for duplicate name', async () => {
      const request = { name: 'Existing Shelf' };
      const error = new ApiError(
        'A shelf with this name already exists',
        409,
        '/api/shelves/1',
        { error: 'A shelf with this name already exists' }
      );
      apiSpies.patch.mockRejectedValue(error);

      await expect(shelfApi.update(1, request)).rejects.toThrow(ApiError);
      await expect(shelfApi.update(1, request)).rejects.toThrow(
        'A shelf with this name already exists'
      );
    });
  });

  describe('delete', () => {
    test('should call DELETE with correct endpoint', async () => {
      const response = { success: true, data: { deleted: true } };
      apiSpies.delete.mockResolvedValue(response);

      const result = await shelfApi.delete(1);

      expect(apiSpies.delete).toHaveBeenCalledWith('/api/shelves/1');
      expect(result).toEqual({ deleted: true });
    });

    test('should unwrap response and return data', async () => {
      const response = { success: true, data: { deleted: true } };
      apiSpies.delete.mockResolvedValue(response);

      const result = await shelfApi.delete(1);

      expect(result).toEqual({ deleted: true });
      expect(result).not.toHaveProperty('success');
    });

    test('should handle different shelf IDs', async () => {
      apiSpies.delete.mockResolvedValue({ success: true, data: { deleted: true } });

      await shelfApi.delete(42);
      expect(apiSpies.delete).toHaveBeenCalledWith('/api/shelves/42');

      await shelfApi.delete(999);
      expect(apiSpies.delete).toHaveBeenCalledWith('/api/shelves/999');
    });

    test('should propagate 404 ApiError when shelf not found', async () => {
      const error = new ApiError('Shelf not found', 404, '/api/shelves/999');
      apiSpies.delete.mockRejectedValue(error);

      await expect(shelfApi.delete(999)).rejects.toThrow(ApiError);
      await expect(shelfApi.delete(999)).rejects.toThrow('Shelf not found');
    });

    test('should propagate 400 ApiError when shelf cannot be deleted', async () => {
      const error = new ApiError(
        'Cannot delete shelf with books',
        400,
        '/api/shelves/1',
        { error: 'Cannot delete shelf with books' }
      );
      apiSpies.delete.mockRejectedValue(error);

      await expect(shelfApi.delete(1)).rejects.toThrow(ApiError);
      await expect(shelfApi.delete(1)).rejects.toThrow('Cannot delete shelf with books');
    });
  });

  describe('addBook', () => {
    test('should call POST with correct endpoint and request body', async () => {
      const request = { bookId: 42, sortOrder: 10 };
      const response = { success: true, data: { added: true } };
      apiSpies.post.mockResolvedValue(response);

      const result = await shelfApi.addBook(1, request);

      expect(apiSpies.post).toHaveBeenCalledWith('/api/shelves/1/books', request);
      expect(result).toEqual({ added: true });
    });

    test('should handle request without sortOrder', async () => {
      const request = { bookId: 42 };
      const response = { success: true, data: { added: true } };
      apiSpies.post.mockResolvedValue(response);

      const result = await shelfApi.addBook(1, request);

      expect(apiSpies.post).toHaveBeenCalledWith('/api/shelves/1/books', request);
      expect(result).toEqual({ added: true });
    });

    test('should unwrap response and return data', async () => {
      const request = { bookId: 100 };
      const response = { success: true, data: { added: true } };
      apiSpies.post.mockResolvedValue(response);

      const result = await shelfApi.addBook(5, request);

      expect(result).toEqual({ added: true });
      expect(result).not.toHaveProperty('success');
    });

    test('should handle different shelf and book IDs', async () => {
      apiSpies.post.mockResolvedValue({ success: true, data: { added: true } });

      await shelfApi.addBook(10, { bookId: 20 });
      expect(apiSpies.post).toHaveBeenCalledWith('/api/shelves/10/books', {
        bookId: 20,
      });

      await shelfApi.addBook(50, { bookId: 100, sortOrder: 5 });
      expect(apiSpies.post).toHaveBeenCalledWith('/api/shelves/50/books', {
        bookId: 100,
        sortOrder: 5,
      });
    });

    test('should propagate 404 ApiError when shelf not found', async () => {
      const request = { bookId: 42 };
      const error = new ApiError('Shelf not found', 404, '/api/shelves/999/books');
      apiSpies.post.mockRejectedValue(error);

      await expect(shelfApi.addBook(999, request)).rejects.toThrow(ApiError);
      await expect(shelfApi.addBook(999, request)).rejects.toThrow('Shelf not found');
    });

    test('should propagate 404 ApiError when book not found', async () => {
      const request = { bookId: 9999 };
      const error = new ApiError('Book not found', 404, '/api/shelves/1/books');
      apiSpies.post.mockRejectedValue(error);

      await expect(shelfApi.addBook(1, request)).rejects.toThrow(ApiError);
      await expect(shelfApi.addBook(1, request)).rejects.toThrow('Book not found');
    });

    test('should propagate 409 ApiError when book already on shelf', async () => {
      const request = { bookId: 42 };
      const error = new ApiError(
        'Book is already on this shelf',
        409,
        '/api/shelves/1/books',
        { error: 'Book is already on this shelf' }
      );
      apiSpies.post.mockRejectedValue(error);

      await expect(shelfApi.addBook(1, request)).rejects.toThrow(ApiError);
      await expect(shelfApi.addBook(1, request)).rejects.toThrow(
        'Book is already on this shelf'
      );
    });
  });

  describe('addBooks', () => {
    test('should call POST with correct endpoint and request body', async () => {
      const request = { bookIds: [42, 43, 44] };
      const response = { success: true, data: { added: true, count: 3 } };
      apiSpies.post.mockResolvedValue(response);

      const result = await shelfApi.addBooks(1, request);

      expect(apiSpies.post).toHaveBeenCalledWith('/api/shelves/1/books/bulk', request);
      expect(result).toEqual({ added: true, count: 3 });
    });

    test('should handle single book in bookIds array', async () => {
      const request = { bookIds: [42] };
      const response = { success: true, data: { added: true, count: 1 } };
      apiSpies.post.mockResolvedValue(response);

      const result = await shelfApi.addBooks(1, request);

      expect(apiSpies.post).toHaveBeenCalledWith('/api/shelves/1/books/bulk', request);
      expect(result).toEqual({ added: true, count: 1 });
    });

    test('should handle large batch of books', async () => {
      const bookIds = Array.from({ length: 50 }, (_, i) => i + 1);
      const request = { bookIds };
      const response = { success: true, data: { added: true, count: 50 } };
      apiSpies.post.mockResolvedValue(response);

      const result = await shelfApi.addBooks(1, request);

      expect(apiSpies.post).toHaveBeenCalledWith('/api/shelves/1/books/bulk', request);
      expect(result).toEqual({ added: true, count: 50 });
      expect(bookIds).toHaveLength(50);
    });

    test('should handle empty bookIds array (server validation)', async () => {
      const request = { bookIds: [] };
      // Server should return validation error, but API client passes through
      const error = new ApiError(
        'bookIds array cannot be empty',
        400,
        '/api/shelves/1/books/bulk',
        { error: 'bookIds array cannot be empty' }
      );
      apiSpies.post.mockRejectedValue(error);

      await expect(shelfApi.addBooks(1, request)).rejects.toThrow(ApiError);
      await expect(shelfApi.addBooks(1, request)).rejects.toThrow('bookIds array cannot be empty');
    });

    test('should return count 0 when no books are added', async () => {
      const request = { bookIds: [9999, 8888] };
      const response = { success: true, data: { added: true, count: 0 } };
      apiSpies.post.mockResolvedValue(response);

      const result = await shelfApi.addBooks(1, request);

      expect(result).toEqual({ added: true, count: 0 });
    });

    test('should handle partial success (some books already on shelf)', async () => {
      const request = { bookIds: [1, 2, 3, 4, 5] };
      // Server adds only 3 out of 5 books
      const response = { success: true, data: { added: true, count: 3 } };
      apiSpies.post.mockResolvedValue(response);

      const result = await shelfApi.addBooks(1, request);

      expect(result).toEqual({ added: true, count: 3 });
    });

    test('should unwrap response and return data', async () => {
      const request = { bookIds: [10, 20, 30] };
      const response = { success: true, data: { added: true, count: 3 } };
      apiSpies.post.mockResolvedValue(response);

      const result = await shelfApi.addBooks(5, request);

      expect(result).toEqual({ added: true, count: 3 });
      expect(result).not.toHaveProperty('success');
    });

    test('should handle different shelf IDs', async () => {
      apiSpies.post.mockResolvedValue({ success: true, data: { added: true, count: 2 } });

      await shelfApi.addBooks(10, { bookIds: [20, 30] });
      expect(apiSpies.post).toHaveBeenCalledWith('/api/shelves/10/books/bulk', {
        bookIds: [20, 30],
      });

      await shelfApi.addBooks(50, { bookIds: [100, 200, 300] });
      expect(apiSpies.post).toHaveBeenCalledWith('/api/shelves/50/books/bulk', {
        bookIds: [100, 200, 300],
      });
    });

    test('should propagate 404 ApiError when shelf not found', async () => {
      const request = { bookIds: [42, 43] };
      const error = new ApiError('Shelf not found', 404, '/api/shelves/999/books/bulk');
      apiSpies.post.mockRejectedValue(error);

      await expect(shelfApi.addBooks(999, request)).rejects.toThrow(ApiError);
      await expect(shelfApi.addBooks(999, request)).rejects.toThrow('Shelf not found');
    });

    test('should propagate 400 ApiError for validation errors', async () => {
      const request = { bookIds: [1, 'invalid' as any, 3] };
      const error = new ApiError(
        'All bookIds must be numbers',
        400,
        '/api/shelves/1/books/bulk',
        { error: 'All bookIds must be numbers' }
      );
      apiSpies.post.mockRejectedValue(error);

      await expect(shelfApi.addBooks(1, request)).rejects.toThrow(ApiError);
      await expect(shelfApi.addBooks(1, request)).rejects.toThrow('All bookIds must be numbers');
    });

    test('should propagate 400 ApiError when bookIds is missing', async () => {
      const request = {} as any;
      const error = new ApiError(
        'bookIds is required',
        400,
        '/api/shelves/1/books/bulk',
        { error: 'bookIds is required' }
      );
      apiSpies.post.mockRejectedValue(error);

      await expect(shelfApi.addBooks(1, request)).rejects.toThrow(ApiError);
      await expect(shelfApi.addBooks(1, request)).rejects.toThrow('bookIds is required');
    });

    test('should handle network errors', async () => {
      const request = { bookIds: [1, 2, 3] };
      const error = new ApiError('Network error', 0, '/api/shelves/1/books/bulk');
      apiSpies.post.mockRejectedValue(error);

      await expect(shelfApi.addBooks(1, request)).rejects.toThrow(ApiError);
      await expect(shelfApi.addBooks(1, request)).rejects.toThrow('Network error');
      await expect(shelfApi.addBooks(1, request)).rejects.toMatchObject({
        statusCode: 0,
        endpoint: '/api/shelves/1/books/bulk',
      });
    });

    test('should preserve response structure with added and count', async () => {
      const request = { bookIds: [1, 2, 3, 4, 5] };
      const response = { success: true, data: { added: true, count: 5 } };
      apiSpies.post.mockResolvedValue(response);

      const result = await shelfApi.addBooks(1, request);

      expect(result).toHaveProperty('added');
      expect(result).toHaveProperty('count');
      expect(result.added).toBe(true);
      expect(result.count).toBe(5);
    });
  });

  describe('removeBook', () => {
    test('should call DELETE with correct endpoint and query string', async () => {
      const response = { success: true, data: { removed: true } };
      apiSpies.delete.mockResolvedValue(response);

      const result = await shelfApi.removeBook(1, 42);

      expect(apiSpies.delete).toHaveBeenCalledWith('/api/shelves/1/books?bookId=42');
      expect(result).toEqual({ removed: true });
    });

    test('should unwrap response and return data', async () => {
      const response = { success: true, data: { removed: true } };
      apiSpies.delete.mockResolvedValue(response);

      const result = await shelfApi.removeBook(1, 42);

      expect(result).toEqual({ removed: true });
      expect(result).not.toHaveProperty('success');
    });

    test('should handle different shelf and book IDs', async () => {
      apiSpies.delete.mockResolvedValue({ success: true, data: { removed: true } });

      await shelfApi.removeBook(10, 20);
      expect(apiSpies.delete).toHaveBeenCalledWith('/api/shelves/10/books?bookId=20');

      await shelfApi.removeBook(99, 88);
      expect(apiSpies.delete).toHaveBeenCalledWith('/api/shelves/99/books?bookId=88');
    });

    test('should construct query string correctly', async () => {
      apiSpies.delete.mockResolvedValue({ success: true, data: { removed: true } });

      await shelfApi.removeBook(1, 100);

      const expectedUrl = '/api/shelves/1/books?bookId=100';
      expect(apiSpies.delete).toHaveBeenCalledWith(expectedUrl);
    });

    test('should propagate 404 ApiError when shelf not found', async () => {
      const error = new ApiError('Shelf not found', 404, '/api/shelves/999/books');
      apiSpies.delete.mockRejectedValue(error);

      await expect(shelfApi.removeBook(999, 42)).rejects.toThrow(ApiError);
      await expect(shelfApi.removeBook(999, 42)).rejects.toThrow('Shelf not found');
    });

    test('should propagate 404 ApiError when book not found on shelf', async () => {
      const error = new ApiError(
        'Book not found on this shelf',
        404,
        '/api/shelves/1/books'
      );
      apiSpies.delete.mockRejectedValue(error);

      await expect(shelfApi.removeBook(1, 9999)).rejects.toThrow(ApiError);
      await expect(shelfApi.removeBook(1, 9999)).rejects.toThrow(
        'Book not found on this shelf'
      );
    });
  });

  describe('updateBookOrder', () => {
    test('should call PATCH with correct endpoint and request body', async () => {
      const request = { bookId: 42, sortOrder: 15 };
      const response = { success: true, data: { updated: true } };
      apiSpies.patch.mockResolvedValue(response);

      const result = await shelfApi.updateBookOrder(1, request);

      expect(apiSpies.patch).toHaveBeenCalledWith('/api/shelves/1/books', request);
      expect(result).toEqual({ updated: true });
    });

    test('should unwrap response and return data', async () => {
      const request = { bookId: 100, sortOrder: 20 };
      const response = { success: true, data: { updated: true } };
      apiSpies.patch.mockResolvedValue(response);

      const result = await shelfApi.updateBookOrder(5, request);

      expect(result).toEqual({ updated: true });
      expect(result).not.toHaveProperty('success');
    });

    test('should handle different shelf IDs and sort orders', async () => {
      apiSpies.patch.mockResolvedValue({ success: true, data: { updated: true } });

      await shelfApi.updateBookOrder(10, { bookId: 20, sortOrder: 1 });
      expect(apiSpies.patch).toHaveBeenCalledWith('/api/shelves/10/books', {
        bookId: 20,
        sortOrder: 1,
      });

      await shelfApi.updateBookOrder(50, { bookId: 100, sortOrder: 999 });
      expect(apiSpies.patch).toHaveBeenCalledWith('/api/shelves/50/books', {
        bookId: 100,
        sortOrder: 999,
      });
    });

    test('should propagate 404 ApiError when shelf not found', async () => {
      const request = { bookId: 42, sortOrder: 10 };
      const error = new ApiError('Shelf not found', 404, '/api/shelves/999/books');
      apiSpies.patch.mockRejectedValue(error);

      await expect(shelfApi.updateBookOrder(999, request)).rejects.toThrow(ApiError);
      await expect(shelfApi.updateBookOrder(999, request)).rejects.toThrow(
        'Shelf not found'
      );
    });

    test('should propagate 404 ApiError when book not found on shelf', async () => {
      const request = { bookId: 9999, sortOrder: 10 };
      const error = new ApiError(
        'Book not found on this shelf',
        404,
        '/api/shelves/1/books'
      );
      apiSpies.patch.mockRejectedValue(error);

      await expect(shelfApi.updateBookOrder(1, request)).rejects.toThrow(ApiError);
      await expect(shelfApi.updateBookOrder(1, request)).rejects.toThrow(
        'Book not found on this shelf'
      );
    });

    test('should propagate 400 ApiError for invalid sortOrder', async () => {
      const request = { bookId: 42, sortOrder: -1 };
      const error = new ApiError(
        'Invalid sort order',
        400,
        '/api/shelves/1/books',
        { error: 'Invalid sort order' }
      );
      apiSpies.patch.mockRejectedValue(error);

      await expect(shelfApi.updateBookOrder(1, request)).rejects.toThrow(ApiError);
      await expect(shelfApi.updateBookOrder(1, request)).rejects.toThrow(
        'Invalid sort order'
      );
    });
  });

  describe('reorderBooks', () => {
    test('should call PUT with correct endpoint and payload', async () => {
      const response = { success: true, data: { reordered: true } };
      apiSpies.put.mockResolvedValue(response);

      const request = { bookIds: [42, 15, 89, 3] };
      const result = await shelfApi.reorderBooks(1, request);

      expect(apiSpies.put).toHaveBeenCalledWith(
        '/api/shelves/1/books/reorder',
        request
      );
      expect(result).toEqual({ reordered: true });
    });

    test('should handle different shelf IDs', async () => {
      const response = { success: true, data: { reordered: true } };
      apiSpies.put.mockResolvedValue(response);

      await shelfApi.reorderBooks(5, { bookIds: [1, 2, 3] });
      expect(apiSpies.put).toHaveBeenCalledWith('/api/shelves/5/books/reorder', expect.any(Object));

      await shelfApi.reorderBooks(999, { bookIds: [10, 20] });
      expect(apiSpies.put).toHaveBeenCalledWith('/api/shelves/999/books/reorder', expect.any(Object));
    });

    test('should handle empty bookIds array', async () => {
      const response = { success: true, data: { reordered: true } };
      apiSpies.put.mockResolvedValue(response);

      const request = { bookIds: [] };
      await shelfApi.reorderBooks(5, request);

      expect(apiSpies.put).toHaveBeenCalledWith(
        '/api/shelves/5/books/reorder',
        { bookIds: [] }
      );
    });

    test('should handle single book reorder', async () => {
      const response = { success: true, data: { reordered: true } };
      apiSpies.put.mockResolvedValue(response);

      const request = { bookIds: [42] };
      await shelfApi.reorderBooks(1, request);

      expect(apiSpies.put).toHaveBeenCalledWith(
        '/api/shelves/1/books/reorder',
        { bookIds: [42] }
      );
    });

    test('should handle large batch of books', async () => {
      const response = { success: true, data: { reordered: true } };
      apiSpies.put.mockResolvedValue(response);

      const bookIds = Array.from({ length: 100 }, (_, i) => i + 1);
      const request = { bookIds };
      
      await shelfApi.reorderBooks(1, request);

      expect(apiSpies.put).toHaveBeenCalledWith(
        '/api/shelves/1/books/reorder',
        { bookIds }
      );
      expect(bookIds).toHaveLength(100);
    });

    test('should propagate ApiError from baseApiClient', async () => {
      const error = new ApiError('Shelf not found', 404, '/api/shelves/999/books/reorder');
      apiSpies.put.mockRejectedValue(error);

      await expect(shelfApi.reorderBooks(999, { bookIds: [1, 2, 3] }))
        .rejects.toThrow(ApiError);
      await expect(shelfApi.reorderBooks(999, { bookIds: [1, 2, 3] }))
        .rejects.toThrow('Shelf not found');
    });

    test('should unwrap response and return data object', async () => {
      const response = { success: true, data: { reordered: true } };
      apiSpies.put.mockResolvedValue(response);

      const result = await shelfApi.reorderBooks(1, { bookIds: [1, 2] });

      expect(result).toEqual({ reordered: true });
      expect(result).not.toHaveProperty('success');
    });
  });

  describe('error handling', () => {
    test('should handle network errors', async () => {
      const error = new ApiError('Network error', 0, '/api/shelves');
      apiSpies.get.mockRejectedValue(error);

      await expect(shelfApi.list()).rejects.toThrow(ApiError);
      await expect(shelfApi.list()).rejects.toThrow('Network error');
      await expect(shelfApi.list()).rejects.toMatchObject({
        statusCode: 0,
        endpoint: '/api/shelves',
      });
    });

    test('should handle timeout errors', async () => {
      const error = new ApiError('Request timeout after 30000ms', 408, '/api/shelves');
      apiSpies.get.mockRejectedValue(error);

      await expect(shelfApi.list()).rejects.toThrow(ApiError);
      await expect(shelfApi.list()).rejects.toThrow('Request timeout');
    });

    test('should handle server errors (500)', async () => {
      const error = new ApiError('Internal server error', 500, '/api/shelves');
      apiSpies.get.mockRejectedValue(error);

      await expect(shelfApi.list()).rejects.toThrow(ApiError);
      await expect(shelfApi.list()).rejects.toMatchObject({
        statusCode: 500,
      });
    });

    test('should preserve error details', async () => {
      const errorDetails = {
        error: 'Validation failed',
        fields: ['name'],
      };
      const error = new ApiError(
        'Validation error',
        400,
        '/api/shelves',
        errorDetails
      );
      apiSpies.post.mockRejectedValue(error);

      try {
        await shelfApi.create({ name: '' });
      } catch (err) {
        expect(err).toBeInstanceOf(ApiError);
        expect((err as ApiError).details).toEqual(errorDetails);
      }
    });
  });

  describe('type safety', () => {
    test('list() should return Shelf[] by default', async () => {
      const shelves: Shelf[] = [
        {
          id: 1,
          name: 'Test',
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z',
        },
      ];
      apiSpies.get.mockResolvedValue({ success: true, data: shelves });

      const result = await shelfApi.list();

      // TypeScript should allow accessing Shelf properties
      expect(result[0].id).toBe(1);
      expect(result[0].name).toBe('Test');
    });

    test('list() with withCounts should return ShelfWithBookCount[]', async () => {
      const shelves: ShelfWithBookCount[] = [
        {
          id: 1,
          name: 'Test',
          bookCount: 5,
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z',
        },
      ];
      apiSpies.get.mockResolvedValue({ success: true, data: shelves });

      const result = await shelfApi.list({ withCounts: true });

      // TypeScript should allow accessing bookCount
      expect((result[0] as ShelfWithBookCount).bookCount).toBe(5);
    });

    test('list() with withCovers should return ShelfWithBookCountAndCovers[]', async () => {
      const shelves: ShelfWithBookCountAndCovers[] = [
        {
          id: 1,
          name: 'Test',
          bookCount: 3,
          bookCoverIds: [1, 2, 3],
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z',
        },
      ];
      apiSpies.get.mockResolvedValue({ success: true, data: shelves });

      const result = await shelfApi.list({ withCovers: true });

      // TypeScript should allow accessing bookCoverIds
      expect((result[0] as ShelfWithBookCountAndCovers).bookCoverIds).toEqual([1, 2, 3]);
    });

    test('get() with withBooks should return ShelfWithBooks', async () => {
      const shelf: ShelfWithBooks = {
        id: 1,
        name: 'Test',
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
        books: [
          {
            id: 1,
            calibreId: 10,
            title: 'Test Book',
            authors: ['Author'],
            sortOrder: 1,
            tags: [],
          },
        ],
      };
      apiSpies.get.mockResolvedValue({ success: true, data: shelf });

      const result = await shelfApi.get(1, { withBooks: true });

      // TypeScript should allow accessing books array
      const resultWithBooks = result as ShelfWithBooks;
      expect(resultWithBooks.books).toBeDefined();
      expect(resultWithBooks.books[0].title).toBe('Test Book');
    });
  });
});
