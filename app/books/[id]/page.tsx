"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { BookOpen, BookCheck } from "lucide-react";
import ReadingHistoryTab from "@/components/ReadingHistoryTab";
import FinishBookModal from "@/components/FinishBookModal";
import RatingModal from "@/components/RatingModal";
import ProgressEditModal from "@/components/ProgressEditModal";
import RereadConfirmModal from "@/components/RereadConfirmModal";
import ArchiveSessionModal from "@/components/ArchiveSessionModal";
import PageCountEditModal from "@/components/PageCountEditModal";
import BookHeader from "@/components/BookDetail/BookHeader";
import BookMetadata from "@/components/BookDetail/BookMetadata";
import BookProgress from "@/components/BookDetail/BookProgress";
import ProgressHistory from "@/components/BookDetail/ProgressHistory";
import SessionDetails from "@/components/BookDetail/SessionDetails";
import { useBookDetail } from "@/hooks/useBookDetail";
import { useBookStatus } from "@/hooks/useBookStatus";
import { useBookProgress } from "@/hooks/useBookProgress";
import { useBookRating } from "@/hooks/useBookRating";
import { useSessionDetails } from "@/hooks/useSessionDetails";
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
    updateBookPartial,
  } = useBookDetail(bookId);

  const bookProgressHook = useBookProgress(bookId, book, handleRefresh);

  const {
    selectedStatus,
    showReadConfirmation,
    showStatusChangeConfirmation,
    pendingStatusChange,
    handleUpdateStatus,
    handleConfirmStatusChange: handleConfirmStatusChangeFromHook,
    handleCancelStatusChange,
    handleConfirmRead: handleConfirmReadFromHook,
    handleStartReread,
  } = useBookStatus(book, bookProgressHook.progress, bookId, handleRefresh, handleRefresh);

  // Wrap handleConfirmRead to clear form state after marking as read
  async function handleConfirmRead(rating: number, review?: string) {
    await handleConfirmReadFromHook(rating, review);
    bookProgressHook.clearFormState();
    setHistoryRefreshKey(prev => prev + 1);
  }

  // Wrap handleConfirmStatusChange to refresh history after archiving session
  async function handleConfirmStatusChange() {
    await handleConfirmStatusChangeFromHook();
    setHistoryRefreshKey(prev => prev + 1);
  }

  const {
    showRatingModal,
    openRatingModal,
    closeRatingModal,
    handleUpdateRating,
  } = useBookRating(book, bookId, handleRefresh, updateBookPartial);

  const sessionDetailsHook = useSessionDetails(bookId, book?.activeSession, handleRefresh);

  // Local UI state
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);
  const [showProgressModeDropdown, setShowProgressModeDropdown] = useState(false);
  const [historyRefreshKey, setHistoryRefreshKey] = useState(0);
  const [totalPagesInput, setTotalPagesInput] = useState("");
  const [showRereadConfirmation, setShowRereadConfirmation] = useState(false);
  const [showPageCountModal, setShowPageCountModal] = useState(false);

  // Refs for dropdowns
  const dropdownRef = useRef<HTMLDivElement>(null);
  const progressModeDropdownRef = useRef<HTMLDivElement>(null);

  // Centralized refresh handler
  function handleRefresh() {
    refetchBook();
    bookProgressHook.refetchProgress();
    router.refresh(); // Refresh server components (dashboard, etc.)
  }

  // Handle re-read with history refresh
  function handleRereadClick() {
    setShowRereadConfirmation(true);
  }

  async function handleConfirmReread() {
    setShowRereadConfirmation(false);
    await handleStartReread();
    setHistoryRefreshKey(prev => prev + 1);
  }

  function handleCancelReread() {
    setShowRereadConfirmation(false);
  }

  // Handle page count editing
  function handlePageCountClick() {
    if (book?.totalPages) {
      setShowPageCountModal(true);
    }
  }

  function handlePageCountUpdateSuccess() {
    setShowPageCountModal(false);
    handleRefresh(); // Existing centralized refresh
  }

  // Total pages submit handler
  async function handleTotalPagesSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!totalPagesInput || parseInt(totalPagesInput) <= 0) return;

    await updateTotalPages(parseInt(totalPagesInput));
    setTotalPagesInput("");
    toast.success("Pages updated");
    router.refresh(); // Refresh server components (dashboard, etc.)
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
    <div className="max-w-6xl mx-auto">
      {/* Single responsive grid - no duplicates! */}
      <div className="grid grid-cols-1 md:grid-cols-[250px_1fr] gap-6 md:gap-8">
        {/* Sidebar: Cover, Status, Rating, Re-read - responsive width */}
        <BookHeader
          book={book}
          selectedStatus={selectedStatus}
          imageError={imageError}
          onImageError={() => setImageError(true)}
          onStatusChange={handleUpdateStatus}
          onRatingClick={openRatingModal}
          onRereadClick={handleRereadClick}
          onPageCountClick={handlePageCountClick}
          showStatusDropdown={showStatusDropdown}
          setShowStatusDropdown={setShowStatusDropdown}
          dropdownRef={dropdownRef}
          rating={book.rating}
          hasCompletedReads={book.hasCompletedReads || false}
          hasActiveSession={!!book.activeSession}
        />

        {/* Main Content Area */}
        <div className="space-y-6 min-w-0">
          {/* Title and Author */}
          <div className="mt-3 md:mt-0 text-center md:text-left">
            <h1 className="text-3xl md:text-4xl font-serif font-bold text-[var(--heading-text)] md:mb-1 leading-tight">
              {book.title}
            </h1>
            <div className="font-serif text-lg md:text-xl text-[var(--subheading-text)] mb-4 font-medium">
              {book.authors.map((author, index) => (
                <span key={author}>
                  <Link
                    href={`/library?search=${encodeURIComponent(author)}`}
                    className="hover:text-[var(--accent)] transition-colors hover:underline"
                  >
                    {author}
                  </Link>
                  {index < book.authors.length - 1 && ", "}
                </span>
              ))}
            </div>

            {/* Metadata */}
            <div className="flex flex-wrap items-center justify-center md:justify-start gap-2 md:gap-3 text-xs md:text-sm font-medium">
              {book.totalReads !== undefined && book.totalReads > 0 && (
                <div className="flex items-center gap-1.5 text-[var(--accent)]">
                  <BookCheck className="w-3 md:w-4 h-3 md:h-4" />
                  <span className="font-semibold">
                    Read {book.totalReads} {book.totalReads === 1 ? 'time' : 'times'}
                  </span>
                </div>
              )}
              {book.totalReads !== undefined && book.totalReads > 0 && book.totalPages && (
                <span className="text-[var(--border-color)]">•</span>
              )}
              {book.totalPages ? (
                <div className="flex items-center gap-1.5 text-[var(--accent)]">
                  <BookOpen className="w-3 md:w-4 h-3 md:h-4" />
                  <span className="font-semibold">{book.totalPages.toLocaleString()} pages</span>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 text-[var(--accent)] italic">
                  <BookOpen className="w-3 md:w-4 h-3 md:h-4" />
                  <span className="font-medium">Pages not set</span>
                </div>
              )}
              {book.pubDate && (
                <>
                  <span className="text-[var(--border-color)]">•</span>
                  <span className="font-medium text-[var(--accent)]">
                    Published {new Date(book.pubDate).getFullYear()}
                  </span>
                </>
              )}
            </div>
          </div>

          {/* Progress Section - only show when reading */}
          {selectedStatus === "reading" && book.activeSession && (
            <>
              {/* Session Start Date */}
              <SessionDetails
                startedDate={book.activeSession.startedDate}
                isEditingStartDate={sessionDetailsHook.isEditingStartDate}
                editStartDate={sessionDetailsHook.editStartDate}
                onStartEditingDate={sessionDetailsHook.startEditing}
                onEditStartDateChange={sessionDetailsHook.setEditStartDate}
                onCancelEdit={sessionDetailsHook.cancelEditing}
                onSaveStartDate={sessionDetailsHook.saveStartDate}
              />

              {/* Progress Bar */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm font-semibold">
                  <span className="text-[var(--foreground)]/60">Progress</span>
                  <span className="text-[var(--foreground)]">
                    {bookProgressHook.progress.length > 0 ? (
                      <>
                        {Math.round((bookProgressHook.progress[0].currentPage / (book.totalPages || 1)) * 100)}%
                      </>
                    ) : (
                      "0%"
                    )}
                  </span>
                </div>
                <div className="relative w-full h-8 bg-[var(--card-bg)] border border-[var(--border-color)] rounded overflow-hidden">
                  <div
                    className="absolute inset-y-0 left-0 bg-[var(--accent)] transition-all duration-300"
                    style={{
                      width: bookProgressHook.progress.length > 0
                        ? `${Math.min((bookProgressHook.progress[0].currentPage / (book.totalPages || 1)) * 100, 100)}%`
                        : "0%",
                    }}
                  />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-xs font-semibold font-mono text-[var(--foreground)] mix-blend-difference">
                      Page {bookProgressHook.progress.length > 0 ? bookProgressHook.progress[0].currentPage : 0} of {book.totalPages}
                    </span>
                  </div>
                </div>
              </div>

              {/* Log Progress Form */}
              <div className="bg-[var(--card-bg)] border border-[var(--border-color)] rounded-lg p-6">
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
              </div>
            </>
          )}

          {/* Add Total Pages Form - only show when pages not set */}
          {!book.totalPages && (
            <BookMetadata
              hasTotalPages={!!book.totalPages}
              totalPagesInput={totalPagesInput}
              onTotalPagesChange={setTotalPagesInput}
              onTotalPagesSubmit={handleTotalPagesSubmit}
            />
          )}

          {/* Description */}
          {book.description && (
            <div>
              <p className="text-sm text-[var(--foreground)]/80 leading-relaxed font-medium">
                {book.description.replace(/<[^>]*>/g, "")}
              </p>
            </div>
          )}

          {/* Tags */}
          {book.tags.length > 0 && (
            <div>
              <label className="block text-xs uppercase tracking-wide text-[var(--foreground)]/60 mb-3 font-semibold">
                Tags
              </label>
              <div className="flex flex-wrap gap-2">
                {book.tags.map((tag) => (
                  <Link
                    key={tag}
                    href={`/library?tags=${encodeURIComponent(tag)}`}
                    className="px-3 py-1 bg-[var(--card-bg)] text-[var(--foreground)] border border-[var(--border-color)] hover:border-[var(--accent)] hover:bg-[var(--accent)]/10 rounded text-sm transition-colors font-medium"
                  >
                    {tag}
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Current Reading Progress History */}
          {bookProgressHook.progress.length > 0 && selectedStatus === "reading" && (
            <div className="bg-[var(--card-bg)] border border-[var(--border-color)] rounded-lg p-6">
              <ProgressHistory
                progress={bookProgressHook.progress}
                onEdit={bookProgressHook.handleEditProgress}
              />
            </div>
          )}

          {/* Reading History */}
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

      <RereadConfirmModal
        isOpen={showRereadConfirmation}
        onClose={handleCancelReread}
        onConfirm={handleConfirmReread}
        bookTitle={book.title}
      />

      <ArchiveSessionModal
        isOpen={showStatusChangeConfirmation}
        onClose={handleCancelStatusChange}
        onConfirm={handleConfirmStatusChange}
        bookTitle={book.title}
        pendingStatus={pendingStatusChange}
      />

      <PageCountEditModal
        isOpen={showPageCountModal}
        onClose={() => setShowPageCountModal(false)}
        bookId={parseInt(bookId)}
        currentPageCount={book.totalPages ?? null}
        onSuccess={handlePageCountUpdateSuccess}
      />

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
