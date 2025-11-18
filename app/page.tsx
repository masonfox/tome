import { BookOpen, BookCheck, TrendingUp, Flame } from "lucide-react";
import { StatsCard } from "@/components/ui/StatsCard";
import { StreakDisplay } from "@/components/StreakDisplay";
import { BookCard } from "@/components/BookCard";
import Link from "next/link";

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

async function getCurrentlyReading() {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";

  try {
    const response = await fetch(
      `${baseUrl}/api/books?status=reading&limit=6`,
      {
        cache: "no-store",
      }
    );

    if (!response.ok) {
      return { books: [] };
    }

    return response.json();
  } catch (error) {
    console.error("Failed to fetch currently reading:", error);
    return { books: [] };
  }
}

async function getReadNext() {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";

  try {
    const response = await fetch(
      `${baseUrl}/api/books?status=read-next&limit=6`,
      {
        cache: "no-store",
      }
    );

    if (!response.ok) {
      return { books: [] };
    }

    return response.json();
  } catch (error) {
    console.error("Failed to fetch read next:", error);
    return { books: [] };
  }
}

export default async function Dashboard() {
  const stats = await getStats();
  const streak = await getStreak();
  const currentlyReading = await getCurrentlyReading();
  const readNext = await getReadNext();

  return (
    <div className="space-y-10">
      {/* Header */}
      <div className="border-b border-[var(--border-color)] pb-6">
        <h1 className="text-5xl font-serif font-bold text-[var(--foreground)] flex items-center gap-3">
          <BookOpen className="w-8 h-8" />
          Dashboard
        </h1>
        <p className="text-[var(--foreground)]/70 mt-2 font-light">
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
          <h2 className="text-2xl font-serif font-bold text-[var(--foreground)]">
            Currently Reading
          </h2>
          <Link
            href="/library?status=reading"
            className="text-sm text-[var(--accent)] hover:text-[var(--light-accent)] font-semibold transition-colors"
          >
            View all →
          </Link>
        </div>

        {currentlyReading.books.length > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {currentlyReading.books.map((book: any) => (
              <BookCard
                key={book._id}
                id={book._id}
                title={book.title}
                authors={book.authors}
                coverPath={book.coverPath}
                currentProgress={book.latestProgress?.currentPercentage}
              />
            ))}
          </div>
        ) : (
          <div className="bg-[var(--card-bg)] border border-[var(--border-color)] p-8 text-center">
            <BookOpen className="w-12 h-12 text-[var(--accent)]/40 mx-auto mb-3" />
            <p className="text-[var(--foreground)]/70">
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
          <h2 className="text-2xl font-serif font-bold text-[var(--foreground)]">
            Read Next
          </h2>
          <Link
            href="/library?status=read-next"
            className="text-sm text-[var(--accent)] hover:text-[var(--light-accent)] font-semibold transition-colors"
          >
            View all →
          </Link>
        </div>

        {readNext.books.length > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {readNext.books.map((book: any) => (
              <BookCard
                key={book._id}
                id={book._id}
                title={book.title}
                authors={book.authors}
                coverPath={book.coverPath}
              />
            ))}
          </div>
        ) : (
          <div className="bg-[var(--card-bg)] border border-[var(--border-color)] p-8 text-center">
            <BookOpen className="w-12 h-12 text-[var(--accent)]/40 mx-auto mb-3" />
            <p className="text-[var(--foreground)]/70">
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
