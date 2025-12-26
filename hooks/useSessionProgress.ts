import { useQuery } from "@tanstack/react-query";

export interface SessionProgressEntry {
  id: number;
  currentPage: number;
  currentPercentage: number;
  progressDate: string;
  notes?: string;
  pagesRead: number;
}

/**
 * Custom hook for fetching progress logs for a specific reading session
 * Uses TanStack Query for automatic caching and background refetching
 * 
 * @param bookId - The ID of the book
 * @param sessionId - The ID of the reading session (null to disable fetching)
 * @returns Progress logs, loading state, and error state
 */
export function useSessionProgress(bookId: string, sessionId: number | null) {
  return useQuery<SessionProgressEntry[]>({
    queryKey: ['session-progress', sessionId],
    queryFn: async () => {
      if (!sessionId) return [];
      
      const response = await fetch(
        `/api/books/${bookId}/progress?sessionId=${sessionId}`
      );
      
      if (!response.ok) {
        throw new Error('Failed to fetch session progress');
      }
      
      return response.json();
    },
    enabled: !!sessionId, // Only fetch when sessionId is provided
    staleTime: 30000, // Cache for 30 seconds
  });
}
