"use client";

import { useEffect, useState, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useLibraryData } from "@/hooks/useLibraryData";
import { libraryService } from "@/lib/library-service";
import { LibraryHeader } from "@/components/LibraryHeader";
import { LibraryFilters } from "@/components/LibraryFilters";
import { BookGrid } from "@/components/BookGrid";
import { toast } from "@/utils/toast";

function LibraryPageContent() {
  const searchParams = useSearchParams();
  const [isReady, setIsReady] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [availableTags, setAvailableTags] = useState<string[]>([]);
  const [searchInput, setSearchInput] = useState("");
  const observerTarget = useRef<HTMLDivElement>(null);

  // Parse initial filters from URL params
  useEffect(() => {
    const searchParam = searchParams.get("search");
    const statusParam = searchParams.get("status");
    const tagsParam = searchParams.get("tags");

    if (searchParam) setSearchInput(searchParam);
    
    setIsReady(true);
  }, [searchParams]);

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
    filters,
    refresh,
  } = useLibraryData({
    search: searchParams.get("search") || undefined,
    status: searchParams.get("status") || undefined,
    tags: searchParams.get("tags")?.split(",").filter(Boolean) || undefined,
  });

  // Debounce search input
  useEffect(() => {
    if (!isReady) return;
    
    const timer = setTimeout(() => {
      setSearch(searchInput);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchInput, setSearch, isReady]);

  // Fetch available tags on mount
  useEffect(() => {
    async function fetchTags() {
      try {
        const tags = await libraryService.getAvailableTags();
        setAvailableTags(tags);
      } catch (error) {
        console.error("Failed to fetch tags:", error);
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
      console.error("Sync failed:", error);
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
  }

  return (
    <div className="space-y-6">
      <LibraryHeader
        totalBooks={total}
        syncing={syncing}
        onSync={handleSync}
      />

      <LibraryFilters
        search={searchInput}
        onSearchChange={setSearchInput}
        statusFilter={filters.status || "all"}
        onStatusFilterChange={(status) => setStatus(status === "all" ? undefined : status)}
        selectedTags={filters.tags || []}
        onTagsChange={(tags) => setTags(tags.length > 0 ? tags : undefined)}
        availableTags={availableTags}
        loading={loading}
        onClearAll={handleClearAll}
      />

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded">
          {error}
        </div>
      )}

      <BookGrid
        books={books}
        loading={loading && books.length === 0}
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
