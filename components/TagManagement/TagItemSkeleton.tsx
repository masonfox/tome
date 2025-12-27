"use client";

/**
 * TagItemSkeleton - Loading skeleton for individual tag items
 * Mimics the layout of TagItem with animated placeholders
 */
export function TagItemSkeleton() {
  return (
    <div className="flex items-center gap-3 p-3 bg-[var(--card-bg)] border border-[var(--border-color)] rounded-lg animate-pulse">
      {/* Tag name skeleton */}
      <div className="flex-1 min-w-0">
        <div className="h-4 bg-[var(--foreground)]/10 rounded w-3/4" />
      </div>
      
      {/* Book count badge skeleton */}
      <div className="h-6 w-12 bg-[var(--foreground)]/10 rounded-full" />
    </div>
  );
}
