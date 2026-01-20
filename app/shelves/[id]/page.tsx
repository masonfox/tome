"use client";

/**
 * Shelf Detail Page
 * 
 * Displays and manages a shelf with its books.
 * Uses shared abstractions: useBookListView, useBulkOperation, BookListControls
 */

import { useState } from "react";
import { useParams } from "next/navigation";
import { FolderOpen, Trash2, ArrowUp, ArrowDown, Plus } from "lucide-react";
import Link from "next/link";
import { useShelfBooks } from "@/hooks/useShelfBooks";
import { useBookListView } from "@/hooks/useBookListView";
import { useBulkOperation } from "@/hooks/useBulkOperation";
import { BookListControls } from "@/components/Books/BookListControls";
import { BookTable } from "@/components/Books/BookTable";
import { BookListItem } from "@/components/Books/BookListItem";
import { BookListItemSkeleton } from "@/components/Books/BookListItemSkeleton";
import { DraggableBookList } from "@/components/Books/DraggableBookList";
import { DraggableBookTable } from "@/components/Books/DraggableBookTable";
import { BulkActionBar } from "@/components/ShelfManagement/BulkActionBar";
import { ShelfSelectionModal } from "@/components/ShelfManagement/ShelfSelectionModal";
import { BookActionsDropdown } from "@/components/Books/BookActionsDropdown";
import BaseModal from "@/components/Modals/BaseModal";
import { AddBooksToShelfModal } from "@/components/ShelfManagement/AddBooksToShelfModal";
import { AddBooksToShelfFAB } from "@/components/ShelfManagement/AddBooksToShelfFAB";
import { getShelfIcon } from "@/components/ShelfManagement/ShelfIconPicker";
import { PageHeader } from "@/components/Layout/PageHeader";
import { cn } from "@/utils/cn";
import { ShelfAvatar } from "@/components/ShelfManagement/ShelfAvatar";
import type { ShelfOrderBy, ShelfSortDirection } from "@/lib/repositories/shelf.repository";

type SortOption = ShelfOrderBy;
type SortDirection = ShelfSortDirection;

