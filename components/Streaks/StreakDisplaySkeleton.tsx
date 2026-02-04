'use client';

import { cn } from "@/utils/cn";

interface StreakDisplaySkeletonProps {
  className?: string;
}

/**
 * StreakDisplaySkeleton - Loading skeleton for StreakDisplay
 * Mimics the layout of StreakDisplay with animated placeholders
 * Includes detailed structure: flame icon, streak count with "days" text, and optional time remaining
 */
export function StreakDisplaySkeleton({ className }: StreakDisplaySkeletonProps) {
  return (
    <div className="flex flex-col items-center gap-1 mb-4 sm:mb-0 animate-pulse">
      {/* Link wrapper matching actual component */}
      <div className="group transition-opacity">
        <div className={cn("flex items-center gap-1", className)}>
          {/* Flame icon skeleton */}
          <div className="w-5 h-5 bg-[var(--card-bg-emphasis)] rounded-full flex-shrink-0" />

          {/* Streak count skeleton - matches text-2xl font-bold leading-none */}
          <div className="h-6 bg-[var(--card-bg-emphasis)] rounded w-16" />
        </div>
      </div>
    </div>
  );
}
