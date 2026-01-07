import { useState, useCallback } from "react";
import { toast } from "@/utils/toast";
import { shelfApi, ApiError } from "@/lib/api";
import type { ShelfWithBooks } from "@/lib/api";
import type { BookWithStatus, ShelfOrderBy, ShelfSortDirection } from "@/lib/repositories/shelf.repository";

export interface ShelfWithBooksExtended extends Omit<ShelfWithBooks, 'books'> {
  books: BookWithStatus[];
}

export function useShelfBooks(shelfId: number | null) {
  const [shelf, setShelf] = useState<ShelfWithBooksExtended | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [hasInitialized, setHasInitialized] = useState(false);

  /**
   * Fetch shelf with its books
   */
  const fetchShelfBooks = useCallback(
    async (orderBy: ShelfOrderBy = "sortOrder", direction: ShelfSortDirection = "asc") => {
      if (!shelfId) {
        return;
      }

      setLoading(true);
      setHasInitialized(true);
      setError(null);
      try {
        const shelf = await shelfApi.get(shelfId, {
          withBooks: true,
          orderBy,
          direction,
        });
        
        // Safe: API returns ShelfWithBooks when withBooks=true
        setShelf(shelf as ShelfWithBooksExtended);
        return shelf;
      } catch (err) {
        const error = err instanceof Error ? err : new Error("Unknown error");
        setError(error);
        
        // Extract user-friendly message from ApiError
        const message = err instanceof ApiError ? err.message : error.message;
        toast.error(`Failed to load shelf books: ${message}`);
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
        await shelfApi.addBook(shelfId, { bookId, sortOrder });
        
        // Refresh shelf books after adding
        await fetchShelfBooks();

        toast.success("Book added to shelf");
        return true;
      } catch (err) {
        const error = err instanceof Error ? err : new Error("Unknown error");
        setError(error);
        
        // Extract user-friendly message from ApiError
        const message = err instanceof ApiError ? err.message : error.message;
        toast.error(`Failed to add book to shelf: ${message}`);
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
        await shelfApi.removeBook(shelfId, bookId);
        
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
        
        // Extract user-friendly message from ApiError
        const message = err instanceof ApiError ? err.message : error.message;
        toast.error(`Failed to remove book from shelf: ${message}`);
        
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
        await shelfApi.updateBookOrder(shelfId, { bookId, sortOrder });
        
        // Refresh shelf books after reordering
        await fetchShelfBooks();

        return true;
      } catch (err) {
        const error = err instanceof Error ? err : new Error("Unknown error");
        setError(error);
        
        // Extract user-friendly message from ApiError
        const message = err instanceof ApiError ? err.message : error.message;
        toast.error(`Failed to update book order: ${message}`);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [shelfId, fetchShelfBooks]
  );

  /**
   * Batch reorder books on the shelf
   */
  const reorderBooks = useCallback(
    async (bookIds: number[]) => {
      if (!shelfId) {
        return;
      }

      // Optimistic update
      if (shelf) {
        const reorderedBooks = bookIds
          .map((id) => shelf.books.find((book) => book.id === id))
          .filter((book): book is BookWithStatus => book !== undefined);
        
        setShelf({
          ...shelf,
          books: reorderedBooks,
        });
      }

      setError(null);
      try {
        await shelfApi.reorderBooks(shelfId, { bookIds });
        
        // Refresh to get server state
        await fetchShelfBooks();

        toast.success("Book order updated");
        return true;
      } catch (err) {
        const error = err instanceof Error ? err : new Error("Unknown error");
        setError(error);
        
        // Extract user-friendly message from ApiError
        const message = err instanceof ApiError ? err.message : error.message;
        toast.error(`Failed to reorder books: ${message}`);
        
        // Refresh to restore correct state
        await fetchShelfBooks();
        throw error;
      }
    },
    [shelfId, shelf, fetchShelfBooks]
  );

  return {
    shelf,
    books: shelf?.books || [],
    loading,
    error,
    hasInitialized,
    fetchShelfBooks,
    addBookToShelf,
    removeBookFromShelf,
    updateBookOrder,
    reorderBooks,
  };
}
