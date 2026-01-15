import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/utils/toast";
import { shelfApi, ApiError } from "@/lib/api";
import type { ShelfWithBooks } from "@/lib/api";
import type { BookWithStatus, ShelfOrderBy, ShelfSortDirection } from "@/lib/repositories/shelf.repository";

export interface ShelfWithBooksExtended extends Omit<ShelfWithBooks, 'books'> {
  books: BookWithStatus[];
}

export function useShelfBooks(
  shelfId: number | null,
  orderBy: ShelfOrderBy = "sortOrder",
  direction: ShelfSortDirection = "asc"
) {
  const queryClient = useQueryClient();

  // Query: Fetch shelf with its books
  const {
    data: shelf = null,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["shelf", shelfId, { orderBy, direction }],
    queryFn: async () => {
      if (!shelfId) return null;

      const shelf = await shelfApi.get(shelfId, {
        withBooks: true,
        orderBy,
        direction,
      });

      // Safe: API returns ShelfWithBooks when withBooks=true
      return shelf as ShelfWithBooksExtended;
    },
    enabled: shelfId !== null,
    staleTime: 30000, // 30 seconds
  });

  /**
   * Helper to extract user-friendly error message
   */
  const getErrorMessage = (err: unknown): string => {
    return err instanceof ApiError ? err.message : err instanceof Error ? err.message : "Unknown error";
  };

  /**
   * Mutation: Add multiple books to the shelf (bulk operation)
   */
  const addBooksMutation = useMutation({
    mutationFn: async (bookIds: number[]) => {
      if (!shelfId || bookIds.length === 0) {
        throw new Error("No shelf ID or book IDs provided");
      }
      return shelfApi.addBooks(shelfId, { bookIds });
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["shelf", shelfId] });
      const bookWord = result.count === 1 ? 'book' : 'books';
      toast.success(`${result.count} ${bookWord} added to shelf`);
    },
    onError: (err) => {
      toast.error(`Failed to add books: ${getErrorMessage(err)}`);
    },
  });

  /**
   * Mutation: Remove a single book from the shelf
   */
  const removeBookMutation = useMutation({
    mutationFn: async (bookId: number) => {
      if (!shelfId) {
        throw new Error("No shelf ID provided");
      }
      return shelfApi.removeBook(shelfId, bookId);
    },
    onMutate: async (bookId) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ["shelf", shelfId] });

      // Snapshot previous value
      const previousShelf = queryClient.getQueryData<ShelfWithBooksExtended>([
        "shelf",
        shelfId,
        { orderBy, direction },
      ]);

      // Optimistically update: filter out removed book and reindex sortOrder
      if (previousShelf) {
        const remainingBooks = previousShelf.books
          .filter((book) => book.id !== bookId)
          .map((book, index) => ({ ...book, sortOrder: index } as BookWithStatus));

        queryClient.setQueryData(
          ["shelf", shelfId, { orderBy, direction }],
          {
            ...previousShelf,
            books: remainingBooks,
          }
        );
      }

      return { previousShelf };
    },
    onSuccess: () => {
      toast.success("Book removed from shelf");
    },
    onError: (err, variables, context) => {
      // Rollback on error
      if (context?.previousShelf) {
        queryClient.setQueryData(
          ["shelf", shelfId, { orderBy, direction }],
          context.previousShelf
        );
      }
      toast.error(`Failed to remove book from shelf: ${getErrorMessage(err)}`);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["shelf", shelfId] });
    },
  });

  /**
   * Mutation: Remove multiple books from the shelf (bulk operation)
   */
  const removeBooksMutation = useMutation({
    mutationFn: async (bookIds: number[]) => {
      if (!shelfId || bookIds.length === 0) {
        throw new Error("No shelf ID or book IDs provided");
      }
      return shelfApi.removeBooks(shelfId, { bookIds });
    },
    onMutate: async (bookIds) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ["shelf", shelfId] });

      // Snapshot previous value
      const previousShelf = queryClient.getQueryData<ShelfWithBooksExtended>([
        "shelf",
        shelfId,
        { orderBy, direction },
      ]);

      // Optimistically update: remove books from local state and reindex
      if (previousShelf) {
        const remainingBooks = previousShelf.books
          .filter((book) => !bookIds.includes(book.id))
          .map((book, index) => ({ ...book, sortOrder: index } as BookWithStatus));

        queryClient.setQueryData(
          ["shelf", shelfId, { orderBy, direction }],
          {
            ...previousShelf,
            books: remainingBooks,
          }
        );
      }

      return { previousShelf };
    },
    onSuccess: (result) => {
      const bookWord = result.count === 1 ? "book" : "books";
      toast.success(`${result.count} ${bookWord} removed from shelf`);
    },
    onError: (err, variables, context) => {
      // Rollback on error
      if (context?.previousShelf) {
        queryClient.setQueryData(
          ["shelf", shelfId, { orderBy, direction }],
          context.previousShelf
        );
      }
      toast.error(`Failed to remove books: ${getErrorMessage(err)}`);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["shelf", shelfId] });
    },
  });

  /**
   * Mutation: Batch reorder books on the shelf
   */
  const reorderBooksMutation = useMutation({
    mutationFn: async (bookIds: number[]) => {
      if (!shelfId) {
        throw new Error("No shelf ID provided");
      }
      return shelfApi.reorderBooks(shelfId, { bookIds });
    },
    onMutate: async (bookIds) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ["shelf", shelfId] });

      // Snapshot previous value
      const previousShelf = queryClient.getQueryData<ShelfWithBooksExtended>([
        "shelf",
        shelfId,
        { orderBy, direction },
      ]);

      // Optimistically update: reorder books and update sortOrder
      if (previousShelf) {
        const reorderedBooks = bookIds
          .map((id, index) => {
            const book = previousShelf.books.find((book) => book.id === id);
            if (!book) return undefined;
            return { ...book, sortOrder: index } as BookWithStatus;
          })
          .filter((book): book is BookWithStatus => book !== undefined);

        queryClient.setQueryData(
          ["shelf", shelfId, { orderBy, direction }],
          {
            ...previousShelf,
            books: reorderedBooks,
          }
        );
      }

      return { previousShelf };
    },
    onError: (err, variables, context) => {
      // Rollback on error
      if (context?.previousShelf) {
        queryClient.setQueryData(
          ["shelf", shelfId, { orderBy, direction }],
          context.previousShelf
        );
      }
      toast.error(`Failed to reorder books: ${getErrorMessage(err)}`);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["shelf", shelfId] });
    },
    // No success toast - visual feedback of reordering is confirmation enough
  });

  /**
   * Mutation: Move books from current shelf to another shelf
   */
  const moveBooksMutation = useMutation({
    mutationFn: async ({
      targetShelfId,
      bookIds,
    }: {
      targetShelfId: number;
      bookIds: number[];
      targetShelfName?: string;
    }) => {
      if (!shelfId || bookIds.length === 0) {
        throw new Error("No shelf ID or book IDs provided");
      }
      return shelfApi.moveBooks(shelfId, targetShelfId, { bookIds });
    },
    onMutate: async ({ bookIds }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ["shelf", shelfId] });

      // Snapshot previous value
      const previousShelf = queryClient.getQueryData<ShelfWithBooksExtended>([
        "shelf",
        shelfId,
        { orderBy, direction },
      ]);

      // Optimistically update: remove books from local state
      if (previousShelf) {
        const remainingBooks = previousShelf.books
          .filter((book) => !bookIds.includes(book.id))
          .map((book, index) => ({ ...book, sortOrder: index } as BookWithStatus));

        queryClient.setQueryData(
          ["shelf", shelfId, { orderBy, direction }],
          {
            ...previousShelf,
            books: remainingBooks,
          }
        );
      }

      return { previousShelf };
    },
    onSuccess: (result, variables) => {
      const bookWord = result.count === 1 ? "book" : "books";
      const shelfName = variables.targetShelfName ? ` to ${variables.targetShelfName}` : "";
      toast.success(`${result.count} ${bookWord} moved${shelfName}`);
    },
    onError: (err, variables, context) => {
      // Rollback on error
      if (context?.previousShelf) {
        queryClient.setQueryData(
          ["shelf", shelfId, { orderBy, direction }],
          context.previousShelf
        );
      }
      toast.error(`Failed to move books: ${getErrorMessage(err)}`);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["shelf", shelfId] });
    },
  });

  /**
   * Mutation: Copy books from current shelf to another shelf
   */
  const copyBooksMutation = useMutation({
    mutationFn: async ({
      targetShelfId,
      bookIds,
    }: {
      targetShelfId: number;
      bookIds: number[];
      targetShelfName?: string;
    }) => {
      if (bookIds.length === 0) {
        throw new Error("No book IDs provided");
      }
      return shelfApi.copyBooks(targetShelfId, { bookIds });
    },
    onSuccess: (result, variables) => {
      const bookWord = result.count === 1 ? "book" : "books";
      const shelfName = variables.targetShelfName ? ` to ${variables.targetShelfName}` : "";
      toast.success(`${result.count} ${bookWord} copied${shelfName}`);
    },
    onError: (err) => {
      toast.error(`Failed to copy books: ${getErrorMessage(err)}`);
    },
  });

  /**
   * Mutation: Move a book to the top of the shelf
   * Uses optimistic updates for instant feedback
   */
  const moveToTopMutation = useMutation({
    mutationFn: async (bookId: number) => {
      if (!shelfId) {
        throw new Error("No shelf ID provided");
      }

      const response = await fetch(`/api/shelves/${shelfId}/books/${bookId}/move-to-top`, {
        method: "POST",
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error?.message || "Failed to move to top");
      }

      return true;
    },
    onMutate: async (bookId) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ["shelf", shelfId] });

      // Snapshot previous value
      const previousShelf = queryClient.getQueryData<ShelfWithBooksExtended>([
        "shelf",
        shelfId,
        { orderBy, direction },
      ]);

      // Optimistically update: move book to top
      if (previousShelf) {
        const bookToMove = previousShelf.books.find((b) => b.id === bookId);
        if (bookToMove) {
          // Create new array with moved book at top
          const otherBooks = previousShelf.books.filter((b) => b.id !== bookId);
          const optimisticBooks = [
            { ...bookToMove, sortOrder: 0 },
            ...otherBooks.map((book, index) => ({
              ...book,
              sortOrder: index + 1,
            })),
          ] as BookWithStatus[];

          queryClient.setQueryData(
            ["shelf", shelfId, { orderBy, direction }],
            {
              ...previousShelf,
              books: optimisticBooks,
            }
          );
        }
      }

      return { previousShelf };
    },
    onError: (err, variables, context) => {
      // Rollback on error
      if (context?.previousShelf) {
        queryClient.setQueryData(
          ["shelf", shelfId, { orderBy, direction }],
          context.previousShelf
        );
      }
      toast.error(`Failed to move to top: ${getErrorMessage(err)}`);
    },
    onSuccess: () => {
      toast.success("Moved to top of shelf");
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["shelf", shelfId] });
    },
  });

  return {
    shelf,
    books: shelf?.books || [],
    loading: isLoading || addBooksMutation.isPending || removeBookMutation.isPending || removeBooksMutation.isPending || reorderBooksMutation.isPending || moveBooksMutation.isPending || copyBooksMutation.isPending || moveToTopMutation.isPending,
    error,
    hasInitialized: shelf !== null || error !== null,
    addBooksToShelf: addBooksMutation.mutateAsync,
    removeBookFromShelf: removeBookMutation.mutateAsync,
    removeBooksFromShelf: removeBooksMutation.mutateAsync,
    reorderBooks: reorderBooksMutation.mutateAsync,
    moveToTop: moveToTopMutation.mutateAsync,
    moveBooks: async (targetShelfId: number, bookIds: number[], targetShelfName?: string) => {
      return moveBooksMutation.mutateAsync({ targetShelfId, bookIds, targetShelfName });
    },
    copyBooks: async (targetShelfId: number, bookIds: number[], targetShelfName?: string) => {
      return copyBooksMutation.mutateAsync({ targetShelfId, bookIds, targetShelfName });
    },
    isAddingBooks: addBooksMutation.isPending,
    isRemovingBook: removeBookMutation.isPending,
    isRemovingBooks: removeBooksMutation.isPending,
    isReordering: reorderBooksMutation.isPending,
    isMovingToTop: moveToTopMutation.isPending,
    isMoving: moveBooksMutation.isPending,
    isCopying: copyBooksMutation.isPending,
  };
}
