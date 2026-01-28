'use client';

/**
 * MonthSelectorSkeleton - Loading skeleton for MonthSelector
 * Mimics the exact layout: label + prev button + dropdown + next button
 * Uses actual "Month" text to prevent layout shift (text doesn't change)
 */
export function MonthSelectorSkeleton() {
  return (
    <div className="flex items-center gap-3">
      {/* Label - use actual text since it never changes */}
      <span className="text-sm font-semibold text-[var(--subheading-text)]">
        Month
      </span>
      
      <div className="flex items-center gap-2 animate-pulse">
        {/* Previous button skeleton */}
        <div className="h-[36px] w-[36px] bg-[var(--card-bg)] border border-[var(--border-color)] rounded-md flex items-center justify-center">
          <div className="w-4 h-4 bg-[var(--foreground)]/10 rounded" />
        </div>

        {/* Dropdown skeleton - matches min-w-[140px] */}
        <div className="h-[36px] min-w-[140px] bg-[var(--card-bg)] border border-[var(--border-color)] rounded-md px-4 flex items-center">
          <div className="h-4 w-20 bg-[var(--foreground)]/10 rounded" />
        </div>

        {/* Next button skeleton */}
        <div className="h-[36px] w-[36px] bg-[var(--card-bg)] border border-[var(--border-color)] rounded-md flex items-center justify-center">
          <div className="w-4 h-4 bg-[var(--foreground)]/10 rounded" />
        </div>
      </div>
    </div>
  );
}
