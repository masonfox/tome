import { useState, useCallback } from "react";
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
 *
 * @param book - The current book data
 * @param bookId - The ID of the book
 * @param onRefresh - Callback to refresh book data
 * @returns Rating management state and functions
 */
export function useBookRating(
  book: Book | null,
  bookId: string,
  onRefresh?: () => void
): UseBookRatingReturn {
  const [showRatingModal, setShowRatingModal] = useState(false);

  const openRatingModal = useCallback(() => {
    setShowRatingModal(true);
  }, []);

  const closeRatingModal = useCallback(() => {
    setShowRatingModal(false);
  }, []);

  const handleUpdateRating = useCallback(async (newRating: number | null) => {
    // Don't update if rating hasn't changed
    if (newRating === book?.rating) {
      setShowRatingModal(false);
      return;
    }

    try {
      const response = await fetch(`/api/books/${bookId}/rating`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating: newRating }),
      });

      if (response.ok) {
        if (newRating === null) {
          toast.success("Rating removed");
        } else {
          toast.success(`Rated ${newRating} ${newRating === 1 ? 'star' : 'stars'}`);
        }

        setShowRatingModal(false);
        onRefresh?.();
      } else {
        const error = await response.json();
        toast.error(error.error || "Failed to update rating");
      }
    } catch (error) {
      console.error("Failed to update rating:", error);
      toast.error("Failed to update rating");
    }
  }, [book?.rating, bookId, onRefresh]);

  return {
    showRatingModal,
    openRatingModal,
    closeRatingModal,
    handleUpdateRating,
  };
}
