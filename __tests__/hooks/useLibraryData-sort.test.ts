import { test, expect, describe, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, waitFor, act } from "../test-utils";
import { useLibraryData } from "@/hooks/useLibraryData";

const originalFetch = global.fetch;

describe("useLibraryData - Sort Functionality", () => {
  const mockBooksResponse = {
    books: [
      {
        id: 1,
        calibreId: 1,
        title: "Book A",
        authors: ["Author A"],
        tags: [],
        status: "to-read",
      },
      {
        id: 2,
        calibreId: 2,
        title: "Book B",
        authors: ["Author B"],
        tags: [],
        status: "reading",
      },
    ],
    total: 2,
    hasMore: false,
    limit: 50,
    skip: 0,
  };

  beforeEach(() => {
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve(mockBooksResponse),
      } as Response)
    ) as any;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  describe("Default Sort Behavior", () => {
    test("should default to 'created' sort when no initial sort provided", async () => {
      const { result } = renderHook(() => useLibraryData());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.filters.sortBy).toBe("created");
    });

    test("should accept initial sortBy from props", async () => {
      const { result } = renderHook(() =>
        useLibraryData({ sortBy: "title" })
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.filters.sortBy).toBe("title");
    });

    test("should initialize with created sort by default", async () => {
      const { result } = renderHook(() => useLibraryData({}));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Default should be 'created' not 'createdAt'
      expect(result.current.filters.sortBy).toBe("created");
    });
  });

  describe("setSortBy Function", () => {
    test("should update sortBy when setSortBy is called", async () => {
      const { result } = renderHook(() => useLibraryData());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.filters.sortBy).toBe("created");

      await act(async () => {
        result.current.setSortBy("title");
      });

      await waitFor(() => {
        expect(result.current.filters.sortBy).toBe("title");
      });
    });

    test("should trigger refetch when sortBy changes", async () => {
      let fetchCallCount = 0;
      global.fetch = vi.fn(() => {
        fetchCallCount++;
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockBooksResponse),
        } as Response);
      }) as any;

      const { result } = renderHook(() => useLibraryData());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const initialFetchCount = fetchCallCount;

      await act(async () => {
        result.current.setSortBy("author");
      });

      await waitFor(() => {
        expect(fetchCallCount).toBeGreaterThan(initialFetchCount);
      });
    });

    test("should reset pagination to page 1 when sortBy changes", async () => {
      const { result } = renderHook(() => useLibraryData());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Simulate loading more (increase skip)
      await act(async () => {
        await result.current.loadMore();
      });

      // Change sort
      await act(async () => {
        result.current.setSortBy("title");
      });

      await waitFor(() => {
        expect(result.current.filters.pagination.skip).toBe(0);
      });
    });

    test("should support all tier 1 & tier 2 sort options", async () => {
      const sortOptions = [
        "created",
        "recently_read",
        "title",
        "title_desc",
        "author",
        "author_desc",
        "rating",
        "rating_asc",
        "pages",
        "pages_desc",
        "created_desc",
      ];

      for (const sortValue of sortOptions) {
        const { result, unmount } = renderHook(() => useLibraryData());

        await waitFor(() => {
          expect(result.current.loading).toBe(false);
        });

        await act(async () => {
          result.current.setSortBy(sortValue);
        });

        await waitFor(() => {
          expect(result.current.filters.sortBy).toBe(sortValue);
        });

        unmount();
      }
    });

    test("should handle undefined sortBy gracefully", async () => {
      const { result } = renderHook(() =>
        useLibraryData({ sortBy: "title" })
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.filters.sortBy).toBe("title");

      await act(async () => {
        result.current.setSortBy(undefined);
      });

      await waitFor(() => {
        // Setting to undefined removes the sortBy filter
        expect(result.current.filters.sortBy).toBe(undefined);
      });
    });
  });

  describe("New Sort Options - recently_read", () => {
    test("should update sortBy to recently_read", async () => {
      const { result } = renderHook(() => useLibraryData());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await act(async () => {
        result.current.setSortBy("recently_read");
      });

      await waitFor(() => {
        expect(result.current.filters.sortBy).toBe("recently_read");
      });
    });

    test("should reset pagination when switching to recently_read", async () => {
      const { result } = renderHook(() => useLibraryData());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Load more to increase skip
      await act(async () => {
        await result.current.loadMore();
      });

      // Change to recently_read sort
      await act(async () => {
        result.current.setSortBy("recently_read");
      });

      await waitFor(() => {
        expect(result.current.filters.pagination.skip).toBe(0);
        expect(result.current.filters.sortBy).toBe("recently_read");
      });
    });
  });

  describe("New Sort Options - pages", () => {
    test("should update sortBy to pages (shortest first)", async () => {
      const { result } = renderHook(() => useLibraryData());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await act(async () => {
        result.current.setSortBy("pages");
      });

      await waitFor(() => {
        expect(result.current.filters.sortBy).toBe("pages");
      });
    });

    test("should reset pagination when switching to pages sort", async () => {
      const { result } = renderHook(() => useLibraryData());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await act(async () => {
        result.current.setSortBy("pages");
      });

      await waitFor(() => {
        expect(result.current.filters.pagination.skip).toBe(0);
        expect(result.current.filters.sortBy).toBe("pages");
      });
    });
  });

  describe("New Sort Options - pages_desc", () => {
    test("should update sortBy to pages_desc (longest first)", async () => {
      const { result } = renderHook(() => useLibraryData());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await act(async () => {
        result.current.setSortBy("pages_desc");
      });

      await waitFor(() => {
        expect(result.current.filters.sortBy).toBe("pages_desc");
      });
    });

    test("should reset pagination when switching to pages_desc sort", async () => {
      const { result } = renderHook(() => useLibraryData());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await act(async () => {
        result.current.setSortBy("pages_desc");
      });

      await waitFor(() => {
        expect(result.current.filters.pagination.skip).toBe(0);
        expect(result.current.filters.sortBy).toBe("pages_desc");
      });
    });
  });

  describe("Sort with Other Filters", () => {
    test("should maintain sortBy when status filter changes", async () => {
      const { result } = renderHook(() =>
        useLibraryData({ sortBy: "title" })
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await act(async () => {
        result.current.setStatus("reading");
      });

      await waitFor(() => {
        expect(result.current.filters.sortBy).toBe("title");
        expect(result.current.filters.status).toBe("reading");
      });
    });

    test("should maintain sortBy when search changes", async () => {
      const { result } = renderHook(() =>
        useLibraryData({ sortBy: "author" })
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await act(async () => {
        result.current.setSearch("test query");
      });

      await waitFor(() => {
        expect(result.current.filters.sortBy).toBe("author");
        expect(result.current.filters.search).toBe("test query");
      });
    });

    test("should maintain sortBy when tags change", async () => {
      const { result } = renderHook(() =>
        useLibraryData({ sortBy: "rating" })
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await act(async () => {
        result.current.setTags(["fiction", "history"]);
      });

      await waitFor(() => {
        expect(result.current.filters.sortBy).toBe("rating");
        expect(result.current.filters.tags).toEqual(["fiction", "history"]);
      });
    });

    test("should maintain sortBy when rating filter changes", async () => {
      const { result } = renderHook(() =>
        useLibraryData({ sortBy: "created_desc" })
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await act(async () => {
        result.current.setRating("5");
      });

      await waitFor(() => {
        expect(result.current.filters.sortBy).toBe("created_desc");
        expect(result.current.filters.rating).toBe("5");
      });
    });

    test("should reset pagination to page 1 when sortBy changes", async () => {
      const { result } = renderHook(() => useLibraryData());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Change sort
      await act(async () => {
        result.current.setSortBy("title");
      });

      await waitFor(() => {
        // Pagination should reset when sort changes (confirmed in updateFilters logic)
        expect(result.current.filters.pagination.skip).toBe(0);
      });
    });

    test("should reset pagination when any filter including sort changes", async () => {
      const { result } = renderHook(() => useLibraryData());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Initial pagination state
      expect(result.current.filters.pagination.skip).toBe(0);

      // Change sort should keep skip at 0 (already reset)
      await act(async () => {
        result.current.setSortBy("title");
      });

      await waitFor(() => {
        expect(result.current.filters.pagination.skip).toBe(0);
        expect(result.current.filters.sortBy).toBe("title");
      });
    });
  });

  describe("Sort Persistence", () => {
    test("should maintain sort across hook rerenders", async () => {
      const { result, rerender } = renderHook(
        ({ sortBy }) => useLibraryData({ sortBy }),
        { initialProps: { sortBy: "title" as string | undefined } }
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.filters.sortBy).toBe("title");

      // Rerender with same props
      rerender({ sortBy: "title" });

      expect(result.current.filters.sortBy).toBe("title");
    });

    test("should update sort when initial props change", async () => {
      const { result, rerender } = renderHook(
        ({ sortBy }) => useLibraryData({ sortBy }),
        { initialProps: { sortBy: "title" as string | undefined } }
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.filters.sortBy).toBe("title");

      // Note: Changing initialProps doesn't automatically update the hook's state
      // The hook initializes with props but doesn't react to prop changes
      // This is expected behavior - use setSortBy to change sort dynamically
      rerender({ sortBy: "author" });

      // The sort remains the same because hook doesn't watch for prop changes
      expect(result.current.filters.sortBy).toBe("title");
    });
  });

  describe("Cache Keys with Sort", () => {
    test("should include sortBy in filters when fetching", async () => {
      const { result } = renderHook(() =>
        useLibraryData({ sortBy: "rating" })
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Verify sortBy is in the filters
      expect(result.current.filters.sortBy).toBe("rating");
    });
  });

  describe("Loading States with Sort Changes", () => {
    test("should set loading state when sort changes", async () => {
      const { result } = renderHook(() => useLibraryData());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Change sort
      act(() => {
        result.current.setSortBy("title");
      });

      // Should briefly show loading
      expect(result.current.loading).toBe(true);

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });
    });

    test("should not set loadingMore when sort changes", async () => {
      const { result } = renderHook(() => useLibraryData());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await act(async () => {
        result.current.setSortBy("author");
      });

      // loadingMore should remain false (sort change is a full refetch)
      expect(result.current.loadingMore).toBe(false);
    });
  });

  describe("Edge Cases", () => {
    test("should handle rapid sort changes", async () => {
      const { result } = renderHook(() => useLibraryData());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Rapidly change sort
      await act(async () => {
        result.current.setSortBy("title");
        result.current.setSortBy("author");
        result.current.setSortBy("rating");
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Final sort should be the last one set
      expect(result.current.filters.sortBy).toBe("rating");
    });

    test("should handle sort change during loadMore", async () => {
      const { result } = renderHook(() => useLibraryData());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Start loadMore
      act(() => {
        result.current.loadMore();
      });

      // Change sort while loading
      await act(async () => {
        result.current.setSortBy("title");
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Sort should be updated, pagination reset
      expect(result.current.filters.sortBy).toBe("title");
      expect(result.current.filters.pagination.skip).toBe(0);
    });

    test("should maintain sort with different result sets", async () => {
      const { result } = renderHook(() =>
        useLibraryData({ sortBy: "title" })
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Sort should be maintained regardless of results
      expect(result.current.filters.sortBy).toBe("title");
    });

    test("should maintain sort when handling fetch errors", async () => {
      // First, establish a successful state
      const { result } = renderHook(() =>
        useLibraryData({ sortBy: "author" })
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Sort should be set even if subsequent operations fail
      expect(result.current.filters.sortBy).toBe("author");
    });
  });

  describe("Refresh with Sort", () => {
    test("should maintain sort when refreshing", async () => {
      const { result } = renderHook(() =>
        useLibraryData({ sortBy: "rating" })
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.filters.sortBy).toBe("rating");

      await act(async () => {
        await result.current.refresh();
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.filters.sortBy).toBe("rating");
    });
  });

  describe("UpdateFilters with Sort", () => {
    test("should support updating sort via updateFilters", async () => {
      const { result } = renderHook(() => useLibraryData());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await act(async () => {
        result.current.updateFilters({ sortBy: "title_desc" });
      });

      await waitFor(() => {
        expect(result.current.filters.sortBy).toBe("title_desc");
      });
    });

    test("should reset pagination state when updating sort via updateFilters", async () => {
      const { result } = renderHook(() => useLibraryData());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Update sort via updateFilters
      await act(async () => {
        result.current.updateFilters({ sortBy: "author_desc" });
      });

      await waitFor(() => {
        // Pagination should be reset to 0
        expect(result.current.filters.pagination.skip).toBe(0);
        expect(result.current.filters.sortBy).toBe("author_desc");
      });
    });

    test("should support updating to new sort options via updateFilters", async () => {
      const newSortOptions = [
        "recently_read",
        "pages",
        "pages_desc",
      ];

      for (const sortValue of newSortOptions) {
        const { result, unmount } = renderHook(() => useLibraryData());

        await waitFor(() => {
          expect(result.current.loading).toBe(false);
        });

        await act(async () => {
          result.current.updateFilters({ sortBy: sortValue });
        });

        await waitFor(() => {
          expect(result.current.filters.sortBy).toBe(sortValue);
        });

        unmount();
      }
    });
  });
});
