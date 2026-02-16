import { StreakPagePanel } from "@/components/Streaks/StreakPagePanel";
import { PageHeader } from "@/components/Layout/PageHeader";
import { getLogger } from "@/lib/logger";
import { Flame } from "lucide-react";
import { streakService } from "@/lib/services/streak.service";

const logger = getLogger();

// Force dynamic rendering for this page
export const dynamic = "force-dynamic";

export default async function StreakPage() {
  // Check if streak tracking is enabled
  const currentStreak = await streakService.getStreak(null);
  const streakEnabled = currentStreak.streakEnabled;
  
  // If streak is not enabled, show onboarding (no header, no analytics)
  if (!streakEnabled) {
    return <StreakPagePanel streakEnabled={false} />;
  }

  // Fetch 7 days by default to match initial client state (StreakChartSection)
  // This avoids wasting bandwidth and server resources on 365 days that get immediately discarded
  // Call service directly instead of making HTTP request to API route
  let analyticsData;
  try {
    analyticsData = await streakService.getAnalytics(7, null);
  } catch (error) {
    logger.error({ error }, "Failed to fetch analytics");
    // Pass undefined analyticsData to show error state
    analyticsData = undefined;
  }

  return (
    <div className="space-y-10">
      <PageHeader
        title="Streak"
        subtitle="Track your reading habits and progress over time"
        icon={Flame}
      />

      <StreakPagePanel 
        streakEnabled={true}
        analyticsData={analyticsData}
      />
    </div>
  );
}
