import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/utils/toast";
import { bookApi } from "@/lib/api";

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
  hasFinishedSessions?: boolean;
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
  error: Error | null;
  imageError: boolean;
  setImageError: (error: boolean) => void;
  refetchBook: () => Promise<void>;
  updateTotalPages: (totalPages: number) => Promise<void>;
  updateTags: (tags: string[]) => Promise<void>;
  updateBookPartial: (updates: Partial<Book>) => void;
}

/**
 * Custom hook for managing book detail data fetching and updates
 * Uses TanStack Query for automatic caching, refetching, and state management
 *
 * @param bookId - The ID of the book to fetch
 * @returns Book data, loading state, and utility functions
 */
export function useBookDetail(bookId: string): UseBookDetailReturn {
  const queryClient = useQueryClient();
  const [imageError, setImageError] = useState(false);

  // Fetch book data with automatic caching and background refetching
  const {
    data: book = null,
    isPending,
    error,
    refetch,
  } = useQuery<Book>({
    queryKey: ['book', bookId],
    queryFn: () => bookApi.getDetail(bookId),
    staleTime: 5000, // Data is fresh for 5 seconds
  });

  // Determine if we're truly loading: either pending or book ID doesn't match
  // This prevents flash when navigating between books with cached data
  const loading = isPending || (book !== null && book.id.toString() !== bookId);

  // Mutation for updating total pages
  const updateTotalPagesMutation = useMutation({
    mutationFn: (totalPages: number) => 
      bookApi.updateBook(bookId, { totalPages }),
    onMutate: async (totalPages) => {
      // Cancel outgoing queries to prevent them from overwriting our optimistic update
      await queryClient.cancelQueries({ queryKey: ['book', bookId] });

      // Snapshot the previous value
      const previousBook = queryClient.getQueryData<Book>(['book', bookId]);

      // Optimistically update to the new value
      queryClient.setQueryData<Book>(['book', bookId], (old) => 
        old ? { ...old, totalPages } : old
      );

      // Return context with previous value for rollback
      return { previousBook };
    },
    onError: (_err, _totalPages, context) => {
      // Rollback on error
      if (context?.previousBook) {
        queryClient.setQueryData(['book', bookId], context.previousBook);
      }
      toast.error('Failed to update page count');
    },
    onSuccess: () => {
      // Invalidate and refetch book data
      queryClient.invalidateQueries({ queryKey: ['book', bookId] });
      toast.success('Page count updated');
    },
  });

  // Mutation for updating tags
  const updateTagsMutation = useMutation({
    mutationFn: (tags: string[]) => 
      bookApi.updateTags(bookId, { tags }),
    onMutate: async (tags) => {
      // Cancel outgoing queries to prevent them from overwriting our optimistic update
      await queryClient.cancelQueries({ queryKey: ['book', bookId] });

      // Snapshot the previous value
      const previousBook = queryClient.getQueryData<Book>(['book', bookId]);

      // Optimistically update to the new value
      queryClient.setQueryData<Book>(['book', bookId], (old) => 
        old ? { ...old, tags } : old
      );

      // Return context with previous value for rollback
      return { previousBook };
    },
    onError: (_err, _tags, context) => {
      // Rollback on error
      if (context?.previousBook) {
        queryClient.setQueryData(['book', bookId], context.previousBook);
      }
      toast.error('Failed to update tags');
    },
    onSuccess: () => {
      // Invalidate and refetch book data
      queryClient.invalidateQueries({ queryKey: ['book', bookId] });
      // Invalidate available tags cache since tags may have been added/removed
      queryClient.invalidateQueries({ queryKey: ['availableTags'] });
      toast.success('Tags updated');
    },
  });

  // Wrapper functions to maintain compatibility with existing code
  const refetchBook = async () => {
    await refetch();
  };

  const updateTotalPages = async (totalPages: number) => {
    await updateTotalPagesMutation.mutateAsync(totalPages);
  };

  const updateTags = async (tags: string[]) => {
    await updateTagsMutation.mutateAsync(tags);
  };

  // Partial update method for optimistic updates from other hooks
  const updateBookPartial = (updates: Partial<Book>) => {
    queryClient.setQueryData<Book>(['book', bookId], (old) =>
      old ? { ...old, ...updates } : old
    );
  };

  return {
    book,
    loading,
    error: error as Error | null,
    imageError,
    setImageError,
    refetchBook,
    updateTotalPages,
    updateTags,
    updateBookPartial,
  };
}
