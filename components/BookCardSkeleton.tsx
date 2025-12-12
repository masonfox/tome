'use client';

/**
 * BookCardSkeleton - Loading skeleton for BookCard
 * Mimics the layout of BookCard with animated placeholders
 */
export default function BookCardSkeleton() {
  return (
    <div className="bg-[var(--card-bg)] border border-[var(--border-color)] shadow-xl rounded-md overflow-hidden animate-pulse">
      {/* Cover skeleton - maintains 2:3 aspect ratio */}
      <div className="aspect-[2/3] bg-[var(--foreground)]/10" />

      {/* Content section skeleton */}
      <div className="p-4 space-y-2">
        {/* Title skeleton - 2 lines */}
        <div className="space-y-2">
          <div className="h-4 bg-[var(--foreground)]/10 rounded w-full" />
          <div className="h-4 bg-[var(--foreground)]/10 rounded w-3/4" />
        </div>
        
        {/* Author skeleton - 1 line */}
        <div className="h-4 bg-[var(--foreground)]/10 rounded w-2/3" />
        
        {/* Status badge skeleton */}
        <div className="pt-2">
          <div className="inline-block h-7 w-24 bg-[var(--foreground)]/10 rounded-sm" />
        </div>
      </div>
    </div>
  );
}
