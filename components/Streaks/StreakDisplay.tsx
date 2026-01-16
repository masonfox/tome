"use client";

import { Flame } from "lucide-react";
import { cn } from "@/utils/cn";
import Link from "next/link";

// Filled flame icon component
function FilledFlame({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
    >
      <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>
    </svg>
  );
}

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

  // Check if user is at a new record (current streak >= longest streak and streak > 0)
  const isNewRecord = currentStreak > 0 && currentStreak >= longestStreak && currentStreak > 1;

  // Determine flame color based on goal completion and new record status
  const flameColor = goalMet
    ? isNewRecord
      ? "text-orange-500 drop-shadow-[0_0_8px_rgba(249,115,22,0.6)]"  // Glowing effect for new record
      : "text-orange-500"  // Orange/red color when goal met
    : "text-[var(--foreground)] opacity-35"; // Very dim color when goal not met

  // Only show time remaining if goal not met
  const showTimeRemaining = !goalMet && hoursRemainingToday !== undefined && hoursRemainingToday > 0;

  return (
    <div className="flex flex-col items-center gap-1 mb-4 sm:mb-0">
      <Link href="/streak" className="group transition-opacity">
        <div className={cn("flex items-center gap-1", className)}>
          {/* Colored flame indicator - filled when goal met, outline when not */}
          {goalMet ? (
            <FilledFlame className={cn("w-5 h-5", flameColor)} />
          ) : (
            <Flame className={cn("w-5 h-5", flameColor)} />
          )}

          {/* Streak count */}
          <div className="flex flex-col">
            <span className="text-2xl font-bold text-[var(--heading-text)] leading-none">
              {currentStreak} {currentStreak === 1 ? "day" : "days"}
            </span>
          </div>
        </div>
        {/* Celebration message for new record */}
        {isNewRecord && (
          <div className="text-xs mt-2 text-orange-500 font-semibold leading-tight text-center">
            New record! 🎉
          </div>
        )}

        {/* Time remaining (only if goal not met and not showing celebration) */}
        {showTimeRemaining && !isNewRecord && (
          <div className="text-xs mt-1 text-[var(--subheading-text)] leading-tight text-center">
            {hoursRemainingToday} {hoursRemainingToday === 1 ? "hour" : "hours"} left today
          </div>
        )}
      </Link>
    </div>
  );
}
