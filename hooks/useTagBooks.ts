import { useState, useEffect, useCallback } from "react";
import type { Book } from "@/lib/db/schema/books";

export function useTagBooks(tagName: string | null) {
  const [books, setBooks] = useState<Book[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchBooks = useCallback(async () => {
    if (!tagName) {
      setBooks([]);
      setTotal(0);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const response = await fetch(`/api/tags/${encodeURIComponent(tagName)}`);
      
      if (!response.ok) {
        throw new Error("Failed to fetch books");
      }

      const data = await response.json();
      setBooks(data.books || []);
      setTotal(data.total || 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch books");
      setBooks([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [tagName]);

  useEffect(() => {
    fetchBooks();
  }, [fetchBooks]);

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
      await fetchBooks();
    } catch (err) {
      throw err instanceof Error ? err : new Error("Failed to remove tag");
    }
  }, [tagName, fetchBooks]);

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
      await fetchBooks();
    } catch (err) {
      throw err instanceof Error ? err : new Error("Failed to add tag");
    }
  }, [tagName, fetchBooks]);

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
      await fetchBooks();
      
      const data = await response.json();
      return data;
    } catch (err) {
      throw err instanceof Error ? err : new Error("Failed to remove tag from books");
    }
  }, [tagName, fetchBooks]);

  return {
    books,
    total,
    loading,
    error,
    refetch: fetchBooks,
    removeTagFromBook,
    addTagToBooks,
    bulkRemoveTag,
  };
}
