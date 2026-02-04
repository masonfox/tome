'use client';

import FannedBookCovers from '@/components/Utilities/FannedBookCovers';

/**
 * SeriesCardSkeleton - Loading skeleton for SeriesCard
 * Mimics the layout of SeriesCard with animated placeholders
 */
export default function SeriesCardSkeleton() {
  return (
    <div className="block bg-[var(--card-bg)] border-2 border-[var(--border-color)] rounded-lg shadow-md overflow-hidden animate-pulse">
      {/* Cover Collage Section Skeleton */}
      <FannedBookCovers
        coverIds={[]}
        isLoading={true}
        size="md"
        className="bg-gradient-to-br from-amber-50/50 to-orange-300/20 [html[data-theme='dark']_&]:from-stone-500/40 [html[data-theme='dark']_&]:to-stone-700/30"
        height={180}
      />

      {/* Series Info Section Skeleton */}
      <div className="p-4 space-y-3">
        {/* Series name skeleton - 2 lines */}
        <div className="space-y-2">
          <div className="h-5 bg-[var(--foreground)]/10 rounded w-3/4" />
          <div className="h-5 bg-[var(--foreground)]/10 rounded w-1/2" />
        </div>
        
        {/* Book count skeleton */}
        <div className="h-4 bg-[var(--foreground)]/10 rounded w-20" />
      </div>
    </div>
  );
}
