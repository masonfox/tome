'use client';

/**
 * CurrentlyReadingCardSkeleton - Loading skeleton for currently reading book cards
 * Mimics the horizontal card layout with thumbnail, title, author, and progress bar
 */
export function CurrentlyReadingCardSkeleton() {
  return (
    <div className="bg-[var(--card-bg)] border border-[var(--border-color)] rounded-lg p-4 animate-pulse">
      <div className="flex gap-4 items-center">
        {/* Book Cover Thumbnail Skeleton */}
        <div className="w-16 h-24 bg-[var(--foreground)]/10 rounded flex-shrink-0" />

        {/* Book Info Skeleton */}
        <div className="flex-1 min-w-0 space-y-2">
          {/* Title skeleton - 1 line */}
          <div className="h-4 bg-[var(--foreground)]/10 rounded w-3/4" />
          
          {/* Author skeleton - 1 line */}
          <div className="h-3.5 bg-[var(--foreground)]/10 rounded w-1/2" />

          {/* Progress Bar Skeleton */}
          <div className="mt-2 flex items-center gap-3">
            {/* Percentage */}
            <div className="h-4 w-10 bg-[var(--foreground)]/10 rounded" />
            
            {/* Progress bar */}
            <div className="flex-1 bg-[var(--background)] rounded-full h-2 shadow-inner">
              <div className="h-2 bg-[var(--foreground)]/10 rounded-full w-1/3" />
            </div>
            
            {/* Update button */}
            <div className="w-7 h-7 bg-[var(--foreground)]/10 rounded" />
          </div>
        </div>
      </div>
    </div>
  );
}
