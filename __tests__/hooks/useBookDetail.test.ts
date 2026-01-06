import { test, expect, describe, beforeEach, afterEach, vi } from 'vitest';
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
    global.fetch = vi.fn(() => Promise.resolve({
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

      global.fetch = vi.fn(() => Promise.resolve({
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
      global.fetch = vi.fn(() => Promise.reject(new Error("Network error")));

      const { result } = renderHook(() => useBookDetail("123"));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.book).toBeNull();
      // TanStack Query doesn't log errors to console by default
      // Instead, check the error state
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

      let callCount = 0;
      global.fetch = vi.fn(() => {
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
      let bookData = { ...mockBook }; // Track current book state
      
      global.fetch = vi.fn((url: string, options?: any) => {
        if (options?.method === "PATCH") {
          patchCalled = true;
          // Update bookData when PATCH succeeds
          const body = JSON.parse(options.body);
          bookData = { ...bookData, ...body };
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ success: true }),
          } as Response);
        }
        // GET requests return current book state
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(bookData),
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

      // Wait for update to complete (mutation + refetch)
      await waitFor(() => {
        expect(result.current.book?.totalPages).toBe(350);
      }, { timeout: 2000 });

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
      const mockBook = {
        id: 123,
        calibreId: 1,
        title: "Test Book",
        authors: ["Test Author"],
        tags: [],
      };

      global.fetch = vi.fn((url: string, options?: any) => {
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

      let patchCalled = false;
      let bookData = { ...mockBook }; // Track current book state
      
      global.fetch = vi.fn((url: string, options?: any) => {
        if (options?.method === "PATCH" && url.includes("/tags")) {
          patchCalled = true;
          // Update bookData when PATCH succeeds
          const body = JSON.parse(options.body);
          bookData = { ...bookData, tags: body.tags };
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ success: true }),
          } as Response);
        }
        // GET requests return current book state
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(bookData),
        } as Response);
      });

      const { result } = renderHook(() => useBookDetail("123"));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.book?.tags).toEqual(["old-tag"]);

      // Update tags
      const newTags = ["fiction", "fantasy"];
      await act(async () => {
        await result.current.updateTags(newTags);
      });

      // Wait for update to complete (mutation + refetch)
      await waitFor(() => {
        expect(result.current.book?.tags).toEqual(newTags);
      }, { timeout: 2000 });

      // Verify PATCH was called with correct payload
      expect(patchCalled).toBe(true);
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/books/123/tags",
        expect.objectContaining({
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tags: newTags }),
        })
      );
    });

    test("should rollback on error", async () => {
      const mockBook = {
        id: 123,
        calibreId: 1,
        title: "Test Book",
        authors: ["Test Author"],
        tags: ["original-tag"],
      };

      global.fetch = vi.fn((url: string, options?: any) => {
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

      let bookData = { ...mockBook };
      
      global.fetch = vi.fn((url: string, options?: any) => {
        if (options?.method === "PATCH" && url.includes("/tags")) {
          const body = JSON.parse(options.body);
          bookData = { ...bookData, tags: body.tags };
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ success: true }),
          } as Response);
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(bookData),
        } as Response);
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

      // Verify PATCH was called with empty array
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/books/123/tags",
        expect.objectContaining({
          method: "PATCH",
          body: JSON.stringify({ tags: [] }),
        })
      );
    });

    test("should refetch book data after successful update", async () => {
      const mockBook = {
        id: 123,
        calibreId: 1,
        title: "Test Book",
        authors: ["Test Author"],
        tags: ["old-tag"],
      };

      let fetchCount = 0;
      let bookData = { ...mockBook };
      
      global.fetch = vi.fn((url: string, options?: any) => {
        if (options?.method === "PATCH" && url.includes("/tags")) {
          const body = JSON.parse(options.body);
          bookData = { ...bookData, tags: body.tags };
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ success: true }),
          } as Response);
        }
        // Count GET requests
        if (!options || options.method === "GET" || !options.method) {
          fetchCount++;
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(bookData),
        } as Response);
      });

      const { result } = renderHook(() => useBookDetail("123"));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const initialFetchCount = fetchCount;

      // Update tags
      await act(async () => {
        await result.current.updateTags(["new-tag"]);
      });

      await waitFor(() => {
        expect(result.current.book?.tags).toEqual(["new-tag"]);
      });

      // Verify that book was refetched after update (fetchCount increased)
      expect(fetchCount).toBeGreaterThan(initialFetchCount);
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

      let patchCalled = false;
      let bookData = { ...mockBook }; // Track current book state
      
      global.fetch = vi.fn((url: string, options?: any) => {
        if (options?.method === "PATCH" && url.includes("/tags")) {
          patchCalled = true;
          // Update bookData when PATCH succeeds
          const body = JSON.parse(options.body);
          bookData = { ...bookData, tags: body.tags };
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ success: true }),
          } as Response);
        }
        // GET requests return current book state
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(bookData),
        } as Response);
      });

      const { result } = renderHook(() => useBookDetail("123"));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.book?.tags).toEqual(["old-tag"]);

      // Update tags
      const newTags = ["fiction", "fantasy"];
      await act(async () => {
        await result.current.updateTags(newTags);
      });

      // Wait for update to complete (mutation + refetch)
      await waitFor(() => {
        expect(result.current.book?.tags).toEqual(newTags);
      }, { timeout: 2000 });

      // Verify PATCH was called with correct payload
      expect(patchCalled).toBe(true);
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/books/123/tags",
        expect.objectContaining({
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tags: newTags }),
        })
      );
    });

    test("should rollback on error", async () => {
      const mockBook = {
        id: 123,
        calibreId: 1,
        title: "Test Book",
        authors: ["Test Author"],
        tags: ["original-tag"],
      };

      global.fetch = vi.fn((url: string, options?: any) => {
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

      let bookData = { ...mockBook };
      
      global.fetch = vi.fn((url: string, options?: any) => {
        if (options?.method === "PATCH" && url.includes("/tags")) {
          const body = JSON.parse(options.body);
          bookData = { ...bookData, tags: body.tags };
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ success: true }),
          } as Response);
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(bookData),
        } as Response);
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

      // Verify PATCH was called with empty array
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/books/123/tags",
        expect.objectContaining({
          method: "PATCH",
          body: JSON.stringify({ tags: [] }),
        })
      );
    });

    test("should refetch book data after successful update", async () => {
      const mockBook = {
        id: 123,
        calibreId: 1,
        title: "Test Book",
        authors: ["Test Author"],
        tags: ["old-tag"],
      };

      let fetchCount = 0;
      let bookData = { ...mockBook };
      
      global.fetch = vi.fn((url: string, options?: any) => {
        if (options?.method === "PATCH" && url.includes("/tags")) {
          const body = JSON.parse(options.body);
          bookData = { ...bookData, tags: body.tags };
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ success: true }),
          } as Response);
        }
        // Count GET requests
        if (!options || options.method === "GET" || !options.method) {
          fetchCount++;
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(bookData),
        } as Response);
      });

      const { result } = renderHook(() => useBookDetail("123"));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const initialFetchCount = fetchCount;

      // Update tags
      await act(async () => {
        await result.current.updateTags(["new-tag"]);
      });

      await waitFor(() => {
        expect(result.current.book?.tags).toEqual(["new-tag"]);
      });

      // Verify that book was refetched after update (fetchCount increased)
      expect(fetchCount).toBeGreaterThan(initialFetchCount);
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

      global.fetch = vi.fn((url: string) => {
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
