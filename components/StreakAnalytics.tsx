"use client";

interface StreakAnalyticsProps {
  currentStreak: number;
  longestStreak: number;
  totalDaysActive: number;
  dailyThreshold: number;
  booksAheadOrBehind?: number;
  daysOfData: number;
}

export function StreakAnalytics({
  currentStreak,
  longestStreak,
  totalDaysActive,
  dailyThreshold,
  booksAheadOrBehind,
  daysOfData,
}: StreakAnalyticsProps) {
  // Show encouraging message for new users with < 7 days of data
  const showEncouragingMessage = daysOfData < 7;

  return (
    <div className="space-y-6">
      {/* Encouraging message for new users */}
      {showEncouragingMessage && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <p className="text-blue-800 dark:text-blue-200 text-sm">
            Keep going! You&apos;re just getting started. Come back after a week to
            see more detailed insights about your reading habits.
          </p>
        </div>
      )}

      {/* Stats grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Current Streak */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-gray-200 dark:border-gray-700">
          <div className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">
            Current Streak
          </div>
          <div className="text-3xl font-bold text-gray-900 dark:text-white">
            {currentStreak}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            consecutive days
          </div>
        </div>

        {/* Longest Streak */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-gray-200 dark:border-gray-700">
          <div className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">
            Longest Streak
          </div>
          <div className="text-3xl font-bold text-amber-600 dark:text-amber-400">
            {longestStreak}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            all-time best
          </div>
        </div>

        {/* Total Days Active */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-gray-200 dark:border-gray-700">
          <div className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">
            Total Days Active
          </div>
          <div className="text-3xl font-bold text-green-600 dark:text-green-400">
            {totalDaysActive}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            days with reading
          </div>
        </div>

        {/* Daily Goal */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-gray-200 dark:border-gray-700">
          <div className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">
            Daily Goal
          </div>
          <div className="text-3xl font-bold text-blue-600 dark:text-blue-400">
            {dailyThreshold}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            pages per day
          </div>
        </div>
      </div>

      {/* Books Ahead/Behind (conditional) */}
      {booksAheadOrBehind !== undefined && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-gray-200 dark:border-gray-700">
          <div className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">
            Reading Goal Progress
          </div>
          <div className="flex items-center gap-2">
            {booksAheadOrBehind > 0 ? (
              <>
                <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                  {Math.abs(booksAheadOrBehind)} books ahead
                </div>
                <div className="text-green-600 dark:text-green-400">
                  <svg
                    className="w-6 h-6"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
                    />
                  </svg>
                </div>
              </>
            ) : booksAheadOrBehind < 0 ? (
              <>
                <div className="text-2xl font-bold text-red-600 dark:text-red-400">
                  {Math.abs(booksAheadOrBehind)} books behind
                </div>
                <div className="text-red-600 dark:text-red-400">
                  <svg
                    className="w-6 h-6"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6"
                    />
                  </svg>
                </div>
              </>
            ) : (
              <div className="text-2xl font-bold text-gray-600 dark:text-gray-400">
                Right on pace!
              </div>
            )}
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
            Compared to your annual reading goal
          </p>
        </div>
      )}
    </div>
  );
}
