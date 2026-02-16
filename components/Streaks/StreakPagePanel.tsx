"use client";

import { StreakAnalytics } from "./StreakAnalytics";
import { StreakChartSection } from "./StreakChartSection";
import { StreakRebuildSection } from "./StreakRebuildSection";
import { StreakOnboarding } from "./StreakOnboarding";

interface StreakPagePanelProps {
  streakEnabled: boolean;
  analyticsData?: {
    streak: {
      currentStreak: number;
      longestStreak: number;
      dailyThreshold: number;
      totalDaysActive: number;
    };
    dailyReadingHistory: {
      date: string;
      pagesRead: number;
      thresholdMet: boolean;
    }[];
    booksAheadOrBehind?: number;
  };
}

export function StreakPagePanel({ streakEnabled, analyticsData }: StreakPagePanelProps) {
  // Show onboarding if streak tracking is not enabled
  if (!streakEnabled) {
    return <StreakOnboarding />;
  }

  // Show analytics if streak is enabled
  if (!analyticsData) {
    return (
      <div className="bg-[var(--card-bg)] border border-[var(--border-color)] p-8 text-center rounded-md">
        <p className="text-[var(--foreground)]/70 font-medium">
          Unable to load streak analytics. Please try again later.
        </p>
      </div>
    );
  }

  const { streak, dailyReadingHistory, booksAheadOrBehind } = analyticsData;

  return (
    <div className="space-y-10">
      {/* Analytics Stats */}
      <StreakAnalytics
        currentStreak={streak.currentStreak}
        longestStreak={streak.longestStreak}
        totalDaysActive={streak.totalDaysActive}
        dailyThreshold={streak.dailyThreshold}
        booksAheadOrBehind={booksAheadOrBehind}
        daysOfData={dailyReadingHistory.length}
      />

      {/* Chart Section */}
      <StreakChartSection
        initialData={dailyReadingHistory}
        threshold={streak.dailyThreshold}
      />

      {/* Rebuild Section */}
      <StreakRebuildSection />
    </div>
  );
}
