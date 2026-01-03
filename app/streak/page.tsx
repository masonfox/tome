import { StreakAnalytics } from "@/components/StreakAnalytics";
import { StreakChartSection } from "@/components/StreakChartSection";
import { StreakRebuildSection } from "@/components/StreakRebuildSection";
import { StreakOnboarding } from "@/components/StreakOnboarding";
import { PageHeader } from "@/components/PageHeader";
import { getLogger } from "@/lib/logger";
import { getServerBaseUrl } from "@/lib/utils/server-url";
import { Flame } from "lucide-react";
import { streakService } from "@/lib/services/streak.service";
import { redirect } from "next/navigation";

const logger = getLogger();

// Force dynamic rendering for this page
export const dynamic = "force-dynamic";

interface DailyReading {
  date: string;
  pagesRead: number;
  thresholdMet: boolean;
}

interface StreakData {
  currentStreak: number;
  longestStreak: number;
  dailyThreshold: number;
  totalDaysActive: number;
}

interface AnalyticsData {
  streak: StreakData;
  dailyReadingHistory: DailyReading[];
  booksAheadOrBehind?: number;
}

async function fetchAnalytics(days: number = 365): Promise<AnalyticsData | null> {
  try {
    const baseUrl = getServerBaseUrl();
    const res = await fetch(`${baseUrl}/api/streak/analytics?days=${days}`, {
      cache: "no-store",
    });

    if (!res.ok) {
      return null;
    }

    const json = await res.json();
    return json.success ? json.data : null;
  } catch (error) {
    logger.error({ error }, "Failed to fetch analytics");
    return null;
  }
}

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
  const analyticsData = await fetchAnalytics(7);

  if (!analyticsData) {
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
