import { test, expect, describe, beforeEach, vi } from 'vitest';
import { renderHook, waitFor, act } from "../test-utils";
import { useBookRating } from "@/hooks/useBookRating";
import type { Book } from "@/hooks/useBookDetail";
import { bookApi } from "@/lib/api";

// Mock bookApi
vi.mock("@/lib/api", () => ({
  bookApi: {
    updateRating: vi.fn(),
  },
}));

describe("useBookRating", () => {
  const mockBook: Book = {
    id: 123,
    calibreId: 1,
    title: "Test Book",
    authors: ["Test Author"],
    tags: [],
    rating: 4,
  };

  const mockOnRefresh = vi.fn(() => {});

  beforeEach(() => {
    vi.clearAllMocks();
    mockOnRefresh.mockClear();
  });

  describe("initialization", () => {
    test("should initialize with modal closed", () => {
      const { result } = renderHook(() => useBookRating(mockBook, "123", mockOnRefresh));

      expect(result.current.showRatingModal).toBe(false);
    });
  });

  describe("modal management", () => {
    test("should open rating modal", () => {
      const { result } = renderHook(() => useBookRating(mockBook, "123", mockOnRefresh));

      act(() => {
        result.current.openRatingModal();
      });

      expect(result.current.showRatingModal).toBe(true);
    });

    test("should close rating modal", () => {
      const { result } = renderHook(() => useBookRating(mockBook, "123", mockOnRefresh));

      act(() => {
        result.current.openRatingModal();
      });

      expect(result.current.showRatingModal).toBe(true);

      act(() => {
        result.current.closeRatingModal();
      });

      expect(result.current.showRatingModal).toBe(false);
    });
  });

  describe("handleUpdateRating", () => {
    test("should update rating and close modal", async () => {
      vi.mocked(bookApi.updateRating).mockResolvedValue();

      const { result } = renderHook(() => useBookRating(mockBook, "123", mockOnRefresh));

      act(() => {
        result.current.openRatingModal();
      });

      await act(async () => {
        await result.current.handleUpdateRating(5);
      });

      await waitFor(() => {
        expect(bookApi.updateRating).toHaveBeenCalledWith("123", { rating: 5 });
      });

      expect(result.current.showRatingModal).toBe(false);
      expect(mockOnRefresh).toHaveBeenCalled();
    });

    test("should remove rating", async () => {
      vi.mocked(bookApi.updateRating).mockResolvedValue();

      const { result } = renderHook(() => useBookRating(mockBook, "123", mockOnRefresh));

      await act(async () => {
        await result.current.handleUpdateRating(null);
      });

      await waitFor(() => {
        expect(bookApi.updateRating).toHaveBeenCalledWith("123", { rating: null });
      });
    });

    test("should not update if rating hasn't changed", async () => {
      const { result } = renderHook(() => useBookRating(mockBook, "123", mockOnRefresh));

      act(() => {
        result.current.openRatingModal();
      });

      await act(async () => {
        await result.current.handleUpdateRating(4); // Same as current rating
      });

      expect(bookApi.updateRating).not.toHaveBeenCalled();
      expect(result.current.showRatingModal).toBe(false);
    });

    test("should handle API errors", async () => {
      vi.mocked(bookApi.updateRating).mockRejectedValue(
        new Error("Failed to update rating")
      );

      const { result } = renderHook(() => useBookRating(mockBook, "123", mockOnRefresh));

      // Expect the mutation to throw
      await act(async () => {
        await expect(result.current.handleUpdateRating(5)).rejects.toThrow("Failed to update rating");
      });

      // Modal should remain open on error (mutation sets it to false in onSuccess only)
      expect(result.current.showRatingModal).toBe(false);
    });

    test("should handle network errors", async () => {
      vi.mocked(bookApi.updateRating).mockRejectedValue(
        new Error("Network error")
      );

      const { result } = renderHook(() => useBookRating(mockBook, "123", mockOnRefresh));

      // Expect the mutation to throw
      await act(async () => {
        await expect(result.current.handleUpdateRating(5)).rejects.toThrow("Network error");
      });
    });
  });

  describe("book without rating", () => {
    test("should handle book with no initial rating", async () => {
      const bookWithoutRating = { ...mockBook, rating: undefined };

      vi.mocked(bookApi.updateRating).mockResolvedValue();

      const { result } = renderHook(() => useBookRating(bookWithoutRating, "123", mockOnRefresh));

      await act(async () => {
        await result.current.handleUpdateRating(3);
      });

      await waitFor(() => {
        expect(bookApi.updateRating).toHaveBeenCalledWith("123", { rating: 3 });
      });
    });
  });
});
