"use client";

import Link from "next/link";
import Image from "next/image";
import { BookOpen, ArrowUpDown, ArrowUp, ArrowDown, Trash2, ExternalLink } from "lucide-react";
import { cn } from "@/utils/cn";
import { useState, ReactNode } from "react";
import { format } from "date-fns";
import { StatusBadge } from "@/components/Utilities/StatusBadge";
import { StarRating } from "@/components/Utilities/StarRating";
import { type BookStatus } from "@/utils/statusConfig";
import { getCoverUrl } from "@/lib/utils/cover-url";

type SortDirection = "asc" | "desc";

interface BookTableBook {
  id: number;
  calibreId: number;
  title: string;
  authors: string[];
  series?: string | null;
  seriesIndex?: number | null;
  rating?: number | null;
  totalPages?: number | null;
  addedToLibrary?: Date | null;
  addedAt?: Date | null;
  status?: string | null;
  sortOrder?: number;
  lastSynced?: Date | string | null;
}

interface BookTableProps {
  books: BookTableBook[];
  sortBy?: string;
  sortDirection?: SortDirection;
  onSortChange?: (column: string, direction: SortDirection) => void;
  onRemoveBook?: (bookId: number) => void;
  loading?: boolean;
  className?: string;
  showOrderColumn?: boolean;
  isSelectMode?: boolean;
  selectedBookIds?: Set<number>;
  onToggleSelection?: (bookId: number) => void;
  onToggleSelectAll?: () => void;
  renderActions?: (book: BookTableBook, index: number) => React.ReactNode;
}

