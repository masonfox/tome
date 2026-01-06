'use client';

/**
 * SeriesCardSkeleton - Loading skeleton for SeriesCard
 * Mimics the layout of SeriesCard with animated placeholders
 */
export default function SeriesCardSkeleton() {
  return (
    <div className="block bg-[var(--card-bg)] border-2 border-[var(--border-color)] rounded-lg shadow-md overflow-hidden animate-pulse">
      {/* Cover Collage Section Skeleton */}
      <div className="relative h-[180px] overflow-hidden bg-gradient-to-br from-amber-50/50 to-orange-300/20 [html[data-theme='dark']_&]:from-stone-500/40 [html[data-theme='dark']_&]:to-stone-700/30">
        <div className="absolute inset-0 flex items-center justify-center">
          {/* Stack of skeleton covers with rotation and offset */}
          {[0, 1, 2].map((index) => {
            const coverStyles = [
              { 
                rotation: '-rotate-6',
                left: 20,
                zIndex: 10,
              },
              { 
                rotation: 'rotate-0',
                left: 60,
                zIndex: 20,
              },
              { 
                rotation: 'rotate-6',
                left: 100,
                zIndex: 30,
              },
            ];
            
            const style = coverStyles[index];
            
            return (
              <div
                key={index}
                className="absolute"
                style={{
                  left: `${style.left}px`,
                  zIndex: style.zIndex,
                }}
              >
                <div className={`${style.rotation}`}>
                  <div className="w-[80px] h-[120px] bg-[var(--foreground)]/10 rounded shadow-xl border-2 border-[var(--card-bg)]" />
                </div>
              </div>
            );
          })}
        </div>
      </div>

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
