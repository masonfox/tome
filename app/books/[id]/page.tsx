"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { BookOpen, Calendar, TrendingUp, Star, ChevronDown, Check, Lock, Bookmark, Clock, BookCheck } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/utils/cn";
import { toast } from "@/utils/toast";
import ReadingHistoryTab from "@/components/ReadingHistoryTab";
import FinishBookModal from "@/components/FinishBookModal";

interface Book {
  id: number;
  calibreId: number;
  title: string;
  authors: string[];
  totalPages?: number;
  publisher?: string;
  pubDate?: string;
  series?: string;
  description?: string;
  tags: string[];
  totalReads?: number;
  hasCompletedReads?: boolean;
  activeSession?: {
    status: string;
    startedDate?: string;
    completedDate?: string;
    review?: string;
  };
  rating?: number | null; // Rating is on the book, not the session
  latestProgress?: {
    currentPage: number;
    currentPercentage: number;
    progressDate: string;
  };
}

interface ProgressEntry {
  id: number;
  currentPage: number;
  currentPercentage: number;
  progressDate: string;
  notes?: string;
  pagesRead: number;
}

export default function BookDetailPage() {
  const params = useParams();
  const router = useRouter();
  const bookId = params?.id as string;

  const [book, setBook] = useState<Book | null>(null);
  const [progress, setProgress] = useState<ProgressEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [imageError, setImageError] = useState(false);
  const [currentPage, setCurrentPage] = useState("");
  const [currentPercentage, setCurrentPercentage] = useState("");
  const [progressInputMode, setProgressInputMode] = useState<"page" | "percentage">("page");
  const [notes, setNotes] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("to-read");
  // Rating is stored on book, not in component state (removed legacy state)
  const [totalPages, setTotalPages] = useState("");
  const [showReadConfirmation, setShowReadConfirmation] = useState(false);
  const [showStatusChangeConfirmation, setShowStatusChangeConfirmation] = useState(false);
  const [pendingStatusChange, setPendingStatusChange] = useState<string | null>(null);
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);
  const [showProgressModeDropdown, setShowProgressModeDropdown] = useState(false);
  const [historyRefreshKey, setHistoryRefreshKey] = useState(0);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const progressModeDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchBook();
    fetchProgress();
  }, [bookId]);

  // Close dropdown when clicking outside
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

  // Load saved progress input mode preference
  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedMode = localStorage.getItem("progressInputMode");
      if (savedMode === "page" || savedMode === "percentage") {
        setProgressInputMode(savedMode);
      }
    }
  }, []);

  async function fetchBook() {
    try {
      const response = await fetch(`/api/books/${bookId}`);
      const data = await response.json();
      setBook(data);
      if (data.activeSession) {
        setSelectedStatus(data.activeSession.status);
      } else if (data.hasCompletedReads) {
        // Show "read" status for completed books with no active session
        setSelectedStatus("read");
      }
      if (data.latestProgress) {
        setCurrentPage(data.latestProgress.currentPage.toString());
        setCurrentPercentage(data.latestProgress.currentPercentage.toString());
      }
    } catch (error) {
      console.error("Failed to fetch book:", error);
    } finally {
      setLoading(false);
    }
  }

  async function fetchProgress() {
    try {
      const response = await fetch(`/api/books/${bookId}/progress`);
      const data = await response.json();
      setProgress(data);
    } catch (error) {
      console.error("Failed to fetch progress:", error);
    }
  }

  async function handleLogProgress(e: React.FormEvent) {
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

    try {
      const response = await fetch(`/api/books/${bookId}/progress`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        const newProgressEntry = await response.json();
        setNotes("");

        // Update the book with the new progress without overwriting form inputs
        setBook((prevBook) => {
          if (!prevBook) return null;
          return {
            ...prevBook,
            latestProgress: {
              currentPage: newProgressEntry.currentPage,
              currentPercentage: newProgressEntry.currentPercentage,
              progressDate: newProgressEntry.progressDate,
            },
          };
        });

        fetchProgress();
        toast.success("Progress logged!");
        router.refresh(); // Refresh server-cached data
      }
    } catch (error) {
      console.error("Failed to log progress:", error);
    }
  }

  async function handleUpdateStatus(newStatus: string) {
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
  }

  async function performStatusChange(newStatus: string) {
    try {
      const body: any = { status: newStatus };
      // Note: Rating is now set via FinishBookModal, not here

      const response = await fetch(`/api/books/${bookId}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (response.ok) {
        const data = await response.json();
        setSelectedStatus(newStatus);
        fetchBook();
        fetchProgress(); // Refresh progress to show new session

        // Check if session was archived
        if (data.sessionArchived) {
          toast.success(
            `Session archived as Read #${data.archivedSessionNumber}. Starting fresh with ${newStatus === "read-next" ? "Read Next" : "Want to Read"} status.`
          );
        } else {
          toast.success("Status updated");
        }

        router.refresh(); // Refresh server-cached data
      }
    } catch (error) {
      console.error("Failed to update status:", error);
      toast.error("Failed to update status");
    }
  }

  async function handleConfirmStatusChange() {
    setShowStatusChangeConfirmation(false);
    if (pendingStatusChange) {
      await performStatusChange(pendingStatusChange);
      setPendingStatusChange(null);
    }
  }

  function handleCancelStatusChange() {
    setShowStatusChangeConfirmation(false);
    setPendingStatusChange(null);
  }

  async function handleConfirmRead(modalRating: number, review?: string) {
    setShowReadConfirmation(false);

    try {
      // First, set the progress to 100%
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
          console.error("Failed to update progress to 100%");
        }
      }

      // Then, update the status to "read"
      const statusBody: any = { status: "read" };
      if (modalRating > 0) {
        statusBody.rating = modalRating;
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
        setSelectedStatus("read");
        fetchBook();
        fetchProgress();
        toast.success("Marked as read!");
        router.refresh(); // Refresh server-cached data
      }
    } catch (error) {
      console.error("Failed to mark book as read:", error);
    }
  }

  async function handleStartReread() {
    try {
      const response = await fetch(`/api/books/${bookId}/reread`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      if (response.ok) {
        toast.success("Started re-reading! Your previous read has been archived.");
        // Increment key to force ReadingHistoryTab remount and refetch
        setHistoryRefreshKey(prev => prev + 1);
        await fetchBook();
        await fetchProgress();
        router.refresh();
      } else {
        const error = await response.json();
        toast.error(error.error || "Failed to start re-reading");
      }
    } catch (error) {
      console.error("Failed to start re-reading:", error);
      toast.error("Failed to start re-reading");
    }
  }

  async function handleUpdateTotalPages(e: React.FormEvent) {
    e.preventDefault();

    if (!totalPages || parseInt(totalPages) <= 0) return;

    try {
      const response = await fetch(`/api/books/${bookId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          totalPages: parseInt(totalPages),
        }),
      });

      if (response.ok) {
        setTotalPages("");
        fetchBook();
        toast.success("Pages updated");
        router.refresh(); // Refresh server-cached data
      }
    } catch (error) {
      console.error("Failed to update total pages:", error);
    }
  }

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="inline-block w-8 h-8 border-4 border-[var(--accent)] border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!book) {
    return (
      <div className="text-center py-12">
        <p className="text-[var(--foreground)]/60 font-medium">Book not found</p>
      </div>
    );
  }

  const progressPercentage = book.latestProgress?.currentPercentage || 0;

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      {/* Book Header */}
      <div className="grid md:grid-cols-[250px_1fr] gap-8">
        {/* Left Column - Cover and Status */}
        <div className="space-y-4">
          {/* Cover */}
          <div className="aspect-[2/3] bg-[var(--light-accent)]/30 rounded border border-[var(--border-color)] overflow-hidden flex items-center justify-center">
            {!imageError ? (
              <img
                src={`/api/covers/${book.calibreId}/cover.jpg`}
                alt={book.title}
                className="w-full h-full object-cover"
                loading="eager"
                onError={() => setImageError(true)}
              />
            ) : (
              <BookOpen className="w-24 h-24 text-[var(--foreground)]/40" />
            )}
          </div>

          {/* Status Dropdown */}
          <div className="space-y-2">
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setShowStatusDropdown(!showStatusDropdown)}
                className="w-full px-4 py-2.5 bg-[var(--accent)] text-white font-semibold rounded cursor-pointer hover:bg-[var(--light-accent)] transition-colors flex items-center justify-between"
              >
                <span>
                  {selectedStatus === "to-read"
                    ? "Want to Read"
                    : selectedStatus === "read-next"
                      ? "Read Next"
                      : selectedStatus === "reading"
                        ? "Reading"
                        : "Read"}
                </span>
                <ChevronDown
                  className={cn(
                    "w-5 h-5 transition-transform",
                    showStatusDropdown && "rotate-180"
                  )}
                />
              </button>

              {/* Dropdown Menu */}
              {showStatusDropdown && (
                <div className="absolute z-10 w-full mt-1 bg-[var(--card-bg)] border border-[var(--border-color)] rounded shadow-lg overflow-hidden">
                  {[
                    { value: "to-read", label: "Want to Read", disabled: false, icon: Bookmark },
                    { value: "read-next", label: "Read Next", disabled: false, icon: Clock },
                    { value: "reading", label: "Reading", disabled: !book.totalPages, icon: BookOpen },
                    { value: "read", label: "Read", disabled: !book.totalPages, icon: BookCheck },
                  ].map((option) => {
                    const Icon = option.icon;
                    return (
                      <button
                        key={option.value}
                        onClick={() => {
                          if (!option.disabled) {
                            handleUpdateStatus(option.value);
                            setShowStatusDropdown(false);
                          }
                        }}
                        disabled={option.disabled}
                        className={cn(
                          "w-full px-4 py-2.5 text-left flex items-center justify-between transition-colors group",
                          option.disabled
                            ? "cursor-not-allowed bg-[var(--card-bg)]"
                            : "cursor-pointer hover:bg-[var(--background)]",
                          selectedStatus === option.value && !option.disabled && "bg-[var(--accent)]/10"
                        )}
                      >
                        <div className="flex items-center gap-2 flex-1">
                          {option.disabled ? (
                            <Lock className="w-4 h-4 text-[var(--foreground)]/40" />
                          ) : (
                            <Icon className="w-4 h-4 text-[var(--foreground)]/60" />
                          )}
                          <div className="flex flex-col">
                            <span
                              className={cn(
                                "font-semibold",
                                option.disabled
                                  ? "text-[var(--foreground)]/40"
                                  : "text-[var(--foreground)]"
                              )}
                            >
                              {option.label}
                            </span>
                            {option.disabled && (
                              <span className="text-xs text-[var(--foreground)]/30 mt-0.5 font-medium">
                                Set pages
                              </span>
                            )}
                          </div>
                        </div>
                        {selectedStatus === option.value && !option.disabled && (
                          <Check className="w-5 h-5 text-[var(--accent)]" />
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Rating Display (read-only) - rating set via FinishBookModal */}
            {selectedStatus === "read" && book.rating && (
              <div className="flex justify-center gap-1 py-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <Star
                    key={star}
                    className={cn(
                      "w-5 h-5",
                      star <= (book.rating || 0)
                        ? "fill-[var(--accent)] text-[var(--accent)]"
                        : "text-[var(--foreground)]/30"
                    )}
                  />
                ))}
              </div>
            )}

            {/* Start Re-reading Button - only show if there are completed reads and no active session */}
            {!book.activeSession && book.hasCompletedReads && (
              <button
                onClick={handleStartReread}
                className="w-full px-4 py-2.5 bg-[var(--background)] text-[var(--foreground)] font-semibold rounded border border-[var(--border-color)] hover:bg-[var(--card-bg)] transition-colors flex items-center justify-center gap-2"
              >
                <BookOpen className="w-4 h-4" />
                <span>Start Re-reading</span>
              </button>
            )}
          </div>
        </div>

        {/* Right Column - Info */}
        <div className="space-y-6">
          <div>
            <h1 className="text-4xl font-serif font-bold text-[var(--heading-text)] mb-2">
              {book.title}
            </h1>
            <div className="text-xl text-[var(--subheading-text)] mb-3 font-medium">
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

            {book.series && (
              <p className="text-sm text-[var(--foreground)]/60 mb-3 italic font-medium">
                {book.series}
              </p>
            )}

            {/* Metadata - integrated into header */}
            <div className="flex flex-wrap items-center gap-3 text-sm font-medium">
              {(book.totalReads ?? 0) > 0 && (
                <>
                  <div className="flex items-center gap-1.5 text-[var(--accent)]">
                    <BookCheck className="w-4 h-4" />
                    <span className="font-semibold">{book.totalReads} {book.totalReads === 1 ? 'read' : 'reads'}</span>
                  </div>
                  <span className="text-[var(--border-color)]">•</span>
                </>
              )}
              {book.totalPages ? (
                <div className="flex items-center gap-1.5 text-[var(--accent)]">
                  <BookOpen className="w-4 h-4" />
                  <span className="font-semibold">{book.totalPages.toLocaleString()} pages</span>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 text-[var(--accent)] italic">
                  <BookOpen className="w-4 h-4" />
                  <span className="font-medium">Pages not set</span>
                </div>
              )}
              {(book.publisher || book.pubDate) && (
                <>
                  <span className="text-[var(--border-color)]">•</span>
                  {book.publisher && (
                    <span className="font-medium text-[var(--accent)]">{book.publisher}</span>
                  )}
                  {book.publisher && book.pubDate && (
                    <span className="text-[var(--foreground)]/30">•</span>
                  )}
                  {book.pubDate && (
                    <span className="font-medium text-[var(--accent)]">Published {new Date(book.pubDate).getFullYear()}</span>
                  )}
                </>
              )}
            </div>
          </div>

          <hr className="border-[var(--border-color)]" />

          {/* Progress Bar */}
          {book.totalPages && selectedStatus === "reading" && (
            <div>
              <div className="flex items-center justify-between text-sm text-[var(--foreground)]/70 mb-2">
                <span className="font-bold">Progress</span>
              </div>
              <div className="relative w-full bg-[var(--border-color)] rounded-md h-8 overflow-hidden">
                <div
                  className="absolute inset-0 bg-gradient-to-r from-[var(--accent)] to-[var(--light-accent)] transition-all duration-300 ease-out"
                  style={{ width: `${Math.min(100, progressPercentage)}%` }}
                />
                <div className="absolute inset-0 flex items-center px-3 top-1">
                  <span className="text-sm font-mono font-bold text-white drop-shadow-sm">{Math.round(progressPercentage)}%</span>
                </div>
              </div>
              <p className="text-sm text-[var(--foreground)]/30 mt-3 font-mono font-medium">
                Page {book.latestProgress?.currentPage || 0} of {book.totalPages}
              </p>
            </div>
          )}

          {/* Pages Setting */}
          {!book.totalPages && (
            <div className="border-l-4 border-[var(--accent)] bg-[var(--card-bg)] pl-4 py-3">
              <p className="text-sm text-[var(--foreground)]/70 mb-3 font-medium">
                Add page count to enable progress tracking
              </p>
              <form onSubmit={handleUpdateTotalPages} className="flex gap-2 max-w-xs">
                <input
                  type="number"
                  value={totalPages}
                  onChange={(e) => setTotalPages(e.target.value)}
                  min="1"
                  className="flex-1 px-3 py-2 border border-[var(--border-color)] bg-[var(--background)] text-[var(--foreground)] text-sm focus:outline-none focus:border-[var(--accent)] transition-colors"
                  placeholder="e.g. 320"
                />
                <button
                  type="submit"
                  className="px-4 py-2 bg-[var(--accent)] text-white rounded-sm text-sm hover:bg-[var(--light-accent)] transition-colors font-semibold"
                >
                  Save
                </button>
              </form>
            </div>
          )}

          {/* Progress Tracker */}
          {book.totalPages && selectedStatus === "reading" && (
            <div className="bg-[var(--card-bg)] border border-[var(--border-color)] rounded-lg p-6">
              <h2 className="text-2xl font-serif font-bold text-[var(--heading-text)] mb-6">
                Log Progress
              </h2>

              <form onSubmit={handleLogProgress} className="space-y-4">
                {/* Progress Input */}
                <div>
                  <label className="block text-xs uppercase tracking-wide text-[var(--foreground)]/60 mb-2 font-semibold">
                    Progress
                  </label>
                  <div className="flex gap-2">
                    {progressInputMode === "page" ? (
                      <input
                        type="number"
                        value={currentPage}
                        onChange={(e) => setCurrentPage(e.target.value)}
                        min="0"
                        max={book.totalPages}
                        step="1"
                        className="flex-1 px-4 py-2 border border-[var(--border-color)] rounded-lg bg-[var(--background)] text-[var(--foreground)] focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent"
                        placeholder="Enter current page"
                      />
                    ) : (
                      <input
                        type="number"
                        value={currentPercentage}
                        onChange={(e) => setCurrentPercentage(e.target.value)}
                        min="0"
                        max="100"
                        step="1"
                        className="flex-1 px-4 py-2 border border-[var(--border-color)] rounded-lg bg-[var(--background)] text-[var(--foreground)] focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent"
                        placeholder="Enter percentage"
                      />
                    )}
                    
                    {/* Progress Mode Dropdown */}
                    <div className="relative" ref={progressModeDropdownRef}>
                      <button
                        type="button"
                        onClick={() => setShowProgressModeDropdown(!showProgressModeDropdown)}
                        className="w-32 px-4 py-2 border border-[var(--border-color)] rounded-lg bg-[var(--background)] text-[var(--foreground)] hover:bg-[var(--card-bg)] transition-colors font-semibold flex items-center justify-between"
                      >
                        <span>{progressInputMode === "page" ? "Page" : "%"}</span>
                        <ChevronDown
                          className={cn(
                            "w-4 h-4 transition-transform",
                            showProgressModeDropdown && "rotate-180"
                          )}
                        />
                      </button>

                      {/* Dropdown Menu */}
                      {showProgressModeDropdown && (
                        <div className="absolute z-10 right-0 mt-1 w-full bg-[var(--card-bg)] border border-[var(--border-color)] rounded shadow-lg overflow-hidden">
                          <button
                            type="button"
                            onClick={() => {
                              setProgressInputMode("page");
                              localStorage.setItem("progressInputMode", "page");
                              if (book.latestProgress) {
                                setCurrentPage(book.latestProgress.currentPage.toString());
                              }
                              setShowProgressModeDropdown(false);
                            }}
                            className={cn(
                              "w-full px-4 py-2.5 text-left flex items-center justify-between transition-colors",
                              progressInputMode === "page"
                                ? "bg-[var(--accent)]/10"
                                : "hover:bg-[var(--background)]"
                            )}
                          >
                            <span className="font-semibold text-[var(--foreground)]">Page</span>
                            {progressInputMode === "page" && (
                              <Check className="w-4 h-4 text-[var(--accent)]" />
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setProgressInputMode("percentage");
                              localStorage.setItem("progressInputMode", "percentage");
                              if (book.latestProgress) {
                                setCurrentPercentage(book.latestProgress.currentPercentage.toString());
                              }
                              setShowProgressModeDropdown(false);
                            }}
                            className={cn(
                              "w-full px-4 py-2.5 text-left flex items-center justify-between transition-colors",
                              progressInputMode === "percentage"
                                ? "bg-[var(--accent)]/10"
                                : "hover:bg-[var(--background)]"
                            )}
                          >
                            <span className="font-semibold text-[var(--foreground)]">Percentage</span>
                            {progressInputMode === "percentage" && (
                              <Check className="w-4 h-4 text-[var(--accent)]" />
                            )}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-xs uppercase tracking-wide text-[var(--foreground)]/60 mb-2 font-semibold">
                    Notes (optional)
                  </label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={4}
                    className="w-full px-4 py-2 border border-[var(--border-color)] rounded-lg bg-[var(--background)] text-[var(--foreground)] focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent"
                    placeholder="Add notes about this reading session..."
                  />
                </div>

                <button
                  type="submit"
                  className="w-full px-6 py-3 bg-[var(--accent)] text-white rounded-lg hover:bg-[var(--light-accent)] transition-colors font-semibold uppercase tracking-wide"
                >
                  Log Progress
                </button>
              </form>
            </div>
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
                    className="px-3 py-1 bg-[var(--card-bg)] text-[var(--foreground)] border border-[var(--border-color)] hover:border-[var(--accent)] hover:bg-[var(--accent)]/10 rounded text-sm transition-colors font-medium">
                    {tag}
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Progress History - Only show for active reading session */}
          {progress.length > 0 && selectedStatus === "reading" && (
            <div className="bg-[var(--card-bg)] border border-[var(--border-color)] rounded-lg p-6">
              <h2 className="text-2xl font-serif font-bold text-[var(--heading-text)] mb-6">
                Current Reading Progress
              </h2>

              <div className="space-y-4">
                {progress.map((entry) => (
                  <div
                    key={entry.id}
                    className="flex items-start gap-4 p-4 bg-[var(--background)] border border-[var(--border-color)] rounded-lg"
                  >
                    <Calendar className="w-5 h-5 text-[var(--accent)]/60 mt-0.5" />
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <p className="font-semibold text-[var(--foreground)]">
                          Page <span className="font-mono">{entry.currentPage}</span>
                        </p>
                        <p className="text-sm text-[var(--foreground)]/60 font-mono font-semibold">
                          {format(new Date(entry.progressDate), "MMM d, yyyy")}
                        </p>
                      </div>
                      <p className="text-sm text-[var(--foreground)]/70 font-medium">
                        <span className="font-mono font-semibold">{Math.round(entry.currentPercentage)}%</span> complete
                        {entry.pagesRead > 0 && (
                          <>
                            {" • "}
                            <span className="font-mono font-semibold">{entry.pagesRead}</span> pages read
                          </>
                        )}
                      </p>
                      {entry.notes && (
                        <p className="text-sm text-[var(--foreground)]/60 mt-2 italic font-medium">
                          {entry.notes}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Reading History */}
          <ReadingHistoryTab key={historyRefreshKey} bookId={bookId} />
        </div>
      </div>

      {/* Finish Book Modal with Rating */}
      <FinishBookModal
        isOpen={showReadConfirmation}
        onClose={() => setShowReadConfirmation(false)}
        onConfirm={handleConfirmRead}
        bookTitle={book?.title || ""}
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
    </div>
  );
}
