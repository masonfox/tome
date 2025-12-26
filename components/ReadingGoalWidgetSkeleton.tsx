'use client';

/**
 * ReadingGoalWidgetSkeleton - Loading skeleton for ReadingGoalWidget
 * Mimics the layout of the current year goal widget with animated placeholders
 */
export function ReadingGoalWidgetSkeleton() {
  return (
    <div className="bg-[var(--card-bg)] border border-[var(--border-color)] rounded-sm p-8 hover:shadow-md transition-shadow relative animate-pulse">
      {/* Header Section */}
      <div className="mb-6">
        {/* Subtitle and Edit Button Row */}
        <div className="flex items-center justify-between mb-3">
          {/* Subtitle skeleton (e.g., "10 of 12 books completed") */}
          <div className="h-5 bg-[var(--foreground)]/10 rounded w-40" />
          
          {/* Edit button skeleton */}
          <div className="h-7 w-14 bg-[var(--foreground)]/10 rounded" />
        </div>
        
        {/* Pacing Indicator Row */}
        <div className="inline-flex items-center bg-[var(--card-bg)] border border-[var(--border-color)] rounded-sm px-3 py-2">
          <div className="h-5 bg-[var(--foreground)]/10 rounded w-24" />
        </div>
      </div>

      {/* Progress Bar */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          {/* "PROGRESS" label skeleton */}
          <div className="h-3 bg-[var(--foreground)]/10 rounded w-16" />
          {/* Percentage skeleton */}
          <div className="h-4 bg-[var(--foreground)]/10 rounded w-12" />
        </div>
        <div className="w-full bg-[var(--border-color)] rounded-sm h-5 overflow-hidden">
          <div className="h-5 bg-[var(--foreground)]/10 w-2/3" />
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-6">
        {/* Stat 1 */}
        <div className="border-l-2 border-[var(--accent)] pl-4">
          <div className="h-3 bg-[var(--foreground)]/10 rounded w-20 mb-1" />
          <div className="h-9 bg-[var(--foreground)]/10 rounded w-16" />
        </div>
        
        {/* Stat 2 */}
        <div className="border-l-2 border-[var(--border-color)] pl-4">
          <div className="h-3 bg-[var(--foreground)]/10 rounded w-20 mb-1" />
          <div className="h-9 bg-[var(--foreground)]/10 rounded w-16" />
        </div>
      </div>
    </div>
  );
}
