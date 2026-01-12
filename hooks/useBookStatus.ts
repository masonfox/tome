import { useState, useEffect, useCallback } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { Book } from "./useBookDetail";
import { toast } from "@/utils/toast";
import { getLogger } from "@/lib/logger";
import { bookApi, ApiError } from "@/lib/api";
import { libraryService } from "@/lib/library-service";

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
 * Exported to allow reuse in components that make direct API calls
 */
export function invalidateBookQueries(queryClient: any, bookId: string): void {
  queryClient.invalidateQueries({ queryKey: ['book', bookId] });
  queryClient.invalidateQueries({ queryKey: ['sessions', bookId] });
  queryClient.invalidateQueries({ queryKey: ['progress', bookId] });
  queryClient.invalidateQueries({ queryKey: ['dashboard'] });
  queryClient.invalidateQueries({ queryKey: ['library-books'] });

  // Clear entire LibraryService cache to ensure status changes reflect across all filters
  libraryService.clearCache();
}

export interface CompleteBookData {
  totalPages?: number;
  startDate: string;
  endDate: string;
  rating?: number;
  review?: string;
}

export interface UseBookStatusReturn {
  selectedStatus: string;
  showReadConfirmation: boolean;
  showStatusChangeConfirmation: boolean;
  showCompleteBookModal: boolean;
  showDNFModal: boolean;
  pendingStatusChange: string | null;
  handleUpdateStatus: (newStatus: string) => Promise<void>;
  handleConfirmStatusChange: () => Promise<void>;
  handleCancelStatusChange: () => void;
  handleConfirmRead: (rating?: number, review?: string) => Promise<void>;
  handleCompleteBook: (data: CompleteBookData) => Promise<void>;
  handleStartReread: () => Promise<void>;
  handleMarkAsDNF: (rating?: number, review?: string, dnfDate?: string) => Promise<void>;
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
  const [showCompleteBookModal, setShowCompleteBookModal] = useState(false);
  const [showDNFModal, setShowDNFModal] = useState(false);
  const [pendingStatusChange, setPendingStatusChange] = useState<string | null>(null);

  // Initialize status from book data
  useEffect(() => {
    if (book?.activeSession) {
      setSelectedStatus(book.activeSession.status);
    } else if (book?.hasCompletedReads) {
      setSelectedStatus("read");
    }
  }, [book]);

  // Mutation for status updates - uses bookApi
  const statusMutation = useMutation({
    mutationFn: async ({ status }: { status: string }) => {
      return await bookApi.updateStatus(bookId, {
        status: status as any,
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

  // Mutation for marking as read - uses bookApi
  const markAsReadMutation = useMutation({
    mutationFn: async ({ rating, review }: { rating?: number; review?: string }) => {
      return await bookApi.markAsRead(bookId, {
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

  // Mutation for starting a re-read - uses bookApi
  const rereadMutation = useMutation({
    mutationFn: async () => {
      return await bookApi.startReread(bookId);
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

  // Mutation for completing a book - uses bookApi
  const completeBookMutation = useMutation({
    mutationFn: async (data: CompleteBookData) => {
      return await bookApi.completeBook(bookId, data);
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

      if (error instanceof ApiError) {
        getLogger().error({
          statusCode: error.statusCode,
          endpoint: error.endpoint,
          details: error.details
        }, "Failed to complete book");
      } else {
        getLogger().error({ err: error }, "Failed to complete book");
      }
      toast.error("Failed to mark book as read");
    },
    onSuccess: () => {
      // Invalidate all related queries
      invalidateBookQueries(queryClient, bookId);
      toast.success("Book marked as read!");
      setShowCompleteBookModal(false);

      // Legacy callbacks for compatibility
      onRefresh?.();
    },
  });

  // Mutation for marking as DNF
  const markAsDNFMutation = useMutation({
    mutationFn: async ({ rating, review, dnfDate }: { rating?: number; review?: string; dnfDate?: string }) => {
      const response = await fetch(`/api/books/${bookId}/mark-as-dnf`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating, review, dnfDate }),
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new ApiError(
          errorData.error || "Failed to mark as DNF",
          response.status,
          `/api/books/${bookId}/mark-as-dnf`,
          errorData
        );
      }
      
      return response.json();
    },
    onMutate: async () => {
      // Cancel outgoing queries and snapshot state
      await queryClient.cancelQueries({ queryKey: ['book', bookId] });
      const previousStatus = selectedStatus;

      // Optimistic update
      setSelectedStatus("dnf");
      return { previousStatus };
    },
    onError: (error, _variables, context) => {
      // Rollback
      if (context?.previousStatus) {
        setSelectedStatus(context.previousStatus);
      }

      if (error instanceof ApiError) {
        getLogger().error({
          statusCode: error.statusCode,
          endpoint: error.endpoint,
          details: error.details
        }, "Failed to mark book as DNF");
      } else {
        getLogger().error({ err: error }, "Failed to mark book as DNF");
      }
      toast.error("Failed to mark book as DNF");
    },
    onSuccess: (data) => {
      // Invalidate all related queries
      invalidateBookQueries(queryClient, bookId);

      // Build success message based on what was updated
      const messages = ["Marked as Did Not Finish"];
      if (data.ratingUpdated) messages.push("Rating saved");
      if (data.reviewUpdated) messages.push("Review saved");

      toast.success(messages.join(" • "));

      // Legacy callbacks for compatibility
      onRefresh?.();
    },
  });

  const handleUpdateStatus = useCallback(async (newStatus: string) => {
    // If marking as "read" from non-reading status, show CompleteBookModal
    if (newStatus === "read" && selectedStatus !== "read" && selectedStatus !== "reading") {
      setShowCompleteBookModal(true);
      return;
    }

    // If marking as "read" from "reading" status, show FinishBookModal
    if (newStatus === "read" && selectedStatus === "reading") {
      setShowReadConfirmation(true);
      return;
    }

    // If marking as "dnf" from "reading" status, show DNFBookModal
    if (newStatus === "dnf" && selectedStatus === "reading") {
      setShowDNFModal(true);
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
    setShowCompleteBookModal(false);
    setShowDNFModal(false);
    setPendingStatusChange(null);
  }, []);

  const handleConfirmRead = useCallback(async (rating?: number, review?: string) => {
    setShowReadConfirmation(false);
    await markAsReadMutation.mutateAsync({ rating, review });
  }, [markAsReadMutation]);

  const handleCompleteBook = useCallback(async (data: CompleteBookData) => {
    await completeBookMutation.mutateAsync(data);
  }, [completeBookMutation]);

  const handleStartReread = useCallback(async () => {
    await rereadMutation.mutateAsync();
  }, [rereadMutation]);

  const handleMarkAsDNF = useCallback(async (rating?: number, review?: string, dnfDate?: string) => {
    await markAsDNFMutation.mutateAsync({ rating, review, dnfDate });
    setShowDNFModal(false);
  }, [markAsDNFMutation]);

  return {
    selectedStatus,
    showReadConfirmation,
    showStatusChangeConfirmation,
    showCompleteBookModal,
    showDNFModal,
    pendingStatusChange,
    handleUpdateStatus,
    handleConfirmStatusChange,
    handleCancelStatusChange,
    handleConfirmRead,
    handleCompleteBook,
    handleStartReread,
    handleMarkAsDNF,
  };
}
