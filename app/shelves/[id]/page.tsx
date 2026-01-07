"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { FolderOpen, Trash2, Search, X, ArrowUp, ArrowDown } from "lucide-react";
import Link from "next/link";
import { useShelfBooks } from "@/hooks/useShelfBooks";
import { BookTable } from "@/components/BookTable";
import { BookListItem } from "@/components/BookListItem";
import { BookListItemSkeleton } from "@/components/BookListItemSkeleton";
import { DraggableBookList } from "@/components/Books/DraggableBookList";
import { DraggableBookTable } from "@/components/Books/DraggableBookTable";
import BaseModal from "@/components/Modals/BaseModal";
import { getShelfIcon } from "@/components/ShelfIconPicker";
import { PageHeader } from "@/components/Layout/PageHeader";
import type { ShelfOrderBy, ShelfSortDirection } from "@/lib/repositories/shelf.repository";

type SortOption = ShelfOrderBy;
type SortDirection = ShelfSortDirection;

export default function ShelfDetailPage() {
  const params = useParams();
  const shelfId = params?.id ? parseInt(params.id as string) : null;

  const {
    shelf,
    books,
    loading,
    hasInitialized,
    fetchShelfBooks,
    removeBookFromShelf,
    reorderBooks,
  } = useShelfBooks(shelfId);

  const [sortBy, setSortBy] = useState<SortOption>("sortOrder");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [removingBook, setRemovingBook] = useState<{ id: number; title: string } | null>(null);
  const [removeLoading, setRemoveLoading] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [filterText, setFilterText] = useState("");

  // Detect mobile/tablet vs desktop
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 1024); // < lg breakpoint
    };

    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // Fetch shelf and books on mount
  useEffect(() => {
    if (shelfId) {
      fetchShelfBooks(sortBy, sortDirection);
    }
  }, [shelfId, sortBy, sortDirection, fetchShelfBooks]);

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

  // Handle remove book
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

  if (!hasInitialized || (loading && !shelf)) {
    return (
      <div className="space-y-10">
        {/* Header Skeleton - Match PageHeader structure */}
        <div className="border-b border-[var(--border-color)] pb-6 animate-pulse">
          {/* Back Link Skeleton */}
          <div className="h-6 bg-[var(--card-bg)] rounded w-36 mb-5"></div>
          {/* Title with Icon Skeleton */}
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 bg-[var(--card-bg)] rounded-full"></div>
            <div className="h-12 bg-[var(--card-bg)] rounded w-64"></div>
          </div>
          {/* Subtitle Skeleton */}
          <div className="h-6 bg-[var(--card-bg)] rounded w-48 mt-2"></div>
        </div>

        {/* Content Skeleton */}
        <div>
          {/* Filter Controls Skeleton */}
          <div className="mb-6 animate-pulse">
            {/* Filter Input Skeleton */}
            <div className="h-[42px] bg-[var(--card-bg)] rounded-lg mb-3"></div>
            
            {/* Sort Controls Skeleton - Only on mobile (using responsive classes) */}
            <div className="flex gap-2 mt-2 lg:hidden">
              <div className="flex-1 h-[42px] bg-[var(--card-bg)] rounded-lg"></div>
              <div className="h-[42px] w-[42px] bg-[var(--card-bg)] rounded-lg"></div>
            </div>
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

  // Build subtitle with description and book count
  const subtitle = shelf.description 
    ? `${shelf.description} • ${books.length} ${books.length === 1 ? "book" : "books"}`
    : `${books.length} ${books.length === 1 ? "book" : "books"}`;

  // Build custom icon with shelf color
  const ShelfIcon = (shelf.icon ? getShelfIcon(shelf.icon) : null) || FolderOpen;
  const customIcon = (
    <div
      className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
      style={{ backgroundColor: shelf.color || "#3b82f6" }}
    >
      <ShelfIcon className="w-5 h-5 text-white" />
    </div>
  );

  return (
    <div className="space-y-10">
      {/* Header */}
      <PageHeader
        title={shelf.name}
        subtitle={subtitle}
        customIcon={customIcon}
        backLink={{
          href: "/shelves",
          label: "Back to Shelves"
        }}
      />

      {/* Content */}
      <div>
        {/* Filter and Sort Controls */}
        {books.length > 0 && (
          <div className="mb-6">
            {/* Filter Input */}
            <div className="relative mb-3">
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

            {/* Sort Controls - Only show on mobile for list view */}
            {isMobile && (
              <div className="flex gap-2 mt-2">
                {/* Sort By Dropdown */}
                <div className="flex-1">
                  <select
                    value={sortBy}
                    onChange={(e) => handleSortChange(e.target.value as SortOption)}
                    className="w-full h-[42px] px-3 py-2 bg-[var(--card-bg)] border border-[var(--border-color)] rounded-lg text-[var(--foreground)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                  >
                    <option value="sortOrder">Custom Order</option>
                    <option value="title">Title</option>
                    <option value="author">Author</option>
                    <option value="series">Series</option>
                    <option value="rating">Rating</option>
                    <option value="pages">Pages</option>
                    <option value="dateAdded">Date Added</option>
                  </select>
                </div>
                
                {/* Direction Toggle Button */}
                <button
                  onClick={() => setSortDirection(sortDirection === "asc" ? "desc" : "asc")}
                  className="h-[42px] px-3 bg-[var(--card-bg)] border border-[var(--border-color)] rounded-lg text-[var(--foreground)] transition-colors flex items-center justify-center"
                  aria-label={sortDirection === "asc" ? "Sort ascending" : "Sort descending"}
                >
                  {sortDirection === "asc" ? (
                    <ArrowUp className="w-5 h-5" />
                  ) : (
                    <ArrowDown className="w-5 h-5" />
                  )}
                </button>
              </div>
            )}
            
            {/* Filter Results Count */}
            {filterText && (
              <p className="text-sm text-[var(--foreground)]/60 mt-2">
                Showing {filteredBooks.length} of {books.length} {books.length === 1 ? "book" : "books"}
              </p>
            )}
          </div>
        )}

        {/* Books Display - Table for Desktop, List for Mobile/Tablet */}
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
        ) : filteredBooks.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-[var(--foreground)]/40 mb-4">
              <Search className="w-24 h-24 mx-auto" />
            </div>
            <h3 className="text-xl font-serif font-semibold text-[var(--heading-text)] mb-2">
              No matching books
            </h3>
            <p className="text-[var(--foreground)]/60 mb-6">
              No books match your filter. Try a different search term.
            </p>
            <button
              onClick={() => setFilterText("")}
              className="inline-flex items-center gap-2 px-6 py-3 bg-[var(--accent)] text-white rounded-md hover:bg-[var(--light-accent)] transition-colors font-medium"
            >
              Clear Filter
            </button>
          </div>
        ) : isMobile ? (
          // Mobile/Tablet: List View
          sortBy === "sortOrder" && sortDirection === "asc" && !filterText ? (
            <DraggableBookList
              books={filteredBooks}
              onReorder={reorderBooks}
              isDragEnabled={true}
              renderActions={(book) => (
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setRemovingBook({ id: book.id, title: book.title });
                  }}
                  className="p-2 text-red-500 hover:bg-red-500/10 rounded transition-colors"
                  title="Remove from shelf"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            />
          ) : (
            <div className="space-y-4">
              {filteredBooks.map((book) => (
                <BookListItem
                  key={book.id}
                  book={book}
                  actions={
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setRemovingBook({ id: book.id, title: book.title });
                      }}
                      className="p-2 text-red-500 hover:bg-red-500/10 rounded transition-colors"
                      title="Remove from shelf"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  }
                />
              ))}
            </div>
          )
        ) : (
          // Desktop: Table View
          sortBy === "sortOrder" && sortDirection === "asc" && !filterText ? (
            <DraggableBookTable
              books={filteredBooks.map((book) => ({
                ...book,
                dateAddedToShelf: book.addedAt,
              }))}
              sortBy={sortBy}
              sortDirection={sortDirection}
              onSortChange={handleTableSort}
              onRemoveBook={(bookId) => {
                const book = filteredBooks.find((b) => b.id === bookId);
                if (book) {
                  setRemovingBook({ id: book.id, title: book.title });
                }
              }}
              onReorder={reorderBooks}
              isDragEnabled={true}
            />
          ) : (
            <BookTable
              books={filteredBooks.map((book) => ({
                ...book,
                dateAddedToShelf: book.addedAt,
              }))}
              sortBy={sortBy}
              sortDirection={sortDirection}
              onSortChange={handleTableSort}
              onRemoveBook={(bookId) => {
                const book = filteredBooks.find((b) => b.id === bookId);
                if (book) {
                  setRemovingBook({ id: book.id, title: book.title });
                }
              }}
              showOrderColumn={true}
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
    </div>
  );
}
