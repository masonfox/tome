"use client";

import { BookOpen, BookCheck, TrendingUp, Flame, ArrowRight } from "lucide-react";
import { StatsCard } from "@/components/Utilities/StatsCard";
import { StreakDisplay } from "@/components/Streaks/StreakDisplay";
import { BookCard } from "@/components/Books/BookCard";
import { BookCardSkeleton } from "@/components/Books/BookCardSkeleton";
import CurrentlyReadingSection from "@/components/CurrentlyReading/CurrentlyReadingSection";
import Link from "next/link";
import { useDashboard } from "@/hooks/useDashboard";

export default function Dashboard() {
  const { stats, streak, currentlyReading, currentlyReadingTotal, readNext, readNextTotal, isLoading } = useDashboard();

  return (
    <div className="space-y-6 md:space-y-10">
      {/* Header */}
      <div className="border-b border-[var(--border-color)] pb-3 md:pb-6">
        <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-4 sm:gap-6">
          <div className="hidden md:block">
            <h1 className="text-5xl font-serif font-bold text-[var(--heading-text)] flex items-center gap-3">
              <BookOpen className="w-8 h-8" />
              Dashboard
            </h1>
            <p className="text-[var(--subheading-text)] mt-2 font-medium">
              Welcome back to your reading journey
            </p>
          </div>

          {/* Streak Display */}
          <div className="flex justify-center md:justify-end">
            {streak && (
              <StreakDisplay
                currentStreak={streak.currentStreak}
                longestStreak={streak.longestStreak}
                dailyThreshold={streak.dailyThreshold}
                hoursRemainingToday={streak.hoursRemainingToday}
                todayPagesRead={streak.todayPagesRead}
                className="flex-shrink-0"
              />
            )}
          </div>
        </div>
      </div>

      {/* Currently Reading */}
      <div>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-serif font-bold">
            <span className="text-[var(--heading-text)]">Currently Reading</span>
            {!isLoading && (
              <span className="ml-2 text-[var(--accent)]">
                ({currentlyReadingTotal})
              </span>
            )}
          </h2>
          {currentlyReadingTotal > 6 && (
            <Link
              href="/library?status=reading"
              className="flex items-center gap-2 px-4 py-2 bg-[var(--accent)] rounded-sm text-white hover:bg-[var(--light-accent)] transition-colors font-medium"
              title="View all currently reading books"
            >
              <span className="hidden md:inline">View all</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          )}
        </div>

        <CurrentlyReadingSection books={currentlyReading} isLoading={isLoading} />
      </div>

      {/* Read Next */}
      <div>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-serif font-bold">
            <span className="text-[var(--heading-text)]">Read Next</span>
            {!isLoading && (
              <span className="ml-2 text-[var(--accent)]">
                ({readNextTotal})
              </span>
            )}
          </h2>
          {readNextTotal > 8 && (
            <Link
              href="/read-next"
              className="flex items-center gap-2 px-4 py-2 bg-[var(--accent)] rounded-sm text-white hover:bg-[var(--light-accent)] transition-colors font-medium"
              title="View all read next books"
            >
              <span className="hidden md:inline">View all</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          )}
        </div>

        {isLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-8 gap-4">
            {[...Array(8)].map((_, i) => (
              <BookCardSkeleton key={i} />
            ))}
          </div>
        ) : readNext.length > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-8 gap-4">
            {readNext.map((book: any) => (
              <BookCard
                key={book.id}
                id={book.id.toString()}
                title={book.title}
                authors={book.authors}
                calibreId={book.calibreId}
              />
            ))}
          </div>
        ) : (
          <div className="bg-[var(--card-bg)] border border-[var(--border-color)] p-8 text-center">
            <BookOpen className="w-12 h-12 text-[var(--accent)]/40 mx-auto mb-3" />
            <p className="text-[var(--foreground)]/70 font-medium">
              No books in your reading queue. Add books from your{" "}
              <Link
                href="/library"
                className="text-[var(--accent)] hover:text-[var(--light-accent)] font-semibold"
              >
                library
              </Link>
              !
            </p>
          </div>
        )}
      </div>

      {/* Stats Grid */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 pt-6 border-t border-[var(--border-color)]">
          <StatsCard
            title="Books Read This Year"
            value={stats.booksRead.thisYear}
            subtitle={`${stats.booksRead.total} total`}
            icon={<BookCheck className="w-6 h-6" />}
          />
          <StatsCard
            title="Currently Reading"
            value={stats.currentlyReading}
            subtitle="Active books"
            icon={<BookOpen className="w-6 h-6" />}
          />
          <StatsCard
            title="Pages Today"
            value={stats.pagesRead.today}
            subtitle={`${stats.pagesRead.thisMonth} this month`}
            icon={<TrendingUp className="w-6 h-6" />}
          />
          <StatsCard
            title="Avg. Pages/Day"
            value={stats.avgPagesPerDay}
            subtitle="Last 30 days"
            icon={<Flame className="w-6 h-6" />}
          />
        </div>
      )}
    </div>
  );
}