export function BookTable({
  books,
  sortBy,
  sortDirection,
  onSortChange,
  onRemoveBook,
  loading = false,
  className,
  showOrderColumn = false,
  isSelectMode = false,
  selectedBookIds = new Set(),
  onToggleSelection,
  onToggleSelectAll,
  renderActions,
}: BookTableProps) {
  const [imageErrors, setImageErrors] = useState<Set<number>>(new Set());

  const handleImageError = (calibreId: number) => {
    setImageErrors((prev) => new Set(prev).add(calibreId));
  };

  const handleColumnClick = (column: string) => {
    if (!onSortChange) return;
    
    // If clicking the same column, toggle direction
    if (sortBy === column) {
      const newDirection = sortDirection === "asc" ? "desc" : "asc";
      onSortChange(column, newDirection);
    } else {
      // New column, default to ascending
      onSortChange(column, "asc");
    }
  };

  const renderSortIcon = (column: string) => {
    if (sortBy !== column) {
      return <ArrowUpDown className="w-4 h-4 opacity-40" />;
    }
    return sortDirection === "asc" ? (
      <ArrowUp className="w-4 h-4" />
    ) : (
      <ArrowDown className="w-4 h-4" />
    );
  };

  const SortableHeader = ({
    column,
    children,
    className: headerClassName,
  }: {
    column: string;
    children: ReactNode;
    className?: string;
  }) => (
    <th
      className={cn(
        "px-4 py-3 text-left text-sm font-semibold text-[var(--heading-text)] cursor-pointer hover:bg-[var(--hover-bg)] transition-colors select-none",
        headerClassName
      )}
      onClick={() => handleColumnClick(column)}
    >
      <div className="flex items-center gap-2">
        {children}
        {renderSortIcon(column)}
      </div>
    </th>
  );

  if (loading) {
    return <BookTableSkeleton showOrderColumn={showOrderColumn} />;
  }

  if (books.length === 0) {
    return (
      <div className="bg-[var(--card-bg)] border border-[var(--border-color)] rounded-lg p-12 text-center">
        <BookOpen className="w-16 h-16 text-[var(--accent)]/40 mx-auto mb-4" />
        <h3 className="text-xl font-serif font-semibold text-[var(--heading-text)] mb-2">
          No books on this shelf
        </h3>
        <p className="text-[var(--foreground)]/70 mb-6">
          Add books to this shelf from your library
        </p>
        <Link
          href="/library"
          className="inline-flex items-center gap-2 px-6 py-3 bg-[var(--accent)] text-white rounded-md hover:bg-[var(--light-accent)] transition-colors font-medium"
        >
          Go to Library
        </Link>
      </div>
    );
  }

  return (
    <div className={cn("overflow-x-auto rounded-lg border border-[var(--border-color)]", className)}>
      <table className="w-full bg-[var(--card-bg)]">
        <thead className="bg-[var(--background)] border-b border-[var(--border-color)] sticky top-0 z-10">
          <tr>
            {isSelectMode && (
              <th className="px-4 py-3 text-left w-[60px]">
                <input
                  type="checkbox"
                  checked={selectedBookIds.size === books.length && books.length > 0}
                  onChange={onToggleSelectAll}
                  className="w-5 h-5 rounded border-[var(--border-color)] text-[var(--accent)] focus:ring-[var(--accent)] focus:ring-offset-0 cursor-pointer"
                  aria-label="Select all books"
                />
              </th>
            )}
            <th className="px-4 py-3 text-left text-sm font-semibold text-[var(--heading-text)] w-[60px]">
              Cover
            </th>
            {showOrderColumn && (
              <SortableHeader column="sortOrder" className="w-[80px]">
                Order
              </SortableHeader>
            )}
            <SortableHeader column="title" className="min-w-[200px]">
              Title
            </SortableHeader>
            <SortableHeader column="author" className="min-w-[150px]">
              Author
            </SortableHeader>
            <SortableHeader column="series" className="min-w-[150px]">
              Series
            </SortableHeader>
            <SortableHeader column="rating" className="w-[120px]">
              Rating
            </SortableHeader>
            <th className="px-4 py-3 text-left text-sm font-semibold text-[var(--heading-text)] w-[120px]">
              Status
            </th>
            <SortableHeader column="pages" className="w-[100px]">
              Pages
            </SortableHeader>
            <SortableHeader column="dateAdded" className="w-[140px]">
              Date Added
            </SortableHeader>
            <th className="px-4 py-3 text-left text-sm font-semibold text-[var(--heading-text)] w-[100px]">
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--border-color)]">
          {books.map((book, index) => {
            const hasImageError = imageErrors.has(book.calibreId);
            const seriesInfo = book.series && book.seriesIndex
              ? `${book.series} #${book.seriesIndex}`
              : book.series || "-";
            const isSelected = selectedBookIds.has(book.id);

            return (
              <tr
                key={book.id}
                className={cn(
                  "transition-colors",
                  isSelected && "bg-[var(--accent)]/10",
                  !isSelected && (index % 2 === 0 ? "bg-[var(--card-bg)]" : "bg-[var(--background)]"),
                  !isSelectMode && "hover:bg-[var(--hover-bg)]",
                  isSelectMode && "cursor-pointer hover:bg-[var(--hover-bg)]"
                )}
                onClick={isSelectMode && onToggleSelection ? () => onToggleSelection(book.id) : undefined}
              >
                {/* Checkbox */}
                {isSelectMode && (
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => onToggleSelection?.(book.id)}
                      onClick={(e) => e.stopPropagation()}
                      className="w-4 h-4 rounded border-[var(--border-color)] focus:ring-2 focus:ring-[var(--accent)] focus:ring-offset-0 cursor-pointer"
                      style={{ accentColor: 'var(--accent)' }}
                    />
                  </td>
                )}

                {/* Cover */}
                <td className="px-4 py-3">
                  <Link href={`/books/${book.id}`} className="block">
                    <div className="w-10 h-[60px] bg-[var(--light-accent)]/30 flex items-center justify-center overflow-hidden rounded relative">
                      {!hasImageError ? (
                        <Image
                          src={getCoverUrl(book.calibreId, book.lastSynced)}
                          alt={book.title}
                          fill
                          loading="lazy"
                          className="object-cover"
                          onError={() => handleImageError(book.calibreId)}
                        />
                      ) : (
                        <BookOpen className="w-5 h-5 text-[var(--accent)]/40" />
                      )}
                    </div>
                  </Link>
                </td>

                {/* Order */}
                {showOrderColumn && (
                  <td className="px-4 py-3 text-[var(--foreground)]/80 text-sm text-center">
                    {book.sortOrder !== undefined ? book.sortOrder + 1 : "-"}
                  </td>
                )}

                {/* Title */}
                <td className="px-4 py-3">
                  <Link
                    href={`/books/${book.id}`}
                    className="font-medium text-[var(--heading-text)] hover:text-[var(--accent)] transition-colors line-clamp-2"
                  >
                    {book.title}
                  </Link>
                </td>

                {/* Author */}
                <td className="px-4 py-3 text-sm">
                  {book.authors.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {book.authors.map((author, idx) => (
                        <span key={author}>
                          <Link
                            href={`/library?search=${encodeURIComponent(author)}`}
                            className="text-[var(--foreground)]/80 hover:text-[var(--accent)] transition-colors"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {author}
                          </Link>
                          {idx < book.authors.length - 1 && (
                            <span className="text-[var(--foreground)]/80">, </span>
                          )}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <span className="text-[var(--foreground)]/40">-</span>
                  )}
                </td>

                {/* Series */}
                <td className="px-4 py-3 text-sm">
                  {book.series ? (
                    <Link
                      href={`/series/${encodeURIComponent(book.series)}`}
                      className="text-[var(--foreground)]/80 hover:text-[var(--accent)] transition-colors"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {seriesInfo}
                    </Link>
                  ) : (
                    <span className="text-[var(--foreground)]/40">-</span>
                  )}
                </td>

                {/* Rating */}
                <td className="px-4 py-3">
                  {book.rating && book.rating > 0 ? (
                    <StarRating rating={book.rating} size="sm" />
                  ) : (
                    <span className="text-[var(--foreground)]/40 text-sm">-</span>
                  )}
                </td>

                {/* Status */}
                <td className="px-4 py-3">
                  {book.status ? (
                    <StatusBadge status={book.status as BookStatus} size="sm" />
                  ) : (
                    <span className="text-[var(--foreground)]/40 text-sm">-</span>
                  )}
                </td>

                {/* Pages */}
                <td className="px-4 py-3 text-[var(--foreground)]/80 text-sm text-center">
                  {book.totalPages || "-"}
                </td>

                {/* Date Added */}
                <td className="px-4 py-3 text-[var(--foreground)]/80 text-sm">
                  {book.addedAt
                    ? format(new Date(book.addedAt), "MMM dd, yyyy")
                    : book.addedToLibrary
                    ? format(new Date(book.addedToLibrary), "MMM dd, yyyy")
                    : "-"}
                </td>

                {/* Actions */}
                <td className="px-4 py-3">
                  {renderActions ? (
                    renderActions(book, index)
                  ) : (
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/books/${book.id}`}
                        className="p-1.5 text-[var(--accent)] hover:bg-[var(--accent)]/10 rounded transition-colors"
                        title="View details"
                        onClick={(e) => isSelectMode && e.stopPropagation()}
                      >
                        <ExternalLink className="w-4 h-4" />
                      </Link>
                      {onRemoveBook && !isSelectMode && (
                        <button
                          onClick={() => onRemoveBook(book.id)}
                          className="p-1.5 text-red-500 hover:bg-red-500/10 rounded transition-colors"
                          title="Remove from shelf"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// Skeleton component for loading state
function BookTableSkeleton({ showOrderColumn = false }: { showOrderColumn?: boolean }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-[var(--border-color)]">
      <table className="w-full bg-[var(--card-bg)]">
        <thead className="bg-[var(--background)] border-b border-[var(--border-color)]">
          <tr>
            <th className="px-4 py-3 w-[60px]">
              <div className="h-4 bg-[var(--hover-bg)] rounded w-12" />
            </th>
            {showOrderColumn && (
              <th className="px-4 py-3 w-[80px]">
                <div className="h-4 bg-[var(--hover-bg)] rounded w-12" />
              </th>
            )}
            <th className="px-4 py-3 min-w-[200px]">
              <div className="h-4 bg-[var(--hover-bg)] rounded w-16" />
            </th>
            <th className="px-4 py-3 min-w-[150px]">
              <div className="h-4 bg-[var(--hover-bg)] rounded w-16" />
            </th>
            <th className="px-4 py-3 min-w-[150px]">
              <div className="h-4 bg-[var(--hover-bg)] rounded w-16" />
            </th>
            <th className="px-4 py-3 w-[120px]">
              <div className="h-4 bg-[var(--hover-bg)] rounded w-12" />
            </th>
            <th className="px-4 py-3 w-[120px]">
              <div className="h-4 bg-[var(--hover-bg)] rounded w-12" />
            </th>
            <th className="px-4 py-3 w-[100px]">
              <div className="h-4 bg-[var(--hover-bg)] rounded w-12" />
            </th>
            <th className="px-4 py-3 w-[140px]">
              <div className="h-4 bg-[var(--hover-bg)] rounded w-20" />
            </th>
            <th className="px-4 py-3 w-[100px]">
              <div className="h-4 bg-[var(--hover-bg)] rounded w-12" />
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--border-color)]">
          {Array.from({ length: 8 }).map((_, index) => (
            <tr
              key={index}
              className={cn(
                "animate-pulse",
                index % 2 === 0 ? "bg-[var(--card-bg)]" : "bg-[var(--background)]"
              )}
            >
              <td className="px-4 py-3">
                <div className="w-10 h-[60px] bg-[var(--hover-bg)] rounded" />
              </td>
              {showOrderColumn && (
                <td className="px-4 py-3">
                  <div className="h-4 bg-[var(--hover-bg)] rounded w-8 mx-auto" />
                </td>
              )}
              <td className="px-4 py-3">
                <div className="h-4 bg-[var(--hover-bg)] rounded w-3/4" />
              </td>
              <td className="px-4 py-3">
                <div className="h-4 bg-[var(--hover-bg)] rounded w-2/3" />
              </td>
              <td className="px-4 py-3">
                <div className="h-4 bg-[var(--hover-bg)] rounded w-1/2" />
              </td>
              <td className="px-4 py-3">
                <div className="h-6 bg-[var(--hover-bg)] rounded w-16" />
              </td>
              <td className="px-4 py-3">
                <div className="h-6 bg-[var(--hover-bg)] rounded w-16" />
              </td>
              <td className="px-4 py-3">
                <div className="h-4 bg-[var(--hover-bg)] rounded w-12 mx-auto" />
              </td>
              <td className="px-4 py-3">
                <div className="h-4 bg-[var(--hover-bg)] rounded w-24" />
              </td>
              <td className="px-4 py-3">
                <div className="flex gap-2">
                  <div className="w-8 h-8 bg-[var(--hover-bg)] rounded" />
                  <div className="w-8 h-8 bg-[var(--hover-bg)] rounded" />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
