"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { ArrowLeft, FolderOpen, Trash2 } from "lucide-react";
import Link from "next/link";
import { useShelfBooks } from "@/hooks/useShelfBooks";
import { BookTable } from "@/components/BookTable";
import { BookListItem } from "@/components/BookListItem";
import { BookListItemSkeleton } from "@/components/BookListItemSkeleton";
import BaseModal from "@/components/Modals/BaseModal";
import { getShelfIcon } from "@/components/ShelfIconPicker";
import { PageHeader } from "@/components/Layout/PageHeader";

type SortOption = "sortOrder" | "title" | "dateAdded" | "recentlyAdded";

export default function ShelfDetailPage() {
  const params = useParams();
  const shelfId = params?.id ? parseInt(params.id as string) : null;

  const {
    shelf,
    books,
    loading,
    fetchShelfBooks,
    removeBookFromShelf,
  } = useShelfBooks(shelfId);

  const [sortBy, setSortBy] = useState<SortOption>("sortOrder");
  const [removingBook, setRemovingBook] = useState<{ id: number; title: string } | null>(null);
  const [removeLoading, setRemoveLoading] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

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
      fetchShelfBooks(sortBy);
    }
  }, [shelfId, sortBy, fetchShelfBooks]);

  // Handle sort change
  const handleSortChange = (newSort: SortOption) => {
    setSortBy(newSort);
  };

  // Handle table column sort
  const handleTableSort = (column: string) => {
    // Map table columns to our sort options
    const columnToSort: Record<string, SortOption> = {
      title: "title",
      dateAdded: "dateAdded",
    };

    const newSort = columnToSort[column];
    if (newSort) {
      setSortBy(newSort);
    }
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

  if (loading && !shelf) {
    return (
      <div className="space-y-10">
        <div className="animate-pulse">
          <div className="h-8 bg-[var(--card-bg)] rounded w-48 mb-4"></div>
          <div className="h-12 bg-[var(--card-bg)] rounded w-96 mb-2"></div>
          <div className="h-6 bg-[var(--card-bg)] rounded w-64 mb-8"></div>
        </div>
        {isMobile ? (
          <div className="space-y-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <BookListItemSkeleton key={i} />
            ))}
          </div>
        ) : (
          <BookTable books={[]} loading={true} />
        )}
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
            href: "/library/shelves",
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
          href: "/library/shelves",
          label: "Back to Shelves"
        }}
      />

      {/* Content */}
      <div>
        {/* Sort Controls - Only show on desktop for table view */}
        {books.length > 0 && !isMobile && (
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-[var(--foreground)]">
                Sort by:
              </label>
              <select
                value={sortBy}
                onChange={(e) => handleSortChange(e.target.value as SortOption)}
                className="px-3 py-2 bg-[var(--input-bg)] border border-[var(--border-color)] rounded-lg text-[var(--foreground)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
              >
                <option value="sortOrder">Custom Order</option>
                <option value="title">Title (A-Z)</option>
                <option value="dateAdded">Date Added (Oldest)</option>
                <option value="recentlyAdded">Date Added (Newest)</option>
              </select>
            </div>
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
        ) : books.length > 0 ? (
          isMobile ? (
            // Mobile/Tablet: List View
            <div className="space-y-4">
              {books.map((book) => (
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
          ) : (
            // Desktop: Table View
            <BookTable
              books={books.map((book) => ({
                ...book,
                dateAddedToShelf: book.addedToLibrary,
              }))}
              sortBy={sortBy}
              sortDirection="asc"
              onSortChange={handleTableSort}
              onRemoveBook={(bookId) => {
                const book = books.find((b) => b.id === bookId);
                if (book) {
                  setRemovingBook({ id: book.id, title: book.title });
                }
              }}
            />
          )
        ) : (
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
