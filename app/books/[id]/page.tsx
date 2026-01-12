"use client";

import { useEffect, useState, useRef } from "react";
import { useParams } from "next/navigation";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { BookOpen, BookCheck, Pencil } from "lucide-react";
import { getShelfIcon } from "@/components/ShelfManagement/ShelfIconPicker";
import ReadingHistoryTab from "@/components/CurrentlyReading/ReadingHistoryTab";
import FinishBookModal from "@/components/Modals/FinishBookModal";
import CompleteBookModal from "@/components/Modals/CompleteBookModal";
import DNFBookModal from "@/components/Modals/DNFBookModal";
import RatingModal from "@/components/Modals/RatingModal";
import ProgressEditModal from "@/components/Modals/ProgressEditModal";
import RereadConfirmModal from "@/components/Modals/RereadConfirmModal";
import ArchiveSessionModal from "@/components/Modals/ArchiveSessionModal";
import PageCountEditModal from "@/components/Modals/PageCountEditModal";
import TagEditor from "@/components/BookDetail/TagEditor";
import ShelfEditor from "@/components/BookDetail/ShelfEditor";
import BookHeader from "@/components/BookDetail/BookHeader";
import { calculatePercentage } from "@/lib/utils/progress-calculations";
import type { MDXEditorMethods } from "@mdxeditor/editor";
import { getLogger } from "@/lib/logger";

import BookProgress from "@/components/BookDetail/BookProgress";
import Journal from "@/components/BookDetail/Journal";
import SessionDetails from "@/components/BookDetail/SessionDetails";
import { useBookDetail } from "@/hooks/useBookDetail";
import { useBookStatus, invalidateBookQueries } from "@/hooks/useBookStatus";
import { useBookProgress } from "@/hooks/useBookProgress";
import { useBookRating } from "@/hooks/useBookRating";
import { useSessionDetails } from "@/hooks/useSessionDetails";
import { useDraftNote } from "@/hooks/useDraftNote";
import { Spinner } from "@/components/Utilities/Spinner";

const logger = getLogger().child({ component: "BookDetailPage" });

