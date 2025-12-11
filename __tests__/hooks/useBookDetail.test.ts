import { test, expect, describe, beforeEach, afterEach, mock } from "bun:test";
import { renderHook, waitFor, act } from "@testing-library/react";
import { useBookDetail } from "@/hooks/useBookDetail";

// Mock fetch globally
const originalFetch = global.fetch;

describe("useBookDetail", () => {
  beforeEach(() => {
    // Reset mocks before each test
    global.fetch = mock(() => Promise.resolve({
      ok: true,
      json: () => Promise.resolve({}),
    } as Response));
  });

  afterEach(() => {
    // Restore original fetch
    global.fetch = originalFetch;
  });

  describe("initialization", () => {
    test("should start with loading state", () => {
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

      global.fetch = mock(() => Promise.resolve({
        ok: true,
        json: () => Promise.resolve(mockBook),
      } as Response));

      const { result } = renderHook(() => useBookDetail("123"));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.book).toEqual(mockBook);
      expect(global.fetch).toHaveBeenCalledWith("/api/books/123");
    });

    test("should handle fetch errors gracefully", async () => {
      const consoleErrorSpy = mock(console.error);
      console.error = consoleErrorSpy;

      global.fetch = mock(() => Promise.reject(new Error("Network error")));

      const { result } = renderHook(() => useBookDetail("123"));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.book).toBeNull();
      expect(consoleErrorSpy).toHaveBeenCalled();

      console.error = console.error;
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

      let callCount = 0;
      global.fetch = mock(() => {
        callCount++;
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(callCount === 1 ? mockBook1 : mockBook2),
        } as Response);
      });

      const { result } = renderHook(() => useBookDetail("123"));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.book?.totalPages).toBeUndefined();

      // Refetch
      result.current.refetchBook();

      await waitFor(() => {
        expect(result.current.book?.totalPages).toBe(400);
      });

      expect(callCount).toBe(2);
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

      let patchCalled = false;
      global.fetch = mock((url: string, options?: any) => {
        if (options?.method === "PATCH") {
          patchCalled = true;
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ success: true }),
          } as Response);
        }
        // GET requests
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockBook),
        } as Response);
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

      // Should optimistically update without refetch
      expect(result.current.book?.totalPages).toBe(350);

      // Verify PATCH was called with correct payload
      expect(patchCalled).toBe(true);
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/books/123",
        expect.objectContaining({
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ totalPages: 350 }),
        })
      );
    });

    test("should handle update errors", async () => {
      const consoleErrorSpy = mock(console.error);
      console.error = consoleErrorSpy;

      const mockBook = {
        id: 123,
        calibreId: 1,
        title: "Test Book",
        authors: ["Test Author"],
        tags: [],
      };

      global.fetch = mock((url: string, options?: any) => {
        if (options?.method === "PATCH") {
          return Promise.reject(new Error("Update failed"));
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockBook),
        } as Response);
      });

      const { result } = renderHook(() => useBookDetail("123"));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Attempt update
      await result.current.updateTotalPages(350);

      expect(consoleErrorSpy).toHaveBeenCalled();

      console.error = console.error;
    });
  });

  describe("imageError", () => {
    test("should provide setImageError function", () => {
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

      global.fetch = mock((url: string) => {
        if (url.includes("123")) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockBook1),
          } as Response);
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockBook2),
        } as Response);
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
