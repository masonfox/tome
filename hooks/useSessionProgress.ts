import { useQuery } from "@tanstack/react-query";
import { bookApi } from "@/lib/api";

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
      
      return bookApi.listProgress(bookId, { sessionId });
    },
    enabled: !!sessionId, // Only fetch when sessionId is provided
    staleTime: 30000, // Cache for 30 seconds
  });
}
