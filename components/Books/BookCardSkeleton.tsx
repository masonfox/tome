'use client';

/**
 * BookCardSkeleton - Loading skeleton for BookCard
 * Mimics the layout of BookCard with animated placeholders
 */
export function BookCardSkeleton() {
  return (
    <div className="bg-[var(--card-bg)] border border-[var(--border-color)] shadow-xl rounded-md overflow-hidden animate-pulse">
      {/* Cover skeleton - maintains 2:3 aspect ratio */}
      <div className="aspect-[2/3] bg-[var(--foreground)]/10" />

      {/* Content section skeleton */}
      <div className="p-4 space-y-1">
        {/* Title skeleton - 1.5 lines */}
        <div className="space-y-1.5">
          <div className="h-3.5 bg-[var(--foreground)]/10 rounded w-full" />
          <div className="h-3.5 bg-[var(--foreground)]/10 rounded w-2/3" />
        </div>
        
        {/* Author skeleton - 1 line */}
        <div className="h-3.5 bg-[var(--foreground)]/10 rounded w-1/2" />
      </div>
    </div>
  );
}
