"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import ReadingHistoryTab from "@/components/ReadingHistoryTab";
import FinishBookModal from "@/components/FinishBookModal";
import RatingModal from "@/components/RatingModal";
import ProgressEditModal from "@/components/ProgressEditModal";
import BookHeader from "@/components/BookDetail/BookHeader";
import BookMetadata from "@/components/BookDetail/BookMetadata";
import BookProgress from "@/components/BookDetail/BookProgress";
import ProgressHistory from "@/components/BookDetail/ProgressHistory";
import SessionDetails from "@/components/BookDetail/SessionDetails";
import { useBookDetail } from "@/hooks/useBookDetail";
import { useBookStatus } from "@/hooks/useBookStatus";
import { useBookProgress } from "@/hooks/useBookProgress";
import { useBookRating } from "@/hooks/useBookRating";
import { toast } from "@/utils/toast";

export default function BookDetailPage() {
  const params = useParams();
  const router = useRouter();
  const bookId = params?.id as string;

  // Custom hooks encapsulate all business logic
  const {
    book,
    loading,
    imageError,
    setImageError,
    refetchBook,
    updateTotalPages,
  } = useBookDetail(bookId);

  const bookProgressHook = useBookProgress(bookId, book, handleRefresh);

  const {
    selectedStatus,
    showReadConfirmation,
    showStatusChangeConfirmation,
    pendingStatusChange,
    handleUpdateStatus,
    handleConfirmStatusChange,
    handleCancelStatusChange,
    handleConfirmRead,
    handleStartReread,
  } = useBookStatus(book, bookProgressHook.progress, bookId, handleRefresh, handleRefresh);

  const {
    showRatingModal,
    openRatingModal,
    closeRatingModal,
    handleUpdateRating,
  } = useBookRating(book, bookId, handleRefresh);

  // Local UI state
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);
  const [showProgressModeDropdown, setShowProgressModeDropdown] = useState(false);
  const [historyRefreshKey, setHistoryRefreshKey] = useState(0);
  const [totalPagesInput, setTotalPagesInput] = useState("");

  // Session date editing state
  const [isEditingStartDate, setIsEditingStartDate] = useState(false);
  const [editStartDate, setEditStartDate] = useState("");

  // Refs for dropdowns
  const dropdownRef = useRef<HTMLDivElement>(null);
  const progressModeDropdownRef = useRef<HTMLDivElement>(null);

  // Centralized refresh handler
  function handleRefresh() {
    refetchBook();
    bookProgressHook.refetchProgress();
    router.refresh();
  }

  // Handle re-read with history refresh
  async function handleRereadClick() {
    await handleStartReread();
    setHistoryRefreshKey(prev => prev + 1);
  }

  // Session date editing handlers
  async function handleUpdateStartDate() {
    if (!book?.activeSession || !editStartDate) return;

    try {
      // Get active session ID
      const response = await fetch(`/api/books/${bookId}/sessions`);
      const sessions = await response.json();
      const activeSession = sessions.find((s: any) => s.isActive);

      if (!activeSession) {
        toast.error("No active reading session found");
        return;
      }

      // Update the session
      const updateResponse = await fetch(`/api/books/${bookId}/sessions/${activeSession.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          startedDate: new Date(editStartDate + "T00:00:00.000Z").toISOString(),
        }),
      });

      if (updateResponse.ok) {
        await refetchBook();
        setIsEditingStartDate(false);
        toast.success("Start date updated");
      } else {
        const error = await updateResponse.json();
        toast.error(error.error || "Failed to update start date");
      }
    } catch (error) {
      console.error("Failed to update start date:", error);
      toast.error("Failed to update start date");
    }
  }

  function handleStartEditingDate() {
    if (book?.activeSession?.startedDate) {
      setEditStartDate(book.activeSession.startedDate.split("T")[0]);
    } else {
      setEditStartDate(new Date().toISOString().split("T")[0]);
    }
    setIsEditingStartDate(true);
  }

  // Total pages submit handler
  async function handleTotalPagesSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!totalPagesInput || parseInt(totalPagesInput) <= 0) return;

    await updateTotalPages(parseInt(totalPagesInput));
    setTotalPagesInput("");
    toast.success("Pages updated");
    router.refresh();
  }

  // Close dropdowns when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowStatusDropdown(false);
      }
      if (progressModeDropdownRef.current && !progressModeDropdownRef.current.contains(event.target as Node)) {
        setShowProgressModeDropdown(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Warn before leaving with unsaved progress
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (bookProgressHook.hasUnsavedProgress) {
        e.preventDefault();
        e.returnValue = "";
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [bookProgressHook.hasUnsavedProgress]);

  // Loading state
  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="inline-block w-8 h-8 border-4 border-[var(--accent)] border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  // Not found state
  if (!book) {
    return (
      <div className="text-center py-12">
        <p className="text-[var(--foreground)]/60 font-medium">Book not found</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      {/* Book Header with Cover, Status, Rating */}
      <BookHeader
        book={book}
        selectedStatus={selectedStatus}
        imageError={imageError}
        onImageError={() => setImageError(true)}
        onStatusChange={handleUpdateStatus}
        onRatingClick={openRatingModal}
        onRereadClick={handleRereadClick}
        showStatusDropdown={showStatusDropdown}
        setShowStatusDropdown={setShowStatusDropdown}
        dropdownRef={dropdownRef}
        rating={book.rating}
        hasCompletedReads={book.hasCompletedReads || false}
        hasActiveSession={!!book.activeSession}
      />

      <div className="grid md:grid-cols-[250px_1fr] gap-8">
        {/* Empty left column for layout alignment */}
        <div />

        {/* Right column with main content */}
        <div className="space-y-6">
          <hr className="border-[var(--border-color)]" />

          {/* Session Details (Started Date) */}
          {selectedStatus === "reading" && book.activeSession && (
            <SessionDetails
              startedDate={book.activeSession.startedDate}
              isEditingStartDate={isEditingStartDate}
              editStartDate={editStartDate}
              onStartEditingDate={handleStartEditingDate}
              onEditStartDateChange={setEditStartDate}
              onCancelEdit={() => setIsEditingStartDate(false)}
              onSaveStartDate={handleUpdateStartDate}
            />
          )}

          {/* Progress Bar & Logging Form */}
          {selectedStatus === "reading" && (
            <BookProgress
              book={book}
              currentPage={bookProgressHook.currentPage}
              currentPercentage={bookProgressHook.currentPercentage}
              progressInputMode={bookProgressHook.progressInputMode}
              notes={bookProgressHook.notes}
              progressDate={bookProgressHook.progressDate}
              onCurrentPageChange={bookProgressHook.setCurrentPage}
              onCurrentPercentageChange={bookProgressHook.setCurrentPercentage}
              onNotesChange={bookProgressHook.setNotes}
              onProgressDateChange={bookProgressHook.setProgressDate}
              onProgressInputModeChange={bookProgressHook.setProgressInputMode}
              onSubmit={bookProgressHook.handleLogProgress}
              showProgressModeDropdown={showProgressModeDropdown}
              setShowProgressModeDropdown={setShowProgressModeDropdown}
              progressModeDropdownRef={progressModeDropdownRef}
            />
          )}

          {/* Book Metadata (Description, Tags, Total Pages Form) */}
          <BookMetadata
            book={book}
            hasTotalPages={!!book.totalPages}
            totalPagesInput={totalPagesInput}
            onTotalPagesChange={setTotalPagesInput}
            onTotalPagesSubmit={handleTotalPagesSubmit}
          />

          {/* Progress History */}
          {bookProgressHook.progress.length > 0 && selectedStatus === "reading" && (
            <div className="bg-[var(--card-bg)] border border-[var(--border-color)] rounded-lg p-6">
              <ProgressHistory
                progress={bookProgressHook.progress}
                onEdit={bookProgressHook.handleEditProgress}
              />
            </div>
          )}

          {/* Reading History Tab */}
          <ReadingHistoryTab
            key={historyRefreshKey}
            bookId={bookId}
            bookTitle={book.title}
          />
        </div>
      </div>

      {/* Modals */}
      <FinishBookModal
        isOpen={showReadConfirmation}
        onClose={() => handleCancelStatusChange()}
        onConfirm={handleConfirmRead}
        bookTitle={book.title}
      />

      <RatingModal
        isOpen={showRatingModal}
        onClose={closeRatingModal}
        onConfirm={handleUpdateRating}
        bookTitle={book.title}
        currentRating={book.rating || null}
      />

      {/* Status Change Confirmation Dialog */}
      {showStatusChangeConfirmation && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-[var(--card-bg)] border border-[var(--border-color)] rounded-lg shadow-lg p-6 max-w-md w-full">
            <h2 className="text-xl font-serif font-bold text-[var(--heading-text)] mb-2">
              Archive Reading Session?
            </h2>
            <p className="text-[var(--foreground)]/70 mb-4 font-medium">
              You have logged progress for this book. Changing the status will:
            </p>
            <ul className="list-disc list-inside text-[var(--foreground)]/70 mb-4 space-y-1 font-medium">
              <li>Archive your current reading session with its progress</li>
              <li>Start a fresh session with {pendingStatusChange === "read-next" ? "Read Next" : "Want to Read"} status</li>
              <li>Preserve your reading history (viewable in Reading History)</li>
            </ul>
            <p className="text-[var(--foreground)] mb-6 font-semibold">
              Continue with status change?
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={handleCancelStatusChange}
                className="px-4 py-2 bg-[var(--border-color)] text-[var(--foreground)] rounded-lg hover:bg-[var(--light-accent)]/20 transition-colors font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmStatusChange}
                className="px-4 py-2 bg-[var(--accent)] text-white rounded-lg hover:bg-[var(--light-accent)] transition-colors font-semibold"
              >
                Archive & Change Status
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Progress Edit Modal */}
      {bookProgressHook.selectedProgressEntry && (
        <ProgressEditModal
          isOpen={bookProgressHook.showEditProgressModal}
          onClose={bookProgressHook.closeEditModal}
          onConfirm={bookProgressHook.handleConfirmEditProgress}
          onDelete={bookProgressHook.handleDeleteProgress}
          currentProgress={bookProgressHook.selectedProgressEntry}
          bookTitle={book.title}
          totalPages={book.totalPages}
        />
      )}
    </div>
  );
}
