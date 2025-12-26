import { useState, useEffect, useCallback } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { Book } from "./useBookDetail";
import { toast } from "@/utils/toast";
import { getLogger } from "@/lib/logger";

interface ProgressEntry {
  id: number;
  currentPage: number;
  currentPercentage: number;
  progressDate: string;
  notes?: string;
  pagesRead: number;
}

export interface UseBookStatusReturn {
  selectedStatus: string;
  showReadConfirmation: boolean;
  showStatusChangeConfirmation: boolean;
  pendingStatusChange: string | null;
  handleUpdateStatus: (newStatus: string) => Promise<void>;
  handleConfirmStatusChange: () => Promise<void>;
  handleCancelStatusChange: () => void;
  handleConfirmRead: (rating: number, review?: string) => Promise<void>;
  handleStartReread: () => Promise<void>;
}

/**
 * Custom hook for managing book status updates and transitions
 * Uses TanStack Query for automatic cache invalidation
 *
 * @param book - The current book data
 * @param progress - Array of progress entries for the active session
 * @param bookId - The ID of the book
 * @param onStatusChange - Callback fired when status changes (deprecated - use query invalidation)
 * @param onRefresh - Callback to refresh book and progress data (deprecated - automatic via query invalidation)
 * @returns Status management state and functions
 */
