"use client";

import { StatsCard } from "@/components/ui/StatsCard";
import { PageHeader } from "@/components/Layout/PageHeader";
import {
  BookOpen,
  BookCheck,
  TrendingUp,
  Calendar,
  Flame,
  BarChart3,
} from "lucide-react";
import { useStats } from "@/hooks/useStats";

export default function StatsPage() {
  const { stats, streak, isLoading } = useStats();

  return (
    <div className="space-y-10">
      <PageHeader
        title="Reading Statistics"
        subtitle="Track your reading progress and achievements"
        icon={BarChart3}
      />

      {/* Loading State */}
      {isLoading && (
        <div className="space-y-10">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="animate-pulse">
                <div className="h-32 bg-[var(--border-color)] rounded-md" />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Streak Stats */}
      {!isLoading && streak && (
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
      {!isLoading && stats && (
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
