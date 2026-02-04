import { useQuery } from "@tanstack/react-query";
import { statsApi, type StatsOverview, type StreakData } from "@/lib/api";

async function fetchStatsOverview(): Promise<StatsOverview> {
  return statsApi.getOverview();
}

async function fetchStreak(): Promise<StreakData> {
  return statsApi.getStreak();
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
