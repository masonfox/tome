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

// ============================================================================
// Helper Functions - Extracted to eliminate duplication
// ============================================================================

/**
 * Ensures a book is in "reading" status, transitioning if necessary
 */
async function ensureReadingStatus(
  bookId: string,
  currentStatus?: string
): Promise<void> {
  if (currentStatus === "reading") return;

  const response = await fetch(`/api/books/${bookId}/status`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status: "reading" }),
  });

  if (!response.ok) {
    throw new Error("Failed to transition to reading status");
  }

  getLogger().info({ bookId, from: currentStatus, to: "reading" }, "Transitioned book to reading status");
}

/**
 * Creates a 100% progress entry for a book (triggers auto-completion to "read")
 */
async function create100PercentProgress(
  bookId: string,
  totalPages: number
): Promise<void> {
  const response = await fetch(`/api/books/${bookId}/progress`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      currentPage: totalPages,
      currentPercentage: 100,
      notes: "Marked as read",
    }),
  });

  if (!response.ok) {
    const errorDetails: any = {
      status: response.status,
      statusText: response.statusText,
    };
    try {
      const data = await response.json();
      errorDetails.body = data;
    } catch (e) {
      // Ignore JSON parse errors
    }
    getLogger().error({ err: errorDetails }, "Failed to create 100% progress entry");
    throw new Error("Failed to create 100% progress entry");
  }

  getLogger().info({ bookId, totalPages }, "Created 100% progress entry (auto-completing to read)");
}

/**
 * Updates book rating in the books table
 */
async function updateRating(bookId: string, rating: number): Promise<void> {
  const response = await fetch(`/api/books/${bookId}/rating`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ rating }),
  });

  if (!response.ok) {
    getLogger().error({ bookId, rating }, "Failed to update rating");
    throw new Error("Failed to update rating");
  }

  getLogger().info({ bookId, rating }, "Updated book rating");
}

/**
 * Updates review on a reading session
 */
async function updateSessionReview(
  bookId: string,
  sessionId: number,
  review: string
): Promise<void> {
  const response = await fetch(`/api/books/${bookId}/sessions/${sessionId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ review }),
  });

  if (!response.ok) {
    getLogger().error({ bookId, sessionId }, "Failed to update session review");
    throw new Error("Failed to update session review");
  }

  getLogger().info({ bookId, sessionId }, "Updated session review");
}

/**
 * Updates book status directly (without progress tracking)
 */
async function updateBookStatus(bookId: string, status: string): Promise<void> {
  const response = await fetch(`/api/books/${bookId}/status`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
  });

  if (!response.ok) {
    throw new Error(`Failed to update book status to ${status}`);
  }

  getLogger().info({ bookId, status }, "Updated book status");
}

/**
 * Finds the most recent completed reading session for a book
 */
async function findMostRecentCompletedSession(bookId: string): Promise<number | undefined> {
  const response = await fetch(`/api/books/${bookId}/sessions`);
  
  if (!response.ok) {
    getLogger().error({ bookId }, "Failed to fetch sessions");
    return undefined;
  }

  const sessions = await response.json();
  
  if (!Array.isArray(sessions)) {
    return undefined;
  }

  const completedSessions = sessions.filter(
    (s: any) => !s.isActive && s.status === "read"
  );

  if (completedSessions.length === 0) {
    return undefined;
  }

  // Sort by completedDate descending to get most recent
  completedSessions.sort((a: any, b: any) =>
    new Date(b.completedDate || 0).getTime() - new Date(a.completedDate || 0).getTime()
  );

  return completedSessions[0].id;
}

/**
 * Updates rating and review after marking book as read
 * Handles both operations with best-effort error handling
 */
async function updateRatingAndReview(
  bookId: string,
  rating?: number,
  review?: string,
  sessionId?: number
): Promise<void> {
  const errors: string[] = [];

  // Update rating if provided (non-blocking)
  if (rating && rating > 0) {
    try {
      await updateRating(bookId, rating);
    } catch (error) {
      errors.push("rating");
      // Don't throw - book is already marked as read
    }
  }

  // Update review if provided (non-blocking)
  if (review && sessionId) {
    try {
      await updateSessionReview(bookId, sessionId, review);
    } catch (error) {
      errors.push("review");
      // Don't throw - book is already marked as read
    }
  }

  if (errors.length > 0) {
    getLogger().warn({ bookId, errors }, "Some updates failed after marking as read");
  }
}

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

interface MarkAsReadParams {
  bookId: string;
  book: Book | null;
  progress: ProgressEntry[];
  rating?: number;
  review?: string;
}

interface MarkAsReadResult {
  success: boolean;
  sessionId?: number;
}

/**
 * Unified function for marking a book as "read"
 * Handles all the complex logic for status transitions and progress tracking
 * 
 * Flow:
 * 1. Determine if book needs 100% progress or direct status change
 * 2. Ensure book is in "reading" status if needed (for progress tracking)
 * 3. Create 100% progress entry (auto-completes) OR change status directly
 * 4. Update rating and review
 */
async function markBookAsRead(params: MarkAsReadParams): Promise<MarkAsReadResult> {
  const { bookId, book, progress, rating, review } = params;

  const currentStatus = book?.activeSession?.status;
  const has100Progress = progress.some(p => p.currentPercentage >= 100);
  const isAlreadyRead = currentStatus === "read";

  let sessionId = book?.activeSession?.id;

  getLogger().info({
    bookId,
    currentStatus,
    has100Progress,
    isAlreadyRead,
    totalPages: book?.totalPages,
    sessionId,
  }, "Starting markBookAsRead");

  // Step 1: Ensure book is marked as "read"
  if (!isAlreadyRead) {
    if (book?.totalPages && !has100Progress) {
      // Book has pages and no 100% progress yet
      // Need to create 100% progress entry (which auto-completes to "read")
      await ensureReadingStatus(bookId, currentStatus);
      await create100PercentProgress(bookId, book.totalPages);
      // Session ID is still valid - it gets archived during progress creation
    } else {
      // Book either has no totalPages, or already has 100% progress
      // Change status directly to "read"
      getLogger().info(
        { bookId, reason: !book?.totalPages ? "no totalPages" : "has 100% progress" },
        "Marking as read via direct status change"
      );
      await updateBookStatus(bookId, "read");
    }
  } else {
    // Book is already read - need to find the archived session for review
    getLogger().info({ bookId }, "Book already marked as read, finding archived session");
    sessionId = await findMostRecentCompletedSession(bookId);
  }

  // Step 2: Update rating and review (best-effort)
  await updateRatingAndReview(bookId, rating, review, sessionId);

  getLogger().info({ bookId, sessionId }, "Successfully marked book as read");

  return { success: true, sessionId };
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

  // Mutation for marking as read - uses unified markBookAsRead function
  const markAsReadMutation = useMutation({
    mutationFn: async ({ rating, review }: { rating: number; review?: string }) => {
      return markBookAsRead({
        bookId,
        book,
        progress,
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
    onSuccess: () => {
      // Invalidate all related queries
      invalidateBookQueries(queryClient, bookId);
      
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
      invalidateBookQueries(queryClient, bookId);
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
