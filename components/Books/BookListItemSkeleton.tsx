export function BookListItemSkeleton() {
  return (
    <div className="bg-[var(--card-bg)] border border-[var(--border-color)] rounded-lg p-4 animate-pulse">
      <div className="flex gap-4 items-start">
        {/* Cover Skeleton */}
        <div className="w-16 h-24 bg-[var(--hover-bg)] rounded flex-shrink-0" />

        {/* Content Skeleton */}
        <div className="flex-1 min-w-0 space-y-3">
          {/* Title & Author */}
          <div className="space-y-2">
            <div className="h-5 bg-[var(--hover-bg)] rounded w-3/4" />
            <div className="h-4 bg-[var(--hover-bg)] rounded w-1/2" />
          </div>

          {/* Metadata Row */}
          <div className="flex gap-3">
            <div className="h-3 bg-[var(--hover-bg)] rounded w-20" />
            <div className="h-3 bg-[var(--hover-bg)] rounded w-16" />
            <div className="h-3 bg-[var(--hover-bg)] rounded w-24" />
          </div>

          {/* Tags Row */}
          <div className="flex gap-2">
            <div className="h-5 bg-[var(--hover-bg)] rounded-full w-16" />
            <div className="h-5 bg-[var(--hover-bg)] rounded-full w-20" />
            <div className="h-5 bg-[var(--hover-bg)] rounded-full w-14" />
          </div>
        </div>
      </div>
    </div>
  );
}
