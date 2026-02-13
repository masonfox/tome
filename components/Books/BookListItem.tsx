"use client";

import Link from "next/link";
import Image from "next/image";
import { BookOpen } from "lucide-react";
import { cn } from "@/utils/cn";
import { useState, memo, ReactNode } from "react";
import { StatusBadge } from "@/components/Utilities/StatusBadge";
import { StarRating } from "@/components/Utilities/StarRating";
import { type BookStatus } from "@/utils/statusConfig";
import { getCoverUrl } from "@/lib/utils/cover-url";

interface BookListItemProps {
  book: {
    id: number;
    calibreId: number | null;
    title: string;
    authors: string[];
    series?: string | null;
    seriesIndex?: number | null;
    rating?: number | null;
    status?: string | null;
    currentProgress?: number;
    lastSynced?: Date | string | null;
  };
  actions?: ReactNode;
  showProgress?: boolean;
  onClick?: () => void;
  className?: string;
  isSelectMode?: boolean;
  isSelected?: boolean;
  onToggleSelection?: () => void;
}

export const BookListItem = memo(function BookListItem({
  book,
  actions,
  showProgress = false,
  onClick,
  className,
  isSelectMode = false,
  isSelected = false,
  onToggleSelection,
}: BookListItemProps) {
  const [imageError, setImageError] = useState(false);

  const progressPercentage = book.currentProgress || 0;
  const hasProgress = showProgress && progressPercentage > 0;

  // Format series info
  const seriesInfo = book.series && book.seriesIndex 
    ? `${book.series} #${book.seriesIndex}`
    : book.series;

  const handleClick = () => {
    if (isSelectMode && onToggleSelection) {
      onToggleSelection();
    } else if (onClick) {
      onClick();
    }
  };

  return (
    <div
      className={cn(
        "bg-[var(--card-bg)] border rounded-lg p-4 transition-all",
        isSelectMode && "cursor-pointer hover:shadow-md",
        isSelected && "border-[var(--accent)] bg-[var(--accent)]/10",
        !isSelected && "border-[var(--border-color)]",
        !isSelectMode && onClick && "cursor-pointer hover:shadow-md",
        className
      )}
      onClick={isSelectMode ? handleClick : onClick}
    >
      <div className="flex gap-4 items-start">
        {/* Checkbox for select mode */}
        {isSelectMode && (
          <div className="flex-shrink-0 h-24 flex items-center">
            <input
              type="checkbox"
              checked={isSelected}
              onChange={onToggleSelection}
              onClick={(e) => e.stopPropagation()}
              className="w-4 h-4 rounded border-[var(--border-color)] focus:ring-2 focus:ring-[var(--accent)] focus:ring-offset-0 cursor-pointer"
              style={{ accentColor: 'var(--accent)' }}
            />
          </div>
        )}

        {/* Book Cover Thumbnail */}
        <Link 
          href={`/books/${book.id}`} 
          className="flex-shrink-0"
          onClick={(e) => isSelectMode && e.preventDefault()}
        >
          <div className="w-16 h-24 bg-[var(--light-accent)]/30 flex items-center justify-center overflow-hidden rounded relative shadow-lg">
            {!imageError && book.calibreId ? (
              <Image
                src={getCoverUrl(book.calibreId, book.lastSynced)}
                alt={book.title}
                fill
                loading="lazy"
                className="object-cover"
                onError={() => setImageError(true)}
              />
            ) : (
              <BookOpen className="w-8 h-8 text-[var(--accent)]/40" />
            )}
          </div>
        </Link>

        {/* Book Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              {/* Series */}
              {seriesInfo && book.series && (
                <Link
                  href={`/series/${encodeURIComponent(book.series)}`}
                  className="text-xs text-[var(--subheading-text)] hover:text-[var(--accent)] font-serif font-medium transition-colors block mb-1"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (isSelectMode) e.preventDefault();
                  }}
                >
                  {seriesInfo}
                </Link>
              )}

              {/* Title */}
              <Link 
                href={`/books/${book.id}`}
                onClick={(e) => {
                  if (isSelectMode) e.preventDefault();
                }}
              >
                <h3 className="font-semibold text-[var(--heading-text)] line-clamp-2 hover:text-[var(--accent)] transition-colors leading-snug">
                  {book.title}
                </h3>
              </Link>

              {/* Authors */}
              <div className="text-sm text-[var(--subheading-text)] line-clamp-1 font-serif font-medium mt-1">
                {book.authors.length > 0 ? (
                  book.authors.map((author, idx) => (
                    <span key={author}>
                      <Link
                        href={`/library?search=${encodeURIComponent(author)}`}
                        className="hover:text-[var(--accent)] transition-colors"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (isSelectMode) e.preventDefault();
                        }}
                      >
                        {author}
                      </Link>
                      {idx < book.authors.length - 1 && ", "}
                    </span>
                  ))
                ) : (
                  <span className="text-[var(--foreground)]/40">Unknown Author</span>
                )}
              </div>

              {/* Rating and Status Row */}
              <div className="flex flex-wrap items-center gap-3 mt-2">
                {/* Rating */}
                {book.rating && book.rating > 0 && (
                  <StarRating rating={book.rating} size="xs" />
                )}

                {/* Status Badge */}
                {book.status && (
                  <StatusBadge status={book.status as BookStatus} size="sm" />
                )}
              </div>
            </div>

            {/* Actions */}
            {actions && (
              <div className="flex-shrink-0 h-24 flex items-center">
                {actions}
              </div>
            )}
          </div>

          {/* Progress Bar */}
          {hasProgress && (
            <div className="mt-3">
              <div className="flex items-center gap-3">
                <span className="text-sm font-mono font-bold text-[var(--accent)]">
                  {Math.round(progressPercentage)}%
                </span>
                <div className="flex-1 bg-[var(--background)] rounded-full h-2 shadow-inner">
                  <div
                    className="bg-gradient-to-r from-[var(--accent)] to-[var(--light-accent)] h-2 rounded-full transition-all duration-300 ease-out"
                    style={{ width: `${Math.min(100, progressPercentage)}%` }}
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}, (prevProps, nextProps) => {
  // Custom comparison for memo optimization
  return (
    prevProps.book.id === nextProps.book.id &&
    prevProps.book.title === nextProps.book.title &&
    prevProps.book.status === nextProps.book.status &&
    prevProps.book.currentProgress === nextProps.book.currentProgress &&
    prevProps.book.rating === nextProps.book.rating &&
    prevProps.showProgress === nextProps.showProgress &&
    prevProps.isSelectMode === nextProps.isSelectMode &&
    prevProps.isSelected === nextProps.isSelected
  );
});
