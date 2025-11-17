import { StatsCard } from "@/components/ui/StatsCard";
import {
  BookOpen,
  BookCheck,
  TrendingUp,
  Calendar,
  Flame,
} from "lucide-react";

async function getStats() {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";

  try {
    const response = await fetch(`${baseUrl}/api/stats/overview`, {
      cache: "no-store",
    });

    if (!response.ok) {
      return null;
    }

    return response.json();
  } catch (error) {
    console.error("Failed to fetch stats:", error);
    return null;
  }
}

async function getStreak() {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";

  try {
    const response = await fetch(`${baseUrl}/api/streaks`, {
      cache: "no-store",
    });

    if (!response.ok) {
      return null;
    }

    return response.json();
  } catch (error) {
    console.error("Failed to fetch streak:", error);
    return null;
  }
}

export default async function StatsPage() {
  const stats = await getStats();
  const streak = await getStreak();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          Reading Statistics
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          Track your reading progress and achievements
        </p>
      </div>

      {/* Streak Stats */}
      {streak && (
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
            Reading Streaks
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <StatsCard
              title="Current Streak"
              value={streak.currentStreak}
              subtitle={streak.currentStreak === 1 ? "day" : "days"}
              icon={<Flame className="w-6 h-6 text-orange-500" />}
              className="bg-gradient-to-br from-orange-50 to-red-50 dark:from-orange-900/20 dark:to-red-900/20"
            />
            <StatsCard
              title="Longest Streak"
              value={streak.longestStreak}
              subtitle={streak.longestStreak === 1 ? "day" : "days"}
              icon={<Flame className="w-6 h-6 text-red-600" />}
              className="bg-gradient-to-br from-red-50 to-pink-50 dark:from-red-900/20 dark:to-pink-900/20"
            />
            <StatsCard
              title="Total Active Days"
              value={streak.totalDaysActive}
              subtitle="All time"
              icon={<Calendar className="w-6 h-6 text-blue-500" />}
              className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20"
            />
          </div>
        </div>
      )}

      {/* Reading Stats */}
      {stats && (
        <>
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
              Books Read
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <StatsCard
                title="All Time"
                value={stats.booksRead.total}
                subtitle="Total books read"
                icon={<BookCheck className="w-6 h-6" />}
              />
              <StatsCard
                title="This Year"
                value={stats.booksRead.thisYear}
                subtitle={`${stats.currentlyReading} currently reading`}
                icon={<BookOpen className="w-6 h-6" />}
              />
              <StatsCard
                title="This Month"
                value={stats.booksRead.thisMonth}
                subtitle="Books completed"
                icon={<TrendingUp className="w-6 h-6" />}
              />
            </div>
          </div>

          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
              Pages Read
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <StatsCard
                title="All Time"
                value={stats.pagesRead.total.toLocaleString()}
                subtitle="Total pages"
                icon={<BookOpen className="w-6 h-6" />}
              />
              <StatsCard
                title="This Year"
                value={stats.pagesRead.thisYear.toLocaleString()}
                subtitle="Pages read"
                icon={<Calendar className="w-6 h-6" />}
              />
              <StatsCard
                title="This Month"
                value={stats.pagesRead.thisMonth.toLocaleString()}
                subtitle="Pages read"
                icon={<TrendingUp className="w-6 h-6" />}
              />
              <StatsCard
                title="Today"
                value={stats.pagesRead.today.toLocaleString()}
                subtitle="Pages read"
                icon={<Flame className="w-6 h-6 text-orange-500" />}
                className="bg-gradient-to-br from-orange-50 to-red-50 dark:from-orange-900/20 dark:to-red-900/20"
              />
            </div>
          </div>

          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
              Reading Velocity
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <StatsCard
                title="Average Pages per Day"
                value={stats.avgPagesPerDay}
                subtitle="Last 30 days"
                icon={<TrendingUp className="w-6 h-6" />}
                className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20"
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
