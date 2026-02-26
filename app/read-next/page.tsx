"use client";

/**
 * Read Next Queue Page
 * 
 * Displays and manages the read-next queue with drag-and-drop reordering.
 * Uses shared abstractions: useBookListView, useBulkOperation, BookListControls
 */

import { Clock } from "lucide-react";
import { useState } from "react";
import Link from "next/link";
import { useReadNextBooks } from "@/hooks/useReadNextBooks";
import { useBookListView } from "@/hooks/useBookListView";
import { useBulkOperation } from "@/hooks/useBulkOperation";
import { BookListControls } from "@/components/Books/BookListControls";
import { DraggableBookList } from "@/components/Books/DraggableBookList";
import { DraggableBookTable } from "@/components/Books/DraggableBookTable";
import { BookListItem } from "@/components/Books/BookListItem";
import { BookListItemSkeleton } from "@/components/Books/BookListItemSkeleton";
import { BookTable } from "@/components/Books/BookTable";
import { BulkActionBar } from "@/components/ShelfManagement/BulkActionBar";
import { BookActionsDropdown } from "@/components/Books/BookActionsDropdown";
import BaseModal from "@/components/Modals/BaseModal";
import { PageHeader } from "@/components/Layout/PageHeader";
import { Button } from "@/components/Utilities/Button";
import type { Book } from "@/lib/db/schema/books";

