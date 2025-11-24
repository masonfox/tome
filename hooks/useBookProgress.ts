import { useState, useEffect, useCallback } from "react";
import type { Book } from "./useBookDetail";
import { toast } from "@/utils/toast";

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
  currentPage: string;
  currentPercentage: string;
  progressInputMode: "page" | "percentage";
  notes: string;
  progressDate: string;
  hasUnsavedProgress: boolean;
  showEditProgressModal: boolean;
  selectedProgressEntry: ProgressEntry | null;
  setCurrentPage: (value: string) => void;
  setCurrentPercentage: (value: string) => void;
  setProgressInputMode: (mode: "page" | "percentage") => void;
  setNotes: (value: string) => void;
  setProgressDate: (value: string) => void;
  handleLogProgress: (e: React.FormEvent) => Promise<void>;
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
  clearFormState: () => void;
}

/**
 * Custom hook for managing book progress tracking and logging
 *
 * @param bookId - The ID of the book
 * @param book - The current book data
 * @param onRefresh - Callback to refresh book data
 * @returns Progress management state and functions
 */
export function useBookProgress(
  bookId: string,
  book: Book | null,
  onRefresh?: () => void
): UseBookProgressReturn {
  const [progress, setProgress] = useState<ProgressEntry[]>([]);
  const [currentPage, setCurrentPage] = useState("");
  const [currentPercentage, setCurrentPercentage] = useState("");
  const [progressInputMode, setProgressInputModeState] = useState<"page" | "percentage">("page");
  const [notes, setNotes] = useState("");
  const [progressDate, setProgressDate] = useState("");
  const [hasUnsavedProgress, setHasUnsavedProgress] = useState(false);
  const [showEditProgressModal, setShowEditProgressModal] = useState(false);
  const [selectedProgressEntry, setSelectedProgressEntry] = useState<ProgressEntry | null>(null);

  // Fetch progress entries
  const fetchProgress = useCallback(async () => {
    try {
      const response = await fetch(`/api/books/${bookId}/progress`);
      const data = await response.json();
      setProgress(data);
    } catch (error) {
      console.error("Failed to fetch progress:", error);
    }
  }, [bookId]);

  // Initialize progress on mount
  useEffect(() => {
    fetchProgress();
  }, [fetchProgress]);

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
      setProgressDate(new Date().toISOString().split("T")[0]);
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

  const handleLogProgress = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();

    const payload: any = {};

    if (progressInputMode === "page") {
      if (!currentPage) return;
      const pageValue = parseInt(currentPage);
      // Validate that the new page is greater than the latest progress
      if (book?.latestProgress && pageValue <= book.latestProgress.currentPage) {
        toast.error("Please enter a page number greater than the current page.");
        return;
      }
      payload.currentPage = pageValue;
    } else {
      if (!currentPercentage) return;
      const percentValue = parseFloat(currentPercentage);
      // Validate that the new percentage is greater than the latest progress
      if (book?.latestProgress && percentValue <= book.latestProgress.currentPercentage) {
        toast.error("Please enter a percentage greater than the current progress.");
        return;
      }
      payload.currentPercentage = percentValue;
    }

    payload.notes = notes;

    // Add progressDate to payload if provided
    if (progressDate) {
      payload.progressDate = new Date(progressDate + "T00:00:00.000Z").toISOString();
    }

    try {
      const response = await fetch(`/api/books/${bookId}/progress`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        const newProgressEntry = await response.json();
        setNotes("");
        setProgressDate(new Date().toISOString().split("T")[0]); // Reset to today
        setHasUnsavedProgress(false); // Clear unsaved flag after successful submission

        fetchProgress();
        onRefresh?.();
        toast.success("Progress logged!");
      } else {
        const errorData = await response.json();
        // Display validation error from the API (temporal validation)
        toast.error(errorData.error || "Failed to log progress");
      }
    } catch (error) {
      console.error("Failed to log progress:", error);
      toast.error("Failed to log progress");
    }
  }, [progressInputMode, currentPage, currentPercentage, notes, progressDate, book, bookId, fetchProgress, onRefresh]);

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
      const response = await fetch(`/api/books/${bookId}/progress/${selectedProgressEntry.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updatedData),
      });

      if (response.ok) {
        setShowEditProgressModal(false);
        setSelectedProgressEntry(null);
        fetchProgress();
        onRefresh?.();
        toast.success("Progress updated");
      } else {
        const errorData = await response.json();
        toast.error(errorData.error || "Failed to update progress");
      }
    } catch (error) {
      console.error("Failed to update progress:", error);
      toast.error("Failed to update progress");
    }
  }, [selectedProgressEntry, bookId, fetchProgress, onRefresh]);

  const handleDeleteProgress = useCallback(async () => {
    if (!selectedProgressEntry) return;

    try {
      const response = await fetch(`/api/books/${bookId}/progress/${selectedProgressEntry.id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        setShowEditProgressModal(false);
        setSelectedProgressEntry(null);
        fetchProgress();
        onRefresh?.();
        toast.success("Progress entry deleted");
      } else {
        toast.error("Failed to delete progress entry");
      }
    } catch (error) {
      console.error("Failed to delete progress:", error);
      toast.error("Failed to delete progress");
    }
  }, [selectedProgressEntry, bookId, fetchProgress, onRefresh]);

  const closeEditModal = useCallback(() => {
    setShowEditProgressModal(false);
    setSelectedProgressEntry(null);
  }, []);

  const refetchProgress = useCallback(async () => {
    await fetchProgress();
  }, [fetchProgress]);

  const clearFormState = useCallback(() => {
    setCurrentPage("");
    setCurrentPercentage("");
    setNotes("");
    setProgressDate(new Date().toISOString().split("T")[0]);
    setHasUnsavedProgress(false);
  }, []);

  return {
    progress,
    currentPage,
    currentPercentage,
    progressInputMode,
    notes,
    progressDate,
    hasUnsavedProgress,
    showEditProgressModal,
    selectedProgressEntry,
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
    clearFormState,
  };
}
