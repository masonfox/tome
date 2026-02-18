import { useState, useCallback, useMemo } from "react";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { libraryService, LibraryFilters } from "@/lib/library-service";

const BOOKS_PER_PAGE = 50;

export function useLibraryData(initialFilters?: Partial<LibraryFilters>) {
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState<LibraryFilters>({
    pagination: {
      limit: BOOKS_PER_PAGE,
      skip: 0,
    },
    sortBy: 'created', // Default to 'created' (newest first based on repository implementation)
    ...initialFilters,
  });

  // Memoize service instance to prevent recreation
  const service = useMemo(() => libraryService, []);

  // Create a stable query key based on filter values (excluding pagination.skip)
  const queryKey = useMemo(() => [
    'library-books',
    filters.status,
    filters.search,
    filters.tags,
    filters.rating,
    filters.shelf,
    filters.sources, // T052: Add sources to query key
    filters.sortBy,
    filters.showOrphaned,
    filters.noTags,
    filters.pagination.limit,
  ], [
    filters.status,
    filters.search,
    filters.tags,
    filters.rating,
    filters.shelf,
    filters.sources, // T052: Add sources to query key
    filters.sortBy,
    filters.showOrphaned,
    filters.noTags,
    filters.pagination.limit,
  ]);

  // Use TanStack Query's infinite query
  const {
    data,
    isLoading,
    isFetchingNextPage,
    error,
    fetchNextPage,
    hasNextPage,
  } = useInfiniteQuery({
    queryKey,
    queryFn: async ({ pageParam = 0 }) => {
      const result = await service.getBooks({
        ...filters,
        pagination: {
          ...filters.pagination,
          skip: pageParam,
        },
      });
      return result;
    },
    getNextPageParam: (lastPage) => {
      if (!lastPage.hasMore) return undefined;
      return lastPage.skip + lastPage.limit;
    },
    initialPageParam: 0,
    // Refetch when data is stale on mount or window focus (e.g., back navigation)
    refetchOnMount: true,
    refetchOnWindowFocus: true,
  });

  // Flatten pages into a single books array
  const books = useMemo(() => {
    if (!data) return [];
    return data.pages.flatMap(page => page.books);
  }, [data]);

  const total = data?.pages[0]?.total || 0;

  // Update filters function
  const updateFilters = useCallback((newFilters: Partial<LibraryFilters>) => {
    setFilters(prev => {
      const updated = {
        ...prev,
        ...newFilters,
        pagination: {
          ...prev.pagination,
          ...newFilters.pagination,
        },
      };

      // Reset pagination when core filters change
      if (
        newFilters.status !== undefined ||
        newFilters.search !== undefined ||
        newFilters.tags !== undefined ||
        newFilters.rating !== undefined ||
        newFilters.shelf !== undefined ||
        newFilters.sources !== undefined || // T052: Reset pagination when sources change
        newFilters.sortBy !== undefined ||
        newFilters.noTags !== undefined
      ) {
        updated.pagination.skip = 0;
      }

      return updated;
    });
  }, []);

  // Load more function for infinite scroll
  const loadMore = useCallback(async () => {
    if (isFetchingNextPage || !hasNextPage) {
      return;
    }
    await fetchNextPage();
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);

  // Reset pagination (useful for filter changes)
  const resetPagination = useCallback(() => {
    setFilters(prev => ({
      ...prev,
      pagination: {
        ...prev.pagination,
        skip: 0,
      },
    }));
  }, []);

  // Clear cache and refresh
  const refresh = useCallback(async () => {
    service.clearCache();
    await queryClient.refetchQueries({ queryKey: ['library-books'] });
  }, [service, queryClient]);

  // Search function with debouncing logic
  const setSearch = useCallback((search: string) => {
    updateFilters({ search });
  }, [updateFilters]);

  // Status filter function
  const setStatus = useCallback((status: string | undefined) => {
    updateFilters({ status });
  }, [updateFilters]);

  // Tags filter function
  const setTags = useCallback((tags: string[] | undefined) => {
    updateFilters({ tags });
  }, [updateFilters]);

  // Rating filter function
  const setRating = useCallback((rating: string | undefined) => {
    updateFilters({ rating });
  }, [updateFilters]);

  // Shelf filter function
  const setShelf = useCallback((shelf: number | undefined) => {
    updateFilters({ shelf });
  }, [updateFilters]);

  // Sort function
  const setSortBy = useCallback((sortBy: string | undefined) => {
    updateFilters({ sortBy });
  }, [updateFilters]);

  // No tags filter function
  const setNoTags = useCallback((noTags: boolean | undefined) => {
    updateFilters({ noTags });
  }, [updateFilters]);

  // Sources filter function - T052
  const setSources = useCallback((sources: string[] | undefined) => {
    updateFilters({ sources });
  }, [updateFilters]);

  // Pagination functions
  const setLimit = useCallback((limit: number) => {
    updateFilters({ pagination: { limit, skip: filters.pagination.skip } });
  }, [updateFilters, filters.pagination.skip]);

  const setSkip = useCallback((skip: number) => {
    updateFilters({ pagination: { skip, limit: filters.pagination.limit } });
  }, [updateFilters, filters.pagination.limit]);

  return {
    // Data
    books,
    total,
    hasMore: hasNextPage || false,
    loading: isLoading,
    loadingMore: isFetchingNextPage,
    error: error ? (error instanceof Error ? error.message : "Failed to fetch books") : null,
    
    // Actions
    updateFilters,
    loadMore,
    refresh,
    resetPagination,
    
    // Specific setters
    setSearch,
    setStatus,
    setTags,
    setRating,
    setShelf,
    setSortBy,
    setNoTags,
    setSources, // T052: Export setSources
    setLimit,
    setSkip,

    // Current filters
    filters,
  };
}

export type UseLibraryDataReturn = ReturnType<typeof useLibraryData>;
