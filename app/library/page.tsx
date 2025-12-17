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
  const [loadingTags, setLoadingTags] = useState(true);
  const [searchInput, setSearchInput] = useState("");
  const observerTarget = useRef<HTMLDivElement>(null);
  const [restoringScrollState, setRestoringScrollState] = useState(false);
  const [targetBooksCount, setTargetBooksCount] = useState<number | null>(null);
  const [targetScrollPosition, setTargetScrollPosition] = useState<number | null>(null);

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

  // Helper function to clear saved scroll state from sessionStorage
  const clearSavedScrollState = useCallback(() => {
    sessionStorage.removeItem('library-scroll-position');
    sessionStorage.removeItem('library-books-count');
    sessionStorage.removeItem('library-filters');
  }, []);

  // Helper function to compare arrays for equality (order-independent for tags)
  const arraysEqual = useCallback((a: string[] | undefined, b: string[] | undefined): boolean => {
    const arrA = (a || []).sort();
    const arrB = (b || []).sort();
    if (arrA.length !== arrB.length) return false;
    return arrA.every((val, index) => val === arrB[index]);
  }, []);

  // Check for saved scroll state on mount
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const savedScrollPosition = sessionStorage.getItem('library-scroll-position');
    const savedBooksCount = sessionStorage.getItem('library-books-count');
    const savedFilters = sessionStorage.getItem('library-filters');

    if (savedScrollPosition && savedBooksCount && savedFilters) {
      try {
        const parsedSavedFilters = JSON.parse(savedFilters);
        
        // Check if filters match current filters
        const currentTags = searchParams?.get("tags")?.split(",").filter(Boolean) || [];
        const savedTags = parsedSavedFilters.tags || [];
        
        const filtersMatch = 
          parsedSavedFilters.search === (searchParams?.get("search") || undefined) &&
          parsedSavedFilters.status === (searchParams?.get("status") || undefined) &&
          arraysEqual(currentTags, savedTags) &&
          parsedSavedFilters.rating === (searchParams?.get("rating") || undefined);
        
        if (filtersMatch) {
          setTargetBooksCount(parseInt(savedBooksCount, 10));
          setTargetScrollPosition(parseInt(savedScrollPosition, 10));
          setRestoringScrollState(true);
        } else {
          // Filters don't match, clear saved state
          clearSavedScrollState();
        }
      } catch (e) {
        // Invalid saved data, clear it
        clearSavedScrollState();
      }
    }
  }, [searchParams, arraysEqual, clearSavedScrollState]);

  // Save scroll position and books count when navigating away
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const saveScrollState = () => {
      const scrollY = window.scrollY;
      const booksCount = books.length;
      
      sessionStorage.setItem('library-scroll-position', scrollY.toString());
      sessionStorage.setItem('library-books-count', booksCount.toString());
      
      // Save current filters to ensure we restore in the same context
      sessionStorage.setItem('library-filters', JSON.stringify({
        search: filters.search,
        status: filters.status,
        tags: filters.tags,
        rating: filters.rating,
      }));
    };

    // Save state on clicks within the book grid
    const handleClick = (e: MouseEvent) => {
      // Check if we're clicking on a link to a book detail page
      const target = e.target as HTMLElement;
      const link = target.closest('a[href^="/books/"]');
      
      if (link) {
        saveScrollState();
      }
    };

    document.addEventListener('click', handleClick);
    
    return () => {
      document.removeEventListener('click', handleClick);
    };
  }, [books.length, filters]);

  // Load more books if we need to restore scroll position
  useEffect(() => {
    if (!restoringScrollState || !targetBooksCount || loading || loadingMore) return;
    
    // If we have fewer books than target and can load more, do it
    if (books.length < targetBooksCount && hasMore) {
      loadMore();
    }
  }, [restoringScrollState, targetBooksCount, books.length, hasMore, loading, loadingMore, loadMore]);

  // Restore scroll position when we have enough books
  useEffect(() => {
    if (!restoringScrollState || !targetScrollPosition) return;
    if (!targetBooksCount) return;
    if (loading) return;
    
    // Check if we have enough books or can't load more
    const hasEnoughBooks = books.length >= targetBooksCount;
    const cantLoadMore = !hasMore;
    
    if (hasEnoughBooks || cantLoadMore) {
      // Restore scroll position after a brief delay to ensure DOM is updated
      // This delay allows the browser to render all book cards before scrolling
      const SCROLL_RESTORE_DELAY_MS = 100;
      
      setTimeout(() => {
        window.scrollTo({
          top: targetScrollPosition,
          behavior: 'instant',
        });
      }, SCROLL_RESTORE_DELAY_MS);
      
      // Clean up
      setRestoringScrollState(false);
      setTargetBooksCount(null);
      setTargetScrollPosition(null);
      clearSavedScrollState();
    }
  }, [restoringScrollState, targetScrollPosition, targetBooksCount, books.length, hasMore, loading, clearSavedScrollState]);

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
      } finally {
        setLoadingTags(false);
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
        totalBooks={total}
        syncing={syncing}
        onSync={handleSync}
        loading={isInitialLoading}
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
        loadingTags={loadingTags}
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
