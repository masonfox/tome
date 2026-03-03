"use client";

import { StreakAnalytics } from "./StreakAnalytics";
import { StreakChartSection } from "./StreakChartSection";
import { StreakRebuildSection } from "./StreakRebuildSection";
import { StreakOnboarding } from "./StreakOnboarding";
import { useStreakQuery } from "@/hooks/useStreakQuery";

export function StreakPagePanel() {
  const { streak, analytics, isLoading, streakError, analyticsError } = useStreakQuery();

  // Loading state - Match the actual page layout
  if (isLoading) {
    return (
      <div className="space-y-10">
        {/* Streak Stats Skeleton */}
        <div className="space-y-6">
          <div className="h-8 w-48 bg-[var(--border-color)] rounded animate-pulse" />
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
            {/* Current Streak - Orange gradient skeleton */}
            <div className="bg-gradient-to-br from-orange-400/30 to-orange-500/30 rounded-md p-6 animate-pulse">
              <div className="h-3 w-24 bg-white/30 rounded mb-4" />
              <div className="h-10 w-16 bg-white/40 rounded mx-auto mb-2" />
              <div className="h-3 w-20 bg-white/30 rounded mx-auto" />
            </div>
            
            {/* Longest Streak - Green gradient skeleton */}
            <div className="bg-gradient-to-br from-emerald-400/30 to-emerald-500/30 rounded-md p-6 animate-pulse">
              <div className="h-3 w-24 bg-white/30 rounded mb-4" />
              <div className="h-10 w-16 bg-white/40 rounded mx-auto mb-2" />
              <div className="h-3 w-20 bg-white/30 rounded mx-auto" />
            </div>
            
            {/* Total Days Active - Purple gradient skeleton */}
            <div className="bg-gradient-to-br from-purple-400/30 to-purple-500/30 rounded-md p-6 animate-pulse">
              <div className="h-3 w-24 bg-white/30 rounded mb-4" />
              <div className="h-10 w-16 bg-white/40 rounded mx-auto mb-2" />
              <div className="h-3 w-20 bg-white/30 rounded mx-auto" />
            </div>
            
            {/* Daily Goal - Blue gradient skeleton */}
            <div className="bg-gradient-to-br from-blue-400/30 to-blue-500/30 rounded-md p-6 animate-pulse">
              <div className="h-3 w-24 bg-white/30 rounded mb-4" />
              <div className="h-10 w-16 bg-white/40 rounded mx-auto mb-2" />
              <div className="h-3 w-20 bg-white/30 rounded mx-auto" />
            </div>
          </div>
        </div>

        {/* Chart Section Skeleton */}
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <div className="h-8 w-56 bg-[var(--border-color)] rounded animate-pulse" />
            <div className="h-10 w-32 bg-[var(--border-color)] rounded animate-pulse" />
          </div>
          <div className="bg-[var(--card-bg)] border border-[var(--border-color)] rounded-md p-6">
            <div className="h-64 bg-[var(--border-color)] rounded animate-pulse" />
          </div>
        </div>

        {/* Heatmap Section Skeleton */}
        <div className="space-y-4">
          <div className="h-8 w-64 bg-[var(--border-color)] rounded animate-pulse" />
          <div className="bg-[var(--card-bg)] border border-[var(--border-color)] rounded-md p-6">
            <div className="h-32 bg-[var(--border-color)] rounded animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (streakError) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-md">
        <p className="text-sm font-medium">Failed to load streak data. Please try again later.</p>
      </div>
    );
  }

  // Show onboarding if streak tracking is not enabled
  if (!streak?.streakEnabled) {
    return <StreakOnboarding />;
  }

  // Show analytics if streak is enabled
  if (!analytics) {
    return (
      <div className="bg-[var(--card-bg)] border border-[var(--border-color)] p-8 text-center rounded-md">
        <p className="text-[var(--foreground)]/70 font-medium">
          Unable to load streak analytics. Please try again later.
        </p>
      </div>
    );
  }

  const { streak: streakData, dailyReadingHistory, booksAheadOrBehind } = analytics;

  return (
    <div className="space-y-10">
      {/* Analytics Stats */}
      <StreakAnalytics
        currentStreak={streakData.currentStreak}
        longestStreak={streakData.longestStreak}
        totalDaysActive={streakData.totalDaysActive}
        dailyThreshold={streakData.dailyThreshold}
        booksAheadOrBehind={booksAheadOrBehind}
        daysOfData={dailyReadingHistory.length}
      />

      {/* Chart Section */}
      <StreakChartSection
        initialData={dailyReadingHistory}
        threshold={streakData.dailyThreshold}
      />

      {/* Rebuild Section */}
      <StreakRebuildSection />
    </div>
  );
}
