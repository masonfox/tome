"use client";

import { StreakAnalytics } from "./StreakAnalytics";
import { StreakChartSection } from "./StreakChartSection";
import { StreakRebuildSection } from "./StreakRebuildSection";
import { StreakOnboarding } from "./StreakOnboarding";
import { useStreakQuery } from "@/hooks/useStreakQuery";

export function StreakPagePanel() {
  const { streak, analytics, isLoading, streakError, analyticsError } = useStreakQuery();

  // Loading state
  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="bg-[var(--card-bg)] border border-[var(--border-color)] rounded-md p-8">
          <div className="animate-pulse space-y-4">
            <div className="h-8 w-48 bg-[var(--border-color)] rounded" />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="h-24 bg-[var(--border-color)] rounded" />
              <div className="h-24 bg-[var(--border-color)] rounded" />
              <div className="h-24 bg-[var(--border-color)] rounded" />
            </div>
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
