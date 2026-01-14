/**
 * Hook for managing read-next queue
 * 
 * Provides fetch and reorder functionality for read-next books.
 * Users add/remove books via Library page status changes, not directly.
 */

import { useState, useCallback } from "react";
import { toast } from "@/utils/toast";
import type { ReadingSession } from "@/lib/db/schema/reading-sessions";

export function useReadNextBooks() {
  const [books, setBooks] = useState<ReadingSession[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  /**
   * Fetch all read-next books
   */
  const fetchBooks = useCallback(async (search?: string) => {
    setLoading(true);
    setError(null);
    
    try {
      const params = new URLSearchParams();
      if (search) {
        params.set("search", search);
      }

      const response = await fetch(`/api/sessions/read-next?${params}`);
      
      if (!response.ok) {
        throw new Error("Failed to fetch read-next books");
      }

      const data = await response.json();
      setBooks(data);
      return data;
    } catch (err) {
      const error = err instanceof Error ? err : new Error("Unknown error");
      setError(error);
      toast.error(`Failed to load read-next books: ${error.message}`);
      throw error;
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Reorder books (batch update)
   */
  const reorderBooks = useCallback(
    async (updates: Array<{ id: number; readNextOrder: number }>) => {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch("/api/sessions/read-next/reorder", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ updates }),
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || "Failed to reorder books");
        }

        // Refresh books after reordering
        await fetchBooks();
        
        toast.success("Books reordered");
        return true;
      } catch (err) {
        const error = err instanceof Error ? err : new Error("Unknown error");
        setError(error);
        toast.error(`Failed to reorder books: ${error.message}`);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [fetchBooks]
  );

  /**
   * Update local book order optimistically (for drag-and-drop UI)
   */
  const updateLocalOrder = useCallback((newBooks: ReadingSession[]) => {
    setBooks(newBooks);
  }, []);

  return {
    books,
    loading,
    error,
    fetchBooks,
    reorderBooks,
    updateLocalOrder,
  };
}
