import { useQuery } from "@tanstack/react-query";

interface StreakData {
  id: number;
  userId: number | null;
  streakEnabled: boolean;
  currentStreak: number;
  longestStreak: number;
  lastActivityDate: string | null;
  streakStartDate: string | null;
  totalDaysActive: number;
  dailyThreshold: number;
  userTimezone: string;
  lastCheckedDate: string | null;
  updatedAt: string;
  hoursRemainingToday: number;
}

interface StreakAnalyticsData {
  streak: {
    currentStreak: number;
    longestStreak: number;
    dailyThreshold: number;
    totalDaysActive: number;
  };
  dailyReadingHistory: {
    date: string;
    pagesRead: number;
    thresholdMet: boolean;
  }[];
  booksAheadOrBehind?: number;
}

/**
 * Custom hook for querying streak data
 * 
 * Provides read-only access to streak settings and analytics.
 * For mutations (updates), use the useStreak() hook.
 * 
 * @example
 * const { streak, analytics, isLoading } = useStreakQuery();
 * 
 * if (isLoading) return <Skeleton />;
 * if (streak?.streakEnabled) {
 *   // Show streak analytics
 * }
 */
export function useStreakQuery() {
  // Query: Fetch streak status and settings
  const streakQuery = useQuery({
    queryKey: ['streak'],
    queryFn: async () => {
      const response = await fetch('/api/streak');
      if (!response.ok) throw new Error('Failed to fetch streak');
      const json = await response.json();
      if (!json.success) throw new Error(json.error?.message || 'Failed to load streak');
      return json.data as StreakData;
    },
    staleTime: 60000, // 1 minute
    refetchOnWindowFocus: true,
  });

  // Query: Fetch streak analytics (only if streak is enabled)
  const analyticsQuery = useQuery({
    queryKey: ['streak-analytics-full', 7],
    queryFn: async () => {
      const response = await fetch('/api/streak/analytics?days=7');
      if (!response.ok) throw new Error('Failed to fetch analytics');
      const json = await response.json();
      if (!json.success) throw new Error(json.error?.message || 'Failed to load analytics');
      return json.data as StreakAnalyticsData;
    },
    staleTime: 60000,
    refetchOnWindowFocus: true,
    enabled: streakQuery.data?.streakEnabled ?? false, // Only fetch if streak is enabled
  });

  return {
    // Streak data
    streak: streakQuery.data,
    isLoadingStreak: streakQuery.isLoading,
    streakError: streakQuery.error,
    
    // Analytics data
    analytics: analyticsQuery.data,
    isLoadingAnalytics: analyticsQuery.isLoading,
    analyticsError: analyticsQuery.error,
    
    // Combined loading state
    isLoading: streakQuery.isLoading || (streakQuery.data?.streakEnabled && analyticsQuery.isLoading),
  };
}
