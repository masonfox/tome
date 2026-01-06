'use client';

/**
 * ReadingGoalChartSkeleton - Loading skeleton for monthly chart
 * Mimics the bar chart layout with animated placeholders
 */
export function ReadingGoalChartSkeleton() {
  return (
    <div className="bg-[var(--card-bg)] border border-[var(--border-color)] rounded-sm p-6 animate-pulse">
      {/* Title skeleton */}
      <div className="h-5 bg-[var(--foreground)]/10 rounded w-40 mb-4" />
      
      {/* Chart area */}
      <div className="h-64 flex items-end justify-between gap-2">
        {/* 12 bar skeletons representing months */}
        {Array.from({ length: 12 }).map((_, i) => {
          // Vary heights for more realistic appearance
          const heights = ['h-12', 'h-24', 'h-16', 'h-32', 'h-20', 'h-28', 'h-24', 'h-36', 'h-20', 'h-16', 'h-12', 'h-8'];
          return (
            <div key={i} className="flex-1 flex flex-col items-center gap-2">
              {/* Bar */}
              <div className={`w-full bg-[var(--foreground)]/10 rounded-t ${heights[i]}`} />
              {/* Month label */}
              <div className="h-3 w-6 bg-[var(--foreground)]/10 rounded" />
            </div>
          );
        })}
      </div>
    </div>
  );
}
