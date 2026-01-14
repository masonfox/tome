"use client";

/**
 * Read Next Queue Page
 * 
 * Displays and manages the read-next queue with drag-and-drop reordering.
 * Mirrors /shelves/[id] page structure but simplified (no add books, no move/copy).
 */

import { useEffect, useState } from "react";
import { Clock, Search, X } from "lucide-react";
import Link from "next/link";
import { useReadNextBooks } from "@/hooks/useReadNextBooks";
import { DraggableBookList } from "@/components/Books/DraggableBookList";
import { DraggableBookTable } from "@/components/Books/DraggableBookTable";
import { BookListItem } from "@/components/Books/BookListItem";
import { BookListItemSkeleton } from "@/components/Books/BookListItemSkeleton";
import { BookTable } from "@/components/Books/BookTable";
import { BulkActionBar } from "@/components/ShelfManagement/BulkActionBar";
import BaseModal from "@/components/Modals/BaseModal";
import { PageHeader } from "@/components/Layout/PageHeader";
import { cn } from "@/utils/cn";
import type { Book } from "@/lib/db/schema/books";

export default function ReadNextPage() {
  const {
    sessions,
    loading,
    fetchBooks,
    reorderBooks,
    updateLocalOrder,
    removeBooks,
  } = useReadNextBooks();

  const [filterText, setFilterText] = useState("");
  const [isMobile, setIsMobile] = useState(false);
  const [hasInitialized, setHasInitialized] = useState(false);
  
  // Multi-select state
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedBookIds, setSelectedBookIds] = useState<Set<number>>(new Set());
  const [bulkRemoveLoading, setBulkRemoveLoading] = useState(false);
  const [showBulkRemoveModal, setShowBulkRemoveModal] = useState(false);

  // Detect mobile/tablet vs desktop
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 1024); // < lg breakpoint
    };

    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // Fetch books on mount
  useEffect(() => {
    const init = async () => {
      await fetchBooks();
      setHasInitialized(true);
    };
    init();
  }, [fetchBooks]);

  // Map sessions to books with sortOrder for draggable components
  const books: (Book & { sortOrder: number })[] = sessions.map((session) => ({
    ...session.book,
    sortOrder: session.readNextOrder,
  }));

  // Filter books based on search text
  const filteredBooks = books.filter((book) => {
    if (!filterText.trim()) return true;
    
    const searchLower = filterText.toLowerCase();
    const titleMatch = book.title.toLowerCase().includes(searchLower);
    const authorMatch = book.authors.some((author) =>
      author.toLowerCase().includes(searchLower)
    );
    const seriesMatch = book.series?.toLowerCase().includes(searchLower);
    
    return titleMatch || authorMatch || seriesMatch;
  });

  // Multi-select handlers
  const toggleSelectMode = () => {
    setIsSelectMode(!isSelectMode);
    setSelectedBookIds(new Set()); // Clear selection when toggling
  };

  const toggleBookSelection = (bookId: number) => {
    setSelectedBookIds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(bookId)) {
        newSet.delete(bookId);
      } else {
        newSet.add(bookId);
      }
      return newSet;
    });
  };

  const toggleSelectAll = () => {
    if (selectedBookIds.size === filteredBooks.length) {
      // Deselect all
      setSelectedBookIds(new Set());
    } else {
      // Select all visible books
      setSelectedBookIds(new Set(filteredBooks.map((book) => book.id)));
    }
  };

  const handleBulkRemove = () => {
    if (selectedBookIds.size === 0) return;
    setShowBulkRemoveModal(true);
  };

  const confirmBulkRemove = async () => {
    if (selectedBookIds.size === 0) return;

    setBulkRemoveLoading(true);
    try {
      await removeBooks(Array.from(selectedBookIds));
      setShowBulkRemoveModal(false);
      setIsSelectMode(false);
      setSelectedBookIds(new Set());
    } catch (error) {
      // Error handled by hook
    } finally {
      setBulkRemoveLoading(false);
    }
  };

  // Handle drag-and-drop reorder (receives array of book IDs in new order)
  const handleReorder = async (bookIds: number[]) => {
    // Find corresponding sessions for reordered books and update their readNextOrder
    const reorderedSessions = bookIds.map((bookId, index) => {
      const session = sessions.find((s) => s.book.id === bookId)!;
      return {
        ...session,
        readNextOrder: index, // Update the order in the optimistic state
      };
    });

    // Update local state optimistically with new order values
    updateLocalOrder(reorderedSessions);

    // Prepare updates for API (session IDs with new order)
    const updates = reorderedSessions.map((session) => ({
      id: session.id, // Session ID, not book ID
      readNextOrder: session.readNextOrder,
    }));

    // Send to API
    try {
      await reorderBooks(updates);
    } catch (error) {
      // Hook already shows toast, refresh to revert optimistic update
      await fetchBooks();
    }
  };

  // Loading skeleton
  if (!hasInitialized || (loading && sessions.length === 0)) {
    return (
      <div className="space-y-10">
        {/* Header Skeleton */}
        <div className="border-b border-[var(--border-color)] pb-6 animate-pulse">
          {/* Title with Icon Skeleton */}
          <div className="flex items-center gap-3 sm:gap-4 mb-2">
            <div className="w-8 h-8 bg-[var(--card-bg)] rounded-full flex-shrink-0"></div>
            <div className="h-10 bg-[var(--card-bg)] rounded w-56"></div>
          </div>
          {/* Subtitle Skeleton */}
          <div className="h-6 bg-[var(--card-bg)] rounded w-64 mt-2"></div>
        </div>

        {/* Content Skeleton */}
        <div>
          {/* Filter Controls Skeleton */}
          <div className="mb-6 animate-pulse">
            <div className="h-[42px] bg-[var(--card-bg)] rounded-lg mb-3"></div>
          </div>

          {/* Books List/Table Skeleton - Responsive */}
          <div className="lg:hidden space-y-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <BookListItemSkeleton key={i} />
            ))}
          </div>
          <div className="hidden lg:block">
            <BookTable books={[]} loading={true} />
          </div>
        </div>
      </div>
    );
  }

  // Build title with book count
  const titleWithCount = (
    <>
      Read Next{' '}
      <span className="text-2xl text-[var(--accent)] whitespace-nowrap">({sessions.length})</span>
    </>
  );

  // Build custom icon (Clock in accent-colored circle)
  const customIcon = (
    <div
      className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
      style={{ backgroundColor: "var(--accent)" }}
    >
      <Clock className="w-5 h-5 text-white" />
    </div>
  );

  return (
    <div className="space-y-10">
      {/* Header */}
      <PageHeader
        title={titleWithCount}
        subtitle="Your reading queue - drag to reorder priority"
        customIcon={customIcon}
      />

      {/* Content */}
      <div>
        {/* Filter Controls */}
        {sessions.length > 0 && (
          <div className="mb-6">
            {/* Filter Input with Select Button */}
            <div className="flex gap-3 mb-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--foreground)]/40" />
                <input
                  type="text"
                  placeholder="Filter by title, author, or series..."
                  value={filterText}
                  onChange={(e) => setFilterText(e.target.value)}
                  className={`w-full pl-10 py-2 bg-[var(--card-bg)] border border-[var(--border-color)] rounded-lg text-[var(--foreground)] placeholder:text-[var(--foreground)]/50 focus:outline-none focus:ring-2 focus:ring-[var(--accent)] ${
                    filterText ? "pr-10" : "pr-4"
                  }`}
                />
                {filterText && (
                  <button
                    type="button"
                    onClick={() => setFilterText("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--foreground)]/40 hover:text-[var(--foreground)] transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                )}
              </div>
              
              {/* Select/Cancel Button */}
              <button
                onClick={toggleSelectMode}
                className={cn(
                  "px-4 py-2 rounded-lg font-medium transition-colors whitespace-nowrap",
                  isSelectMode
                    ? "bg-[var(--card-bg)] text-[var(--foreground)] border border-[var(--border-color)] hover:bg-[var(--hover-bg)]"
                    : "bg-[var(--accent)] text-white hover:bg-[var(--light-accent)]"
                )}
              >
                {isSelectMode ? "Cancel" : "Select"}
              </button>
            </div>
            
            {/* Filter Results Count */}
            {filterText && (
              <p className="text-sm text-[var(--foreground)]/60 mt-2">
                Showing {filteredBooks.length} of {sessions.length} {sessions.length === 1 ? "book" : "books"}
              </p>
            )}
          </div>
        )}

        {/* Books Display - Responsive with drag-and-drop */}
        {loading ? (
          isMobile ? (
            <div className="space-y-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <BookListItemSkeleton key={i} />
              ))}
            </div>
          ) : (
            <BookTable books={[]} loading={true} />
          )
        ) : sessions.length === 0 ? (
          // Empty state
          <div className="text-center py-16">
            <div className="text-[var(--foreground)]/40 mb-4">
              <Clock className="w-24 h-24 mx-auto" />
            </div>
            <h2 className="text-xl font-semibold text-[var(--heading-text)] mb-2">
              Your read-next queue is empty
            </h2>
            <p className="text-[var(--foreground)]/60 mb-6">
              Add books from your library to start building your reading queue
            </p>
            <Link
              href="/library?status=to-read"
              className="inline-flex items-center gap-2 px-6 py-3 bg-[var(--accent)] text-white rounded-lg hover:bg-[var(--light-accent)] transition-colors font-medium"
            >
              Browse To-Read Books
            </Link>
          </div>
        ) : filteredBooks.length === 0 ? (
          // No search results
          <div className="text-center py-16">
            <p className="text-[var(--foreground)]/60">
              No books found matching &quot;{filterText}&quot;
            </p>
          </div>
        ) : isMobile ? (
          // Mobile: Always use draggable list (disable dragging when filtering or selecting)
          !filterText ? (
            <DraggableBookList
              books={filteredBooks}
              onReorder={handleReorder}
              isDragEnabled={!isSelectMode}
              isSelectMode={isSelectMode}
              selectedBookIds={selectedBookIds}
              onToggleSelection={toggleBookSelection}
            />
          ) : (
            <div className="space-y-4">
              {filteredBooks.map((book) => (
                <BookListItem
                  key={book.id}
                  book={book}
                  isSelectMode={isSelectMode}
                  isSelected={selectedBookIds.has(book.id)}
                  onToggleSelection={() => toggleBookSelection(book.id)}
                />
              ))}
            </div>
          )
        ) : (
          // Desktop: Always use draggable table (disable dragging when filtering or selecting)
          !filterText ? (
            <DraggableBookTable
              books={filteredBooks}
              onReorder={handleReorder}
              isDragEnabled={!isSelectMode}
              isSelectMode={isSelectMode}
              selectedBookIds={selectedBookIds}
              onToggleSelection={toggleBookSelection}
              onToggleSelectAll={toggleSelectAll}
            />
          ) : (
            <BookTable
              books={filteredBooks}
              onToggleSelection={isSelectMode ? toggleBookSelection : undefined}
              selectedBookIds={isSelectMode ? selectedBookIds : undefined}
              onToggleSelectAll={isSelectMode ? toggleSelectAll : undefined}
            />
          )
        )}

        {/* Bulk Action Bar */}
        {isSelectMode && selectedBookIds.size > 0 && (
          <BulkActionBar
            selectedCount={selectedBookIds.size}
            onCancel={() => {
              setIsSelectMode(false);
              setSelectedBookIds(new Set());
            }}
            onDelete={handleBulkRemove}
          />
        )}

        {/* Bulk Remove Confirmation Modal */}
        <BaseModal
          isOpen={showBulkRemoveModal}
          onClose={() => setShowBulkRemoveModal(false)}
          title="Remove from Read Next"
          actions={
            <>
              <button
                onClick={() => setShowBulkRemoveModal(false)}
                disabled={bulkRemoveLoading}
                className="px-4 py-2 bg-[var(--card-bg)] text-[var(--foreground)] border border-[var(--border-color)] rounded-lg hover:bg-[var(--hover-bg)] transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={confirmBulkRemove}
                disabled={bulkRemoveLoading}
                className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors disabled:opacity-50"
              >
                {bulkRemoveLoading ? "Removing..." : "Remove"}
              </button>
            </>
          }
        >
          <div className="space-y-4">
            <p className="text-[var(--foreground)]">
              Are you sure you want to remove {selectedBookIds.size}{" "}
              {selectedBookIds.size === 1 ? "book" : "books"} from your read-next queue?
            </p>
            <p className="text-sm text-[var(--foreground)]/60">
              {selectedBookIds.size === 1 ? "This book" : "These books"} will be moved back to your To-Read list.
            </p>
          </div>
        </BaseModal>
      </div>
    </div>
  );
}
