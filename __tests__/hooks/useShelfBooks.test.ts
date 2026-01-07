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
    addBooks: vi.fn(),
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

      // Check optimistic update happened (with updated sortOrder values)
      await waitFor(() => {
        expect(result.current.books.length).toBe(2);
        // The optimistic update persists since we no longer refetch on success
      });
    });

    test('should not refresh after successful reorder (trusts optimistic update)', async () => {
      (shelfApi.get as any).mockResolvedValue(mockShelf);
      (shelfApi.reorderBooks as any).mockResolvedValue({ reordered: true });

      const { result } = renderHook(() => useShelfBooks(1));
      
      // Pre-populate shelf state with initial fetch
      await result.current.fetchShelfBooks();
      
      // Clear the mock call history after initial fetch
      (shelfApi.get as any).mockClear();

      // Call reorderBooks - should NOT call fetchShelfBooks after success
      await result.current.reorderBooks([20, 10]);

      // Verify that get was NOT called again after the successful reorder
      expect(shelfApi.get).not.toHaveBeenCalled();
      
      // Verify the API reorder was still called
      expect(shelfApi.reorderBooks).toHaveBeenCalledWith(1, { bookIds: [20, 10] });
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

  describe('null shelfId handling', () => {
    test('should not fetch when shelfId is null', async () => {
      (shelfApi.get as any).mockResolvedValue(mockShelf);

      const { result } = renderHook(() => useShelfBooks(null));

      await result.current.fetchShelfBooks();

      expect(shelfApi.get).not.toHaveBeenCalled();
    });

    test('should not add book when shelfId is null', async () => {
      (shelfApi.addBook as any).mockResolvedValue({ added: true });

      const { result } = renderHook(() => useShelfBooks(null));

      await result.current.addBookToShelf(42);

      expect(shelfApi.addBook).not.toHaveBeenCalled();
    });

    test('should not remove book when shelfId is null', async () => {
      (shelfApi.removeBook as any).mockResolvedValue({ removed: true });

      const { result } = renderHook(() => useShelfBooks(null));

      await result.current.removeBookFromShelf(10);

      expect(shelfApi.removeBook).not.toHaveBeenCalled();
    });

    test('should not update book order when shelfId is null', async () => {
      (shelfApi.updateBookOrder as any).mockResolvedValue({ updated: true });

      const { result } = renderHook(() => useShelfBooks(null));

      await result.current.updateBookOrder(10, 5);

      expect(shelfApi.updateBookOrder).not.toHaveBeenCalled();
    });

    test('should not reorder books when shelfId is null', async () => {
      (shelfApi.reorderBooks as any).mockResolvedValue({ reordered: true });

      const { result } = renderHook(() => useShelfBooks(null));

      await result.current.reorderBooks([10, 20]);

      expect(shelfApi.reorderBooks).not.toHaveBeenCalled();
    });
  });

  describe('optimistic updates', () => {
    test('should handle optimistic reorder when no matching book found', async () => {
      (shelfApi.get as any).mockResolvedValue(mockShelf);
      (shelfApi.reorderBooks as any).mockResolvedValue({ reordered: true });

      const { result } = renderHook(() => useShelfBooks(1));

      // Pre-populate shelf state
      await result.current.fetchShelfBooks();

      // Try to reorder with non-existent book IDs
      const bookIds = [999, 888];
      await result.current.reorderBooks(bookIds);

      await waitFor(() => {
        // Should filter out undefined books
        expect(result.current.books.length).toBe(0);
      });
    });

    test('should handle reorder without pre-loaded shelf', async () => {
      (shelfApi.reorderBooks as any).mockResolvedValue({ reordered: true });

      const { result } = renderHook(() => useShelfBooks(1));

      // Reorder without fetching first (shelf is null)
      await result.current.reorderBooks([10, 20]);

      expect(shelfApi.reorderBooks).toHaveBeenCalledWith(1, { bookIds: [10, 20] });
    });
  });

  describe('addBooksToShelf (bulk operation)', () => {
    test('should call shelfApi.addBooks with correct parameters', async () => {
      (shelfApi.addBooks as any).mockResolvedValue({ count: 3 });
      (shelfApi.get as any).mockResolvedValue(mockShelf);

      const { result } = renderHook(() => useShelfBooks(1));

      await waitFor(() => {
        result.current.addBooksToShelf([10, 20, 30]);
      });

      await waitFor(() => {
        expect(shelfApi.addBooks).toHaveBeenCalledWith(1, {
          bookIds: [10, 20, 30],
        });
      });
    });

    test('should set loading state during operation', async () => {
      (shelfApi.addBooks as any).mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve({ count: 2 }), 100))
      );
      (shelfApi.get as any).mockResolvedValue(mockShelf);

      const { result } = renderHook(() => useShelfBooks(1));

      const promise = result.current.addBooksToShelf([10, 20]);

      // Wait for loading state to update
      await waitFor(() => {
        expect(result.current.loading).toBe(true);
      });

      await promise;

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });
    });

    test('should show success toast with correct count (single book)', async () => {
      const { toast } = await import('@/utils/toast');
      (shelfApi.addBooks as any).mockResolvedValue({ count: 1 });
      (shelfApi.get as any).mockResolvedValue(mockShelf);

      const { result } = renderHook(() => useShelfBooks(1));

      await result.current.addBooksToShelf([10]);

      await waitFor(() => {
        expect(toast.success).toHaveBeenCalledWith('1 book added to shelf');
      });
    });

    test('should show success toast with correct count (multiple books)', async () => {
      const { toast } = await import('@/utils/toast');
      (shelfApi.addBooks as any).mockResolvedValue({ count: 3 });
      (shelfApi.get as any).mockResolvedValue(mockShelf);

      const { result } = renderHook(() => useShelfBooks(1));

      await result.current.addBooksToShelf([10, 20, 30]);

      await waitFor(() => {
        expect(toast.success).toHaveBeenCalledWith('3 books added to shelf');
      });
    });

    test('should refresh shelf data after successful add', async () => {
      (shelfApi.addBooks as any).mockResolvedValue({ count: 2 });
      (shelfApi.get as any).mockResolvedValue(mockShelf);

      const { result } = renderHook(() => useShelfBooks(1));

      // Clear initial fetch calls
      (shelfApi.get as any).mockClear();

      await result.current.addBooksToShelf([10, 20]);

      await waitFor(() => {
        // Should call fetchShelfBooks (which calls shelfApi.get)
        expect(shelfApi.get).toHaveBeenCalled();
      });
    });

    test('should handle API errors gracefully', async () => {
      const error = new ApiError('Failed to add books', 500, '/api/shelves/1/books/bulk');
      (shelfApi.addBooks as any).mockRejectedValue(error);

      const { result } = renderHook(() => useShelfBooks(1));

      try {
        await result.current.addBooksToShelf([10, 20]);
        expect.fail('Should have thrown an error');
      } catch (err) {
        expect(err).toBeInstanceOf(Error);
        expect((err as Error).message).toBe('Failed to add books');
      }

      await waitFor(() => {
        expect(result.current.error).toBeInstanceOf(Error);
      });
    });

    test('should show error toast on failure', async () => {
      const { toast } = await import('@/utils/toast');
      const error = new ApiError('Server error', 500, '/api/shelves/1/books/bulk');
      (shelfApi.addBooks as any).mockRejectedValue(error);

      const { result } = renderHook(() => useShelfBooks(1));

      try {
        await result.current.addBooksToShelf([10, 20]);
      } catch (err) {
        // Expected
      }

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('Failed to add books: Server error');
      });
    });

    test('should clear loading state after completion', async () => {
      (shelfApi.addBooks as any).mockResolvedValue({ count: 2 });
      (shelfApi.get as any).mockResolvedValue(mockShelf);

      const { result } = renderHook(() => useShelfBooks(1));

      await result.current.addBooksToShelf([10, 20]);

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });
    });

    test('should handle network errors', async () => {
      const networkError = new Error('Network request failed');
      (shelfApi.addBooks as any).mockRejectedValue(networkError);

      const { result } = renderHook(() => useShelfBooks(1));

      try {
        await result.current.addBooksToShelf([10, 20]);
        expect.fail('Should have thrown an error');
      } catch (err) {
        expect(err).toBeInstanceOf(Error);
      }

      await waitFor(() => {
        expect(result.current.error).toBeInstanceOf(Error);
      });
    });

    test('should not call API when shelfId is null', async () => {
      (shelfApi.addBooks as any).mockResolvedValue({ count: 2 });

      const { result } = renderHook(() => useShelfBooks(null));

      await result.current.addBooksToShelf([10, 20]);

      expect(shelfApi.addBooks).not.toHaveBeenCalled();
    });

    test('should not call API when bookIds array is empty', async () => {
      (shelfApi.addBooks as any).mockResolvedValue({ count: 0 });

      const { result } = renderHook(() => useShelfBooks(1));

      await result.current.addBooksToShelf([]);

      expect(shelfApi.addBooks).not.toHaveBeenCalled();
    });

    test('should return result with count', async () => {
      (shelfApi.addBooks as any).mockResolvedValue({ count: 5 });
      (shelfApi.get as any).mockResolvedValue(mockShelf);

      const { result } = renderHook(() => useShelfBooks(1));

      const addResult = await result.current.addBooksToShelf([10, 20, 30, 40, 50]);

      expect(addResult).toEqual({ count: 5 });
    });
  });
});
