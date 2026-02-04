'use client';

interface BookCardSkeletonProps {
  /**
   * Variant determines which elements to show:
   * - 'simple': Just cover, title, and author (used on dashboard "Read Next")
   * - 'with-status': Adds status badge (used on library page)
   * - 'with-progress': Adds status badge and progress bar (used on book detail pages or filtered views)
   */
  variant?: 'simple' | 'with-status' | 'with-progress';
}

/**
 * BookCardSkeleton - Loading skeleton for BookCard
 * Mimics the layout of BookCard with animated placeholders
 * Supports different variants based on what data will be displayed
 */
export function BookCardSkeleton({ variant = 'simple' }: BookCardSkeletonProps) {
  return (
    <div className="bg-[var(--card-bg)] border border-[var(--border-color)] shadow-xl rounded-md overflow-hidden animate-pulse">
      {/* Cover skeleton - maintains 2:3 aspect ratio */}
      <div className="aspect-[2/3] bg-[var(--card-bg-emphasis)] flex items-center justify-center">
        {/* Book icon placeholder in cover area */}
        <div className="w-20 h-20 bg-[var(--foreground)]/15 rounded-lg" />
      </div>

      {/* Content section skeleton */}
      <div className="p-4 space-y-1">
        {/* Title skeleton - 2 lines to match line-clamp-2 with text-md and leading-snug */}
        <div className="space-y-2">
          <div className="h-5 bg-[var(--card-bg-emphasis)] rounded w-full" />
          <div className="h-5 bg-[var(--card-bg-emphasis)] rounded w-4/5" />
        </div>
        
        {/* Author skeleton - 1 line with text-md */}
        <div className="h-5 bg-[var(--card-bg-emphasis)] rounded w-3/5" />

        {/* Status badge skeleton - only shown for 'with-status' and 'with-progress' variants */}
        {(variant === 'with-status' || variant === 'with-progress') && (
          <div className="pt-2">
            <div className="h-6 bg-[var(--card-bg-emphasis)] rounded-full w-20" />
          </div>
        )}

        {/* Progress section skeleton - only shown for 'with-progress' variant */}
        {variant === 'with-progress' && (
          <div className="pt-3 mt-1 border-t border-[var(--border-color)]">
            {/* Progress label and percentage */}
            <div className="flex items-center justify-between mb-2.5">
              <div className="h-3 bg-[var(--card-bg-emphasis)] rounded w-20" />
              <div className="h-4 bg-[var(--card-bg-emphasis)] rounded w-12" />
            </div>
            {/* Progress bar */}
            <div className="w-full bg-[var(--card-bg-emphasis)] rounded-full h-2.5 shadow-inner border border-[var(--border-color)]/50">
              <div className="h-2.5 bg-[var(--foreground)]/15 rounded-full w-1/3" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
