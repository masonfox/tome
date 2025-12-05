import { useState, useEffect, useCallback } from "react";
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
 *
 * @param book - The current book data
 * @param progress - Array of progress entries for the active session
 * @param bookId - The ID of the book
 * @param onStatusChange - Callback fired when status changes
 * @param onRefresh - Callback to refresh book and progress data
 * @returns Status management state and functions
 */
export function useBookStatus(
  book: Book | null,
  progress: ProgressEntry[],
  bookId: string,
  onStatusChange?: () => void,
  onRefresh?: () => void
): UseBookStatusReturn {
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

  const performStatusChange = useCallback(async (newStatus: string) => {
    // OPTIMISTIC UPDATE: Set status immediately for instant UI feedback
    const previousStatus = selectedStatus;
    setSelectedStatus(newStatus);

    try {
      const body: any = { status: newStatus };

      const response = await fetch(`/api/books/${bookId}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (response.ok) {
        const data = await response.json();

        // Call callbacks
        onStatusChange?.();
        onRefresh?.();

        // Check if session was archived
        if (data.sessionArchived) {
          toast.success(
            `Session archived as Read #${data.archivedSessionNumber}. Starting fresh with ${newStatus === "read-next" ? "Read Next" : "Want to Read"} status.`
          );
        } else {
          toast.success("Status updated");
        }
      } else {
        // Rollback optimistic update on error
        setSelectedStatus(previousStatus);
        toast.error("Failed to update status");
      }
    } catch (error) {
      // Rollback optimistic update on error
      setSelectedStatus(previousStatus);
      getLogger().error({ err: error }, "Failed to update status");
      toast.error("Failed to update status");
    }
  }, [bookId, selectedStatus, onStatusChange, onRefresh]);

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
    await performStatusChange(newStatus);
  }, [selectedStatus, progress, performStatusChange]);

  const handleConfirmStatusChange = useCallback(async () => {
    setShowStatusChangeConfirmation(false);
    if (pendingStatusChange) {
      await performStatusChange(pendingStatusChange);
      setPendingStatusChange(null);
    }
  }, [pendingStatusChange, performStatusChange]);

  const handleCancelStatusChange = useCallback(() => {
    setShowStatusChangeConfirmation(false);
    setShowReadConfirmation(false);
    setPendingStatusChange(null);
  }, []);

  const handleConfirmRead = useCallback(async (rating: number, review?: string) => {
    setShowReadConfirmation(false);

    // OPTIMISTIC UPDATE: Set status immediately
    const previousStatus = selectedStatus;
    setSelectedStatus("read");

    try {
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
          getLogger().error("Failed to update progress to 100%");
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

      if (statusResponse.ok) {
        onRefresh?.();
        toast.success("Marked as read!");
      } else {
        // Rollback on error
        setSelectedStatus(previousStatus);
        toast.error("Failed to mark book as read");
      }
    } catch (error) {
      // Rollback on error
      setSelectedStatus(previousStatus);
      getLogger().error({ err: error }, "Failed to mark book as read");
      toast.error("Failed to mark book as read");
    }
  }, [book, bookId, selectedStatus, onRefresh]);

  const handleStartReread = useCallback(async () => {
    try {
      const response = await fetch(`/api/books/${bookId}/reread`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      if (response.ok) {
        toast.success("Started re-reading! Your previous read has been archived.");
        onRefresh?.();
      } else {
        const error = await response.json();
        toast.error(error.error || "Failed to start re-reading");
      }
    } catch (error) {
      console.error("Failed to start re-reading:", error);
      toast.error("Failed to start re-reading");
    }
  }, [bookId, onRefresh]);

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
