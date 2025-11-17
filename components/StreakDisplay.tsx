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
        "bg-gradient-to-br from-orange-500 to-red-600 rounded-lg shadow-lg p-6 text-white",
        className
      )}
    >
      <div className="flex items-center gap-3 mb-4">
        <Flame className="w-8 h-8" />
        <h2 className="text-2xl font-bold">Reading Streak</h2>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white/10 rounded-lg p-4 backdrop-blur-sm">
          <p className="text-sm opacity-90">Current Streak</p>
          <p className="text-4xl font-bold mt-1">{currentStreak}</p>
          <p className="text-sm opacity-90 mt-1">
            {currentStreak === 1 ? "day" : "days"}
          </p>
        </div>

        <div className="bg-white/10 rounded-lg p-4 backdrop-blur-sm">
          <p className="text-sm opacity-90">Best Streak</p>
          <p className="text-4xl font-bold mt-1">{longestStreak}</p>
          <p className="text-sm opacity-90 mt-1">
            {longestStreak === 1 ? "day" : "days"}
          </p>
        </div>
      </div>

      {currentStreak > 0 && (
        <p className="text-sm mt-4 opacity-90">
          {currentStreak >= longestStreak
            ? "You're on fire! Keep it up!"
            : "Keep reading to beat your record!"}
        </p>
      )}
    </div>
  );
}
