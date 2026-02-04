import { useQuery } from "@tanstack/react-query";
import { dashboardApi, type DashboardData } from "@/lib/api";

export type {
  DashboardStats,
  DashboardStreak,
  BookWithStatus,
  DashboardData,
} from "@/lib/api";

async function fetchDashboardData(): Promise<DashboardData> {
  return dashboardApi.get();
}

export function useDashboard() {
  const { data, isLoading, error, refetch } = useQuery<DashboardData>({
    queryKey: ["dashboard"],
    queryFn: fetchDashboardData,
    staleTime: 30000, // 30 seconds - dashboard updates fairly frequently
    refetchOnWindowFocus: true, // Refetch when user returns to tab
  });

  return {
    stats: data?.stats ?? null,
    streak: data?.streak ?? null,
    currentlyReading: data?.currentlyReading ?? [],
    currentlyReadingTotal: data?.currentlyReadingTotal ?? 0,
    readNext: data?.readNext ?? [],
    readNextTotal: data?.readNextTotal ?? 0,
    isLoading,
    error,
    refetch,
  };
}
