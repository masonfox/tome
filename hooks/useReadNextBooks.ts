/**
 * Hook for managing read-next queue
 * 
 * Provides fetch and reorder functionality for read-next books.
 * Users add/remove books via Library page status changes, not directly.
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/utils/toast";
import { invalidateBookQueries } from "@/hooks/useBookStatus";
import type { SessionWithBook } from "@/lib/repositories/session.repository";

export function useReadNextBooks(search?: string) {
  const queryClient = useQueryClient();

  // Query: Fetch all read-next books
  const {
    data: sessions = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ["read-next-books", search],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (search) {
        params.set("search", search);
      }

      const response = await fetch(`/api/sessions/read-next?${params}`);

      if (!response.ok) {
        throw new Error("Failed to fetch read-next books");
      }

      const data: SessionWithBook[] = await response.json();
      return data;
    },
    staleTime: 30000, // 30 seconds
  });

  /**
   * Mutation: Reorder books (batch update)
   * Uses optimistic updates to prevent loading skeleton flash
   */
  const reorderMutation = useMutation({
    mutationFn: async (updates: Array<{ id: number; readNextOrder: number }>) => {
      const response = await fetch("/api/sessions/read-next/reorder", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ updates }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to reorder books");
      }

      return true;
    },
    onMutate: async (updates) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ["read-next-books"] });

      // Snapshot previous value
      const previousSessions = queryClient.getQueryData<SessionWithBook[]>([
        "read-next-books",
        search,
      ]);

      // Optimistically update cache
      if (previousSessions) {
        const updatesMap = new Map(
          updates.map((u) => [u.id, u.readNextOrder])
        );
        const optimisticSessions = previousSessions
          .map((session) => {
            const newOrder = updatesMap.get(session.id);
            return newOrder !== undefined
              ? { ...session, readNextOrder: newOrder }
              : session;
          })
          .sort((a, b) => (a.readNextOrder || 0) - (b.readNextOrder || 0));

        queryClient.setQueryData(["read-next-books", search], optimisticSessions);
      }

      // Return context for rollback
      return { previousSessions };
    },
    onError: (err, variables, context) => {
      // Rollback to previous state
      if (context?.previousSessions) {
        queryClient.setQueryData(
          ["read-next-books", search],
          context.previousSessions
        );
      }
      const error = err instanceof Error ? err : new Error("Unknown error");
      toast.error(`Failed to reorder books: ${error.message}`);
    },
    onSettled: () => {
      // Refetch after error or success to sync with server
      queryClient.invalidateQueries({ queryKey: ["read-next-books"] });
    },
    // No success toast - visual feedback of reordering is confirmation enough
  });

  /**
   * Mutation: Remove multiple books from read-next queue
   * Changes session status from "read-next" to "to-read"
   */
  const removeMutation = useMutation({
    mutationFn: async (bookIds: number[]) => {
      // Update status for each book
      const updatePromises = bookIds.map(async (bookId) => {
        const response = await fetch(`/api/books/${bookId}/status`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "to-read" }),
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || `Failed to remove book ${bookId}`);
        }

        return response.json();
      });

      await Promise.all(updatePromises);
      return bookIds;
    },
    onSuccess: (bookIds) => {
      // Invalidate all book-related queries for each affected book
      // This ensures library, dashboard, and other pages update correctly
      bookIds.forEach(bookId => {
        invalidateBookQueries(queryClient, bookId.toString());
      });
      
      // Also explicitly invalidate read-next query (redundant but clear)
      queryClient.invalidateQueries({ queryKey: ["read-next-books"] });
      
      const count = bookIds.length;
      toast.success(
        `Removed ${count} ${count === 1 ? "book" : "books"} from Read Next`
      );
    },
    onError: (err) => {
      const error = err instanceof Error ? err : new Error("Unknown error");
      toast.error(`Failed to remove books: ${error.message}`);
    },
  });

  /**
   * Mutation: Move a session to the top of the read-next queue
   * Uses optimistic updates for instant feedback
   */
  const moveToTopMutation = useMutation({
    mutationFn: async (sessionId: number) => {
      const response = await fetch(`/api/sessions/read-next/${sessionId}/move-to-top`, {
        method: "POST",
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error?.message || "Failed to move to top");
      }

      return true;
    },
    onMutate: async (sessionId) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ["read-next-books"] });

      // Snapshot previous value
      const previousSessions = queryClient.getQueryData<SessionWithBook[]>([
        "read-next-books",
        search,
      ]);

      // Optimistically update cache
      if (previousSessions) {
        const sessionToMove = previousSessions.find((s) => s.id === sessionId);
        if (sessionToMove) {
          // Create new array with moved session at top
          const otherSessions = previousSessions.filter((s) => s.id !== sessionId);
          const optimisticSessions = [
            { ...sessionToMove, readNextOrder: 0 },
            ...otherSessions.map((s, index) => ({
              ...s,
              readNextOrder: index + 1,
            })),
          ];

          queryClient.setQueryData(["read-next-books", search], optimisticSessions);
        }
      }

      // Return context for rollback
      return { previousSessions };
    },
    onError: (err, variables, context) => {
      // Rollback to previous state
      if (context?.previousSessions) {
        queryClient.setQueryData(
          ["read-next-books", search],
          context.previousSessions
        );
      }
      const error = err instanceof Error ? err : new Error("Unknown error");
      toast.error(`Failed to move to top: ${error.message}`);
    },
    onSuccess: () => {
      toast.success("Moved to top of queue");
    },
    onSettled: () => {
      // Refetch after error or success to sync with server
      queryClient.invalidateQueries({ queryKey: ["read-next-books"] });
    },
  });

  const moveToBottomMutation = useMutation({
    mutationFn: async (sessionId: number) => {
      const response = await fetch(`/api/sessions/read-next/${sessionId}/move-to-bottom`, {
        method: "POST",
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error?.message || "Failed to move to bottom");
      }

      return true;
    },
    onMutate: async (sessionId) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ["read-next-books"] });

      // Snapshot previous value
      const previousSessions = queryClient.getQueryData<SessionWithBook[]>([
        "read-next-books",
        search,
      ]);

      // Optimistically update cache
      if (previousSessions) {
        const sessionToMove = previousSessions.find((s) => s.id === sessionId);
        if (sessionToMove) {
          // Find current order of the session and max order in current list
          const currentOrder = sessionToMove.readNextOrder ?? 0;
          const maxOrder = Math.max(
            ...previousSessions.map((s) => s.readNextOrder ?? 0),
            0
          );

          // Mirror server logic:
          // - decrement sessions that were below (had higher order than) the moved one
          // - set moved session to the maxOrder
          const optimisticSessions = previousSessions.map((s) => {
            if (s.id === sessionId) {
              return { ...s, readNextOrder: maxOrder };
            }

            const order = s.readNextOrder ?? 0;
            if (order > currentOrder) {
              return { ...s, readNextOrder: order - 1 };
            }

            return s;
          });

          const sortedOptimisticSessions = optimisticSessions.slice().sort((a, b) => {
            const aOrder = a.readNextOrder ?? 0;
            const bOrder = b.readNextOrder ?? 0;
            if (aOrder !== bOrder) {
              return aOrder - bOrder;
            }
            return String(a.id).localeCompare(String(b.id));
          });

          queryClient.setQueryData(["read-next-books", search], sortedOptimisticSessions);
        }
      }

      // Return context for rollback
      return { previousSessions };
    },
    onError: (err, variables, context) => {
      // Rollback to previous state
      if (context?.previousSessions) {
        queryClient.setQueryData(
          ["read-next-books", search],
          context.previousSessions
        );
      }
      const error = err instanceof Error ? err : new Error("Unknown error");
      toast.error(`Failed to move to bottom: ${error.message}`);
    },
    onSuccess: () => {
      toast.success("Moved to bottom of queue");
    },
    onSettled: () => {
      // Refetch after error or success to sync with server
      queryClient.invalidateQueries({ queryKey: ["read-next-books"] });
    },
  });

  return {
    sessions,
    loading: isLoading || removeMutation.isPending,
    error,
    reorderBooks: reorderMutation.mutateAsync,
    removeBooks: removeMutation.mutateAsync,
    moveToTop: moveToTopMutation.mutateAsync,
    moveToBottom: moveToBottomMutation.mutateAsync,
    isReordering: reorderMutation.isPending,
    isRemoving: removeMutation.isPending,
    isMovingToTop: moveToTopMutation.isPending,
  };
}
