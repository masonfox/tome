import { useState, useEffect, useCallback, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { Book } from "@/lib/db/schema/books";

const BOOKS_PER_PAGE = 50;

export function useTagBooks(tagName: string | null) {
  const queryClient = useQueryClient();
  const [books, setBooks] = useState<Book[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const skipRef = useRef(0);
  const beforeRefetchCallback = useRef<(() => void) | null>(null);
  const afterRefetchCallback = useRef<(() => void) | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const loadMoreAbortControllerRef = useRef<AbortController | null>(null);
  const isLoadingRef = useRef(false);

  // Calculate if there are more books to load
  const hasMore = books.length < total;

  // Fetch initial books when tag changes
  const fetchInitialBooks = useCallback(async () => {
    if (!tagName) {
      setBooks([]);
      setTotal(0);
      skipRef.current = 0;
      return;
    }

    // Prevent double fetch - if already loading, return
    if (isLoadingRef.current) {
      return;
    }

    // Cancel any pending request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Create new abort controller for this request
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    try {
      // Call before refetch callback if set (to save scroll position)
      beforeRefetchCallback.current?.();
      
      isLoadingRef.current = true;
      setLoading(true);
      setError(null);
      skipRef.current = 0;
      
      const response = await fetch(
        `/api/tags/${encodeURIComponent(tagName)}?limit=${BOOKS_PER_PAGE}&skip=0`,
        { signal: abortController.signal }
      );
      
      if (!response.ok) {
        throw new Error("Failed to fetch books");
      }

      const data = await response.json();
      setBooks(data.books || []);
      setTotal(data.total || 0);
      skipRef.current = BOOKS_PER_PAGE;
    } catch (err) {
      // Ignore abort errors
      if (err instanceof Error && err.name === 'AbortError') {
        return;
      }
      setError(err instanceof Error ? err.message : "Failed to fetch books");
      setBooks([]);
      setTotal(0);
    } finally {
      // Only update loading state if this request wasn't aborted
      if (!abortController.signal.aborted) {
        isLoadingRef.current = false;
        setLoading(false);
        
        // Call after refetch callback if set (to restore scroll position)
        afterRefetchCallback.current?.();
      }
    }
  }, [tagName]);

  // Load more books for infinite scroll
  const loadMore = useCallback(async () => {
    if (!tagName || loadingMore || !hasMore) {
      return;
    }

    // Cancel any pending loadMore request
    if (loadMoreAbortControllerRef.current) {
      loadMoreAbortControllerRef.current.abort();
    }

    // Create new abort controller for this request
    const abortController = new AbortController();
    loadMoreAbortControllerRef.current = abortController;

    try {
      setLoadingMore(true);
      setError(null);
      
      const response = await fetch(
        `/api/tags/${encodeURIComponent(tagName)}?limit=${BOOKS_PER_PAGE}&skip=${skipRef.current}`,
        { signal: abortController.signal }
      );
      
      if (!response.ok) {
        throw new Error("Failed to fetch more books");
      }

      const data = await response.json();
      setBooks(prev => [...prev, ...(data.books || [])]);
      setTotal(data.total || 0);
      skipRef.current += BOOKS_PER_PAGE;
    } catch (err) {
      // Ignore abort errors
      if (err instanceof Error && err.name === 'AbortError') {
        return;
      }
      setError(err instanceof Error ? err.message : "Failed to fetch more books");
    } finally {
      // Only update loading state if this request wasn't aborted
      if (!abortController.signal.aborted) {
        setLoadingMore(false);
      }
    }
  }, [tagName, loadingMore, hasMore]);

  // Reset and fetch initial books when tag changes
  useEffect(() => {
    fetchInitialBooks();
    
    // Cleanup function to abort pending requests when component unmounts or tag changes
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      if (loadMoreAbortControllerRef.current) {
        loadMoreAbortControllerRef.current.abort();
      }
    };
  }, [fetchInitialBooks]);

  const removeTagFromBook = useCallback(async (bookId: number) => {
    if (!tagName) return;

    try {
      const response = await fetch("/api/tags/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bookIds: [bookId],
          tags: [tagName],
          action: "remove",
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to remove tag");
      }

      // Refresh books after successful removal
      await fetchInitialBooks();
      
      // Invalidate tags cache since book count changed
      queryClient.invalidateQueries({ queryKey: ['tags-stats'] });
      queryClient.invalidateQueries({ queryKey: ['availableTags'] });
    } catch (err) {
      throw err instanceof Error ? err : new Error("Failed to remove tag");
    }
  }, [tagName, fetchInitialBooks, queryClient]);

  const addTagToBooks = useCallback(async (bookIds: number[]) => {
    if (!tagName || bookIds.length === 0) return;

    try {
      const response = await fetch("/api/tags/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bookIds,
          tags: [tagName],
          action: "add",
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to add tag");
      }

      // Refresh books after successful addition
      await fetchInitialBooks();
      
      // Invalidate tags cache since book count changed
      queryClient.invalidateQueries({ queryKey: ['tags-stats'] });
      queryClient.invalidateQueries({ queryKey: ['availableTags'] });
    } catch (err) {
      throw err instanceof Error ? err : new Error("Failed to add tag");
    }
  }, [tagName, fetchInitialBooks, queryClient]);

  const bulkRemoveTag = useCallback(async (bookIds: number[]) => {
    if (!tagName || bookIds.length === 0) return;

    try {
      const response = await fetch("/api/tags/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bookIds,
          tags: [tagName],
          action: "remove",
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to remove tag from books");
      }

      // Refresh books after successful bulk removal
      await fetchInitialBooks();
      
      // Invalidate tags cache since book count changed
      queryClient.invalidateQueries({ queryKey: ['tags-stats'] });
      queryClient.invalidateQueries({ queryKey: ['availableTags'] });
      
      const data = await response.json();
      return data;
    } catch (err) {
      throw err instanceof Error ? err : new Error("Failed to remove tag from books");
    }
  }, [tagName, fetchInitialBooks, queryClient]);

  return {
    books,
    total,
    loading,
    loadingMore,
    hasMore,
    error,
    refetch: fetchInitialBooks,
    loadMore,
    removeTagFromBook,
    addTagToBooks,
    bulkRemoveTag,
    setBeforeRefetch: (callback: (() => void) | null) => {
      beforeRefetchCallback.current = callback;
    },
    setAfterRefetch: (callback: (() => void) | null) => {
      afterRefetchCallback.current = callback;
    },
  };
}