export default function ShelfDetailPage() {
  const params = useParams();
  const shelfId = params?.id ? parseInt(params.id as string) : null;

  const [sortBy, setSortBy] = useState<SortOption>("sortOrder");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");

  const {
    shelf,
    books,
    loading,
    hasInitialized,
    addBooksToShelf,
    removeBookFromShelf,
    removeBooksFromShelf,
    reorderBooks,
    moveBooks,
    copyBooks,
    moveToTop,
  } = useShelfBooks(shelfId, sortBy, sortDirection);

  // Use shared book list view hook for filtering and selection
  const listView = useBookListView({ books });

  // Single book removal state
  const [removingBook, setRemovingBook] = useState<{ id: number; title: string } | null>(null);
  const [removeLoading, setRemoveLoading] = useState(false);
  const [showAddBooksModal, setShowAddBooksModal] = useState(false);

  // Bulk delete operation
  const bulkDelete = useBulkOperation({
    onExecute: async (bookIds: number[]) => {
      await removeBooksFromShelf(bookIds);
    },
    onSuccess: () => {
      listView.clearSelection();
      listView.exitSelectMode();
    },
  });

  // Move/Copy operations - modals controlled separately
  const [showMoveModal, setShowMoveModal] = useState(false);
  const [showCopyModal, setShowCopyModal] = useState(false);
  const [moveLoading, setMoveLoading] = useState(false);
  const [copyLoading, setCopyLoading] = useState(false);

  // Handle sort change from dropdown (mobile only)
  const handleSortChange = (newSort: SortOption) => {
    setSortBy(newSort);
    setSortDirection("asc");
  };

  // Handle table column sort (desktop only)
  const handleTableSort = (column: string, direction: SortDirection) => {
    setSortBy(column as SortOption);
    setSortDirection(direction);
  };

  // Handle single book removal
  const handleRemoveBook = async (bookId?: number) => {
    const targetBookId = bookId || removingBook?.id;
    if (!targetBookId) return;

    setRemoveLoading(true);
    try {
      await removeBookFromShelf(targetBookId);
      setRemovingBook(null);
    } catch (error) {
      // Error handled by hook
    } finally {
      setRemoveLoading(false);
    }
  };

  // Handle move books to another shelf
  const handleMoveSubmit = async (targetShelfId: number, keepSelected: boolean) => {
    if (listView.selectedBookIds.size === 0 || !shelf) return;

    setMoveLoading(true);
    try {
      // Fetch target shelf name for toast message
      const shelvesResponse = await fetch("/api/shelves?withCounts=true");
      const shelvesData = await shelvesResponse.json();
      const targetShelf = shelvesData.data.find((s: { id: number }) => s.id === targetShelfId);

      await moveBooks(targetShelfId, Array.from(listView.selectedBookIds), targetShelf?.name);
      setShowMoveModal(false);

      if (!keepSelected) {
        listView.exitSelectMode();
      }
    } catch (error) {
      // Error handled by hook
    } finally {
      setMoveLoading(false);
    }
  };

  // Handle copy books to another shelf
  const handleCopySubmit = async (targetShelfId: number, keepSelected: boolean) => {
    if (listView.selectedBookIds.size === 0 || !shelf) return;

    setCopyLoading(true);
    try {
      // Fetch target shelf name for toast message
      const shelvesResponse = await fetch("/api/shelves?withCounts=true");
      const shelvesData = await shelvesResponse.json();
      const targetShelf = shelvesData.data.find((s: { id: number }) => s.id === targetShelfId);

      await copyBooks(targetShelfId, Array.from(listView.selectedBookIds), targetShelf?.name);
      setShowCopyModal(false);

      if (!keepSelected) {
        listView.exitSelectMode();
      }
    } catch (error) {
      // Error handled by hook
    } finally {
      setCopyLoading(false);
    }
  };

  if (!hasInitialized || (loading && !shelf)) {
    return (
      <div className="space-y-10">
        {/* Header Skeleton */}
        <div className="border-b border-[var(--border-color)] pb-6 animate-pulse">
          <div className="h-6 bg-[var(--card-bg)] rounded w-36 mb-5"></div>
          <div className="flex items-center gap-3 sm:gap-4 mb-2">
            <div className="w-8 h-8 bg-[var(--card-bg)] rounded-full flex-shrink-0"></div>
            <div className="h-10 bg-[var(--card-bg)] rounded w-56"></div>
          </div>
          <div className="h-6 bg-[var(--card-bg)] rounded w-44 mt-2"></div>
        </div>

        {/* Content Skeleton */}
        <div>
          <div className="mb-6 animate-pulse">
            <div className="h-[42px] bg-[var(--card-bg)] rounded-lg mb-3"></div>
            <div className="flex gap-2 mt-2 lg:hidden">
              <div className="flex-1 h-[42px] bg-[var(--card-bg)] rounded-lg"></div>
              <div className="h-[42px] w-[42px] bg-[var(--card-bg)] rounded-lg"></div>
            </div>
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

  if (!shelf) {
    return (
      <div className="space-y-10">
        <PageHeader
          title="Shelf not found"
          subtitle="This shelf doesn't exist or has been deleted."
          icon={FolderOpen}
          backLink={{
            href: "/shelves",
            label: "Back to Shelves"
          }}
        />
      </div>
    );
  }

  // Build title with book count
  const titleWithCount = (
    <>
      {shelf.name}{' '}
      <span className="text-2xl text-[var(--accent)] whitespace-nowrap">({books.length})</span>
    </>
  );

  const subtitle = shelf.description || "";

  // Build custom icon with shelf color
  const customIcon = (
    <ShelfAvatar
      color={shelf.color}
      icon={shelf.icon}
      size="sm"
    />
  );

  return (
    <div className="space-y-10">
      {/* Header */}
      <PageHeader
        title={titleWithCount}
        subtitle={subtitle}
        customIcon={customIcon}
        backLink={{
          href: "/shelves",
          label: "Back to Shelves"
        }}
        actions={
          <button
            onClick={() => setShowAddBooksModal(true)}
            className="hidden lg:flex items-center gap-2 px-4 py-2 bg-[var(--accent)] text-white rounded-md hover:bg-[var(--light-accent)] transition-colors font-medium"
          >
            <Plus className="w-5 h-5" />
            Add Books
          </button>
        }
      />

      {/* Content */}
      <div>
        {/* Filter and Sort Controls */}
        {books.length > 0 && (
          <>
            <BookListControls
              filterText={listView.filterText}
              onFilterChange={listView.setFilterText}
              onClearFilter={() => listView.setFilterText("")}
              isSelectMode={listView.isSelectMode}
              onToggleSelectMode={listView.toggleSelectMode}
              totalCount={books.length}
              filteredCount={listView.filteredBooks.length}
              showSortControls={listView.isMobile && !listView.isSelectMode}
              sortBy={sortBy as string}
              sortDirection={sortDirection}
              onSortChange={(s) => handleSortChange(s as SortOption)}
              onDirectionToggle={() => setSortDirection(sortDirection === "asc" ? "desc" : "asc")}
            />
          </>
        )}

        {/* Books Display - Table for Desktop, List for Mobile/Tablet */}
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
        ) : books.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-[var(--foreground)]/40 mb-4">
              <svg
                className="w-24 h-24 mx-auto"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
                />
              </svg>
            </div>
            <h3 className="text-xl font-serif font-semibold text-[var(--heading-text)] mb-2">
              No books on this shelf
            </h3>
            <p className="text-[var(--foreground)]/60 mb-6">
              Add books to this shelf from your library
            </p>
            <Link
              href="/library"
              className="inline-flex items-center gap-2 px-6 py-3 bg-[var(--accent)] text-white rounded-md hover:bg-[var(--light-accent)] transition-colors font-medium"
            >
              Go to Library
            </Link>
          </div>
        ) : listView.filteredBooks.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-[var(--foreground)]/40 mb-4">
              <svg className="w-24 h-24 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <circle cx="11" cy="11" r="8" strokeWidth="2" />
                <path d="M21 21l-4.35-4.35" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </div>
            <h3 className="text-xl font-serif font-semibold text-[var(--heading-text)] mb-2">
              No matching books
            </h3>
            <p className="text-[var(--foreground)]/60 mb-6">
              No books match your filter. Try a different search term.
            </p>
            <button
              onClick={() => listView.setFilterText("")}
              className="inline-flex items-center gap-2 px-6 py-3 bg-[var(--accent)] text-white rounded-md hover:bg-[var(--light-accent)] transition-colors font-medium"
            >
              Clear Filter
            </button>
          </div>
        ) : listView.isMobile ? (
          // Mobile/Tablet: List View
          sortBy === "sortOrder" && sortDirection === "asc" && !listView.filterText ? (
            <DraggableBookList
              books={listView.filteredBooks}
              onReorder={reorderBooks}
              isDragEnabled={!listView.isSelectMode}
              isSelectMode={listView.isSelectMode}
              selectedBookIds={listView.selectedBookIds}
              onToggleSelection={listView.toggleBookSelection}
              renderActions={!listView.isSelectMode ? (book, index) => (
                <BookActionsDropdown
                  bookId={book.id}
                  bookTitle={book.title}
                  isAtTop={index === 0}
                  onRemove={() => setRemovingBook({ id: book.id, title: book.title })}
                  onMoveToTop={() => moveToTop(book.id)}
                />
              ) : undefined}
            />
          ) : (
            <div className="space-y-4">
              {listView.filteredBooks.map((book, index) => (
                <BookListItem
                  key={book.id}
                  book={book}
                  isSelectMode={listView.isSelectMode}
                  isSelected={listView.selectedBookIds.has(book.id)}
                  onToggleSelection={() => listView.toggleBookSelection(book.id)}
                  actions={
                    !listView.isSelectMode ? (
                      <BookActionsDropdown
                        bookId={book.id}
                        bookTitle={book.title}
                        isAtTop={index === 0}
                        onRemove={() => setRemovingBook({ id: book.id, title: book.title })}
                        onMoveToTop={() => moveToTop(book.id)}
                      />
                    ) : undefined
                  }
                />
              ))}
            </div>
          )
        ) : (
          // Desktop: Table View
          sortBy === "sortOrder" && sortDirection === "asc" && !listView.filterText ? (
            <DraggableBookTable
              books={listView.filteredBooks}
              sortBy={sortBy}
              sortDirection={sortDirection}
              onSortChange={handleTableSort}
              onReorder={reorderBooks}
              isDragEnabled={!listView.isSelectMode}
              isSelectMode={listView.isSelectMode}
              selectedBookIds={listView.selectedBookIds}
              onToggleSelection={listView.toggleBookSelection}
              onToggleSelectAll={listView.toggleSelectAll}
              renderActions={!listView.isSelectMode ? (book, index) => (
                <BookActionsDropdown
                  bookId={book.id}
                  bookTitle={book.title}
                  isAtTop={book.sortOrder === 0}
                  onRemove={() => setRemovingBook({ id: book.id, title: book.title })}
                  onMoveToTop={() => moveToTop(book.id)}
                />
              ) : undefined}
            />
          ) : (
            <BookTable
              books={listView.filteredBooks}
              sortBy={sortBy}
              sortDirection={sortDirection}
              onSortChange={handleTableSort}
              showOrderColumn={true}
              isSelectMode={listView.isSelectMode}
              selectedBookIds={listView.selectedBookIds}
              onToggleSelection={listView.toggleBookSelection}
              onToggleSelectAll={listView.toggleSelectAll}
              renderActions={!listView.isSelectMode ? (book, index) => (
                <BookActionsDropdown
                  bookId={book.id}
                  bookTitle={book.title}
                  isAtTop={book.sortOrder === 0}
                  onRemove={() => setRemovingBook({ id: book.id, title: book.title })}
                  onMoveToTop={() => moveToTop(book.id)}
                />
              ) : undefined}
            />
          )
        )}
      </div>

      {/* Remove Book Confirmation Modal */}
      <BaseModal
        isOpen={!!removingBook}
        onClose={() => !removeLoading && setRemovingBook(null)}
        title="Remove from Shelf"
        subtitle={removingBook ? `Remove "${removingBook.title}" from this shelf?` : ""}
        size="md"
        loading={removeLoading}
        actions={
          <div className="flex gap-3 justify-end">
            <button
              onClick={() => setRemovingBook(null)}
              disabled={removeLoading}
              className="px-4 py-2 text-sm font-medium text-[var(--foreground)] hover:bg-[var(--hover-bg)] rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <button
              onClick={() => handleRemoveBook()}
              disabled={removeLoading}
              className="px-4 py-2 text-sm font-medium bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {removeLoading ? "Removing..." : "Remove"}
            </button>
          </div>
        }
      >
        <p className="text-[var(--foreground)]">
          The book will be removed from this shelf but will remain in your library.
        </p>
      </BaseModal>

      {/* Mobile FAB for Add Books */}
      <AddBooksToShelfFAB onClick={() => setShowAddBooksModal(true)} isHidden={showAddBooksModal || listView.isSelectMode} />

      {/* Add Books to Shelf Modal */}
      {shelf && shelfId && (
        <AddBooksToShelfModal
          isOpen={showAddBooksModal}
          onClose={() => setShowAddBooksModal(false)}
          onAddBooks={async (bookIds) => {
            const result = await addBooksToShelf(bookIds);
            return result || { count: 0 };
          }}
          shelfId={shelfId}
          shelfName={shelf.name}
        />
      )}

      {/* Bulk Action Bar */}
      {listView.isSelectMode && (
        <BulkActionBar
          selectedCount={listView.selectedBookIds.size}
          onMove={() => setShowMoveModal(true)}
          onCopy={() => setShowCopyModal(true)}
          onCancel={listView.toggleSelectMode}
          onDelete={bulkDelete.trigger}
          loading={bulkDelete.loading || moveLoading || copyLoading}
        />
      )}

      {/* Bulk Delete Confirmation Modal */}
      <BaseModal
        isOpen={bulkDelete.showModal}
        onClose={bulkDelete.cancel}
        title="Remove Books from Shelf"
        subtitle={`Remove ${listView.selectedBookIds.size} ${listView.selectedBookIds.size === 1 ? "book" : "books"} from this shelf?`}
        size="md"
        loading={bulkDelete.loading}
        actions={
          <div className="flex gap-3 justify-end">
            <button
              onClick={bulkDelete.cancel}
              disabled={bulkDelete.loading}
              className="px-4 py-2 text-sm font-medium text-[var(--foreground)] hover:bg-[var(--hover-bg)] rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <button
              onClick={() => bulkDelete.execute(Array.from(listView.selectedBookIds))}
              disabled={bulkDelete.loading}
              className="px-4 py-2 text-sm font-medium bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {bulkDelete.loading ? "Removing..." : "Remove"}
            </button>
          </div>
        }
      >
        <p className="text-[var(--foreground)]">
          The selected books will be removed from this shelf but will remain in your library.
        </p>
      </BaseModal>

      {/* Move Books Modal */}
      {shelf && shelfId && (
        <ShelfSelectionModal
          isOpen={showMoveModal}
          onClose={() => !moveLoading && setShowMoveModal(false)}
          onSelectShelf={handleMoveSubmit}
          currentShelfId={shelfId}
          title="Move Books to Shelf"
          confirmButtonText="Move"
          allowKeepSelected={true}
        />
      )}

      {/* Copy Books Modal */}
      {shelf && shelfId && (
        <ShelfSelectionModal
          isOpen={showCopyModal}
          onClose={() => !copyLoading && setShowCopyModal(false)}
          onSelectShelf={handleCopySubmit}
          currentShelfId={shelfId}
          title="Copy Books to Shelf"
          confirmButtonText="Copy"
          allowKeepSelected={true}
        />
      )}
    </div>
  );
}
