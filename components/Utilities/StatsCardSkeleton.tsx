'use client';

import { cn } from "@/utils/cn";

interface StatsCardSkeletonProps {
  className?: string;
}

/**
 * StatsCardSkeleton - Loading skeleton for StatsCard
 * Mimics the layout of StatsCard with animated placeholders
 * Includes detailed structure: title label, large value number, subtitle, and icon
 */
export function StatsCardSkeleton({ className }: StatsCardSkeletonProps) {
  return (
    <div
      className={cn(
        "bg-[var(--card-bg)] border border-[var(--border-color)] rounded-md p-6 animate-pulse",
        className
      )}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1 space-y-3">
          {/* Title skeleton - uppercase label style */}
          <div className="h-3 bg-[var(--foreground)]/10 rounded w-32" />
          
          {/* Value skeleton - large number with varying widths for realism */}
          <div className="space-y-2">
            <div className="h-10 bg-[var(--foreground)]/15 rounded w-20" />
          </div>
          
          {/* Subtitle skeleton */}
          <div className="h-3 bg-[var(--foreground)]/10 rounded w-24" />
        </div>
        
        {/* Icon skeleton - circular placeholder */}
        <div className="w-6 h-6 bg-[var(--foreground)]/10 rounded-full flex-shrink-0" />
      </div>
    </div>
  );
}
