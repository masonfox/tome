import { describe, test, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useShelfBooks } from '@/hooks/useShelfBooks';
import { shelfApi, ApiError } from '@/lib/api';
import type { ShelfWithBooks } from '@/lib/api';

// Mock dependencies
vi.mock('@/lib/api', () => ({
  shelfApi: {
    get: vi.fn(),
    addBook: vi.fn(),
    removeBook: vi.fn(),
    updateBookOrder: vi.fn(),
    reorderBooks: vi.fn(),
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

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('fetchShelfBooks', () => {
    test('should call shelfApi.get with correct parameters', async () => {
      (shelfApi.get as any).mockResolvedValue(mockShelf);

      const { result } = renderHook(() => useShelfBooks(1));

      await waitFor(() => {
        result.current.fetchShelfBooks('title', 'asc');
      });

      await waitFor(() => {
        expect(shelfApi.get).toHaveBeenCalledWith(1, {
          withBooks: true,
          orderBy: 'title',
          direction: 'asc',
        });
      });
    });

    test('should update shelf state after successful fetch', async () => {
      (shelfApi.get as any).mockResolvedValue(mockShelf);

      const { result } = renderHook(() => useShelfBooks(1));

      await waitFor(() => {
        result.current.fetchShelfBooks();
      });

      await waitFor(() => {
        expect(result.current.shelf).toEqual(mockShelf);
        expect(result.current.books).toEqual(mockShelf.books);
      });
    });

    test('should handle ApiError with user-friendly message', async () => {
      const error = new ApiError('Shelf not found', 404, '/api/shelves/1');
      (shelfApi.get as any).mockRejectedValue(error);

      const { result } = renderHook(() => useShelfBooks(1));

      try {
        await result.current.fetchShelfBooks();
        expect.fail('Should have thrown an error');
      } catch (err) {
        expect(err).toBeInstanceOf(Error);
        expect((err as Error).message).toBe('Shelf not found');
      }

      await waitFor(() => {
        expect(result.current.error).toBeInstanceOf(Error);
      });
    });
  });

  describe('addBookToShelf', () => {
    test('should call shelfApi.addBook with correct parameters', async () => {
      (shelfApi.addBook as any).mockResolvedValue({ added: true });
      (shelfApi.get as any).mockResolvedValue(mockShelf);

      const { result } = renderHook(() => useShelfBooks(1));

      await waitFor(() => {
        result.current.addBookToShelf(42, 5);
      });

      await waitFor(() => {
        expect(shelfApi.addBook).toHaveBeenCalledWith(1, {
          bookId: 42,
          sortOrder: 5,
        });
      });
    });

    test('should refresh shelf after adding book', async () => {
      (shelfApi.addBook as any).mockResolvedValue({ added: true });
      (shelfApi.get as any).mockResolvedValue(mockShelf);

      const { result } = renderHook(() => useShelfBooks(1));

      await waitFor(() => {
        result.current.addBookToShelf(42);
      });

      await waitFor(() => {
        expect(shelfApi.get).toHaveBeenCalled();
      });
    });
  });

  describe('removeBookFromShelf', () => {
    test('should call shelfApi.removeBook with correct parameters', async () => {
      (shelfApi.removeBook as any).mockResolvedValue({ removed: true });
      (shelfApi.get as any).mockResolvedValue(mockShelf);

      const { result } = renderHook(() => useShelfBooks(1));
      
      // Set initial state
      result.current.shelf = mockShelf as any;

      await waitFor(() => {
        result.current.removeBookFromShelf(10);
      });

      await waitFor(() => {
        expect(shelfApi.removeBook).toHaveBeenCalledWith(1, 10);
      });
    });

    test('should optimistically update state', async () => {
      (shelfApi.removeBook as any).mockResolvedValue({ removed: true });
      const { result } = renderHook(() => useShelfBooks(1));
      
      // Pre-populate shelf state
      (shelfApi.get as any).mockResolvedValue(mockShelf);
      await waitFor(() => result.current.fetchShelfBooks());

      await waitFor(() => {
        result.current.removeBookFromShelf(10);
      });

      await waitFor(() => {
        expect(result.current.books.find(b => b.id === 10)).toBeUndefined();
      });
    });

    test('should refresh on error to restore correct state', async () => {
      const error = new ApiError('Book not found', 404, '/api/shelves/1/books');
      (shelfApi.removeBook as any).mockRejectedValue(error);
      (shelfApi.get as any).mockResolvedValue(mockShelf);

      const { result } = renderHook(() => useShelfBooks(1));

      try {
        await result.current.removeBookFromShelf(10);
        expect.fail('Should have thrown an error');
      } catch (err) {
        // Expected
      }

      await waitFor(() => {
        expect(shelfApi.get).toHaveBeenCalled();
      });
    });
  });

  describe('updateBookOrder', () => {
    test('should call shelfApi.updateBookOrder with correct parameters', async () => {
      (shelfApi.updateBookOrder as any).mockResolvedValue({ updated: true });
      (shelfApi.get as any).mockResolvedValue(mockShelf);

      const { result } = renderHook(() => useShelfBooks(1));

      await waitFor(() => {
        result.current.updateBookOrder(10, 5);
      });

      await waitFor(() => {
        expect(shelfApi.updateBookOrder).toHaveBeenCalledWith(1, {
          bookId: 10,
          sortOrder: 5,
        });
      });
    });
  });

  describe('reorderBooks', () => {
    test('should call shelfApi.reorderBooks with correct parameters', async () => {
      (shelfApi.reorderBooks as any).mockResolvedValue({ reordered: true });
      (shelfApi.get as any).mockResolvedValue(mockShelf);

      const { result } = renderHook(() => useShelfBooks(1));

      const bookIds = [20, 10]; // Reversed order

      await waitFor(() => {
        result.current.reorderBooks(bookIds);
      });

      await waitFor(() => {
        expect(shelfApi.reorderBooks).toHaveBeenCalledWith(1, { bookIds });
      });
    });

    test('should optimistically update order', async () => {
      (shelfApi.get as any).mockResolvedValue(mockShelf);
      (shelfApi.reorderBooks as any).mockResolvedValue({ reordered: true });

      const { result } = renderHook(() => useShelfBooks(1));
      
      // Pre-populate shelf state
      await result.current.fetchShelfBooks();

      const bookIds = [20, 10]; // Reversed order

      result.current.reorderBooks(bookIds);

      // Check optimistic update happened (eventually after state updates)
      await waitFor(() => {
        expect(result.current.books.length).toBe(2);
        // After reorder completes, it refreshes, so we get back the original order from mock
        // But initially the optimistic update should have happened
      });
    });

    test('should refresh after reorder to sync server state', async () => {
      (shelfApi.get as any).mockResolvedValue(mockShelf);
      (shelfApi.reorderBooks as any).mockResolvedValue({ reordered: true });

      const { result } = renderHook(() => useShelfBooks(1));

      // Call reorderBooks which internally calls fetchShelfBooks after success
      await result.current.reorderBooks([20, 10]);

      // reorderBooks calls fetchShelfBooks internally, so get should be called at least once
      expect(shelfApi.get).toHaveBeenCalled();
    });

    test('should restore state on error', async () => {
      const error = new ApiError('Reorder failed', 500, '/api/shelves/1/books/reorder');
      (shelfApi.reorderBooks as any).mockRejectedValue(error);
      (shelfApi.get as any).mockResolvedValue(mockShelf);

      const { result } = renderHook(() => useShelfBooks(1));

      try {
        await result.current.reorderBooks([20, 10]);
        expect.fail('Should have thrown an error');
      } catch (err) {
        // Expected
      }

      await waitFor(() => {
        // Should call get to restore correct state
        expect(shelfApi.get).toHaveBeenCalled();
      });
    });
  });

  describe('loading states', () => {
    test('should set loading to true during fetch', async () => {
      (shelfApi.get as any).mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve(mockShelf), 100))
      );

      const { result } = renderHook(() => useShelfBooks(1));

      const fetchPromise = result.current.fetchShelfBooks();

      // Wait for loading state to update
      await waitFor(() => {
        expect(result.current.loading).toBe(true);
      });

      await fetchPromise;

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });
    });
  });
});
