import { BookOpen, BookCheck, TrendingUp, Flame } from "lucide-react";
import { StatsCard } from "@/components/ui/StatsCard";
import { StreakDisplay } from "@/components/StreakDisplay";
import { BookCard } from "@/components/BookCard";
import Link from "next/link";
import { getDashboardData } from "@/lib/dashboard-service";

export default async function Dashboard() {
  const { stats, streak, currentlyReading, currentlyReadingTotal, readNext, readNextTotal } = await getDashboardData();

  return (
    <div className="space-y-10">
      {/* Header */}
      <div className="border-b border-[var(--border-color)] pb-6">
        <h1 className="text-5xl font-serif font-bold text-[var(--heading-text)] flex items-center gap-3">
          <BookOpen className="w-8 h-8" />
          Dashboard
        </h1>
        <p className="text-[var(--subheading-text)] mt-2 font-medium">
          Welcome back to your reading journey
        </p>
      </div>

      {/* Streak Display */}
      {streak && (
        <StreakDisplay
          currentStreak={streak.currentStreak}
          longestStreak={streak.longestStreak}
        />
      )}

      {/* Currently Reading */}
      <div>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-serif font-bold">
            <span className="text-[var(--heading-text)]">Currently Reading</span>
            <span className="ml-2 text-[var(--accent)]">
              ({currentlyReadingTotal})
            </span>
          </h2>
          {currentlyReadingTotal > 6 && (
            <Link
              href="/library?status=reading"
              className="flex items-center gap-2 px-4 py-2 bg-[var(--accent)] rounded-sm text-white hover:bg-[var(--light-accent)] transition-colors font-medium"
            >
              View all →
            </Link>
          )}
        </div>

        {currentlyReading.length > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {currentlyReading.map((book: any) => (
              <BookCard
                key={book._id}
                id={book._id}
                title={book.title}
                authors={book.authors}
                calibreId={book.calibreId}
                currentProgress={book.latestProgress?.currentPercentage}
              />
            ))}
          </div>
        ) : (
          <div className="bg-[var(--card-bg)] border border-[var(--border-color)] p-8 text-center">
            <BookOpen className="w-12 h-12 text-[var(--accent)]/40 mx-auto mb-3" />
            <p className="text-[var(--foreground)]/70 font-medium">
              No books in progress. Start reading from your{" "}
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

      {/* Read Next */}
      <div>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-serif font-bold">
            <span className="text-[var(--heading-text)]">Read Next</span>
            <span className="ml-2 text-[var(--accent)]">
              ({readNextTotal})
            </span>
          </h2>
          {readNextTotal > 6 && (
            <Link
              href="/library?status=read-next"
              className="flex items-center gap-2 px-4 py-2 bg-[var(--accent)] rounded-sm text-white hover:bg-[var(--light-accent)] transition-colors font-medium"
            >
              View all →
            </Link>
          )}
        </div>

        {readNext.length > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {readNext.map((book: any) => (
              <BookCard
                key={book._id}
                id={book._id}
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
