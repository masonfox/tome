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

export default async function Dashboard() {
  const stats = await getStats();
  const streak = await getStreak();
  const currentlyReading = await getCurrentlyReading();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          Dashboard
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
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
        <div className="flex items-center justify-between mb-">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            Currently Reading
          </h2>
          <Link
            href="/library?status=reading"
            className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
          >
            View all
          </Link>
        </div>
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
        <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-8 text-center">
          <BookOpen className="w-12 h-12 text-gray-400 mx-auto mb-3" />
          <p className="text-gray-600 dark:text-gray-400">
            No books in progress. Start reading from your{" "}
            <Link
              href="/library"
              className="text-blue-600 hover:text-blue-700 dark:text-blue-400"
            >
              library
            </Link>
            !
          </p>
        </div>
      )}

      {/* Stats Grid */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
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
