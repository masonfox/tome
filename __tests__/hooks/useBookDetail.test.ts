import { test, expect, describe, beforeEach, vi } from 'vitest';
import { renderHook, waitFor, act } from "../test-utils";
import { useBookDetail } from "@/hooks/useBookDetail";
import { bookApi } from "@/lib/api";

// Mock bookApi
vi.mock("@/lib/api", () => ({
  bookApi: {
    getDetail: vi.fn(),
    updateBook: vi.fn(),
    updateTags: vi.fn(),
  },
}));

describe("useBookDetail", () => {
  beforeEach(() => {
    // Reset mocks before each test
    vi.clearAllMocks();
  });

  describe("initialization", () => {
    test("should start with loading state", () => {
      vi.mocked(bookApi.getDetail).mockImplementation(() => new Promise(() => {}));
      
      const { result } = renderHook(() => useBookDetail("123"));

      expect(result.current.loading).toBe(true);
      expect(result.current.book).toBeNull();
      expect(result.current.imageError).toBe(false);
    });

    test("should fetch book data on mount", async () => {
      const mockBook = {
        id: 123,
        calibreId: 1,
        title: "Test Book",
        authors: ["Test Author"],
        tags: [],
        totalPages: 300,
      };

      vi.mocked(bookApi.getDetail).mockResolvedValue(mockBook);

      const { result } = renderHook(() => useBookDetail("123"));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.book).toEqual(mockBook);
      expect(bookApi.getDetail).toHaveBeenCalledWith("123");
    });

    test("should handle fetch errors gracefully", async () => {
      vi.mocked(bookApi.getDetail).mockRejectedValue(new Error("Network error"));

      const { result } = renderHook(() => useBookDetail("123"));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.book).toBeNull();
      expect(result.current.error).toBeTruthy();
    });
  });

  describe("refetchBook", () => {
    test("should refetch book data when called", async () => {
      const mockBook1 = {
        id: 123,
        calibreId: 1,
        title: "Test Book",
        authors: ["Test Author"],
        tags: [],
      };

      const mockBook2 = {
        ...mockBook1,
        totalPages: 400,
      };

      vi.mocked(bookApi.getDetail)
        .mockResolvedValueOnce(mockBook1)
        .mockResolvedValueOnce(mockBook2);

      const { result } = renderHook(() => useBookDetail("123"));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.book?.totalPages).toBeUndefined();

      // Refetch
      await act(async () => {
        await result.current.refetchBook();
      });

      await waitFor(() => {
        expect(result.current.book?.totalPages).toBe(400);
      });

      expect(bookApi.getDetail).toHaveBeenCalledTimes(2);
    });
  });

  describe("updateTotalPages", () => {
    test("should optimistically update book total pages", async () => {
      const mockBook = {
        id: 123,
        calibreId: 1,
        title: "Test Book",
        authors: ["Test Author"],
        tags: [],
      };

      const updatedBook = { ...mockBook, totalPages: 350 };

      vi.mocked(bookApi.getDetail)
        .mockResolvedValueOnce(mockBook)
        .mockResolvedValueOnce(updatedBook);
      
      vi.mocked(bookApi.updateBook).mockResolvedValue({
        success: true,
        book: updatedBook,
      });

      const { result } = renderHook(() => useBookDetail("123"));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.book?.totalPages).toBeUndefined();

      // Update total pages
      await act(async () => {
        await result.current.updateTotalPages(350);
      });

      // Wait for update to complete (mutation + refetch)
      await waitFor(() => {
        expect(result.current.book?.totalPages).toBe(350);
      }, { timeout: 2000 });

      // Verify updateBook was called with correct payload
      expect(bookApi.updateBook).toHaveBeenCalledWith("123", { totalPages: 350 });
    });

    test("should handle update errors", async () => {
      const mockBook = {
        id: 123,
        calibreId: 1,
        title: "Test Book",
        authors: ["Test Author"],
        tags: [],
      };

      vi.mocked(bookApi.getDetail).mockResolvedValue(mockBook);
      vi.mocked(bookApi.updateBook).mockRejectedValue(new Error("Update failed"));

      const { result } = renderHook(() => useBookDetail("123"));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Attempt update - expect it to throw
      await expect(result.current.updateTotalPages(350)).rejects.toThrow("Update failed");
    });
  });

  describe("updateTags", () => {
    test("should optimistically update book tags", async () => {
      const mockBook = {
        id: 123,
        calibreId: 1,
        title: "Test Book",
        authors: ["Test Author"],
        tags: ["old-tag"],
      };

      const newTags = ["fiction", "fantasy"];
      const updatedBook = { ...mockBook, tags: newTags };

      vi.mocked(bookApi.getDetail)
        .mockResolvedValueOnce(mockBook)
        .mockResolvedValueOnce(updatedBook);
      
      vi.mocked(bookApi.updateTags).mockResolvedValue({
        success: true,
        book: updatedBook,
      });

      const { result } = renderHook(() => useBookDetail("123"));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.book?.tags).toEqual(["old-tag"]);

      // Update tags
      await act(async () => {
        await result.current.updateTags(newTags);
      });

      // Wait for update to complete (mutation + refetch)
      await waitFor(() => {
        expect(result.current.book?.tags).toEqual(newTags);
      }, { timeout: 2000 });

      // Verify updateTags was called with correct payload
      expect(bookApi.updateTags).toHaveBeenCalledWith("123", { tags: newTags });
    });

    test("should rollback on error", async () => {
      const mockBook = {
        id: 123,
        calibreId: 1,
        title: "Test Book",
        authors: ["Test Author"],
        tags: ["original-tag"],
      };

      vi.mocked(bookApi.getDetail).mockResolvedValue(mockBook);
      vi.mocked(bookApi.updateTags).mockRejectedValue(new Error("Update failed"));

      const { result } = renderHook(() => useBookDetail("123"));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.book?.tags).toEqual(["original-tag"]);

      // Attempt update - expect it to throw
      await expect(result.current.updateTags(["new-tag"])).rejects.toThrow("Update failed");

      // Verify tags reverted to original value
      await waitFor(() => {
        expect(result.current.book?.tags).toEqual(["original-tag"]);
      });
    });

    test("should handle empty tags array", async () => {
      const mockBook = {
        id: 123,
        calibreId: 1,
        title: "Test Book",
        authors: ["Test Author"],
        tags: ["tag1", "tag2"],
      };

      const updatedBook = { ...mockBook, tags: [] };

      vi.mocked(bookApi.getDetail)
        .mockResolvedValueOnce(mockBook)
        .mockResolvedValueOnce(updatedBook);
      
      vi.mocked(bookApi.updateTags).mockResolvedValue({
        success: true,
        book: updatedBook,
      });

      const { result } = renderHook(() => useBookDetail("123"));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.book?.tags).toEqual(["tag1", "tag2"]);

      // Clear all tags by passing empty array
      await act(async () => {
        await result.current.updateTags([]);
      });

      await waitFor(() => {
        expect(result.current.book?.tags).toEqual([]);
      }, { timeout: 2000 });

      // Verify updateTags was called with empty array
      expect(bookApi.updateTags).toHaveBeenCalledWith("123", { tags: [] });
    });

    test("should refetch book data after successful update", async () => {
      const mockBook = {
        id: 123,
        calibreId: 1,
        title: "Test Book",
        authors: ["Test Author"],
        tags: ["old-tag"],
      };

      const updatedBook = { ...mockBook, tags: ["new-tag"] };

      vi.mocked(bookApi.getDetail)
        .mockResolvedValueOnce(mockBook)
        .mockResolvedValueOnce(updatedBook);
      
      vi.mocked(bookApi.updateTags).mockResolvedValue({
        success: true,
        book: updatedBook,
      });

      const { result } = renderHook(() => useBookDetail("123"));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const initialCallCount = vi.mocked(bookApi.getDetail).mock.calls.length;

      // Update tags
      await act(async () => {
        await result.current.updateTags(["new-tag"]);
      });

      await waitFor(() => {
        expect(result.current.book?.tags).toEqual(["new-tag"]);
      });

      // Verify that book was refetched after update
      expect(bookApi.getDetail).toHaveBeenCalledTimes(initialCallCount + 1);
    });
  });

  describe("imageError", () => {
    test("should provide setImageError function", () => {
      vi.mocked(bookApi.getDetail).mockImplementation(() => new Promise(() => {}));
      
      const { result } = renderHook(() => useBookDetail("123"));

      expect(result.current.imageError).toBe(false);

      act(() => {
        result.current.setImageError(true);
      });

      expect(result.current.imageError).toBe(true);
    });
  });

  describe("bookId changes", () => {
    test("should refetch when bookId changes", async () => {
      const mockBook1 = {
        id: 123,
        calibreId: 1,
        title: "Book 1",
        authors: ["Author 1"],
        tags: [],
      };

      const mockBook2 = {
        id: 456,
        calibreId: 2,
        title: "Book 2",
        authors: ["Author 2"],
        tags: [],
      };

      vi.mocked(bookApi.getDetail).mockImplementation((id) => {
        if (id === "123") return Promise.resolve(mockBook1);
        return Promise.resolve(mockBook2);
      });

      const { result, rerender } = renderHook(
        ({ id }) => useBookDetail(id),
        { initialProps: { id: "123" } }
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.book?.title).toBe("Book 1");

      // Change bookId
      rerender({ id: "456" });

      await waitFor(() => {
        expect(result.current.book?.title).toBe("Book 2");
      });
    });
  });
});
