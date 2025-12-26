import { useQuery } from "@tanstack/react-query";

interface StatsOverview {
  booksRead: {
    total: number;
    thisYear: number;
    thisMonth: number;
  };
  currentlyReading: number;
  pagesRead: {
    total: number;
    thisYear: number;
    thisMonth: number;
    today: number;
  };
  avgPagesPerDay: number;
}

interface StreakData {
  currentStreak: number;
  longestStreak: number;
  dailyThreshold: number;
  totalDaysActive: number;
  streakEnabled: boolean;
  userTimezone: string;
  hoursRemainingToday: number;
}

async function fetchStatsOverview(): Promise<StatsOverview> {
  const response = await fetch("/api/stats/overview", {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("Failed to fetch stats");
  }

  return response.json();
}

async function fetchStreak(): Promise<StreakData> {
  const response = await fetch("/api/streaks", {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("Failed to fetch streak");
  }

  return response.json();
}

export function useStats() {
  const { data: stats, isLoading: isLoadingStats, error: statsError } = useQuery<StatsOverview>({
    queryKey: ['stats'],
    queryFn: fetchStatsOverview,
    staleTime: 30000, // 30 seconds
    refetchOnWindowFocus: true,
  });

  const { data: streak, isLoading: isLoadingStreak, error: streakError } = useQuery<StreakData>({
    queryKey: ['streaks'],
    queryFn: fetchStreak,
    staleTime: 30000, // 30 seconds
    refetchOnWindowFocus: true,
  });

  return {
    stats: stats ?? null,
    streak: streak ?? null,
    isLoading: isLoadingStats || isLoadingStreak,
    error: statsError || streakError,
  };
}
