'use client';

/**
 * ReadingGoalChartSkeleton - Loading skeleton for monthly chart
 * Mimics the bar chart layout with animated placeholders
 * NOTE: Does NOT include card wrapper - parent should provide it
 */
export function ReadingGoalChartSkeleton() {
  return (
    <div className="animate-pulse">
      {/* Chart area - matches h-64 md:h-80 from actual chart */}
      <div className="h-64 md:h-80 flex items-end justify-between gap-1 md:gap-2">
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
