"use client";

import { useEffect, useState, useRef, useCallback, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useLibraryData } from "@/hooks/useLibraryData";
import { libraryService } from "@/lib/library-service";
import { LibraryHeader } from "@/components/LibraryHeader";
import { LibraryFilters } from "@/components/LibraryFilters";
import { BookGrid } from "@/components/BookGrid";
import { toast } from "@/utils/toast";

function LibraryPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [isReady, setIsReady] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [availableTags, setAvailableTags] = useState<string[]>([]);
  const [searchInput, setSearchInput] = useState("");
  const observerTarget = useRef<HTMLDivElement>(null);

  // Parse initial filters from URL params
  useEffect(() => {
    if (!searchParams) {
      setIsReady(true);
      return;
    }

    const searchParam = searchParams.get("search");
    const statusParam = searchParams.get("status");
    const tagsParam = searchParams.get("tags");
    const ratingParam = searchParams.get("rating");

    if (searchParam) setSearchInput(searchParam);

    setIsReady(true);
  }, [searchParams]);

  // Function to update URL with current filters
  const updateURL = useCallback((currentFilters: any) => {
    const params = new URLSearchParams();
    
    if (currentFilters.search) {
      params.set('search', currentFilters.search);
    }
    if (currentFilters.status && currentFilters.status !== 'all') {
      params.set('status', currentFilters.status);
    }
    if (currentFilters.tags && currentFilters.tags.length > 0) {
      params.set('tags', currentFilters.tags.join(','));
    }
    if (currentFilters.rating && currentFilters.rating !== 'all') {
      params.set('rating', currentFilters.rating);
    }
    
    const queryString = params.toString();
    const newPath = queryString ? `/library?${queryString}` : '/library';
    
    router.replace(newPath);
  }, [router]);

  // Initialize useLibraryData hook with filters from URL
  const {
    books,
    total,
    hasMore,
    loading,
    loadingMore,
    error,
    loadMore,
    setSearch,
    setStatus,
    setTags,
    setRating,
    filters,
    refresh,
  } = useLibraryData({
    search: searchParams?.get("search") || undefined,
    status: searchParams?.get("status") || undefined,
    tags: searchParams?.get("tags")?.split(",").filter(Boolean) || undefined,
    rating: searchParams?.get("rating") || undefined,
  });

  // Performance monitoring - track page load times
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const startTime = performance.now();

    return () => {
      const loadTime = performance.now() - startTime;
      
      // Track slow page loads (over 1 second) in development
      if (loadTime > 1000 && process.env.NODE_ENV === 'development') {
        const perfData = {
          loadTimeMs: Math.round(loadTime),
          booksCount: books.length,
          hasFilters: !!(filters.search || filters.status || filters.tags?.length || filters.rating),
          total,
        };
        // Use performance API for client-side metrics
        if (window.performance && window.performance.mark) {
          window.performance.mark('library-page-slow-load');
        }
      }
    };
  }, [books.length, filters, total]);

  // Create wrapped setters that also update URL
  const handleStatusChange = useCallback((status: string | undefined) => {
    setStatus(status);
    updateURL({
      search: filters.search,
      status: status || 'all',
      tags: filters.tags || [],
      rating: filters.rating || 'all'
    });
  }, [setStatus, updateURL, filters.search, filters.tags, filters.rating]);

  const handleTagsChange = useCallback((tags: string[] | undefined) => {
    setTags(tags);
    updateURL({
      search: filters.search,
      status: filters.status || 'all',
      tags: tags || [],
      rating: filters.rating || 'all'
    });
  }, [setTags, updateURL, filters.search, filters.status, filters.rating]);

  const handleRatingChange = useCallback((rating: string | undefined) => {
    setRating(rating);
    updateURL({
      search: filters.search,
      status: filters.status || 'all',
      tags: filters.tags || [],
      rating: rating || 'all'
    });
  }, [setRating, updateURL, filters.search, filters.status, filters.tags]);

  // Handle search submission
  const handleSearchSubmit = useCallback(() => {
    if (!isReady) return;
    
    setSearch(searchInput);
    // Update URL with current filters including search
    updateURL({
      search: searchInput,
      status: filters.status || 'all',
      tags: filters.tags || [],
      rating: filters.rating || 'all'
    });
  }, [searchInput, setSearch, isReady, filters.status, filters.tags, filters.rating, updateURL]);

  // Handle search clear (X button)
  const handleSearchClear = useCallback(() => {
    if (!isReady) return;
    
    setSearch("");
    // Update URL to remove search parameter
    updateURL({
      search: "",
      status: filters.status || 'all',
      tags: filters.tags || [],
      rating: filters.rating || 'all'
    });
  }, [setSearch, isReady, filters.status, filters.tags, filters.rating, updateURL]);

  // Fetch available tags on mount
  useEffect(() => {
    async function fetchTags() {
      try {
        const tags = await libraryService.getAvailableTags();
        setAvailableTags(tags);
      } catch (error) {
        // Suppress console; toast used for user feedback
      }
    }
    fetchTags();
  }, []);

  // Set up intersection observer for infinite scroll
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loading) {
          loadMore();
        }
      },
      { threshold: 0.1 }
    );

    if (observerTarget.current) {
      observer.observe(observerTarget.current);
    }

    return () => observer.disconnect();
  }, [loadMore, hasMore, loading]);

  async function handleSync() {
    setSyncing(true);
    try {
      const result = await libraryService.syncCalibre();

      if (result.success) {
        toast.success(`Sync successful: ${result.syncedCount} new books, ${result.updatedCount} updated`);
        await refresh();
      } else {
        toast.error(`Sync failed: ${result.error}`);
      }
    } catch (error) {
      // Suppress console; toast provides user-visible error
      toast.error("Failed to sync with Calibre");
    } finally {
      setSyncing(false);
    }
  }

  function handleClearAll() {
    setSearchInput("");
    setSearch("");
    setStatus(undefined);
    setTags(undefined);
    setRating(undefined);
    
    // Update URL to remove all filter parameters
    router.replace('/library');
  }

  // During initial load, show skeleton UI with header and filters
  const isInitialLoading = loading && books.length === 0;

  return (
    <div className="space-y-6">
      <LibraryHeader
        totalBooks={isInitialLoading ? 0 : total}
        syncing={syncing}
        onSync={handleSync}
      />

      <LibraryFilters
        search={searchInput}
        onSearchChange={setSearchInput}
        onSearchSubmit={handleSearchSubmit}
        onSearchClear={handleSearchClear}
        statusFilter={filters.status || "all"}
        onStatusFilterChange={(status) => handleStatusChange(status === "all" ? undefined : status)}
        selectedTags={filters.tags || []}
        onTagsChange={(tags) => handleTagsChange(tags.length > 0 ? tags : undefined)}
        ratingFilter={filters.rating || "all"}
        onRatingFilterChange={(rating) => handleRatingChange(rating === "all" ? undefined : rating)}
        availableTags={availableTags}
        loading={isInitialLoading}
        onClearAll={handleClearAll}
      />

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded">
          {error}
        </div>
      )}

      <BookGrid
        books={books}
        loading={isInitialLoading}
        loadingMore={loadingMore}
      />

      {/* Infinite scroll trigger */}
      <div ref={observerTarget} className="py-8" />
    </div>
  );
}

export default function LibraryPage() {
  return (
    <Suspense fallback={
      <div className="text-center py-12">
        <div className="inline-block w-8 h-8 border-4 border-[var(--accent)] border-t-transparent rounded-full animate-spin"></div>
      </div>
    }>
      <LibraryPageContent />
    </Suspense>
  );
}
