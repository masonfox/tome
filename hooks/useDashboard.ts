import { useQuery } from "@tanstack/react-query";

export interface DashboardStats {
  booksRead: {
    thisYear: number;
    total: number;
  };
  currentlyReading: number;
  pagesRead: {
    today: number;
    thisMonth: number;
  };
  avgPagesPerDay: number;
}

export interface DashboardStreak {
  currentStreak: number;
  longestStreak: number;
  dailyThreshold: number;
  hoursRemainingToday: number;
  todayPagesRead: number;
}

export interface BookWithStatus {
  id: number;
  title: string;
  authors: string[];
  calibreId: number;
  status?: string | null;
  rating?: number | null;
  latestProgress?: any;
}

export interface DashboardData {
  stats: DashboardStats | null;
  streak: DashboardStreak | null;
  currentlyReading: BookWithStatus[];
  currentlyReadingTotal: number;
  readNext: BookWithStatus[];
  readNextTotal: number;
}

async function fetchDashboardData(): Promise<DashboardData> {
  const response = await fetch("/api/dashboard", {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("Failed to fetch dashboard data");
  }

  return response.json();
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
