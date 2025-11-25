"use client";

import { Flame } from "lucide-react";
import { cn } from "@/utils/cn";

interface StreakDisplayProps {
  currentStreak: number;
  longestStreak: number;
  dailyThreshold?: number;
  hoursRemainingToday?: number;
  todayPagesRead?: number;
  className?: string;
}

export function StreakDisplay({
  currentStreak,
  longestStreak,
  dailyThreshold,
  hoursRemainingToday,
  todayPagesRead = 0,
  className,
}: StreakDisplayProps) {
  // Check if user has met their goal today
  const goalMet = dailyThreshold ? todayPagesRead >= dailyThreshold : false;

  // Determine flame color based on goal completion
  const flameColor = goalMet
    ? "text-[var(--accent)]"  // Bright color when goal met
    : "text-[var(--foreground)]/30"; // Dim color when goal not met

  // Only show time remaining if goal not met
  const showTimeRemaining = !goalMet && hoursRemainingToday !== undefined && hoursRemainingToday > 0;

  return (
    <div className="flex flex-col items-center">
      <div className={cn("flex items-center gap-1", className)}>
        {/* Colored flame indicator */}
        <Flame className={cn("w-5 h-5", flameColor)} />

        {/* Streak count */}
        <div className="flex flex-col">
          <span className="text-2xl font-bold text-[var(--heading-text)] leading-none">
            {currentStreak} {currentStreak === 1 ? "day" : "days"}
          </span>
        </div>
      </div>
      {/* Time remaining (only if goal not met) */}
      {showTimeRemaining && (
        <div className="text-xs mt-1.5 text-[var(--subheading-text)] leading-tight mt-0.5">
          {hoursRemainingToday} {hoursRemainingToday === 1 ? "hour" : "hours"} left today
        </div>
      )}
    </div>
  );
}
