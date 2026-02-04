"use client";

import { BookCard } from "@/components/Books/BookCard";
import { BookCardSkeleton } from "@/components/Books/BookCardSkeleton";

interface BookGridProps {
  books: Array<{
    id: number;
    calibreId: number;
    title: string;
    authors: string[];
    coverPath?: string;
    status?: string | null;
    tags?: string[];
    totalPages?: number;
    lastSynced?: Date | string | null;
  }>;
  loading?: boolean;
  loadingMore?: boolean;
  skeletonCount?: number; // Number of skeleton cards to show when loading
}

export function BookGrid({ books, loading = false, loadingMore = false, skeletonCount = 18 }: BookGridProps) {
  return (
    <>
      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {Array.from({ length: skeletonCount }).map((_, index) => (
            <BookCardSkeleton key={index} variant="with-status" />
          ))}
        </div>
      ) : books.length > 0 ? (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {books.map((book) => (
              <BookCard
                key={book.id}
                id={book.id.toString()}
                title={book.title}
                authors={book.authors}
                calibreId={book.calibreId}
                status={book.status}
                lastSynced={book.lastSynced}
              />
            ))}
          </div>

          {/* Loading indicator for next page */}
          {loadingMore && (
            <div className="text-center py-8">
              <div className="inline-block w-6 h-6 border-4 border-[var(--accent)] border-t-transparent rounded-full animate-spin"></div>
              <p className="text-[var(--foreground)]/70 mt-2 font-medium">
                Loading more books...
              </p>
            </div>
          )}
        </>
      ) : (
        <div className="bg-[var(--card-bg)] border border-[var(--border-color)] p-12 text-center">
          <p className="text-[var(--foreground)]/70 font-medium">
            No books found. Try syncing with Calibre or adjusting your filters.
          </p>
        </div>
      )}
    </>
  );
}