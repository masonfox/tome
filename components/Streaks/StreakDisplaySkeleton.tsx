'use client';

import { cn } from "@/utils/cn";

interface StreakDisplaySkeletonProps {
  className?: string;
}

/**
 * StreakDisplaySkeleton - Loading skeleton for StreakDisplay
 * Mimics the layout of StreakDisplay with animated placeholders
 * Includes detailed structure: flame icon, streak count with "days" text, and time remaining
 */
export function StreakDisplaySkeleton({ className }: StreakDisplaySkeletonProps) {
  return (
    <div className="flex flex-col items-center gap-1 mb-4 sm:mb-0 animate-pulse">
      <div className={cn("flex items-center gap-2", className)}>
        {/* Flame icon skeleton - circular placeholder */}
        <div className="w-5 h-5 bg-[var(--foreground)]/10 rounded-full flex-shrink-0" />

        {/* Streak count skeleton - includes number and "days" text */}
        <div className="flex items-baseline gap-1.5">
          {/* Number part */}
          <div className="h-8 bg-[var(--foreground)]/15 rounded w-10" />
          {/* "days" text part */}
          <div className="h-6 bg-[var(--foreground)]/10 rounded w-12" />
        </div>
      </div>
      
      {/* Time remaining/celebration skeleton - small text below */}
      <div className="h-3 bg-[var(--foreground)]/10 rounded w-28 mt-1" />
    </div>
  );
}