export default function ReadNextPage() {
  const { sessions, loading, reorderBooks, removeBooks, moveToTop, moveToBottom } = useReadNextBooks();
  const [removingBook, setRemovingBook] = useState<{ id: number; title: string } | null>(null);
  const [removeLoading, setRemoveLoading] = useState(false);

  // Map sessions to books with sortOrder for draggable components
  // Use array index for sortOrder so Order column displays sequential "1, 2, 3..."
  const booksWithOrder: (Book & { sortOrder: number })[] = sessions.map((session, index) => ({
    ...session.book,
    sortOrder: index,
  }));

  // Pre-compute lookup map to avoid O(n) findIndex per row in renderActions
  const sessionLookup = new Map(
    sessions.map((s, i) => [s.book.id, { sessionId: s.id, index: i }])
  );

  // Use shared book list view hook for filtering and selection
  const listView = useBookListView({ books: booksWithOrder });

  // Use shared bulk operation hook for remove operation
  const bulkRemove = useBulkOperation({
    onExecute: async (bookIds: number[]) => {
      await removeBooks(bookIds);
    },
    onSuccess: () => {
      listView.clearSelection();
      listView.exitSelectMode();
    },
  });

  // Handle drag-and-drop reorder (receives array of book IDs in new order)
  const handleReorder = async (bookIds: number[]) => {
    // Prepare updates for API (session IDs with new order)
    const updates = bookIds.map((bookId, index) => {
      const entry = sessionLookup.get(bookId)!;
      return {
        id: entry.sessionId,
        readNextOrder: index,
      };
    });

    // Send to API (with optimistic update handled by React Query)
    try {
      await reorderBooks(updates);
    } catch (error) {
      // Error already handled by hook with rollback
    }
  };

  // Handle individual book removal
  const handleRemoveBook = async () => {
    if (!removingBook) return;

    setRemoveLoading(true);
    try {
      await removeBooks([removingBook.id]);
      setRemovingBook(null);
    } catch (error) {
      console.error("Failed to remove book:", error);
    } finally {
      setRemoveLoading(false);
    }
  };

  // Loading skeleton
  const hasInitialized = sessions.length > 0 || !loading;
  if (!hasInitialized) {
    return (
      <div className="space-y-10">
        {/* Header Skeleton */}
        <div className="border-b border-[var(--border-color)] pb-6 animate-pulse">
          <div className="flex items-center gap-3 sm:gap-4 mb-2">
            <div className="w-8 h-8 bg-[var(--card-bg)] rounded-full flex-shrink-0"></div>
            <div className="h-10 bg-[var(--card-bg)] rounded w-56"></div>
          </div>
          <div className="h-6 bg-[var(--card-bg)] rounded w-64 mt-2"></div>
        </div>

        {/* Content Skeleton */}
        <div>
          <div className="mb-6 animate-pulse">
            <div className="h-[42px] bg-[var(--card-bg)] rounded-lg mb-3"></div>
          </div>

          {/* Books List/Table Skeleton */}
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
        subtitle="Your reading queue"
        customIcon={customIcon}
      />

      {/* Content */}
      <div>
        {/* Filter Controls */}
        {sessions.length > 0 && (
          <BookListControls
            filterText={listView.filterText}
            onFilterChange={listView.setFilterText}
            onClearFilter={() => listView.setFilterText("")}
            isSelectMode={listView.isSelectMode}
            onToggleSelectMode={listView.toggleSelectMode}
            totalCount={sessions.length}
            filteredCount={listView.filteredBooks.length}
          />
        )}

        {/* Books Display - Responsive with drag-and-drop */}
        {loading ? (
          listView.isMobile ? (
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
              className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-[var(--accent)] text-white rounded-md hover:bg-[var(--light-accent)] shadow-md hover:shadow-lg transition-all font-semibold"
            >
              Browse To-Read Books
            </Link>
          </div>
        ) : listView.filteredBooks.length === 0 ? (
          // No search results
          <div className="text-center py-16">
            <p className="text-[var(--foreground)]/60">
              No books found matching &quot;{listView.filterText}&quot;
            </p>
          </div>
        ) : listView.isMobile ? (
          // Mobile: Always use draggable list (disable dragging when filtering or selecting)
          !listView.filterText ? (
            <DraggableBookList
              books={listView.filteredBooks}
              onReorder={handleReorder}
              isDragEnabled={!listView.isSelectMode}
              isSelectMode={listView.isSelectMode}
              selectedBookIds={listView.selectedBookIds}
              onToggleSelection={listView.toggleBookSelection}
              renderActions={!listView.isSelectMode ? (book) => {
                const entry = sessionLookup.get(book.id);
                return entry ? (
                  <BookActionsDropdown
                    bookId={book.id}
                    bookTitle={book.title}
                    isAtTop={entry.index === 0}
                    isAtBottom={entry.index === sessions.length - 1}
                    onRemove={() => setRemovingBook({ id: book.id, title: book.title })}
                    onMoveToTop={() => moveToTop(entry.sessionId)}
                    onMoveToBottom={() => moveToBottom(entry.sessionId)}
                  />
                ) : null;
              } : undefined}
            />
          ) : (
            <div className="space-y-4">
              {listView.filteredBooks.map((book) => {
                const entry = sessionLookup.get(book.id);
                return (
                  <BookListItem
                    key={book.id}
                    book={book}
                    isSelectMode={listView.isSelectMode}
                    isSelected={listView.selectedBookIds.has(book.id)}
                    onToggleSelection={() => listView.toggleBookSelection(book.id)}
                    actions={
                      !listView.isSelectMode && entry ? (
                        <BookActionsDropdown
                          bookId={book.id}
                          bookTitle={book.title}
                          isAtTop={entry.index === 0}
                          isAtBottom={entry.index === sessions.length - 1}
                          onRemove={() => setRemovingBook({ id: book.id, title: book.title })}
                          onMoveToTop={() => moveToTop(entry.sessionId)}
                          onMoveToBottom={() => moveToBottom(entry.sessionId)}
                        />
                      ) : undefined
                    }
                  />
                );
              })}
            </div>
          )
        ) : (
          // Desktop: Always use draggable table (disable dragging when filtering or selecting)
          !listView.filterText ? (
            <DraggableBookTable
              books={booksWithOrder}
              isDragEnabled={!listView.isSelectMode}
              isSelectMode={listView.isSelectMode}
              selectedBookIds={listView.selectedBookIds}
              onToggleSelection={listView.toggleBookSelection}
              onToggleSelectAll={listView.toggleSelectAll}
              onReorder={handleReorder}
              renderActions={(book, index) => {
                const entry = sessionLookup.get(book.id);
                return entry && !listView.isSelectMode ? (
                  <BookActionsDropdown
                    bookId={book.id}
                    bookTitle={book.title}
                    isAtTop={index === 0}
                    isAtBottom={index === booksWithOrder.length - 1}
                    onRemove={() => setRemovingBook({ id: book.id, title: book.title })}
                    onMoveToTop={() => moveToTop(entry.sessionId)}
                    onMoveToBottom={() => moveToBottom(entry.sessionId)}
                  />
                ) : null;
              }}
            />
          ) : (
            <BookTable
              books={listView.filteredBooks}
              isSelectMode={listView.isSelectMode}
              selectedBookIds={listView.selectedBookIds}
              onToggleSelection={listView.toggleBookSelection}
              onToggleSelectAll={listView.toggleSelectAll}
              renderActions={(book, index) => {
                const entry = sessionLookup.get(book.id);
                return entry && !listView.isSelectMode ? (
                  <BookActionsDropdown
                    bookId={book.id}
                    bookTitle={book.title}
                    isAtTop={entry.index === 0}
                    isAtBottom={entry.index === sessions.length - 1}
                    onRemove={() => setRemovingBook({ id: book.id, title: book.title })}
                    onMoveToTop={() => moveToTop(entry.sessionId)}
                    onMoveToBottom={() => moveToBottom(entry.sessionId)}
                  />
                ) : null;
              }}
            />
          )
        )}

        {/* Bulk Action Bar */}
        {listView.isSelectMode && listView.selectedBookIds.size > 0 && (
          <BulkActionBar
            selectedCount={listView.selectedBookIds.size}
            onCancel={() => {
              listView.exitSelectMode();
            }}
            onDelete={bulkRemove.trigger}
          />
        )}

        {/* Individual Remove Confirmation Modal */}
        <BaseModal
          isOpen={!!removingBook}
          onClose={() => !removeLoading && setRemovingBook(null)}
          title="Remove from Read Next"
          size="md"
          loading={removeLoading}
          actions={
            <>
              <Button
                onClick={() => setRemovingBook(null)}
                disabled={removeLoading}
                variant="ghost"
                size="sm"
              >
                Cancel
              </Button>
              <Button
                onClick={handleRemoveBook}
                disabled={removeLoading}
                variant="danger"
                size="sm"
              >
                {removeLoading ? "Removing..." : "Remove"}
              </Button>
            </>
          }
        >
          <div className="space-y-4">
            <p className="text-[var(--foreground)]">
              Are you sure you want to remove <strong>{removingBook?.title}</strong> from your read-next queue?
            </p>
            <p className="text-sm text-[var(--subheading-text)]">
              This book will be moved back to your "Want To Read" list.
            </p>
          </div>
        </BaseModal>

        {/* Bulk Remove Confirmation Modal */}
        <BaseModal
          isOpen={bulkRemove.showModal}
          onClose={bulkRemove.cancel}
          title="Remove from Read Next"
          actions={
            <>
              <Button
                onClick={bulkRemove.cancel}
                disabled={bulkRemove.loading}
                variant="ghost"
                size="sm"
              >
                Cancel
              </Button>
              <Button
                onClick={() => bulkRemove.execute(Array.from(listView.selectedBookIds))}
                disabled={bulkRemove.loading}
                variant="danger"
                size="sm"
              >
                {bulkRemove.loading ? "Removing..." : "Remove"}
              </Button>
            </>
          }
        >
          <div className="space-y-4">
            <p className="text-[var(--foreground)]">
              Are you sure you want to remove {listView.selectedBookIds.size}{" "}
              {listView.selectedBookIds.size === 1 ? "book" : "books"} from your read-next queue?
            </p>
            <p className="text-sm text-[var(--subheading-text)]">
              {listView.selectedBookIds.size === 1 ? "This book" : "These books"} will be moved back to your "Want To Read" list.
            </p>
          </div>
        </BaseModal>
      </div>
    </div>
  );
}
