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
   * Add multiple books to the shelf (bulk operation)
   */
  const addBooksToShelf = useCallback(
    async (bookIds: number[]) => {
      if (!shelfId || bookIds.length === 0) {
        return;
      }

      setLoading(true);
      setError(null);
      try {
        const result = await shelfApi.addBooks(shelfId, { bookIds });
        
        // Refresh shelf books after adding
        await fetchShelfBooks();

        const bookWord = result.count === 1 ? 'book' : 'books';
        toast.success(`${result.count} ${bookWord} added to shelf`);
        return result;
      } catch (err) {
        const error = err instanceof Error ? err : new Error("Unknown error");
        setError(error);
        
        // Extract user-friendly message from ApiError
        const message = err instanceof ApiError ? err.message : error.message;
        toast.error(`Failed to add books: ${message}`);
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
        
        // Update local state optimistically - filter out removed book and reindex sortOrder
        setShelf((prev) => {
          if (!prev) return null;
          
          const remainingBooks = prev.books
            .filter((book) => book.id !== bookId)
            .map((book, index) => ({ ...book, sortOrder: index } as BookWithStatus));
          
          return {
            ...prev,
            books: remainingBooks,
          };
        });

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
   * Remove multiple books from the shelf (bulk operation)
   */
  const removeBooksFromShelf = useCallback(
    async (bookIds: number[]) => {
      if (!shelfId || bookIds.length === 0) {
        return;
      }

      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/shelves/${shelfId}/books/bulk`, {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ bookIds }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error?.message || "Failed to remove books");
        }

        const result = await response.json();

        // Optimistic update: remove books from local state and reindex
        setShelf((prev) => {
          if (!prev) return null;
          
          const remainingBooks = prev.books
            .filter((book) => !bookIds.includes(book.id))
            .map((book, index) => ({ ...book, sortOrder: index } as BookWithStatus));
          
          return {
            ...prev,
            books: remainingBooks,
          };
        });

        const bookWord = result.data.count === 1 ? "book" : "books";
        toast.success(`${result.data.count} ${bookWord} removed from shelf`);
        return result.data;
      } catch (err) {
        const error = err instanceof Error ? err : new Error("Unknown error");
        setError(error);
        
        toast.error(`Failed to remove books: ${error.message}`);
        
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

      // Optimistic update - reorder books and update sortOrder to match server behavior
      if (shelf) {
        const reorderedBooks = bookIds
          .map((id, index) => {
            const book = shelf.books.find((book) => book.id === id);
            if (!book) return undefined;
            return { ...book, sortOrder: index } as BookWithStatus;
          })
          .filter((book): book is BookWithStatus => book !== undefined);
        
        setShelf({
          ...shelf,
          books: reorderedBooks,
        });
      }

      setError(null);
      try {
        await shelfApi.reorderBooks(shelfId, { bookIds });
        
        // No need to refetch - optimistic update already reflects correct state
        // This prevents the jarring page refresh after drag-and-drop
        // No success toast - the visual feedback of reordering is confirmation enough

        return true;
      } catch (err) {
        const error = err instanceof Error ? err : new Error("Unknown error");
        setError(error);
        
        // Extract user-friendly message from ApiError
        const message = err instanceof ApiError ? err.message : error.message;
        toast.error(`Failed to reorder books: ${message}`);
        
        // Refresh to restore correct state on error
        await fetchShelfBooks();
        throw error;
      }
    },
    [shelfId, shelf, fetchShelfBooks]
  );

  /**
   * Move books from current shelf to another shelf
   */
  const moveBooks = useCallback(
    async (targetShelfId: number, bookIds: number[], targetShelfName?: string) => {
      if (!shelfId || bookIds.length === 0) {
        return;
      }

      setLoading(true);
      setError(null);

      // Optimistic update: remove books from local state
      setShelf((prev) => {
        if (!prev) return null;
        
        const remainingBooks = prev.books
          .filter((book) => !bookIds.includes(book.id))
          .map((book, index) => ({ ...book, sortOrder: index } as BookWithStatus));
        
        return {
          ...prev,
          books: remainingBooks,
        };
      });

      try {
        // 1. Remove from source shelf
        await fetch(`/api/shelves/${shelfId}/books/bulk`, {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ bookIds }),
        });

        // 2. Add to target shelf
        const response = await fetch(`/api/shelves/${targetShelfId}/books/bulk`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ bookIds }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error?.message || "Failed to move books");
        }

        const result = await response.json();
        
        const bookWord = result.data.count === 1 ? "book" : "books";
        const shelfName = targetShelfName ? ` to ${targetShelfName}` : "";
        toast.success(`${result.data.count} ${bookWord} moved${shelfName}`);
        
        return { count: result.data.count };
      } catch (err) {
        const error = err instanceof Error ? err : new Error("Unknown error");
        setError(error);
        
        toast.error(`Failed to move books: ${error.message}`);
        
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
   * Copy books from current shelf to another shelf
   */
  const copyBooks = useCallback(
    async (targetShelfId: number, bookIds: number[], targetShelfName?: string) => {
      if (bookIds.length === 0) {
        return;
      }

      setLoading(true);
      setError(null);

      try {
        // Add to target shelf (no removal from current shelf)
        const response = await fetch(`/api/shelves/${targetShelfId}/books/bulk`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ bookIds }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error?.message || "Failed to copy books");
        }

        const result = await response.json();
        
        const bookWord = result.data.count === 1 ? "book" : "books";
        const shelfName = targetShelfName ? ` to ${targetShelfName}` : "";
        toast.success(`${result.data.count} ${bookWord} copied${shelfName}`);
        
        return { count: result.data.count };
      } catch (err) {
        const error = err instanceof Error ? err : new Error("Unknown error");
        setError(error);
        
        toast.error(`Failed to copy books: ${error.message}`);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [shelfId]
  );

  return {
    shelf,
    books: shelf?.books || [],
    loading,
    error,
    hasInitialized,
    fetchShelfBooks,
    addBookToShelf,
    addBooksToShelf,
    removeBookFromShelf,
    removeBooksFromShelf,
    updateBookOrder,
    reorderBooks,
    moveBooks,
    copyBooks,
  };
}
