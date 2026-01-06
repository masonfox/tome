import { test, expect, describe, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, waitFor, act } from '../test-utils';
import { useShelfManagement } from '@/hooks/useShelfManagement';
import { shelfApi } from '@/lib/api';
import { ApiError } from '@/lib/api/base-client';
import type { Shelf, ShelfWithBookCountAndCovers } from '@/lib/api';

// Mock the shelfApi domain helper
vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual('@/lib/api');
  return {
    ...actual,
    shelfApi: {
      list: vi.fn(),
      get: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      addBook: vi.fn(),
      removeBook: vi.fn(),
      updateBookOrder: vi.fn(),
    },
  };
});

// Mock toast
vi.mock('@/utils/toast', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

describe('useShelfManagement', () => {
  const mockShelf: Shelf = {
    id: 1,
    name: 'Favorites',
    description: 'My favorite books',
    color: '#3b82f6',
    icon: '⭐',
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
  };

  const mockShelfWithCovers: ShelfWithBookCountAndCovers = {
    ...mockShelf,
    bookCount: 3,
    bookCoverIds: [1, 2, 3],
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('initialization', () => {
    test('should initialize with empty state', () => {
      const { result } = renderHook(() => useShelfManagement());

      expect(result.current.shelves).toEqual([]);
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBeNull();
    });
  });

  describe('fetchShelves', () => {
    test('should fetch shelves successfully', async () => {
      const mockShelves = [mockShelfWithCovers];
      vi.mocked(shelfApi.list).mockResolvedValue(mockShelves);

      const { result } = renderHook(() => useShelfManagement());

      await act(async () => {
        await result.current.fetchShelves();
      });

      await waitFor(() => {
        expect(result.current.shelves).toEqual(mockShelves);
        expect(result.current.loading).toBe(false);
        expect(result.current.error).toBeNull();
      });

      expect(shelfApi.list).toHaveBeenCalledWith({ withCovers: true });
    });

    test('should set loading state during fetch', async () => {
      vi.mocked(shelfApi.list).mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve([]), 100))
      );

      const { result } = renderHook(() => useShelfManagement());

      act(() => {
        result.current.fetchShelves();
      });

      // Loading should be true immediately
      expect(result.current.loading).toBe(true);

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });
    });

    test('should handle fetch errors', async () => {
      const error = new ApiError('Network error', 0, '/api/shelves');
      vi.mocked(shelfApi.list).mockRejectedValue(error);

      const { result } = renderHook(() => useShelfManagement());

      await act(async () => {
        try {
          await result.current.fetchShelves();
        } catch {
          // Expected to throw
        }
      });

      await waitFor(() => {
        expect(result.current.error).toBeInstanceOf(Error);
        expect(result.current.error?.message).toBe('Network error');
        expect(result.current.loading).toBe(false);
      });
    });

    test('should handle 404 errors', async () => {
      const error = new ApiError('Not found', 404, '/api/shelves');
      vi.mocked(shelfApi.list).mockRejectedValue(error);

      const { result } = renderHook(() => useShelfManagement());

      await act(async () => {
        try {
          await result.current.fetchShelves();
        } catch {
          // Expected to throw
        }
      });

      await waitFor(() => {
        expect(result.current.error?.message).toBe('Not found');
      });
    });

    test('should handle non-ApiError errors', async () => {
      const error = new Error('Unknown error');
      vi.mocked(shelfApi.list).mockRejectedValue(error);

      const { result } = renderHook(() => useShelfManagement());

      await act(async () => {
        try {
          await result.current.fetchShelves();
        } catch {
          // Expected to throw
        }
      });

      await waitFor(() => {
        expect(result.current.error?.message).toBe('Unknown error');
      });
    });

    test('should return fetched data', async () => {
      const mockShelves = [mockShelfWithCovers];
      vi.mocked(shelfApi.list).mockResolvedValue(mockShelves);

      const { result } = renderHook(() => useShelfManagement());

      let fetchResult;
      await act(async () => {
        fetchResult = await result.current.fetchShelves();
      });

      expect(fetchResult).toEqual(mockShelves);
    });
  });

  describe('createShelf', () => {
    test('should create shelf successfully', async () => {
      const request = {
        name: 'New Shelf',
        description: 'A new shelf',
        color: '#10b981',
        icon: '📚',
      };
      vi.mocked(shelfApi.create).mockResolvedValue(mockShelf);

      const { result } = renderHook(() => useShelfManagement());

      await act(async () => {
        await result.current.createShelf(request);
      });

      await waitFor(() => {
        expect(result.current.shelves).toHaveLength(1);
        expect(result.current.shelves[0]).toMatchObject({
          ...mockShelf,
          bookCount: 0,
          bookCoverIds: [],
        });
        expect(result.current.loading).toBe(false);
        expect(result.current.error).toBeNull();
      });

      expect(shelfApi.create).toHaveBeenCalledWith(request);
    });

    test('should add created shelf to existing shelves', async () => {
      const existingShelf: ShelfWithBookCountAndCovers = {
        id: 1,
        name: 'Existing',
        bookCount: 5,
        bookCoverIds: [1, 2],
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
      };
      const newShelf: Shelf = {
        id: 2,
        name: 'New Shelf',
        createdAt: '2024-01-02T00:00:00.000Z',
        updatedAt: '2024-01-02T00:00:00.000Z',
      };

      vi.mocked(shelfApi.list).mockResolvedValue([existingShelf]);
      vi.mocked(shelfApi.create).mockResolvedValue(newShelf);

      const { result } = renderHook(() => useShelfManagement());

      // First fetch existing shelves
      await act(async () => {
        await result.current.fetchShelves();
      });

      // Then create new shelf
      await act(async () => {
        await result.current.createShelf({ name: 'New Shelf' });
      });

      await waitFor(() => {
        expect(result.current.shelves).toHaveLength(2);
        expect(result.current.shelves[0]).toEqual(existingShelf);
        expect(result.current.shelves[1]).toMatchObject({
          ...newShelf,
          bookCount: 0,
          bookCoverIds: [],
        });
      });
    });

    test('should set loading state during creation', async () => {
      vi.mocked(shelfApi.create).mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve(mockShelf), 100))
      );

      const { result } = renderHook(() => useShelfManagement());

      act(() => {
        result.current.createShelf({ name: 'New Shelf' });
      });

      // Loading should be true immediately
      expect(result.current.loading).toBe(true);

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });
    });

    test('should handle creation errors', async () => {
      const error = new ApiError('Duplicate name', 409, '/api/shelves');
      vi.mocked(shelfApi.create).mockRejectedValue(error);

      const { result } = renderHook(() => useShelfManagement());

      await act(async () => {
        try {
          await result.current.createShelf({ name: 'Duplicate' });
        } catch {
          // Expected to throw
        }
      });

      await waitFor(() => {
        expect(result.current.error?.message).toBe('Duplicate name');
        expect(result.current.loading).toBe(false);
        expect(result.current.shelves).toHaveLength(0);
      });
    });

    test('should return created shelf', async () => {
      vi.mocked(shelfApi.create).mockResolvedValue(mockShelf);

      const { result } = renderHook(() => useShelfManagement());

      let createdShelf;
      await act(async () => {
        createdShelf = await result.current.createShelf({ name: 'New Shelf' });
      });

      expect(createdShelf).toEqual(mockShelf);
    });
  });

  describe('updateShelf', () => {
    test('should update shelf successfully', async () => {
      const updatedShelf: Shelf = {
        ...mockShelf,
        name: 'Updated Name',
        updatedAt: '2024-01-02T00:00:00.000Z',
      };

      vi.mocked(shelfApi.list).mockResolvedValue([mockShelfWithCovers]);
      vi.mocked(shelfApi.update).mockResolvedValue(updatedShelf);

      const { result } = renderHook(() => useShelfManagement());

      // First fetch shelves
      await act(async () => {
        await result.current.fetchShelves();
      });

      // Then update shelf
      await act(async () => {
        await result.current.updateShelf(1, { name: 'Updated Name' });
      });

      await waitFor(() => {
        expect(result.current.shelves).toHaveLength(1);
        expect(result.current.shelves[0].name).toBe('Updated Name');
        expect(result.current.loading).toBe(false);
        expect(result.current.error).toBeNull();
      });

      expect(shelfApi.update).toHaveBeenCalledWith(1, { name: 'Updated Name' });
    });

    test('should preserve bookCount and bookCoverIds on update', async () => {
      const updatedShelf: Shelf = {
        ...mockShelf,
        color: '#ef4444',
      };

      vi.mocked(shelfApi.list).mockResolvedValue([mockShelfWithCovers]);
      vi.mocked(shelfApi.update).mockResolvedValue(updatedShelf);

      const { result } = renderHook(() => useShelfManagement());

      await act(async () => {
        await result.current.fetchShelves();
      });

      await act(async () => {
        await result.current.updateShelf(1, { color: '#ef4444' });
      });

      await waitFor(() => {
        expect(result.current.shelves[0].bookCount).toBe(3);
        expect(result.current.shelves[0].bookCoverIds).toEqual([1, 2, 3]);
        expect(result.current.shelves[0].color).toBe('#ef4444');
      });
    });

    test('should handle update of non-existent shelf', async () => {
      vi.mocked(shelfApi.list).mockResolvedValue([mockShelfWithCovers]);
      vi.mocked(shelfApi.update).mockResolvedValue({
        id: 999,
        name: 'Updated',
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-02T00:00:00.000Z',
      });

      const { result } = renderHook(() => useShelfManagement());

      await act(async () => {
        await result.current.fetchShelves();
      });

      await act(async () => {
        await result.current.updateShelf(999, { name: 'Updated' });
      });

      // Should not update any shelf since ID doesn't match
      await waitFor(() => {
        expect(result.current.shelves).toHaveLength(1);
        expect(result.current.shelves[0].id).toBe(1);
        expect(result.current.shelves[0].name).toBe('Favorites');
      });
    });

    test('should handle update errors', async () => {
      const error = new ApiError('Shelf not found', 404, '/api/shelves/999');
      vi.mocked(shelfApi.list).mockResolvedValue([mockShelfWithCovers]);
      vi.mocked(shelfApi.update).mockRejectedValue(error);

      const { result } = renderHook(() => useShelfManagement());

      await act(async () => {
        await result.current.fetchShelves();
      });

      await act(async () => {
        try {
          await result.current.updateShelf(999, { name: 'Updated' });
        } catch {
          // Expected to throw
        }
      });

      await waitFor(() => {
        expect(result.current.error?.message).toBe('Shelf not found');
        expect(result.current.loading).toBe(false);
      });
    });

    test('should return updated shelf', async () => {
      const updatedShelf: Shelf = {
        ...mockShelf,
        name: 'Updated Name',
      };

      vi.mocked(shelfApi.update).mockResolvedValue(updatedShelf);

      const { result } = renderHook(() => useShelfManagement());

      let returnedShelf;
      await act(async () => {
        returnedShelf = await result.current.updateShelf(1, { name: 'Updated Name' });
      });

      expect(returnedShelf).toEqual(updatedShelf);
    });
  });

  describe('deleteShelf', () => {
    test('should delete shelf successfully', async () => {
      vi.mocked(shelfApi.list).mockResolvedValue([
        mockShelfWithCovers,
        { ...mockShelfWithCovers, id: 2, name: 'Another Shelf' },
      ]);
      vi.mocked(shelfApi.delete).mockResolvedValue({ deleted: true });

      const { result } = renderHook(() => useShelfManagement());

      // First fetch shelves
      await act(async () => {
        await result.current.fetchShelves();
      });

      expect(result.current.shelves).toHaveLength(2);

      // Then delete shelf
      await act(async () => {
        await result.current.deleteShelf(1);
      });

      await waitFor(() => {
        expect(result.current.shelves).toHaveLength(1);
        expect(result.current.shelves[0].id).toBe(2);
        expect(result.current.loading).toBe(false);
        expect(result.current.error).toBeNull();
      });

      expect(shelfApi.delete).toHaveBeenCalledWith(1);
    });

    test('should remove correct shelf from list', async () => {
      const shelf1: ShelfWithBookCountAndCovers = {
        ...mockShelfWithCovers,
        id: 1,
        name: 'Shelf 1',
      };
      const shelf2: ShelfWithBookCountAndCovers = {
        ...mockShelfWithCovers,
        id: 2,
        name: 'Shelf 2',
      };
      const shelf3: ShelfWithBookCountAndCovers = {
        ...mockShelfWithCovers,
        id: 3,
        name: 'Shelf 3',
      };

      vi.mocked(shelfApi.list).mockResolvedValue([shelf1, shelf2, shelf3]);
      vi.mocked(shelfApi.delete).mockResolvedValue({ deleted: true });

      const { result } = renderHook(() => useShelfManagement());

      await act(async () => {
        await result.current.fetchShelves();
      });

      // Delete middle shelf
      await act(async () => {
        await result.current.deleteShelf(2);
      });

      await waitFor(() => {
        expect(result.current.shelves).toHaveLength(2);
        expect(result.current.shelves[0].id).toBe(1);
        expect(result.current.shelves[1].id).toBe(3);
      });
    });

    test('should handle deletion of non-existent shelf', async () => {
      vi.mocked(shelfApi.list).mockResolvedValue([mockShelfWithCovers]);
      vi.mocked(shelfApi.delete).mockResolvedValue({ deleted: true });

      const { result } = renderHook(() => useShelfManagement());

      await act(async () => {
        await result.current.fetchShelves();
      });

      // Delete non-existent shelf
      await act(async () => {
        await result.current.deleteShelf(999);
      });

      // Shelf list should remain unchanged
      await waitFor(() => {
        expect(result.current.shelves).toHaveLength(1);
        expect(result.current.shelves[0].id).toBe(1);
      });
    });

    test('should handle delete errors', async () => {
      const error = new ApiError('Shelf not found', 404, '/api/shelves/999');
      vi.mocked(shelfApi.list).mockResolvedValue([mockShelfWithCovers]);
      vi.mocked(shelfApi.delete).mockRejectedValue(error);

      const { result } = renderHook(() => useShelfManagement());

      await act(async () => {
        await result.current.fetchShelves();
      });

      await act(async () => {
        try {
          await result.current.deleteShelf(999);
        } catch {
          // Expected to throw
        }
      });

      await waitFor(() => {
        expect(result.current.error?.message).toBe('Shelf not found');
        expect(result.current.loading).toBe(false);
        // Shelf list should remain unchanged
        expect(result.current.shelves).toHaveLength(1);
      });
    });

    test('should return true on successful deletion', async () => {
      vi.mocked(shelfApi.delete).mockResolvedValue({ deleted: true });

      const { result } = renderHook(() => useShelfManagement());

      let deleteResult;
      await act(async () => {
        deleteResult = await result.current.deleteShelf(1);
      });

      expect(deleteResult).toBe(true);
    });
  });

  describe('error handling', () => {
    test('should clear error state on successful operation after error', async () => {
      const error = new ApiError('Network error', 0, '/api/shelves');
      vi.mocked(shelfApi.list).mockRejectedValueOnce(error);
      vi.mocked(shelfApi.list).mockResolvedValueOnce([mockShelfWithCovers]);

      const { result } = renderHook(() => useShelfManagement());

      // First fetch fails
      await act(async () => {
        try {
          await result.current.fetchShelves();
        } catch {
          // Expected to throw
        }
      });

      await waitFor(() => {
        expect(result.current.error).toBeTruthy();
      });

      // Second fetch succeeds
      await act(async () => {
        await result.current.fetchShelves();
      });

      await waitFor(() => {
        expect(result.current.error).toBeNull();
        expect(result.current.shelves).toHaveLength(1);
      });
    });

    test('should handle ApiError with details', async () => {
      const errorDetails = {
        error: 'Validation failed',
        fields: ['name'],
      };
      const error = new ApiError('Validation error', 400, '/api/shelves', errorDetails);
      vi.mocked(shelfApi.create).mockRejectedValue(error);

      const { result } = renderHook(() => useShelfManagement());

      await act(async () => {
        try {
          await result.current.createShelf({ name: '' });
        } catch {
          // Expected to throw
        }
      });

      await waitFor(() => {
        expect(result.current.error?.message).toBe('Validation error');
      });
    });
  });

  describe('loading state', () => {
    test('should manage loading state correctly for concurrent operations', async () => {
      vi.mocked(shelfApi.list).mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve([mockShelfWithCovers]), 50))
      );
      vi.mocked(shelfApi.create).mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve(mockShelf), 50))
      );

      const { result } = renderHook(() => useShelfManagement());

      // Start fetch
      act(() => {
        result.current.fetchShelves();
      });

      expect(result.current.loading).toBe(true);

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Start create
      act(() => {
        result.current.createShelf({ name: 'New Shelf' });
      });

      expect(result.current.loading).toBe(true);

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });
    });
  });
});
