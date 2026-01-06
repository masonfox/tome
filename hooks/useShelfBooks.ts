import { useState, useCallback } from "react";
import { toast } from "@/utils/toast";
import type { Shelf } from "@/lib/db/schema/shelves";
import type { BookWithStatus, ShelfOrderBy, ShelfSortDirection } from "@/lib/repositories/shelf.repository";

export interface ShelfWithBooks extends Shelf {
  books: BookWithStatus[];
}

export function useShelfBooks(shelfId: number | null) {
  const [shelf, setShelf] = useState<ShelfWithBooks | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  /**
   * Fetch shelf with its books
   */
  const fetchShelfBooks = useCallback(
    async (orderBy: ShelfOrderBy = "sortOrder", direction: ShelfSortDirection = "asc") => {
      if (!shelfId) {
        return;
      }

      setLoading(true);
      setError(null);
      try {
        const response = await fetch(
          `/api/shelves/${shelfId}?withBooks=true&orderBy=${orderBy}&direction=${direction}`
        );
        const data = await response.json();

        if (!data.success) {
          throw new Error(data.error?.message || "Failed to fetch shelf books");
        }

        setShelf(data.data);
        return data.data;
      } catch (err) {
        const error = err instanceof Error ? err : new Error("Unknown error");
        setError(error);
        toast.error(`Failed to load shelf books: ${error.message}`);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [shelfId]
  );

  /**
   * Add a book to the shelf
   */
  const addBookToShelf = useCallback(
    async (bookId: number, sortOrder?: number) => {
      if (!shelfId) {
        return;
      }

      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/shelves/${shelfId}/books`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ bookId, sortOrder }),
        });

        const data = await response.json();

        if (!data.success) {
          throw new Error(data.error?.message || "Failed to add book to shelf");
        }

        // Refresh shelf books after adding
        await fetchShelfBooks();

        toast.success("Book added to shelf");
        return true;
      } catch (err) {
        const error = err instanceof Error ? err : new Error("Unknown error");
        setError(error);
        toast.error(`Failed to add book to shelf: ${error.message}`);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [shelfId, fetchShelfBooks]
  );

  /**
   * Remove a book from the shelf
   */
  const removeBookFromShelf = useCallback(
    async (bookId: number) => {
      if (!shelfId) {
        return;
      }

      setLoading(true);
      setError(null);
      try {
        const response = await fetch(
          `/api/shelves/${shelfId}/books?bookId=${bookId}`,
          {
            method: "DELETE",
          }
        );

        const data = await response.json();

        if (!data.success) {
          throw new Error(data.error?.message || "Failed to remove book from shelf");
        }

        // Update local state optimistically
        setShelf((prev) =>
          prev
            ? {
                ...prev,
                books: prev.books.filter((book) => book.id !== bookId),
              }
            : null
        );

        toast.success("Book removed from shelf");
        return true;
      } catch (err) {
        const error = err instanceof Error ? err : new Error("Unknown error");
        setError(error);
        toast.error(`Failed to remove book from shelf: ${error.message}`);
        // Refresh to ensure consistency
        await fetchShelfBooks();
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [shelfId, fetchShelfBooks]
  );

  /**
   * Update the order of a book on the shelf
   */
  const updateBookOrder = useCallback(
    async (bookId: number, sortOrder: number) => {
      if (!shelfId) {
        return;
      }

      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/shelves/${shelfId}/books`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ bookId, sortOrder }),
        });

        const data = await response.json();

        if (!data.success) {
          throw new Error(data.error?.message || "Failed to update book order");
        }

        // Refresh shelf books after reordering
        await fetchShelfBooks();

        return true;
      } catch (err) {
        const error = err instanceof Error ? err : new Error("Unknown error");
        setError(error);
        toast.error(`Failed to update book order: ${error.message}`);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [shelfId, fetchShelfBooks]
  );

  return {
    shelf,
    books: shelf?.books || [],
    loading,
    error,
    fetchShelfBooks,
    addBookToShelf,
    removeBookFromShelf,
    updateBookOrder,
  };
}
