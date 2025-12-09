import { StatsCard } from "@/components/ui/StatsCard";
import { PageHeader } from "@/components/PageHeader";
import {
  BookOpen,
  BookCheck,
  TrendingUp,
  Calendar,
  Flame,
  BarChart3,
} from "lucide-react";

export const dynamic = 'force-dynamic';
export const revalidate = 0; // Disable all caching including router cache

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
    // Suppress console; return null to indicate failure
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
    // Suppress console; return null to indicate failure
    return null;
  }
}

export default async function StatsPage() {
  const stats = await getStats();
  const streak = await getStreak();

  return (
    <div className="space-y-10">
      <PageHeader
        title="Reading Statistics"
        subtitle="Track your reading progress and achievements"
        icon={BarChart3}
      />

      {/* Streak Stats */}
      {streak && (
        <div>
          <h2 className="text-2xl font-serif font-bold text-[var(--heading-text)] mb-4">
            Reading Streaks
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <StatsCard
              title="Current Streak"
              value={streak.currentStreak}
              subtitle={streak.currentStreak === 1 ? "day" : "days"}
              icon={<Flame className="w-6 h-6" />}
            />
            <StatsCard
              title="Longest Streak"
              value={streak.longestStreak}
              subtitle={streak.longestStreak === 1 ? "day" : "days"}
              icon={<Flame className="w-6 h-6" />}
            />
            <StatsCard
              title="Total Active Days"
              value={streak.totalDaysActive}
              subtitle="All time"
              icon={<Calendar className="w-6 h-6" />}
            />
          </div>
        </div>
      )}

      {/* Reading Stats */}
      {stats && (
        <>
          <div>
            <h2 className="text-2xl font-serif font-bold text-[var(--heading-text)] mb-4">
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
            <h2 className="text-2xl font-serif font-bold text-[var(--heading-text)] mb-4">
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
                icon={<Flame className="w-6 h-6" />}
              />
            </div>
          </div>

          <div>
            <h2 className="text-2xl font-serif font-bold text-[var(--heading-text)] mb-4">
              Reading Velocity
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <StatsCard
                title="Average Pages per Day"
                value={stats.avgPagesPerDay}
                subtitle="Last 30 days"
                icon={<TrendingUp className="w-6 h-6" />}
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
