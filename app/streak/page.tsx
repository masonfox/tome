import { StreakAnalytics } from "@/components/Streaks/StreakAnalytics";
import { StreakChartSection } from "@/components/Streaks/StreakChartSection";
import { StreakRebuildSection } from "@/components/Streaks/StreakRebuildSection";
import { StreakOnboarding } from "@/components/Streaks/StreakOnboarding";
import { PageHeader } from "@/components/Layout/PageHeader";
import { getLogger } from "@/lib/logger";
import { Flame } from "lucide-react";
import { streakService } from "@/lib/services/streak.service";
import { redirect } from "next/navigation";

const logger = getLogger();

// Force dynamic rendering for this page
export const dynamic = "force-dynamic";

export default async function StreakPage() {
  // Check if streak tracking is enabled
  const currentStreak = await streakService.getStreak(null);
  
  if (!currentStreak.streakEnabled) {
    // Show onboarding without header
    return (
      <StreakOnboarding 
        onEnable={async (dailyGoal: number) => {
          "use server";
          await streakService.setStreakEnabled(null, true, dailyGoal);
          redirect("/streak");
        }}
      />
    );
  }

  // Fetch 7 days by default to match initial client state (StreakChartSection)
  // This avoids wasting bandwidth and server resources on 365 days that get immediately discarded
  // Call service directly instead of making HTTP request to API route
  let analyticsData;
  try {
    analyticsData = await streakService.getAnalytics(7, null);
  } catch (error) {
    logger.error({ error }, "Failed to fetch analytics");
    return (
      <div className="space-y-10">
        <PageHeader
          title="Streak"
          subtitle="Track your reading habits and progress over time"
          icon={Flame}
        />
        <div className="bg-[var(--card-bg)] border border-[var(--border-color)] p-8 text-center rounded-md">
          <p className="text-[var(--foreground)]/70 font-medium">
            Unable to load streak analytics. Please try again later.
          </p>
        </div>
      </div>
    );
  }

  const { streak, dailyReadingHistory, booksAheadOrBehind } = analyticsData;

  return (
    <div className="space-y-10">
      <PageHeader
        title="Streak"
        subtitle="Track your reading habits and progress over time"
        icon={Flame}
      />

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
