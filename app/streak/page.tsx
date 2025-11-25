import { StreakChart } from "@/components/StreakChart";
import { StreakAnalytics } from "@/components/StreakAnalytics";
import { getLogger } from "@/lib/logger";
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
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto">
          <Link
            href="/"
            className="text-blue-600 dark:text-blue-400 hover:underline mb-4 inline-block"
          >
            ← Back to Home
          </Link>
          <h1 className="text-3xl font-bold mb-6">Reading Streak Analytics</h1>
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6">
            <p className="text-red-800 dark:text-red-200">
              Unable to load streak analytics. Please try again later.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const { streak, dailyReadingHistory, booksAheadOrBehind } = analyticsData;

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <Link
            href="/"
            className="text-blue-600 dark:text-blue-400 hover:underline mb-4 inline-block"
          >
            ← Back to Home
          </Link>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Reading Streak Analytics
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            Track your reading habits and see your progress over time
          </p>
        </div>

        {/* Analytics Stats */}
        <div className="mb-8">
          <StreakAnalytics
            currentStreak={streak.currentStreak}
            longestStreak={streak.longestStreak}
            totalDaysActive={streak.totalDaysActive}
            dailyThreshold={streak.dailyThreshold}
            booksAheadOrBehind={booksAheadOrBehind}
            daysOfData={dailyReadingHistory.length}
          />
        </div>

        {/* Chart */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
            Daily Reading Activity
          </h2>
          {dailyReadingHistory.length > 0 ? (
            <StreakChart
              data={dailyReadingHistory}
              threshold={streak.dailyThreshold}
            />
          ) : (
            <div className="text-center py-12 text-gray-500 dark:text-gray-400">
              <p>No reading data available yet. Start reading to see your progress!</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
