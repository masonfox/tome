import { useState, useEffect, useCallback } from "react";

export interface Book {
  id: number;
  calibreId: number;
  title: string;
  authors: string[];
  totalPages?: number;
  publisher?: string;
  pubDate?: string;
  series?: string;
  seriesIndex?: number | null;
  description?: string;
  tags: string[];
  totalReads?: number;
  hasCompletedReads?: boolean;
  activeSession?: {
    id: number;
    status: string;
    startedDate?: string;
    completedDate?: string;
    review?: string;
  };
  rating?: number | null;
  latestProgress?: {
    currentPage: number;
    currentPercentage: number;
    progressDate: string;
  };
}

export interface UseBookDetailReturn {
  book: Book | null;
  loading: boolean;
  imageError: boolean;
  setImageError: (error: boolean) => void;
  refetchBook: () => Promise<void>;
  updateTotalPages: (totalPages: number) => Promise<void>;
  updateBookPartial: (updates: Partial<Book>) => void;
}

/**
 * Custom hook for managing book detail data fetching and updates
 *
 * @param bookId - The ID of the book to fetch
 * @returns Book data, loading state, and utility functions
 */
export function useBookDetail(bookId: string): UseBookDetailReturn {
  const [book, setBook] = useState<Book | null>(null);
  const [loading, setLoading] = useState(true);
  const [imageError, setImageError] = useState(false);

  const fetchBook = useCallback(async () => {
    try {
      const response = await fetch(`/api/books/${bookId}`);
      const data = await response.json();
      setBook(data);
    } catch (error) {
      console.error("Failed to fetch book:", error);
    } finally {
      setLoading(false);
    }
  }, [bookId]);

  const refetchBook = useCallback(async () => {
    await fetchBook();
  }, [fetchBook]);

  const updateTotalPages = useCallback(async (totalPages: number) => {
    try {
      const response = await fetch(`/api/books/${bookId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ totalPages }),
      });

      if (response.ok) {
        // Optimistically update local state instead of full refetch
        setBook(prev => prev ? { ...prev, totalPages } : null);
      }
    } catch (error) {
      console.error("Failed to update total pages:", error);
    }
  }, [bookId]);

  // Partial update method for optimistic updates
  const updateBookPartial = useCallback((updates: Partial<Book>) => {
    setBook(prev => prev ? { ...prev, ...updates } : null);
  }, []);

  // Fetch book on mount or when bookId changes
  useEffect(() => {
    setLoading(true);
    fetchBook();
  }, [bookId, fetchBook]);

  return {
    book,
    loading,
    imageError,
    setImageError,
    refetchBook,
    updateTotalPages,
    updateBookPartial,
  };
}
