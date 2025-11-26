import { StreakChart } from "@/components/StreakChart";
import { StreakAnalytics } from "@/components/StreakAnalytics";
import { getLogger } from "@/lib/logger";
import { Flame, TrendingUp, ArrowLeft } from "lucide-react";
import Link from "next/link";

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
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
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
  const analyticsData = await fetchAnalytics();

  if (!analyticsData) {
    return (
      <div className="space-y-10">
        {/* Back to Dashboard Link */}
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-[var(--accent)] hover:text-[var(--light-accent)] my-5 font-medium transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Dashboard
        </Link>

        <div className="border-b border-[var(--border-color)] pb-6">
          <h1 className="text-5xl font-serif font-bold text-[var(--heading-text)] flex items-center gap-3">
            <Flame className="w-8 h-8" />
            Streak Analytics
          </h1>
          <p className="text-[var(--subheading-text)] mt-2 font-medium">
            Track your reading habits and progress over time
          </p>
        </div>
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
      {/* Header */}
      <div className="border-b border-[var(--border-color)] pb-6">
        {/* Back to Dashboard Link */}
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-[var(--accent)] hover:text-[var(--light-accent)] my-5 font-medium transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Dashboard
        </Link>
        <h1 className="text-5xl font-serif font-bold text-[var(--heading-text)] flex items-center gap-3">
          <Flame className="w-8 h-8" />
          Streak Analytics
        </h1>
        <p className="text-[var(--subheading-text)] mt-2 font-medium">
          Track your reading habits and progress over time
        </p>
      </div>

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
      <div>
        <h2 className="text-2xl font-serif font-bold text-[var(--heading-text)] mb-4">
          Daily Reading Activity
        </h2>
        {dailyReadingHistory.length > 0 ? (
          <div className="bg-[var(--card-bg)] border border-[var(--border-color)] rounded-md p-3 md:p-6">
            <StreakChart
              data={dailyReadingHistory}
              threshold={streak.dailyThreshold}
            />
          </div>
        ) : (
          <div className="bg-[var(--card-bg)] border border-[var(--border-color)] p-8 text-center rounded-md">
            <TrendingUp className="w-12 h-12 text-[var(--accent)]/40 mx-auto mb-3" />
            <p className="text-[var(--foreground)]/70 font-medium">
              No reading data available yet. Start reading to see your progress!
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
