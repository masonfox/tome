import { useState, useEffect, useCallback, useMemo } from "react";
import { libraryService, LibraryFilters, PaginatedBooks, BookWithStatus } from "@/lib/library-service";

const BOOKS_PER_PAGE = 50;

export function useLibraryData(initialFilters?: Partial<LibraryFilters>) {
  const [filters, setFilters] = useState<LibraryFilters>({
    pagination: {
      limit: BOOKS_PER_PAGE,
      skip: 0,
    },
    sortBy: 'createdAt', // Use createdAt sorting for consistent pagination
    ...initialFilters,
  });

  const [data, setData] = useState<PaginatedBooks | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Memoize service instance to prevent recreation
  const service = useMemo(() => libraryService, []);

  // Fetch books when filters change (but NOT pagination)
  useEffect(() => {
    let isCancelled = false;

    const fetchData = async () => {
      setLoading(true);
      setError(null);
      
      try {
        const result = await service.getBooks(filters);
        
        if (!isCancelled) {
          setData(result);
        }
      } catch (err) {
        if (!isCancelled) {
          setError(err instanceof Error ? err.message : "Failed to fetch books");
        }
      } finally {
        if (!isCancelled) {
          setLoading(false);
        }
      }
    };

    fetchData();

    return () => {
      isCancelled = true;
    };
  }, [filters.status, filters.search, filters.tags, filters.sortBy, filters.showOrphaned, filters.pagination.limit, service]);

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
        newFilters.sortBy !== undefined
      ) {
        updated.pagination.skip = 0;
      }

      return updated;
    });
  }, []);

  // Load more function for infinite scroll
  const loadMore = useCallback(async () => {
    if (!data || loading || loadingMore || !data.hasMore) {
      return;
    }

    setLoadingMore(true);
    setError(null);

    try {
      const nextSkip = filters.pagination.skip + filters.pagination.limit;
      const nextFilters = {
        ...filters,
        pagination: {
          ...filters.pagination,
          skip: nextSkip,
        },
      };

      const result = await service.getBooks(nextFilters);
      
      setData(prev => prev ? {
        ...result,
        books: [...prev.books, ...result.books],
      } : result);

      // Update pagination without triggering full re-fetch
      setFilters(prev => ({
        ...prev,
        pagination: {
          ...prev.pagination,
          skip: nextSkip,
        },
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load more books");
    } finally {
      setLoadingMore(false);
    }
  }, [data, loading, loadingMore, filters, service]);

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
    setFilters(prev => ({ ...prev })); // Trigger re-fetch
  }, [service]);

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

  // Sort function
  const setSortBy = useCallback((sortBy: string | undefined) => {
    updateFilters({ sortBy });
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
    books: data?.books || [],
    total: data?.total || 0,
    hasMore: data?.hasMore || false,
    loading,
    loadingMore,
    error,
    
    // Actions
    updateFilters,
    loadMore,
    refresh,
    resetPagination,
    
    // Specific setters
    setSearch,
    setStatus,
    setTags,
    setSortBy,
    setLimit,
    setSkip,
    
    // Current filters
    filters,
  };
}

export type UseLibraryDataReturn = ReturnType<typeof useLibraryData>;