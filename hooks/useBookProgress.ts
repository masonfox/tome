import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { Book } from "./useBookDetail";
import { toast } from "@/utils/toast";
import { parseISO, startOfDay } from "date-fns";
import { getTodayLocalDate } from "@/utils/dateFormatting";
import { getLogger } from "@/lib/logger";

const logger = getLogger().child({ hook: "useBookProgress" });

export interface ProgressEntry {
  id: number;
  currentPage: number;
  currentPercentage: number;
  progressDate: string;
  notes?: string;
  pagesRead: number;
}

export interface UseBookProgressReturn {
  progress: ProgressEntry[];
  isLoading: boolean;
  currentPage: string;
  currentPercentage: string;
  progressInputMode: "page" | "percentage";
  notes: string;
  progressDate: string;
  hasUnsavedProgress: boolean;
  showEditProgressModal: boolean;
  selectedProgressEntry: ProgressEntry | null;
  showCompletionModal: boolean;
  completedSessionId?: number; // Session ID when auto-completed
  setCurrentPage: (value: string) => void;
  setCurrentPercentage: (value: string) => void;
  setProgressInputMode: (mode: "page" | "percentage") => void;
  setNotes: (value: string) => void;
  setProgressDate: (value: string) => void;
  handleLogProgress: (e: React.FormEvent) => Promise<{ success: boolean; shouldShowCompletionModal?: boolean; completedSessionId?: number }>;
  handleEditProgress: (entry: ProgressEntry) => void;
  handleConfirmEditProgress: (updatedData: {
    currentPage?: number;
    currentPercentage?: number;
    progressDate?: string;
    notes?: string;
  }) => Promise<void>;
  handleDeleteProgress: () => Promise<void>;
  refetchProgress: () => Promise<void>;
  closeEditModal: () => void;
  closeCompletionModal: () => void;
  clearFormState: () => void;
}

/**
 * Custom hook for managing book progress tracking and logging
 *
 * @param bookId - The ID of the book
 * @param book - The current book data
 * @param onRefresh - Callback to refresh book data (deprecated, use TanStack Query invalidation)
 * @returns Progress management state and functions
 */
