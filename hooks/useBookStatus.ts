import { useState, useEffect, useCallback } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { Book } from "./useBookDetail";
import { toast } from "@/utils/toast";
import { getLogger } from "@/lib/logger";
import { bookApi, ApiError } from "@/lib/api";
import { sessionService } from "@/lib/services";

interface ProgressEntry {
  id: number;
  currentPage: number;
  currentPercentage: number;
  progressDate: string;
  notes?: string;
  pagesRead: number;
}

// ============================================================================
// Helper Functions - UI-specific helpers kept in hook
// ============================================================================

/**
 * Checks if status change requires archive confirmation
 */
function requiresArchiveConfirmation(
  currentStatus: string,
  newStatus: string,
  progress: ProgressEntry[]
): boolean {
  const isBackwardMovement =
    currentStatus === "reading" &&
    (newStatus === "read-next" || newStatus === "to-read");

  return isBackwardMovement && progress.length > 0;
}

/**
 * Invalidates all queries related to a book
 */
function invalidateBookQueries(queryClient: any, bookId: string): void {
  queryClient.invalidateQueries({ queryKey: ['book', bookId] });
  queryClient.invalidateQueries({ queryKey: ['sessions', bookId] });
  queryClient.invalidateQueries({ queryKey: ['progress', bookId] });
  queryClient.invalidateQueries({ queryKey: ['dashboard'] });
  queryClient.invalidateQueries({ queryKey: ['library-books'] });
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

  // Mutation for status updates - uses SessionService
  const statusMutation = useMutation({
    mutationFn: async ({ status, rating, review }: { status: string; rating?: number; review?: string }) => {
      return await sessionService.updateStatus(parseInt(bookId), {
        status: status as any,
        rating: rating !== undefined && rating > 0 ? rating : undefined,
        review,
      });
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
      
      if (error instanceof ApiError) {
        getLogger().error({ 
          statusCode: error.statusCode, 
          endpoint: error.endpoint, 
          details: error.details 
        }, "Failed to update status");
      } else {
        getLogger().error({ err: error }, "Failed to update status");
      }
      
      toast.error("Failed to update status");
    },
    onSuccess: (data) => {
      // Invalidate and refetch related queries
      invalidateBookQueries(queryClient, bookId);

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

  // Mutation for marking as read - uses SessionService
  const markAsReadMutation = useMutation({
    mutationFn: async ({ rating, review }: { rating?: number; review?: string }) => {
      return await sessionService.markAsRead({
        bookId: parseInt(bookId),
        rating,
        review,
      });
    },
    onMutate: async () => {
      // Cancel outgoing queries and snapshot state
      await queryClient.cancelQueries({ queryKey: ['book', bookId] });
      const previousStatus = selectedStatus;

      // Optimistic update
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
    onSuccess: (data) => {
      // Invalidate all related queries
      invalidateBookQueries(queryClient, bookId);

      // Build success message based on what was updated
      const messages = ["Marked as read!"];
      if (data.ratingUpdated) messages.push("Rating saved");
      if (data.reviewUpdated) messages.push("Review saved");

      toast.success(messages.join(" • "));

      // Legacy callbacks for compatibility
      onRefresh?.();
    },
  });

  // Mutation for starting a re-read - uses SessionService
  const rereadMutation = useMutation({
    mutationFn: async () => {
      return await sessionService.startReread(parseInt(bookId));
    },
    onSuccess: () => {
      invalidateBookQueries(queryClient, bookId);
      toast.success("Started re-reading! Your previous read has been archived.");
      onRefresh?.();
    },
    onError: (error) => {
      if (error instanceof ApiError) {
        getLogger().error({ 
          statusCode: error.statusCode, 
          endpoint: error.endpoint, 
          details: error.details 
        }, "Failed to start re-reading");
      } else {
        getLogger().error({ err: error }, "Failed to start re-reading");
      }
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
    if (requiresArchiveConfirmation(selectedStatus, newStatus, progress)) {
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
