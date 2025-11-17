"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { BookOpen, Calendar, TrendingUp, Star } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/utils/cn";

interface Book {
  _id: string;
  title: string;
  authors: string[];
  coverPath?: string;
  totalPages?: number;
  publisher?: string;
  pubDate?: string;
  series?: string;
  description?: string;
  tags: string[];
  status?: {
    status: string;
    startedDate?: string;
    completedDate?: string;
    rating?: number;
    review?: string;
  };
  latestProgress?: {
    currentPage: number;
    currentPercentage: number;
    progressDate: string;
  };
}

interface ProgressEntry {
  _id: string;
  currentPage: number;
  currentPercentage: number;
  progressDate: string;
  notes?: string;
  pagesRead: number;
}

export default function BookDetailPage() {
  const params = useParams();
  const bookId = params?.id as string;

  const [book, setBook] = useState<Book | null>(null);
  const [progress, setProgress] = useState<ProgressEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState("");
  const [currentPercentage, setCurrentPercentage] = useState("");
  const [progressInputMode, setProgressInputMode] = useState<"page" | "percentage">("page");
  const [notes, setNotes] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("to-read");
  const [rating, setRating] = useState(0);
  const [totalPages, setTotalPages] = useState("");
  const [showReadConfirmation, setShowReadConfirmation] = useState(false);

  useEffect(() => {
    fetchBook();
    fetchProgress();
  }, [bookId]);

  async function fetchBook() {
    try {
      const response = await fetch(`/api/books/${bookId}`);
      const data = await response.json();
      setBook(data);
      if (data.status) {
        setSelectedStatus(data.status.status);
        setRating(data.status.rating || 0);
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
        alert("Please enter a page number greater than the current page.");
        return;
      }
      payload.currentPage = pageValue;
    } else {
      if (!currentPercentage) return;
      const percentValue = parseFloat(currentPercentage);
      // Validate that the new percentage is greater than the latest progress
      if (book?.latestProgress && percentValue <= book.latestProgress.currentPercentage) {
        alert("Please enter a percentage greater than the current progress.");
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

    try {
      const body: any = { status: newStatus };
      // Only include rating if it's been set (greater than 0)
      if (rating > 0) {
        body.rating = rating;
      }
      
      const response = await fetch(`/api/books/${bookId}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (response.ok) {
        setSelectedStatus(newStatus);
        fetchBook();
      }
    } catch (error) {
      console.error("Failed to update status:", error);
    }
  }

  async function handleConfirmRead() {
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
      if (rating > 0) {
        statusBody.rating = rating;
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
      }
    } catch (error) {
      console.error("Failed to mark book as read:", error);
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
        <p className="text-[var(--foreground)]/60">Book not found</p>
      </div>
    );
  }

  const progressPercentage = book.latestProgress?.currentPercentage || 0;

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      {/* Book Header */}
      <div className="grid md:grid-cols-[250px_1fr] gap-8">
        {/* Cover */}
        <div className="aspect-[2/3] bg-[var(--light-accent)]/30 rounded border border-[var(--border-color)] overflow-hidden flex items-center justify-center">
          {book.coverPath ? (
            <img
              src={book.coverPath}
              alt={book.title}
              className="w-full h-full object-cover"
              loading="eager"
            />
          ) : (
            <BookOpen className="w-24 h-24 text-[var(--foreground)]/40" />
          )}
        </div>

        {/* Info */}
        <div className="space-y-6">
          <div>
            <h1 className="text-4xl font-serif font-bold text-[var(--foreground)] mb-2">
              {book.title}
            </h1>
            <p className="text-xl text-[var(--foreground)]/70">
              {book.authors.join(", ")}
            </p>

            {book.series && (
              <p className="text-sm text-[var(--foreground)]/60 mt-1 font-light">
                {book.series}
              </p>
            )}
          </div>

          {/* Metadata */}
          <div className="grid grid-cols-2 gap-4 text-sm border-t border-[var(--border-color)] pt-4">
            {book.publisher && (
              <div>
                <span className="text-[var(--foreground)]/60 font-light uppercase tracking-wide text-xs">
                  Publisher
                </span>
                <p className="text-[var(--foreground)] mt-1">
                  {book.publisher}
                </p>
              </div>
            )}
            <div>
              <span className="text-[var(--foreground)]/60 font-light uppercase tracking-wide text-xs">
                Pages
              </span>
              <p className="text-[var(--foreground)] mt-1">
                {book.totalPages || "Not set"}
              </p>
            </div>
          </div>

          {/* Tags */}
          {book.tags.length > 0 && (
            <div>
              <label className="block text-xs font-light uppercase tracking-wide text-[var(--foreground)]/60 mb-3">
                Tags
              </label>
              <div className="flex flex-wrap gap-2">
                {book.tags.map((tag) => (
                  <span
                    key={tag}
                    className="px-3 py-1 bg-[var(--card-bg)] text-[var(--foreground)] border border-[var(--border-color)] rounded text-sm font-light"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Description */}
          {book.description && (
            <div>
              <label className="block text-xs font-light uppercase tracking-wide text-[var(--foreground)]/60 mb-3">
                Description
              </label>
              <p className="text-sm text-[var(--foreground)]/80 font-light leading-relaxed whitespace-pre-wrap">
                {book.description.replace(/<[^>]*>/g, "")}
              </p>
            </div>
          )}

          {/* Pages Setting - Required Before Status Change */}
          {!book.totalPages && (
            <div className="bg-[var(--light-accent)]/10 border border-[var(--light-accent)]/40 rounded-lg p-4">
              <p className="text-sm font-light text-[var(--foreground)] mb-3">
                📖 Set total pages first to track your reading progress
              </p>
              <form onSubmit={handleUpdateTotalPages} className="flex gap-2">
                <input
                  type="number"
                  value={totalPages}
                  onChange={(e) => setTotalPages(e.target.value)}
                  min="1"
                  className="flex-1 px-3 py-2 border border-[var(--border-color)] rounded-lg bg-[var(--background)] text-[var(--foreground)] text-sm focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent"
                  placeholder="Total pages in this book"
                  autoFocus
                />
                <button
                  type="submit"
                  className="px-4 py-2 bg-[var(--accent)] text-white rounded-lg text-sm hover:bg-[var(--light-accent)] transition-colors font-semibold"
                >
                  Set Pages
                </button>
              </form>
            </div>
          )}

          {/* Status Selector */}
          <div>
            <label className="block text-xs font-light uppercase tracking-wide text-[var(--foreground)]/60 mb-3">
              Reading Status
            </label>
            <div className="flex gap-2">
              {["to-read", "read-next", "reading", "read"].map((status) => {
                const isDisabled = !book.totalPages && status !== "to-read" && status !== "read-next";
                return (
                  <button
                    key={status}
                    onClick={() => handleUpdateStatus(status)}
                    disabled={isDisabled}
                    title={isDisabled ? "Set total pages first to track reading progress" : ""}
                    className={cn(
                      "px-4 py-2 rounded-lg font-semibold transition-colors text-sm uppercase tracking-wide",
                      selectedStatus === status
                        ? "bg-[var(--accent)] text-white"
                        : isDisabled
                        ? "bg-[var(--card-bg)] text-[var(--foreground)]/40 cursor-not-allowed"
                        : "bg-[var(--card-bg)] text-[var(--foreground)] hover:bg-[var(--light-accent)]/30"
                    )}
                  >
                    {status === "to-read"
                      ? "To Read"
                      : status === "read-next"
                      ? "Read Next"
                      : status === "reading"
                      ? "Reading"
                      : "Read"}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Progress Bar */}
          {book.totalPages && (
            <div>
              <div className="flex items-center justify-between text-sm text-[var(--foreground)]/70 mb-3 font-light">
                <span>PROGRESS</span>
                <span className="font-semibold">{Math.round(progressPercentage)}%</span>
              </div>
              <div className="w-full bg-[var(--border-color)] rounded-full h-2">
                <div
                  className="bg-[var(--accent)] h-2 rounded-full transition-all"
                  style={{ width: `${Math.min(100, progressPercentage)}%` }}
                />
              </div>
              <p className="text-sm text-[var(--foreground)]/60 mt-2 font-light">
                Page {book.latestProgress?.currentPage || 0} of {book.totalPages}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Progress Tracker */}
      {book.totalPages && selectedStatus === "reading" && (
        <div className="bg-[var(--card-bg)] border border-[var(--border-color)] rounded-lg p-6">
          <h2 className="text-2xl font-serif font-bold text-[var(--foreground)] mb-6">
            Log Progress
          </h2>

          <form onSubmit={handleLogProgress} className="space-y-4">
            {/* Input Mode Toggle */}
            <div className="flex gap-2 border-b border-[var(--border-color)] pb-4">
              <button
                type="button"
                onClick={() => {
                  setProgressInputMode("page");
                  if (book.latestProgress) {
                    setCurrentPage(book.latestProgress.currentPage.toString());
                  }
                }}
                className={cn(
                  "px-4 py-2 rounded-lg font-semibold transition-colors text-sm uppercase tracking-wide",
                  progressInputMode === "page"
                    ? "bg-[var(--accent)] text-white"
                    : "bg-[var(--background)] text-[var(--foreground)] hover:bg-[var(--light-accent)]/30"
                )}
              >
                By Page
              </button>
              <button
                type="button"
                onClick={() => {
                  setProgressInputMode("percentage");
                  if (book.latestProgress) {
                    setCurrentPercentage(book.latestProgress.currentPercentage.toString());
                  }
                }}
                className={cn(
                  "px-4 py-2 rounded-lg font-semibold transition-colors text-sm uppercase tracking-wide",
                  progressInputMode === "percentage"
                    ? "bg-[var(--accent)] text-white"
                    : "bg-[var(--background)] text-[var(--foreground)] hover:bg-[var(--light-accent)]/30"
                )}
              >
                By Percentage
              </button>
            </div>

            {/* Page Input */}
            {progressInputMode === "page" && (
              <div>
                <label className="block text-xs font-light uppercase tracking-wide text-[var(--foreground)]/60 mb-2">
                  Current Page
                </label>
                <input
                  type="number"
                  value={currentPage}
                  onChange={(e) => setCurrentPage(e.target.value)}
                  min="0"
                  max={book.totalPages}
                  step="1"
                  className="w-full px-4 py-2 border border-[var(--border-color)] rounded-lg bg-[var(--background)] text-[var(--foreground)] focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent"
                  placeholder="Enter current page"
                />
              </div>
            )}

            {/* Percentage Input */}
            {progressInputMode === "percentage" && (
              <div>
                <label className="block text-xs font-light uppercase tracking-wide text-[var(--foreground)]/60 mb-2">
                  Progress Percentage
                </label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    value={currentPercentage}
                    onChange={(e) => setCurrentPercentage(e.target.value)}
                    min="0"
                    max="100"
                    step="1"
                    className="flex-1 px-4 py-2 border border-[var(--border-color)] rounded-lg bg-[var(--background)] text-[var(--foreground)] focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent"
                    placeholder="Enter percentage (0-100)"
                  />
                  <span className="flex items-center px-4 py-2 bg-[var(--border-color)] text-[var(--foreground)]/70 rounded-lg">
                    %
                  </span>
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-light uppercase tracking-wide text-[var(--foreground)]/60 mb-2">
                Notes (optional)
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
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

      {/* Progress History */}
      {progress.length > 0 && (
        <div className="bg-[var(--card-bg)] border border-[var(--border-color)] rounded-lg p-6">
          <h2 className="text-2xl font-serif font-bold text-[var(--foreground)] mb-6">
            Progress History
          </h2>

          <div className="space-y-4">
            {progress.map((entry) => (
              <div
                key={entry._id}
                className="flex items-start gap-4 p-4 bg-[var(--background)] border border-[var(--border-color)] rounded-lg"
              >
                <Calendar className="w-5 h-5 text-[var(--accent)]/60 mt-0.5" />
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <p className="font-semibold text-[var(--foreground)]">
                      Page {entry.currentPage}
                    </p>
                    <p className="text-sm text-[var(--foreground)]/60 font-light">
                      {format(new Date(entry.progressDate), "MMM d, yyyy")}
                    </p>
                  </div>
                  <p className="text-sm text-[var(--foreground)]/70 font-light">
                    {Math.round(entry.currentPercentage)}% complete
                    {entry.pagesRead > 0 && ` • ${entry.pagesRead} pages read`}
                  </p>
                  {entry.notes && (
                    <p className="text-sm text-[var(--foreground)]/60 mt-2 italic font-light">
                      {entry.notes}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Read Confirmation Dialog */}
      {showReadConfirmation && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-[var(--card-bg)] border border-[var(--border-color)] rounded-lg shadow-lg p-6 max-w-sm w-full">
            <h2 className="text-xl font-serif font-bold text-[var(--foreground)] mb-2">
              Mark as Read?
            </h2>
            <p className="text-[var(--foreground)]/70 mb-4 font-light">
              Marking this book as read will set your progress to 100%.
            </p>
            <p className="text-[var(--foreground)] mb-6 font-semibold">
              Are you sure you've finished reading?
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowReadConfirmation(false)}
                className="px-4 py-2 bg-[var(--border-color)] text-[var(--foreground)] rounded-lg hover:bg-[var(--light-accent)]/20 transition-colors font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmRead}
                className="px-4 py-2 bg-[var(--accent)] text-white rounded-lg hover:bg-[var(--light-accent)] transition-colors font-semibold"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
