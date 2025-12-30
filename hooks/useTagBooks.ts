import { useState, useEffect, useCallback, useRef } from "react";
import type { Book } from "@/lib/db/schema/books";

const BOOKS_PER_PAGE = 50;

export function useTagBooks(tagName: string | null) {
  const [books, setBooks] = useState<Book[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const skipRef = useRef(0);

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

    try {
      setLoading(true);
      setError(null);
      skipRef.current = 0;
      
      const response = await fetch(
        `/api/tags/${encodeURIComponent(tagName)}?limit=${BOOKS_PER_PAGE}&skip=0`
      );
      
      if (!response.ok) {
        throw new Error("Failed to fetch books");
      }

      const data = await response.json();
      setBooks(data.books || []);
      setTotal(data.total || 0);
      skipRef.current = BOOKS_PER_PAGE;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch books");
      setBooks([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [tagName]);

  // Load more books for infinite scroll
  const loadMore = useCallback(async () => {
    if (!tagName || loadingMore || !hasMore) {
      return;
    }

    try {
      setLoadingMore(true);
      setError(null);
      
      const response = await fetch(
        `/api/tags/${encodeURIComponent(tagName)}?limit=${BOOKS_PER_PAGE}&skip=${skipRef.current}`
      );
      
      if (!response.ok) {
        throw new Error("Failed to fetch more books");
      }

      const data = await response.json();
      setBooks(prev => [...prev, ...(data.books || [])]);
      setTotal(data.total || 0);
      skipRef.current += BOOKS_PER_PAGE;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch more books");
    } finally {
      setLoadingMore(false);
    }
  }, [tagName, loadingMore, hasMore]);

  // Reset and fetch initial books when tag changes
  useEffect(() => {
    fetchInitialBooks();
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
    } catch (err) {
      throw err instanceof Error ? err : new Error("Failed to remove tag");
    }
  }, [tagName, fetchInitialBooks]);

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
    } catch (err) {
      throw err instanceof Error ? err : new Error("Failed to add tag");
    }
  }, [tagName, fetchInitialBooks]);

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
      
      const data = await response.json();
      return data;
    } catch (err) {
      throw err instanceof Error ? err : new Error("Failed to remove tag from books");
    }
  }, [tagName, fetchInitialBooks]);

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
  };
}
