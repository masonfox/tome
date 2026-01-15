import { describe, test, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useShelfBooks } from '@/hooks/useShelfBooks';
import { shelfApi, ApiError } from '@/lib/api';
import type { ShelfWithBooks } from '@/lib/api';
import React from 'react';

// Mock dependencies
vi.mock('@/lib/api', () => ({
  shelfApi: {
    get: vi.fn(),
    addBook: vi.fn(),
    addBooks: vi.fn(),
    removeBook: vi.fn(),
    removeBooks: vi.fn(),
    updateBookOrder: vi.fn(),
    reorderBooks: vi.fn(),
    moveBooks: vi.fn(),
    copyBooks: vi.fn(),
  },
  ApiError: class ApiError extends Error {
    constructor(
      message: string,
      public statusCode: number,
      public endpoint: string,
      public details?: any
    ) {
      super(message);
      this.name = 'ApiError';
    }
  },
}));

vi.mock('@/utils/toast', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe('useShelfBooks', () => {
  let queryClient: QueryClient;

  const mockShelf: ShelfWithBooks = {
    id: 1,
    name: 'Test Shelf',
    description: 'Test Description',
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    books: [
      {
        id: 10,
        calibreId: 100,
        title: 'Book 1',
        authors: ['Author 1'],
        sortOrder: 0,
        tags: [],
      },
      {
        id: 20,
        calibreId: 200,
        title: 'Book 2',
        authors: ['Author 2'],
        sortOrder: 1,
        tags: [],
      },
    ],
  };

  const createWrapper = () => {
    return ({ children }: { children: React.ReactNode }) => (
      React.createElement(QueryClientProvider, { client: queryClient }, children)
    );
  };

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
        mutations: {
          retry: false,
        },
      },
    });
    vi.clearAllMocks();
  });

  describe('useQuery - fetch shelf with books', () => {
    test('should fetch shelf data with correct parameters', async () => {
      (shelfApi.get as any).mockResolvedValue(mockShelf);

      const { result } = renderHook(() => useShelfBooks(1, 'title', 'asc'), { wrapper: createWrapper() });

      await waitFor(() => {
        expect(result.current.shelf).toEqual(mockShelf);
      });

      expect(shelfApi.get).toHaveBeenCalledWith(1, {
        withBooks: true,
        orderBy: 'title',
        direction: 'asc',
      });
    });

    test('should return books array from shelf', async () => {
      (shelfApi.get as any).mockResolvedValue(mockShelf);

      const { result } = renderHook(() => useShelfBooks(1), { wrapper: createWrapper() });

      await waitFor(() => {
        expect(result.current.books).toEqual(mockShelf.books);
      });
    });

    test('should handle ApiError with user-friendly message', async () => {
      const apiError = new (ApiError as any)('Shelf not found', 404, '/api/shelves/1');
      (shelfApi.get as any).mockRejectedValue(apiError);

      const { result } = renderHook(() => useShelfBooks(1), { wrapper: createWrapper() });

      await waitFor(() => {
        expect(result.current.error).toBeTruthy();
      });
    });

    test('should not fetch when shelfId is null', async () => {
      const { result } = renderHook(() => useShelfBooks(null), { wrapper: createWrapper() });

      await waitFor(() => {
        expect(result.current.shelf).toBeNull();
      });

      expect(shelfApi.get).not.toHaveBeenCalled();
    });

    test('should set hasInitialized after data loads', async () => {
      (shelfApi.get as any).mockResolvedValue(mockShelf);

      const { result } = renderHook(() => useShelfBooks(1), { wrapper: createWrapper() });

      await waitFor(() => {
        expect(result.current.hasInitialized).toBe(true);
      });
    });
  });

  describe('addBooksToShelf mutation', () => {
    test('should call shelfApi.addBooks with correct parameters', async () => {
      (shelfApi.get as any).mockResolvedValue(mockShelf);
      (shelfApi.addBooks as any).mockResolvedValue({ count: 2 });

      const { result } = renderHook(() => useShelfBooks(1), { wrapper: createWrapper() });

      await waitFor(() => expect(result.current.shelf).toEqual(mockShelf));

      await result.current.addBooksToShelf([30, 40]);

      expect(shelfApi.addBooks).toHaveBeenCalledWith(1, { bookIds: [30, 40] });
    });

    test('should show success toast with correct count (single book)', async () => {
      (shelfApi.get as any).mockResolvedValue(mockShelf);
      (shelfApi.addBooks as any).mockResolvedValue({ count: 1 });

      const { toast } = await import('@/utils/toast');
      const { result } = renderHook(() => useShelfBooks(1), { wrapper: createWrapper() });

      await waitFor(() => expect(result.current.shelf).toEqual(mockShelf));

      await result.current.addBooksToShelf([30]);

      expect(toast.success).toHaveBeenCalledWith('1 book added to shelf');
    });

    test('should show success toast with correct count (multiple books)', async () => {
      (shelfApi.get as any).mockResolvedValue(mockShelf);
      (shelfApi.addBooks as any).mockResolvedValue({ count: 3 });

      const { toast } = await import('@/utils/toast');
      const { result } = renderHook(() => useShelfBooks(1), { wrapper: createWrapper() });

      await waitFor(() => expect(result.current.shelf).toEqual(mockShelf));

      await result.current.addBooksToShelf([30, 40, 50]);

      expect(toast.success).toHaveBeenCalledWith('3 books added to shelf');
    });

    test('should handle API errors gracefully', async () => {
      (shelfApi.get as any).mockResolvedValue(mockShelf);
      (shelfApi.addBooks as any).mockRejectedValue(new Error('Add failed'));

      const { toast } = await import('@/utils/toast');
      const { result } = renderHook(() => useShelfBooks(1), { wrapper: createWrapper() });

      await waitFor(() => expect(result.current.shelf).toEqual(mockShelf));

      await expect(result.current.addBooksToShelf([30])).rejects.toThrow();

      expect(toast.error).toHaveBeenCalledWith(expect.stringContaining('Failed to add books'));
    });
  });

  describe('removeBookFromShelf mutation', () => {
    test('should call shelfApi.removeBook with correct parameters', async () => {
      (shelfApi.get as any).mockResolvedValue(mockShelf);
      (shelfApi.removeBook as any).mockResolvedValue({});

      const { result } = renderHook(() => useShelfBooks(1), { wrapper: createWrapper() });

      await waitFor(() => expect(result.current.shelf).toEqual(mockShelf));

      await result.current.removeBookFromShelf(10);

      expect(shelfApi.removeBook).toHaveBeenCalledWith(1, 10);
    });

    test('should optimistically update state', async () => {
      (shelfApi.get as any).mockResolvedValue(mockShelf);
      (shelfApi.removeBook as any).mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100)));

      const { result } = renderHook(() => useShelfBooks(1), { wrapper: createWrapper() });

      await waitFor(() => expect(result.current.books.length).toBe(2));

      // Start mutation (don't await)
      result.current.removeBookFromShelf(10);

      // Should optimistically remove book
      await waitFor(() => {
        expect(result.current.books.length).toBe(1);
        expect(result.current.books[0].id).toBe(20);
      });
    });

    test('should show success toast', async () => {
      (shelfApi.get as any).mockResolvedValue(mockShelf);
      (shelfApi.removeBook as any).mockResolvedValue({});

      const { toast } = await import('@/utils/toast');
      const { result } = renderHook(() => useShelfBooks(1), { wrapper: createWrapper() });

      await waitFor(() => expect(result.current.shelf).toEqual(mockShelf));

      await result.current.removeBookFromShelf(10);

      expect(toast.success).toHaveBeenCalledWith('Book removed from shelf');
    });
  });

  describe('removeBooksFromShelf mutation', () => {
    test('should call shelfApi.removeBooks with correct parameters', async () => {
      (shelfApi.get as any).mockResolvedValue(mockShelf);
      (shelfApi.removeBooks as any).mockResolvedValue({ count: 2, removedBookIds: [10, 20] });

      const { result } = renderHook(() => useShelfBooks(1), { wrapper: createWrapper() });

      await waitFor(() => expect(result.current.shelf).toEqual(mockShelf));

      await result.current.removeBooksFromShelf([10, 20]);

      expect(shelfApi.removeBooks).toHaveBeenCalledWith(1, { bookIds: [10, 20] });
    });

    test('should optimistically update shelf state', async () => {
      (shelfApi.get as any).mockResolvedValue(mockShelf);
      (shelfApi.removeBooks as any).mockImplementation(() => new Promise(resolve => setTimeout(() => resolve({ count: 1, removedBookIds: [10] }), 100)));

      const { result } = renderHook(() => useShelfBooks(1), { wrapper: createWrapper() });

      await waitFor(() => expect(result.current.books.length).toBe(2));

      // Start mutation (don't await)
      result.current.removeBooksFromShelf([10]);

      // Should optimistically remove book
      await waitFor(() => {
        expect(result.current.books.length).toBe(1);
        expect(result.current.books[0].id).toBe(20);
      });
    });

    test('should show success toast with correct count (single book)', async () => {
      (shelfApi.get as any).mockResolvedValue(mockShelf);
      (shelfApi.removeBooks as any).mockResolvedValue({ count: 1, removedBookIds: [10] });

      const { toast } = await import('@/utils/toast');
      const { result } = renderHook(() => useShelfBooks(1), { wrapper: createWrapper() });

      await waitFor(() => expect(result.current.shelf).toEqual(mockShelf));

      await result.current.removeBooksFromShelf([10]);

      expect(toast.success).toHaveBeenCalledWith('1 book removed from shelf');
    });

    test('should show success toast with correct count (multiple books)', async () => {
      (shelfApi.get as any).mockResolvedValue(mockShelf);
      (shelfApi.removeBooks as any).mockResolvedValue({ count: 2, removedBookIds: [10, 20] });

      const { toast } = await import('@/utils/toast');
      const { result } = renderHook(() => useShelfBooks(1), { wrapper: createWrapper() });

      await waitFor(() => expect(result.current.shelf).toEqual(mockShelf));

      await result.current.removeBooksFromShelf([10, 20]);

      expect(toast.success).toHaveBeenCalledWith('2 books removed from shelf');
    });
  });

  describe('reorderBooks mutation', () => {
    test('should call shelfApi.reorderBooks with correct parameters', async () => {
      (shelfApi.get as any).mockResolvedValue(mockShelf);
      (shelfApi.reorderBooks as any).mockResolvedValue({});

      const { result } = renderHook(() => useShelfBooks(1), { wrapper: createWrapper() });

      await waitFor(() => expect(result.current.shelf).toEqual(mockShelf));

      await result.current.reorderBooks([20, 10]);

      expect(shelfApi.reorderBooks).toHaveBeenCalledWith(1, { bookIds: [20, 10] });
    });

    test('should optimistically update order', async () => {
      (shelfApi.get as any).mockResolvedValue(mockShelf);
      (shelfApi.reorderBooks as any).mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100)));

      const { result } = renderHook(() => useShelfBooks(1), { wrapper: createWrapper() });

      await waitFor(() => expect(result.current.books[0].id).toBe(10));

      // Start mutation (don't await)
      result.current.reorderBooks([20, 10]);

      // Should optimistically reorder
      await waitFor(() => {
        expect(result.current.books[0].id).toBe(20);
        expect(result.current.books[1].id).toBe(10);
      });
    });

    test('should not show success toast (silent operation)', async () => {
      (shelfApi.get as any).mockResolvedValue(mockShelf);
      (shelfApi.reorderBooks as any).mockResolvedValue({});

      const { toast } = await import('@/utils/toast');
      const { result } = renderHook(() => useShelfBooks(1), { wrapper: createWrapper() });

      await waitFor(() => expect(result.current.shelf).toEqual(mockShelf));

      await result.current.reorderBooks([20, 10]);

      expect(toast.success).not.toHaveBeenCalled();
    });
  });

  describe('moveBooks mutation', () => {
    test('should call shelfApi.moveBooks with correct parameters', async () => {
      (shelfApi.get as any).mockResolvedValue(mockShelf);
      (shelfApi.moveBooks as any).mockResolvedValue({ count: 1 });

      const { result } = renderHook(() => useShelfBooks(1), { wrapper: createWrapper() });

      await waitFor(() => expect(result.current.shelf).toEqual(mockShelf));

      await result.current.moveBooks(2, [10], 'Target Shelf');

      expect(shelfApi.moveBooks).toHaveBeenCalledWith(1, 2, { bookIds: [10] });
    });

    test('should show success toast with target shelf name', async () => {
      (shelfApi.get as any).mockResolvedValue(mockShelf);
      (shelfApi.moveBooks as any).mockResolvedValue({ count: 1 });

      const { toast } = await import('@/utils/toast');
      const { result } = renderHook(() => useShelfBooks(1), { wrapper: createWrapper() });

      await waitFor(() => expect(result.current.shelf).toEqual(mockShelf));

      await result.current.moveBooks(2, [10], 'Target Shelf');

      expect(toast.success).toHaveBeenCalledWith('1 book moved to Target Shelf');
    });
  });

  describe('copyBooks mutation', () => {
    test('should call shelfApi.copyBooks with correct parameters', async () => {
      (shelfApi.get as any).mockResolvedValue(mockShelf);
      (shelfApi.copyBooks as any).mockResolvedValue({ count: 2 });

      const { result } = renderHook(() => useShelfBooks(1), { wrapper: createWrapper() });

      await waitFor(() => expect(result.current.shelf).toEqual(mockShelf));

      await result.current.copyBooks(2, [10, 20], 'Target Shelf');

      expect(shelfApi.copyBooks).toHaveBeenCalledWith(2, { bookIds: [10, 20] });
    });

    test('should show success toast with target shelf name', async () => {
      (shelfApi.get as any).mockResolvedValue(mockShelf);
      (shelfApi.copyBooks as any).mockResolvedValue({ count: 2 });

      const { toast } = await import('@/utils/toast');
      const { result } = renderHook(() => useShelfBooks(1), { wrapper: createWrapper() });

      await waitFor(() => expect(result.current.shelf).toEqual(mockShelf));

      await result.current.copyBooks(2, [10, 20], 'Target Shelf');

      expect(toast.success).toHaveBeenCalledWith('2 books copied to Target Shelf');
    });
  });

  describe('loading states', () => {
    test('should set loading to true during initial fetch', async () => {
      (shelfApi.get as any).mockImplementation(() => new Promise(resolve => setTimeout(() => resolve(mockShelf), 100)));

      const { result } = renderHook(() => useShelfBooks(1), { wrapper: createWrapper() });

      expect(result.current.loading).toBe(true);

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });
    });

    test('should track mutation loading states', async () => {
      (shelfApi.get as any).mockResolvedValue(mockShelf);
      (shelfApi.removeBooks as any).mockImplementation(() => new Promise(resolve => setTimeout(() => resolve({ count: 1 }), 100)));

      const { result } = renderHook(() => useShelfBooks(1), { wrapper: createWrapper() });

      await waitFor(() => expect(result.current.shelf).toEqual(mockShelf));

      // Start mutation
      result.current.removeBooksFromShelf([10]);

      await waitFor(() => {
        expect(result.current.isRemovingBooks).toBe(true);
      });

      await waitFor(() => {
        expect(result.current.isRemovingBooks).toBe(false);
      });
    });
  });

  describe('error handling', () => {
    test('should handle network errors', async () => {
      (shelfApi.get as any).mockRejectedValue(new Error('Network error'));

      const { result } = renderHook(() => useShelfBooks(1), { wrapper: createWrapper() });

      await waitFor(() => {
        expect(result.current.error).toBeTruthy();
      });
    });

    test('should rollback optimistic updates on mutation error', async () => {
      (shelfApi.get as any).mockResolvedValue(mockShelf);
      (shelfApi.removeBook as any).mockRejectedValue(new Error('Remove failed'));

      const { result } = renderHook(() => useShelfBooks(1), { wrapper: createWrapper() });

      await waitFor(() => expect(result.current.books.length).toBe(2));

      await expect(result.current.removeBookFromShelf(10)).rejects.toThrow();

      // Should rollback to original state
      await waitFor(() => {
        expect(result.current.books.length).toBe(2);
      });
    });
  });
});
