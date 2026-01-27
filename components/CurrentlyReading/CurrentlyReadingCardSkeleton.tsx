'use client';

/**
 * CurrentlyReadingCardSkeleton - Loading skeleton for currently reading book cards
 * Mimics the exact horizontal card layout with:
 * - 16x24 thumbnail cover on left
 * - Title (single line, line-clamp-1)
 * - Author (smaller text, line-clamp-1)
 * - Progress bar with percentage and update button
 */
export function CurrentlyReadingCardSkeleton() {
  return (
    <div className="bg-[var(--card-bg)] border border-[var(--border-color)] rounded-lg p-4 animate-pulse">
      <div className="flex gap-4 items-center">
        {/* Book Cover Thumbnail - 16x24 with rounded corners */}
        <div className="w-16 h-24 bg-[var(--card-bg-emphasis)] rounded flex-shrink-0 flex items-center justify-center">
          {/* Book icon placeholder */}
          <div className="w-8 h-8 bg-[var(--foreground)]/15 rounded" />
        </div>

        {/* Book Info - matches flex-1 min-w-0 layout */}
        <div className="flex-1 min-w-0">
          {/* Title skeleton - single line (line-clamp-1) */}
          <div className="h-5 bg-[var(--card-bg-emphasis)] rounded w-full mb-1" />
          
          {/* Author skeleton - smaller text-sm size */}
          <div className="h-4 bg-[var(--card-bg-emphasis)] rounded w-2/5" />

          {/* Progress Bar - mt-2 to match spacing */}
          <div className="mt-2 flex items-center gap-3">
            {/* Percentage - text-sm font-mono */}
            <div className="h-4 w-9 bg-[var(--card-bg-emphasis)] rounded" />
            
            {/* Progress bar - h-2 rounded-full */}
            <div className="flex-1 bg-[var(--card-bg-emphasis)] rounded-full h-2 shadow-inner">
              <div className="h-2 bg-[var(--foreground)]/15 rounded-full w-[55%]" />
            </div>
            
            {/* Update button - p-1.5 with icon w-4 h-4 */}
            <div className="w-7 h-7 bg-[var(--card-bg-emphasis)] rounded flex-shrink-0" />
          </div>
        </div>
      </div>
    </div>
  );
}
