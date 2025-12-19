import { useState, useCallback } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { Book } from "./useBookDetail";
import { toast } from "@/utils/toast";

export interface UseBookRatingReturn {
  showRatingModal: boolean;
  openRatingModal: () => void;
  closeRatingModal: () => void;
  handleUpdateRating: (newRating: number | null) => Promise<void>;
}

/**
 * Custom hook for managing book rating updates
 * Uses TanStack Query for automatic cache invalidation and optimistic updates
 *
 * @param book - The current book data
 * @param bookId - The ID of the book
 * @param onRefresh - Callback to refresh book data (deprecated - automatic via query invalidation)
 * @param updateBookPartial - Optional callback for optimistic updates (deprecated - handled by query)
 * @returns Rating management state and functions
 */
export function useBookRating(
  book: Book | null,
  bookId: string,
  onRefresh?: () => void,
  updateBookPartial?: (updates: Partial<Book>) => void
): UseBookRatingReturn {
  const queryClient = useQueryClient();
  const [showRatingModal, setShowRatingModal] = useState(false);

  const openRatingModal = useCallback(() => {
    setShowRatingModal(true);
  }, []);

  const closeRatingModal = useCallback(() => {
    setShowRatingModal(false);
  }, []);

  // Mutation for updating rating
  const ratingMutation = useMutation({
    mutationFn: async (newRating: number | null) => {
      const response = await fetch(`/api/books/${bookId}/rating`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating: newRating }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to update rating");
      }

      return { rating: newRating };
    },
    onMutate: async (newRating) => {
      // Cancel outgoing queries
      await queryClient.cancelQueries({ queryKey: ['book', bookId] });

      // Snapshot previous value
      const previousBook = queryClient.getQueryData<Book>(['book', bookId]);

      // Optimistic update
      queryClient.setQueryData<Book>(['book', bookId], (old) =>
        old ? { ...old, rating: newRating } : old
      );

      // Legacy support: also call updateBookPartial if provided
      updateBookPartial?.({ rating: newRating });

      return { previousBook };
    },
    onError: (_err, _newRating, context) => {
      // Rollback on error
      if (context?.previousBook) {
        queryClient.setQueryData(['book', bookId], context.previousBook);
        // Legacy support
        updateBookPartial?.({ rating: context.previousBook.rating });
      }
      toast.error("Failed to update rating");
    },
    onSuccess: (data) => {
      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: ['book', bookId] });

      // Show success message
      if (data.rating === null) {
        toast.success("Rating removed");
      } else {
        toast.success(`Rated ${data.rating} ${data.rating === 1 ? 'star' : 'stars'}`);
      }

      setShowRatingModal(false);

      // Legacy callback support
      onRefresh?.();
    },
  });

  const handleUpdateRating = useCallback(async (newRating: number | null) => {
    // Don't update if rating hasn't changed
    if (newRating === book?.rating) {
      setShowRatingModal(false);
      return;
    }

    await ratingMutation.mutateAsync(newRating);
  }, [book?.rating, ratingMutation]);

  return {
    showRatingModal,
    openRatingModal,
    closeRatingModal,
    handleUpdateRating,
  };
}