export function useBookProgress(
  bookId: string,
  book: Book | null,
  onRefresh?: () => void
): UseBookProgressReturn {
  const queryClient = useQueryClient();
  
  // Form state
  const [currentPage, setCurrentPage] = useState("");
  const [currentPercentage, setCurrentPercentage] = useState("");
  const [progressInputMode, setProgressInputModeState] = useState<"page" | "percentage">("page");
  const [notes, setNotes] = useState("");
  const [progressDate, setProgressDate] = useState(getTodayLocalDate());
  const [hasUnsavedProgress, setHasUnsavedProgress] = useState(false);
  const [showEditProgressModal, setShowEditProgressModal] = useState(false);
  const [selectedProgressEntry, setSelectedProgressEntry] = useState<ProgressEntry | null>(null);
  const [showCompletionModal, setShowCompletionModal] = useState(false);
  const [completedSessionId, setCompletedSessionId] = useState<number | undefined>();

  // Fetch progress entries with TanStack Query
  const { data: progress = [], isLoading } = useQuery({
    queryKey: ['progress', bookId],
    queryFn: async () => {
      const response = await fetch(`/api/books/${bookId}/progress`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache',
        },
      });
      if (!response.ok) {
        throw new Error('Failed to fetch progress');
      }
      return response.json() as Promise<ProgressEntry[]>;
    },
    staleTime: 30000, // 30 seconds
  });

  // Mutation for logging new progress
  const logProgressMutation = useMutation({
    mutationFn: async (payload: {
      currentPage?: number;
      currentPercentage?: number;
      notes: string;
      progressDate?: string;
    }) => {
      const response = await fetch(`/api/books/${bookId}/progress`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to log progress");
      }

      return response.json();
    },
    onSuccess: () => {
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: ['progress', bookId] });
      queryClient.invalidateQueries({ queryKey: ['book', bookId] });
      queryClient.invalidateQueries({ queryKey: ['sessions', bookId] }); // Refresh reading history
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['streak-analytics'] });
      queryClient.invalidateQueries({ queryKey: ['stats'] });
      
      // Clear form state
      setNotes("");
      setProgressDate(getTodayLocalDate());
      setHasUnsavedProgress(false);
      
      // Call deprecated onRefresh if provided
      onRefresh?.();
      
      toast.success("Progress logged!");
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  // Mutation for editing progress
  const editProgressMutation = useMutation({
    mutationFn: async (params: {
      progressId: number;
      data: {
        currentPage?: number;
        currentPercentage?: number;
        progressDate?: string;
        notes?: string;
      };
    }) => {
      const response = await fetch(`/api/books/${bookId}/progress/${params.progressId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params.data),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to update progress");
      }

      return response.json();
    },
    onSuccess: () => {
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: ['progress', bookId] });
      queryClient.invalidateQueries({ queryKey: ['book', bookId] });
      queryClient.invalidateQueries({ queryKey: ['sessions', bookId] }); // Refresh reading history
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['streak-analytics'] });
      queryClient.invalidateQueries({ queryKey: ['stats'] });
      
      // Close modal
      setShowEditProgressModal(false);
      setSelectedProgressEntry(null);
      
      // Call deprecated onRefresh if provided
      onRefresh?.();
      
      toast.success("Progress updated");
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  // Mutation for deleting progress
  const deleteProgressMutation = useMutation({
    mutationFn: async (progressId: number) => {
      const response = await fetch(`/api/books/${bookId}/progress/${progressId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to delete progress entry");
      }

      return response.json();
    },
    onSuccess: () => {
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: ['progress', bookId] });
      queryClient.invalidateQueries({ queryKey: ['book', bookId] });
      queryClient.invalidateQueries({ queryKey: ['sessions', bookId] }); // Refresh reading history
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['streak-analytics'] });
      queryClient.invalidateQueries({ queryKey: ['stats'] });
      
      // Close modal
      setShowEditProgressModal(false);
      setSelectedProgressEntry(null);
      
      // Call deprecated onRefresh if provided
      onRefresh?.();
      
      toast.success("Progress entry deleted");
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  // Load saved progress input mode preference
  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedMode = localStorage.getItem("progressInputMode");
      if (savedMode === "page" || savedMode === "percentage") {
        setProgressInputModeState(savedMode);
      }
    }
  }, []);

  // Initialize current values from latest progress
  useEffect(() => {
    if (book?.latestProgress) {
      setCurrentPage(book.latestProgress.currentPage.toString());
      setCurrentPercentage(book.latestProgress.currentPercentage.toString());
    }
  }, [book?.latestProgress]);

  // Set default progress date to today when viewing a reading book
  useEffect(() => {
    if (book?.activeSession?.status === "reading") {
      setProgressDate(getTodayLocalDate());
    }
  }, [book?.activeSession?.status]);

  // Track if form has unsaved changes
  useEffect(() => {
    // Only track unsaved changes if book is actively being read
    if (book?.activeSession?.status !== "reading") {
      setHasUnsavedProgress(false);
      return;
    }

    if (!book?.latestProgress) {
      // If there's notes or any progress value entered, mark as dirty
      const hasChanges = notes.trim() !== "" || currentPage !== "" || currentPercentage !== "";
      setHasUnsavedProgress(hasChanges);
      return;
    }

    // Check if values differ from latest progress
    const pageChanged = progressInputMode === "page" &&
      currentPage !== "" &&
      currentPage !== book.latestProgress.currentPage.toString();

    const percentageChanged = progressInputMode === "percentage" &&
      currentPercentage !== "" &&
      currentPercentage !== book.latestProgress.currentPercentage.toString();

    const hasNotes = notes.trim() !== "";

    setHasUnsavedProgress(pageChanged || percentageChanged || hasNotes);
  }, [currentPage, currentPercentage, notes, progressInputMode, book?.latestProgress, book?.activeSession?.status]);

  const setProgressInputMode = useCallback((mode: "page" | "percentage") => {
    setProgressInputModeState(mode);
    if (typeof window !== "undefined") {
      localStorage.setItem("progressInputMode", mode);
    }
    // Update current values when switching modes
    if (book?.latestProgress) {
      if (mode === "page") {
        setCurrentPage(book.latestProgress.currentPage.toString());
      } else {
        setCurrentPercentage(book.latestProgress.currentPercentage.toString());
      }
    }
  }, [book?.latestProgress]);

  const handleLogProgress = useCallback(async (e: React.FormEvent): Promise<{ success: boolean; shouldShowCompletionModal?: boolean; completedSessionId?: number }> => {
    e.preventDefault();

    const payload: any = {};

    if (progressInputMode === "page") {
      if (!currentPage) return { success: false };
      const pageValue = parseInt(currentPage);
      // Validate that the new page is greater than the latest progress
      if (book?.latestProgress && pageValue <= book.latestProgress.currentPage) {
        toast.error("Please enter a page number greater than the current page.");
        return { success: false };
      }
      payload.currentPage = pageValue;
    } else {
      if (!currentPercentage) return { success: false };
      const percentValue = parseFloat(currentPercentage);
      // Validate that the new percentage is greater than the latest progress
      if (book?.latestProgress && percentValue <= book.latestProgress.currentPercentage) {
        toast.error("Please enter a percentage greater than the current progress.");
        return { success: false };
      }
      payload.currentPercentage = percentValue;
    }

    payload.notes = notes;

    // Add progressDate to payload if provided
    if (progressDate) {
      // Parse the selected date and get midnight in LOCAL timezone
      // This ensures the timestamp represents the intended calendar day in the user's timezone
      const localMidnight = startOfDay(parseISO(progressDate));

      // Send as ISO string (will be stored as UTC but represents local midnight)
      payload.progressDate = localMidnight.toISOString();
    }

    try {
      const result = await logProgressMutation.mutateAsync(payload);
      logger.info({ bookId, result }, 'Progress log result');
      
      // Check if completion modal should be shown
      if (result.shouldShowCompletionModal) {
        logger.info({ bookId }, 'Setting showCompletionModal to true');
        setShowCompletionModal(true);
        setCompletedSessionId(result.completedSessionId);
      }
      
      return { 
        success: true, 
        shouldShowCompletionModal: result.shouldShowCompletionModal,
        completedSessionId: result.completedSessionId
      };
    } catch (error) {
      return { success: false };
    }
  }, [progressInputMode, currentPage, currentPercentage, notes, progressDate, book, logProgressMutation]);

  const handleEditProgress = useCallback((entry: ProgressEntry) => {
    setSelectedProgressEntry(entry);
    setShowEditProgressModal(true);
  }, []);

  const handleConfirmEditProgress = useCallback(async (updatedData: {
    currentPage?: number;
    currentPercentage?: number;
    progressDate?: string;
    notes?: string;
  }) => {
    if (!selectedProgressEntry) return;

    try {
      await editProgressMutation.mutateAsync({
        progressId: selectedProgressEntry.id,
        data: updatedData,
      });
    } catch (error) {
      // Error is already handled by mutation
      console.error("Failed to edit progress:", error);
    }
  }, [selectedProgressEntry, editProgressMutation]);

  const handleDeleteProgress = useCallback(async () => {
    if (!selectedProgressEntry) return;

    try {
      await deleteProgressMutation.mutateAsync(selectedProgressEntry.id);
    } catch (error) {
      // Error is already handled by mutation
      console.error("Failed to delete progress:", error);
    }
  }, [selectedProgressEntry, deleteProgressMutation]);

  const closeEditModal = useCallback(() => {
    setShowEditProgressModal(false);
    setSelectedProgressEntry(null);
  }, []);

  const closeCompletionModal = useCallback(() => {
    setShowCompletionModal(false);
  }, []);

  const refetchProgress = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ['progress', bookId] });
  }, [queryClient, bookId]);

  const clearFormState = useCallback(() => {
    setCurrentPage("");
    setCurrentPercentage("");
    setNotes("");
    setProgressDate(getTodayLocalDate());
    setHasUnsavedProgress(false);
  }, []);

  return {
    progress,
    isLoading,
    currentPage,
    currentPercentage,
    progressInputMode,
    notes,
    progressDate,
    hasUnsavedProgress,
    showEditProgressModal,
    selectedProgressEntry,
    showCompletionModal,
    completedSessionId,
    setCurrentPage,
    setCurrentPercentage,
    setProgressInputMode,
    setNotes,
    setProgressDate,
    handleLogProgress,
    handleEditProgress,
    handleConfirmEditProgress,
    handleDeleteProgress,
    refetchProgress,
    closeEditModal,
    closeCompletionModal,
    clearFormState,
  };
}
