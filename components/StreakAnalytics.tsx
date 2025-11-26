"use client";

import { Flame, Calendar, Target, TrendingUp, TrendingDown, Settings } from "lucide-react";
import Link from "next/link";

interface StreakAnalyticsProps {
  currentStreak: number;
  longestStreak: number;
  totalDaysActive: number;
  dailyThreshold: number;
  booksAheadOrBehind?: number;
  daysOfData: number;
}

export function StreakAnalytics({
  currentStreak,
  longestStreak,
  totalDaysActive,
  dailyThreshold,
  booksAheadOrBehind,
  daysOfData,
}: StreakAnalyticsProps) {
  // Show encouraging message for new users with < 7 days of data
  const showEncouragingMessage = daysOfData < 7;

  return (
    <div className="space-y-6">
      {/* Encouraging message for new users */}
      {showEncouragingMessage && (
        <div className="bg-gradient-to-r from-teal-500 to-cyan-500 rounded-md p-4 text-white">
          <p className="text-sm font-semibold">
            🌱 Keep going! You&apos;re just getting started. Come back after a week to
            see more detailed insights about your reading habits.
          </p>
        </div>
      )}

      {/* Streak Stats */}
      <div>
        <h2 className="text-2xl font-serif font-bold text-[var(--heading-text)] mb-4">
          Reading Streaks
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Current Streak - Vibrant Orange */}
          <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-md p-6 hover:shadow-lg transition-shadow text-white">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <p className="text-xs uppercase tracking-wide font-semibold opacity-90">
                  Current Streak
                </p>
                <p className="text-4xl font-serif font-bold mt-3">
                  {currentStreak}
                </p>
                <p className="text-xs mt-2 font-medium opacity-80">
                  {currentStreak === 1 ? "day" : "consecutive days"}
                </p>
              </div>
              <div className="opacity-80">
                <Flame className="w-6 h-6" />
              </div>
            </div>
          </div>

          {/* Longest Streak - Pantone Green */}
          <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-md p-6 hover:shadow-lg transition-shadow text-white">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <p className="text-xs uppercase tracking-wide font-semibold opacity-90">
                  Longest Streak
                </p>
                <p className="text-4xl font-serif font-bold mt-3">
                  {longestStreak}
                </p>
                <p className="text-xs mt-2 font-medium opacity-80">
                  {longestStreak === 1 ? "day" : "all-time best"}
                </p>
              </div>
              <div className="opacity-80">
                <Flame className="w-6 h-6" />
              </div>
            </div>
          </div>

          {/* Total Days Active - Purple */}
          <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-md p-6 hover:shadow-lg transition-shadow text-white">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <p className="text-xs uppercase tracking-wide font-semibold opacity-90">
                  Total Days Active
                </p>
                <p className="text-4xl font-serif font-bold mt-3">
                  {totalDaysActive}
                </p>
                <p className="text-xs mt-2 font-medium opacity-80">
                  days with reading
                </p>
              </div>
              <div className="opacity-80">
                <Calendar className="w-6 h-6" />
              </div>
            </div>
          </div>

          {/* Daily Goal - Blue with hover effect */}
          <Link href="/settings" className="block hover:scale-[1.02] transition-transform">
            <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-md p-6 hover:shadow-lg transition-shadow text-white cursor-pointer">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <p className="text-xs uppercase tracking-wide font-semibold opacity-90">
                    Daily Goal
                  </p>
                  <p className="text-4xl font-serif font-bold mt-3">
                    {dailyThreshold}
                  </p>
                  <p className="text-xs mt-2 font-medium opacity-80">
                    pages per day • edit
                  </p>
                </div>
                <div className="opacity-80">
                  <Settings className="w-6 h-6" />
                </div>
              </div>
            </div>
          </Link>
        </div>
      </div>

      {/* Books Ahead/Behind (conditional) */}
      {booksAheadOrBehind !== undefined && (
        <div>
          <h2 className="text-2xl font-serif font-bold text-[var(--heading-text)] mb-4">
            Reading Goal Progress
          </h2>
          {booksAheadOrBehind > 0 ? (
            <div className="bg-gradient-to-br from-green-500 to-emerald-600 rounded-md p-6 text-white">
              <div className="flex items-center gap-4">
                <TrendingUp className="w-10 h-10 opacity-90" />
                <div>
                  <p className="text-3xl font-serif font-bold">
                    {Math.abs(booksAheadOrBehind)} {Math.abs(booksAheadOrBehind) === 1 ? "book" : "books"} ahead
                  </p>
                  <p className="text-sm mt-1 font-medium opacity-90">
                    Great job! You&apos;re exceeding your annual reading goal 🎉
                  </p>
                </div>
              </div>
            </div>
          ) : booksAheadOrBehind < 0 ? (
            <div className="bg-gradient-to-br from-amber-500 to-orange-500 rounded-md p-6 text-white">
              <div className="flex items-center gap-4">
                <TrendingDown className="w-10 h-10 opacity-90" />
                <div>
                  <p className="text-3xl font-serif font-bold">
                    {Math.abs(booksAheadOrBehind)} {Math.abs(booksAheadOrBehind) === 1 ? "book" : "books"} behind
                  </p>
                  <p className="text-sm mt-1 font-medium opacity-90">
                    You can catch up! Keep reading to reach your annual goal 📚
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-gradient-to-br from-blue-500 to-indigo-600 rounded-md p-6 text-white">
              <div className="flex items-center gap-4">
                <Target className="w-10 h-10 opacity-90" />
                <div>
                  <p className="text-3xl font-serif font-bold">
                    Right on pace! 🎯
                  </p>
                  <p className="text-sm mt-1 font-medium opacity-90">
                    You&apos;re perfectly aligned with your annual reading goal
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
