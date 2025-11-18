"use client";

import { Flame } from "lucide-react";
import { cn } from "@/utils/cn";

interface StreakDisplayProps {
  currentStreak: number;
  longestStreak: number;
  className?: string;
}

export function StreakDisplay({
  currentStreak,
  longestStreak,
  className,
}: StreakDisplayProps) {
  return (
    <div
      className={cn(
        "bg-[var(--card-bg)] border border-[var(--border-color)] rounded-md p-8",
        className
      )}
    >
      <div className="flex items-center gap-3 mb-6">
        <Flame className="w-8 h-8 text-[var(--accent)]" />
        <h2 className="text-2xl font-serif font-bold text-[var(--heading-text)]">
          Reading Streak
        </h2>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div className="border-r border-[var(--border-color)] pr-6">
          <p className="text-xs uppercase tracking-wide text-[var(--foreground)]/70 font-semibold">
            Current Streak
          </p>
          <p className="text-5xl font-serif font-bold text-[var(--accent)] mt-2">
            {currentStreak}
          </p>
          <p className="text-sm text-[var(--foreground)]/60 mt-1 font-medium">
            {currentStreak === 1 ? "day" : "days"}
          </p>
        </div>

        <div className="pl-6">
          <p className="text-xs uppercase tracking-wide text-[var(--foreground)]/70 font-semibold">
            Best Streak
          </p>
          <p className="text-5xl font-serif font-bold text-[var(--light-accent)] mt-2">
            {longestStreak}
          </p>
          <p className="text-sm text-[var(--foreground)]/60 mt-1 font-medium">
            {longestStreak === 1 ? "day" : "days"}
          </p>
        </div>
      </div>

      {currentStreak > 0 && (
        <p className="text-sm mt-6 pt-6 border-t border-[var(--border-color)] text-[var(--foreground)]/70 font-medium">
          {currentStreak >= longestStreak
            ? "✓ You're on fire! Keep it up!"
            : "✓ Keep reading to beat your record!"}
        </p>
      )}
    </div>
  );
}