export default function BookDetailPage() {
  const params = useParams();
  const bookId = params?.id as string;
  const queryClient = useQueryClient();

  // Custom hooks encapsulate all business logic
  const {
    book,
    loading,
    imageError,
    setImageError,
    updateTags,
  } = useBookDetail(bookId);

  const bookProgressHook = useBookProgress(bookId, book, async () => {
    // Invalidate relevant queries to refetch fresh data
    await queryClient.invalidateQueries({ queryKey: ['book', bookId] });
  });

  const {
    selectedStatus,
    showReadConfirmation,
    showStatusChangeConfirmation,
    showCompleteBookModal,
    showDNFModal,
    pendingStatusChange,
    handleUpdateStatus: handleUpdateStatusFromHook,
    handleConfirmStatusChange,
    handleCancelStatusChange,
    handleConfirmRead: handleConfirmReadFromHook,
    handleCompleteBook,
    handleStartReread,
    handleMarkAsDNF,
  } = useBookStatus(book, bookProgressHook.progress, bookId);

  // Handle finishing book from auto-completion modal (when progress reaches 100%)
  // Note: Book status is already "read" at this point (auto-completed by progress service)
  // We only need to update rating/review, not status
  async function handleConfirmReadAfterAutoCompletion(rating?: number, review?: string) {
    try {
      // Update rating to the book table if provided
      if (rating && rating > 0) {
        const ratingBody = { rating };
        const ratingResponse = await fetch(`/api/books/${bookId}/rating`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(ratingBody),
        });

        if (!ratingResponse.ok) {
          throw new Error("Failed to update rating");
        }
      }

      // Update review to the session if provided and we have a session ID
      // Check both bookProgressHook.completedSessionId (from auto-completion) and book.activeSession.id (from manual mark as read)
      const sessionId = bookProgressHook.completedSessionId || book?.activeSession?.id;
      if (review && sessionId) {
        const sessionBody = { review };
        const sessionResponse = await fetch(`/api/books/${bookId}/sessions/${sessionId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(sessionBody),
        });

        if (!sessionResponse.ok) {
          throw new Error("Failed to update review");
        }
      }

      // Clear form state and draft
      bookProgressHook.clearFormState();
      clearDraft();

      // Refresh data
      await queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      await queryClient.invalidateQueries({ queryKey: ['book', bookId] });
      await queryClient.invalidateQueries({ queryKey: ['sessions', bookId] });
      await queryClient.invalidateQueries({ queryKey: ['library-books'] });
    } catch (error) {
      logger.error({ error }, "Failed to finish book");
      throw error;
    }
  }

  const {
    showRatingModal,
    openRatingModal,
    closeRatingModal,
    handleUpdateRating,
  } = useBookRating(book, bookId);

  const sessionDetailsHook = useSessionDetails(bookId, book?.activeSession, async () => {
    // Invalidate relevant queries to refetch fresh data
    await queryClient.invalidateQueries({ queryKey: ['book', bookId] });
  });

  // Draft note management with localStorage autosave
  const { draftNote, saveDraft, clearDraft } = useDraftNote(parseInt(bookId));
  const [isDraftInitialized, setIsDraftInitialized] = useState(false);

  // Restore draft note on mount (runs once)
  useEffect(() => {
    if (draftNote && bookProgressHook.notes === "") {
      bookProgressHook.setNotes(draftNote);
    }
    setIsDraftInitialized(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftNote]);

  // Save draft when notes change (only after initialization to prevent clearing on mount)
  useEffect(() => {
    if (isDraftInitialized) {
      saveDraft(bookProgressHook.notes);
    }
  }, [bookProgressHook.notes, saveDraft, isDraftInitialized]);

  // Local UI state
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);
  const [showProgressModeDropdown, setShowProgressModeDropdown] = useState(false);
  const [showRereadConfirmation, setShowRereadConfirmation] = useState(false);
  const [showPageCountModal, setShowPageCountModal] = useState(false);
  const [showTagEditor, setShowTagEditor] = useState(false);
  const [showShelfEditor, setShowShelfEditor] = useState(false);
  const [pendingStatusForPageCount, setPendingStatusForPageCount] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(false);

  // Detect mobile viewport
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Fetch available tags for the tag editor
  const { data: availableTagsData } = useQuery<{ tags: string[] }>({
    queryKey: ['availableTags'],
    queryFn: async () => {
      const response = await fetch('/api/tags');
      if (!response.ok) {
        throw new Error('Failed to fetch tags');
      }
      return response.json();
    },
    staleTime: 60000, // Cache for 1 minute
    gcTime: 300000, // 5 minutes - match other queries
    refetchOnMount: false, // Don't refetch when mounting if data exists
    retry: 1, // Reduce retry attempts to prevent blocking
  });
  const availableTags = availableTagsData?.tags || [];

  // Fetch available shelves for the shelf editor
  const { data: availableShelvesData } = useQuery<{ success: boolean; data: Array<{ id: number; name: string; description: string | null; color: string | null; icon: string | null }> }>({
    queryKey: ['availableShelves'],
    queryFn: async () => {
      const response = await fetch('/api/shelves');
      if (!response.ok) {
        throw new Error('Failed to fetch shelves');
      }
      return response.json();
    },
    staleTime: 60000, // Cache for 1 minute
  });
  const availableShelves = availableShelvesData?.data || [];

  // Fetch current shelves for this book
  const { data: bookShelvesData, refetch: refetchBookShelves } = useQuery<{ success: boolean; data: Array<{ id: number; name: string; description: string | null; color: string | null; icon: string | null }> }>({
    queryKey: ['bookShelves', bookId],
    queryFn: async () => {
      const response = await fetch(`/api/books/${bookId}/shelves`);
      if (!response.ok) {
        throw new Error('Failed to fetch book shelves');
      }
      return response.json();
    },
    enabled: !!bookId,
    staleTime: 60000, // Cache for 1 minute
  });
  const currentShelves = bookShelvesData?.data || [];
  const currentShelfIds = currentShelves.map((s) => s.id);

  // Function to update book shelves
  async function updateShelves(shelfIds: number[]) {
    try {
      const response = await fetch(`/api/books/${bookId}/shelves`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shelfIds }),
      });

      if (!response.ok) {
        throw new Error('Failed to update shelves');
      }

      // Refetch shelf data
      await refetchBookShelves();
      
      const { toast } = await import('@/utils/toast');
      toast.success('Shelves updated successfully');
    } catch (error) {
      logger.error({ err: error }, 'Failed to update shelves');
      const { toast } = await import('@/utils/toast');
      toast.error('Failed to update shelves');
      throw error;
    }
  }

  // Refs for dropdowns and MDXEditor
  const dropdownRef = useRef<HTMLDivElement>(null);
  const progressModeDropdownRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<MDXEditorMethods | null>(null);

  // Wrapper for log progress that clears draft and resets editor
  async function handleLogProgress(e: React.FormEvent) {
    const result = await bookProgressHook.handleLogProgress(e);
    // Only clear draft and reset editor if submission was successful
    if (result.success) {
      clearDraft();
      // Reset MDXEditor using the documented setMarkdown method
      try {
        editorRef.current?.setMarkdown("");
      } catch (error) {
        logger.error({ error }, "Failed to reset editor");
        // Editor reset failed but form submission succeeded, so just log the error
      }
    }
  }

  // Wrapper for status updates with optimistic page count validation
  async function handleUpdateStatus(newStatus: string) {
    // Optimistic check: if trying to change to "reading" without pages, show modal immediately
    // Note: "read" transitions from Want to Read/Read Next are handled by CompleteBookModal
    if (newStatus === "reading" && !book?.totalPages) {
      setPendingStatusForPageCount(newStatus);
      setShowPageCountModal(true);
      return;
    }

    // Otherwise, call the hook's handler
    try {
      await handleUpdateStatusFromHook(newStatus);
    } catch (error: any) {
      // Defense in depth: Handle API validation error for "reading" status
      if (error?.code === "PAGES_REQUIRED" || error?.response?.data?.code === "PAGES_REQUIRED") {
        setPendingStatusForPageCount(newStatus);
        setShowPageCountModal(true);
      } else {
        // Re-throw other errors to be handled by the hook
        throw error;
      }
    }
  }

  // Handle re-read
  function handleRereadClick() {
    setShowRereadConfirmation(true);
  }

  async function handleConfirmReread() {
    setShowRereadConfirmation(false);
    await handleStartReread();
  }

  function handleCancelReread() {
    setShowRereadConfirmation(false);
  }

  // Handle page count editing (works for both null and existing values)
  function handlePageCountClick() {
    setShowPageCountModal(true);
  }

  async function handlePageCountUpdateSuccess() {
    setShowPageCountModal(false);
    setPendingStatusForPageCount(null);

    // Use shared invalidation helper to ensure consistency across all code paths
    invalidateBookQueries(queryClient, bookId);
  }
  
  function handlePageCountModalClose() {
    setShowPageCountModal(false);
    // If user cancels the page count modal with a pending status, clear it
    if (pendingStatusForPageCount) {
      setPendingStatusForPageCount(null);
    }
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
        <Spinner size="md" />
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
            {/* Series Information */}
            {book.series && (
              <Link
                href={`/series/${encodeURIComponent(book.series)}`}
                className="inline-block mb-1 font-serif text-base italic text-[var(--subheading-text)] hover:text-[var(--accent)] transition-colors"
              >
                {book.series}
                {book.seriesIndex && ` #${book.seriesIndex}`}
              </Link>
            )}
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
              <div 
                onClick={handlePageCountClick}
                className="flex items-center gap-1.5 text-[var(--accent)] group cursor-pointer"
              >
                <BookOpen className="w-3 md:w-4 h-3 md:h-4" />
                <span className="font-semibold group-hover:underline">
                  {book.totalPages ? `${book.totalPages.toLocaleString()} pages` : 'Pages not set'}
                </span>
                <Pencil className="w-3 h-3 text-[var(--subheading-text)]" />
              </div>
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
                        {calculatePercentage(bookProgressHook.progress[0].currentPage, book.totalPages || 1)}%
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
                        ? `${calculatePercentage(bookProgressHook.progress[0].currentPage, book.totalPages || 1)}%`
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
                  onSubmit={handleLogProgress}
                  showProgressModeDropdown={showProgressModeDropdown}
                  setShowProgressModeDropdown={setShowProgressModeDropdown}
                  progressModeDropdownRef={progressModeDropdownRef}
                  onEditorReady={(methods) => {
                    if (methods) editorRef.current = methods;
                  }}
                />
              </div>
            </>
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
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="block text-xs uppercase tracking-wide text-[var(--foreground)]/60 font-semibold">
                Tags
              </label>
              <button
                onClick={() => setShowTagEditor(true)}
                className="flex items-center gap-1 text-xs text-[var(--accent)] hover:text-[var(--light-accent)] transition-colors font-semibold"
              >
                Edit
                <Pencil className="w-3 h-3" />
              </button>
            </div>
            {book.tags.length > 0 ? (
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
            ) : (
              <p className="text-sm text-[var(--foreground)]/50">
                No tags yet. Click Edit to add some!
              </p>
            )}
          </div>

          {/* Shelves */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="block text-xs uppercase tracking-wide text-[var(--foreground)]/60 font-semibold">
                Shelves
              </label>
              <button
                onClick={() => setShowShelfEditor(true)}
                className="flex items-center gap-1 text-xs text-[var(--accent)] hover:text-[var(--light-accent)] transition-colors font-semibold"
              >
                Edit
                <Pencil className="w-3 h-3" />
              </button>
            </div>
            {currentShelves.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {currentShelves.map((shelf) => {
                  const Icon = shelf.icon ? getShelfIcon(shelf.icon) : null;
                  return (
                    <Link
                      key={shelf.id}
                      href={`/shelves/${shelf.id}`}
                      className="px-3 py-2 bg-[var(--card-bg)] text-[var(--foreground)] border border-[var(--border-color)] hover:border-[var(--accent)] hover:bg-[var(--accent)]/10 rounded text-sm transition-colors font-medium flex items-center gap-2"
                    >
                      <div
                        className="w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center"
                        style={{ backgroundColor: shelf.color || '#3b82f6' }}
                      >
                        {Icon && <Icon className="w-3 h-3 text-white" />}
                      </div>
                      {shelf.name}
                    </Link>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-[var(--foreground)]/50">
                Not on any shelves. Click Edit to add to shelves!
              </p>
            )}
          </div>

          {/* Current Reading Progress History */}
          {bookProgressHook.progress.length > 0 && selectedStatus === "reading" && (
            <div className="bg-[var(--card-bg)] border border-[var(--border-color)] rounded-lg p-6">
              <Journal
                key={bookProgressHook.progress.map(p => `${p.id}-${p.progressDate}`).join(',')}
                progress={bookProgressHook.progress}
                onEdit={bookProgressHook.handleEditProgress}
              />
            </div>
          )}

          {/* Reading History */}
          <ReadingHistoryTab
            bookId={bookId}
            bookTitle={book.title}
          />
        </div>
      </div>

      {/* Modals */}
      {/* Manual completion from non-reading status (Want to Read / Read Next → Read) */}
      <CompleteBookModal
        isOpen={showCompleteBookModal}
        onClose={() => handleCancelStatusChange()}
        onConfirm={handleCompleteBook}
        bookTitle={book.title}
        bookId={bookId}
        currentPageCount={book.totalPages ?? null}
        currentRating={book.rating}
        defaultStartDate={book.activeSession?.startedDate ? new Date(book.activeSession.startedDate) : undefined}
      />

      {/* Manual status change from "reading" to "read" - uses mark-as-read API */}
      <FinishBookModal
        isOpen={showReadConfirmation}
        onClose={() => handleCancelStatusChange()}
        onConfirm={handleConfirmReadFromHook}
        bookTitle={book.title}
        bookId={bookId}
      />

      {/* Manual status change from "reading" to "dnf" - uses mark-as-dnf API */}
      <DNFBookModal
        isOpen={showDNFModal}
        onClose={() => handleCancelStatusChange()}
        onConfirm={handleMarkAsDNF}
        bookTitle={book.title}
        bookId={bookId}
        lastProgressDate={book.latestProgress?.progressDate}
        lastProgressPage={book.latestProgress?.currentPage}
        lastProgressPercentage={book.latestProgress?.currentPercentage}
      />

      {/* Auto-completion modal (shown when progress reaches 100%) - book already marked as read */}
      <FinishBookModal
        isOpen={bookProgressHook.showCompletionModal}
        onClose={bookProgressHook.closeCompletionModal}
        onConfirm={handleConfirmReadAfterAutoCompletion}
        bookTitle={book.title}
        bookId={bookId}
        sessionId={bookProgressHook.completedSessionId}
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
        onClose={handlePageCountModalClose}
        bookId={parseInt(bookId)}
        currentPageCount={book.totalPages ?? null}
        onSuccess={handlePageCountUpdateSuccess}
        hasProgress={bookProgressHook.progress.length > 0}
        pendingStatus={pendingStatusForPageCount ?? undefined}
        currentRating={book.rating}
      />

      {bookProgressHook.selectedProgressEntry && (
        <ProgressEditModal
          isOpen={bookProgressHook.showEditProgressModal}
          onClose={bookProgressHook.closeEditModal}
          onConfirm={bookProgressHook.handleConfirmEditProgress}
          onDelete={bookProgressHook.handleDeleteProgress}
          currentProgress={bookProgressHook.selectedProgressEntry}
          bookTitle={book.title}
          bookId={bookId}
          totalPages={book.totalPages}
        />
      )}

      <TagEditor
        isOpen={showTagEditor}
        onClose={() => setShowTagEditor(false)}
        onSave={updateTags}
        bookTitle={book.title}
        currentTags={book.tags}
        availableTags={availableTags}
        isMobile={isMobile}
      />

      <ShelfEditor
        isOpen={showShelfEditor}
        onClose={() => setShowShelfEditor(false)}
        onSave={updateShelves}
        bookTitle={book.title}
        currentShelfIds={currentShelfIds}
        availableShelves={availableShelves}
        isMobile={isMobile}
      />
    </div>
  );
}
