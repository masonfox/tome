'use client';

/**
 * ReadingGoalWidgetSkeleton - Loading skeleton for ReadingGoalWidget
 * Mimics the layout of the current year goal widget with animated placeholders
 */
export function ReadingGoalWidgetSkeleton() {
  return (
    <div className="bg-[var(--card-bg)] border border-[var(--border-color)] rounded-sm p-8 hover:shadow-md transition-shadow relative animate-pulse">
      {/* Header Section */}
      <div className="flex items-start justify-between mb-6">
        <div className="flex-1">
          {/* Title skeleton */}
          <div className="h-7 bg-[var(--foreground)]/10 rounded w-48 mb-2" />
          
          {/* Stats row skeleton */}
          <div className="flex items-center gap-4">
            <div className="h-5 bg-[var(--foreground)]/10 rounded w-32" />
            <div className="h-5 bg-[var(--foreground)]/10 rounded w-24" />
          </div>
        </div>

        {/* Edit button skeleton */}
        <div className="h-8 w-16 bg-[var(--foreground)]/10 rounded" />
      </div>

      {/* Progress Bar Section */}
      <div className="space-y-3 mb-6">
        {/* Progress bar */}
        <div className="relative w-full h-6 bg-[var(--foreground)]/5 rounded-sm overflow-hidden">
          <div className="absolute inset-0 bg-[var(--foreground)]/10 w-2/3" />
        </div>
        
        {/* Percentage text */}
        <div className="flex justify-between items-center">
          <div className="h-4 bg-[var(--foreground)]/10 rounded w-16" />
          <div className="h-4 bg-[var(--foreground)]/10 rounded w-24" />
        </div>
      </div>

      {/* Stats Grid Section */}
      <div className="grid grid-cols-3 gap-4 pt-4 border-t border-[var(--border-color)]">
        {/* Stat 1 */}
        <div>
          <div className="h-3 bg-[var(--foreground)]/10 rounded w-20 mb-2" />
          <div className="h-6 bg-[var(--foreground)]/10 rounded w-16" />
        </div>
        
        {/* Stat 2 */}
        <div>
          <div className="h-3 bg-[var(--foreground)]/10 rounded w-20 mb-2" />
          <div className="h-6 bg-[var(--foreground)]/10 rounded w-16" />
        </div>
        
        {/* Stat 3 */}
        <div>
          <div className="h-3 bg-[var(--foreground)]/10 rounded w-20 mb-2" />
          <div className="h-6 bg-[var(--foreground)]/10 rounded w-16" />
        </div>
      </div>
    </div>
  );
}
