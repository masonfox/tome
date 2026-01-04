"use client";

import { TagItemSkeleton } from "./TagItemSkeleton";

/**
 * TagListSkeleton - Loading skeleton for tag list
 * Shows multiple tag item skeletons while data is loading
 */
export function TagListSkeleton() {
  return (
    <div className="flex flex-col h-full">
      {/* Search and controls skeletons */}
      <div className="space-y-3 mb-4">
        {/* Search bar skeleton */}
        <div className="h-10 bg-[var(--foreground)]/10 rounded-lg animate-pulse" />
        
        {/* Sort dropdown skeleton */}
        <div className="h-10 bg-[var(--foreground)]/10 rounded-lg animate-pulse" />
        
        {/* Select Multiple button skeleton */}
        <div className="h-10 bg-[var(--foreground)]/10 rounded-lg animate-pulse" />
      </div>

      {/* Tags list skeleton */}
      <div className="flex-1 overflow-y-auto space-y-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <TagItemSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}
