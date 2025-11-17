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
  const bookId = params.id as string;

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
        <div className="inline-block w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!book) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600 dark:text-gray-400">Book not found</p>
      </div>
    );
  }

  const progressPercentage = book.latestProgress?.currentPercentage || 0;

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      {/* Book Header */}
      <div className="grid md:grid-cols-[250px_1fr] gap-8">
        {/* Cover */}
        <div className="aspect-[2/3] bg-gray-200 dark:bg-gray-700 rounded-lg overflow-hidden flex items-center justify-center">
          {book.coverPath ? (
            <img
              src={book.coverPath}
              alt={book.title}
              className="w-full h-full object-cover"
              loading="eager"
            />
          ) : (
            <BookOpen className="w-24 h-24 text-gray-400" />
          )}
        </div>

        {/* Info */}
        <div className="space-y-6">
          <div>
            <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-2">
              {book.title}
            </h1>
            <p className="text-xl text-gray-600 dark:text-gray-400">
              {book.authors.join(", ")}
            </p>

            {book.series && (
              <p className="text-sm text-gray-500 dark:text-gray-500 mt-1">
                {book.series}
              </p>
            )}
          </div>

          {/* Metadata */}
          <div className="grid grid-cols-2 gap-4 text-sm">
            {book.publisher && (
              <div>
                <span className="text-gray-500 dark:text-gray-400">
                  Publisher:
                </span>
                <span className="ml-2 text-gray-900 dark:text-white">
                  {book.publisher}
                </span>
              </div>
            )}
            <div>
              <span className="text-gray-500 dark:text-gray-400">
                Pages:
              </span>
              <span className="ml-2 text-gray-900 dark:text-white">
                {book.totalPages || "Not set"}
              </span>
            </div>
          </div>

          {/* Tags */}
          {book.tags.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Tags
              </label>
              <div className="flex flex-wrap gap-2">
                {book.tags.map((tag) => (
                  <span
                    key={tag}
                    className="px-3 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-full text-sm"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Pages Setting - Required Before Status Change */}
          {!book.totalPages && (
            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
              <p className="text-sm font-medium text-amber-900 dark:text-amber-200 mb-3">
                📖 Set total pages first to track your reading progress
              </p>
              <form onSubmit={handleUpdateTotalPages} className="flex gap-2">
                <input
                  type="number"
                  value={totalPages}
                  onChange={(e) => setTotalPages(e.target.value)}
                  min="1"
                  className="flex-1 px-3 py-2 border border-amber-300 dark:border-amber-700 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                  placeholder="Total pages in this book"
                  autoFocus
                />
                <button
                  type="submit"
                  className="px-4 py-2 bg-amber-600 text-white rounded-lg text-sm hover:bg-amber-700 transition-colors font-medium"
                >
                  Set Pages
                </button>
              </form>
            </div>
          )}

          {/* Status Selector */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Reading Status
            </label>
            <div className="flex gap-2">
              {["to-read", "reading", "read"].map((status) => {
                const isDisabled = !book.totalPages && status !== "to-read";
                return (
                  <button
                    key={status}
                    onClick={() => handleUpdateStatus(status)}
                    disabled={isDisabled}
                    title={isDisabled ? "Set total pages first to track reading progress" : ""}
                    className={cn(
                      "px-4 py-2 rounded-lg font-medium transition-colors",
                      selectedStatus === status
                        ? "bg-blue-600 text-white"
                        : isDisabled
                        ? "bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-600 cursor-not-allowed"
                        : "bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600"
                    )}
                  >
                    {status === "to-read"
                      ? "To Read"
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
              <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-400 mb-2">
                <span>Progress</span>
                <span>{Math.round(progressPercentage)}%</span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
                <div
                  className="bg-green-500 h-3 rounded-full transition-all"
                  style={{ width: `${Math.min(100, progressPercentage)}%` }}
                />
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Page {book.latestProgress?.currentPage || 0} of {book.totalPages}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Progress Tracker */}
      {book.totalPages && selectedStatus === "reading" && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 border border-gray-200 dark:border-gray-700">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
            Log Progress
          </h2>

          <form onSubmit={handleLogProgress} className="space-y-4">
            {/* Input Mode Toggle */}
            <div className="flex gap-2 border-b border-gray-200 dark:border-gray-700 pb-4">
              <button
                type="button"
                onClick={() => {
                  setProgressInputMode("page");
                  if (book.latestProgress) {
                    setCurrentPage(book.latestProgress.currentPage.toString());
                  }
                }}
                className={cn(
                  "px-4 py-2 rounded-lg font-medium transition-colors",
                  progressInputMode === "page"
                    ? "bg-blue-600 text-white"
                    : "bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600"
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
                  "px-4 py-2 rounded-lg font-medium transition-colors",
                  progressInputMode === "percentage"
                    ? "bg-blue-600 text-white"
                    : "bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600"
                )}
              >
                By Percentage
              </button>
            </div>

            {/* Page Input */}
            {progressInputMode === "page" && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Current Page
                </label>
                <input
                  type="number"
                  value={currentPage}
                  onChange={(e) => setCurrentPage(e.target.value)}
                  min="0"
                  max={book.totalPages}
                  step="1"
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Enter current page"
                />
              </div>
            )}

            {/* Percentage Input */}
            {progressInputMode === "percentage" && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
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
                    className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Enter percentage (0-100)"
                  />
                  <span className="flex items-center px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg">
                    %
                  </span>
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Notes (optional)
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Add notes about this reading session..."
              />
            </div>

            <button
              type="submit"
              className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              Log Progress
            </button>
          </form>
        </div>
      )}

      {/* Progress History */}
      {progress.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 border border-gray-200 dark:border-gray-700">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
            Progress History
          </h2>

          <div className="space-y-4">
            {progress.map((entry) => (
              <div
                key={entry._id}
                className="flex items-start gap-4 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg"
              >
                <Calendar className="w-5 h-5 text-gray-400 mt-0.5" />
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <p className="font-medium text-gray-900 dark:text-white">
                      Page {entry.currentPage}
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {format(new Date(entry.progressDate), "MMM d, yyyy")}
                    </p>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-300">
                    {Math.round(entry.currentPercentage)}% complete
                    {entry.pagesRead > 0 && ` • ${entry.pagesRead} pages read`}
                  </p>
                  {entry.notes && (
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-2 italic">
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
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 max-w-sm w-full">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
              Mark as Read?
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              Marking this book as read will set your progress to 100%.
            </p>
            <p className="text-gray-600 dark:text-gray-400 mb-6 font-bold">
              Are you sure you've finished reading?
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowReadConfirmation(false)}
                className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmRead}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
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