export function useBookStatus(
  book: Book | null,
  progress: ProgressEntry[],
  bookId: string,
  onStatusChange?: () => void,
  onRefresh?: () => void
): UseBookStatusReturn {
  const queryClient = useQueryClient();
  const [selectedStatus, setSelectedStatus] = useState("to-read");
  const [showReadConfirmation, setShowReadConfirmation] = useState(false);
  const [showStatusChangeConfirmation, setShowStatusChangeConfirmation] = useState(false);
  const [pendingStatusChange, setPendingStatusChange] = useState<string | null>(null);

  // Initialize status from book data
  useEffect(() => {
    if (book?.activeSession) {
      setSelectedStatus(book.activeSession.status);
    } else if (book?.hasCompletedReads) {
      setSelectedStatus("read");
    }
  }, [book]);

  // Mutation for status updates
  const statusMutation = useMutation({
    mutationFn: async ({ status, rating, review }: { status: string; rating?: number; review?: string }) => {
      const body: any = { status };
      if (rating !== undefined && rating > 0) {
        body.rating = rating;
      }
      if (review) {
        body.review = review;
      }

      const response = await fetch(`/api/books/${bookId}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to update status");
      }

      return response.json();
    },
    onMutate: async ({ status }) => {
      // Cancel outgoing queries
      await queryClient.cancelQueries({ queryKey: ['book', bookId] });

      // Snapshot previous value
      const previousStatus = selectedStatus;
      
      // Optimistic update
      setSelectedStatus(status);

      return { previousStatus };
    },
    onError: (error, _variables, context) => {
      // Rollback on error
      if (context?.previousStatus) {
        setSelectedStatus(context.previousStatus);
      }
      getLogger().error({ err: error }, "Failed to update status");
      toast.error("Failed to update status");
    },
    onSuccess: (data) => {
      // Invalidate and refetch related queries
      queryClient.invalidateQueries({ queryKey: ['book', bookId] });
      queryClient.invalidateQueries({ queryKey: ['sessions', bookId] });
      queryClient.invalidateQueries({ queryKey: ['progress', bookId] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] }); // Invalidate dashboard when book status changes
      queryClient.invalidateQueries({ queryKey: ['library-books'] }); // Invalidate library

      // Call legacy callbacks for compatibility (will be removed later)
      onStatusChange?.();
      onRefresh?.();

      // Check if session was archived
      if (data.sessionArchived) {
        toast.success(
          `Session archived as Read #${data.archivedSessionNumber}. Starting fresh with ${data.status === "read-next" ? "Read Next" : "Want to Read"} status.`
        );
      } else {
        toast.success("Status updated");
      }
    },
  });

  // Mutation for marking as read (includes progress update)
  const markAsReadMutation = useMutation({
    mutationFn: async ({ rating, review }: { rating: number; review?: string }) => {
      // First, set the progress to 100% if book has total pages
      if (book?.totalPages) {
        const progressPayload = {
          currentPage: book.totalPages,
          currentPercentage: 100,
          notes: "Marked as read",
        };

        const progressResponse = await fetch(`/api/books/${bookId}/progress`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(progressPayload),
        });

        if (!progressResponse.ok) {
          const errorDetails: any = {
            status: progressResponse.status,
            statusText: progressResponse.statusText,
          };
          try {
            const data = await progressResponse.json();
            errorDetails.body = data;
          } catch (e) {
            // Ignore JSON parse errors
          }
          getLogger().error({ err: errorDetails }, "Failed to update progress to 100%");
        }
      }

      // Then, update the status to "read"
      const statusBody: any = { status: "read" };
      if (rating > 0) {
        statusBody.rating = rating;
      }
      if (review) {
        statusBody.review = review;
      }

      const statusResponse = await fetch(`/api/books/${bookId}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(statusBody),
      });

      if (!statusResponse.ok) {
        throw new Error("Failed to mark book as read");
      }

      return statusResponse.json();
    },
    onMutate: async () => {
      // Optimistic update
      const previousStatus = selectedStatus;
      setSelectedStatus("read");
      return { previousStatus };
    },
    onError: (error, _variables, context) => {
      // Rollback
      if (context?.previousStatus) {
        setSelectedStatus(context.previousStatus);
      }
      getLogger().error({ err: error }, "Failed to mark book as read");
      toast.error("Failed to mark book as read");
    },
    onSuccess: () => {
      // Invalidate all related queries
      queryClient.invalidateQueries({ queryKey: ['book', bookId] });
      queryClient.invalidateQueries({ queryKey: ['sessions', bookId] });
      queryClient.invalidateQueries({ queryKey: ['progress', bookId] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] }); // Invalidate dashboard when marked as read
      queryClient.invalidateQueries({ queryKey: ['library-books'] }); // Invalidate library
      
      onRefresh?.();
      toast.success("Marked as read!");
    },
  });

  // Mutation for starting a re-read
  const rereadMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/books/${bookId}/reread`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to start re-reading");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['book', bookId] });
      queryClient.invalidateQueries({ queryKey: ['sessions', bookId] });
      queryClient.invalidateQueries({ queryKey: ['progress', bookId] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] }); // Invalidate dashboard when reread starts
      queryClient.invalidateQueries({ queryKey: ['library-books'] }); // Invalidate library
      
      toast.success("Started re-reading! Your previous read has been archived.");
      onRefresh?.();
    },
    onError: (error) => {
      console.error("Failed to start re-reading:", error);
      toast.error("Failed to start re-reading");
    },
  });

  const handleUpdateStatus = useCallback(async (newStatus: string) => {
    // If marking as "read", show confirmation dialog
    if (newStatus === "read" && selectedStatus !== "read") {
      setShowReadConfirmation(true);
      return;
    }

    // Check if this is backward movement from "reading" to planning statuses
    const isBackwardMovement =
      selectedStatus === "reading" &&
      (newStatus === "read-next" || newStatus === "to-read");

    // If backward movement and we have progress, show confirmation
    if (isBackwardMovement && progress.length > 0) {
      setPendingStatusChange(newStatus);
      setShowStatusChangeConfirmation(true);
      return;
    }

    // Proceed with status change
    await statusMutation.mutateAsync({ status: newStatus });
  }, [selectedStatus, progress, statusMutation]);

  const handleConfirmStatusChange = useCallback(async () => {
    setShowStatusChangeConfirmation(false);
    if (pendingStatusChange) {
      await statusMutation.mutateAsync({ status: pendingStatusChange });
      setPendingStatusChange(null);
    }
  }, [pendingStatusChange, statusMutation]);

  const handleCancelStatusChange = useCallback(() => {
    setShowStatusChangeConfirmation(false);
    setShowReadConfirmation(false);
    setPendingStatusChange(null);
  }, []);

  const handleConfirmRead = useCallback(async (rating: number, review?: string) => {
    setShowReadConfirmation(false);
    await markAsReadMutation.mutateAsync({ rating, review });
  }, [markAsReadMutation]);

  const handleStartReread = useCallback(async () => {
    await rereadMutation.mutateAsync();
  }, [rereadMutation]);

  return {
    selectedStatus,
    showReadConfirmation,
    showStatusChangeConfirmation,
    pendingStatusChange,
    handleUpdateStatus,
    handleConfirmStatusChange,
    handleCancelStatusChange,
    handleConfirmRead,
    handleStartReread,
  };
}
