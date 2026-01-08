"use client";

import { useState, useCallback, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { StreakChart } from "@/components/Streaks/StreakChart";
import { StreakHeatmap } from "@/components/Streaks/StreakHeatmap";
import { TimePeriodFilter, TimePeriod } from "@/components/Utilities/TimePeriodFilter";
import { TrendingUp } from "lucide-react";
import { getLogger } from "@/lib/logger";

const logger = getLogger();

interface DailyReading {
  date: string;
  pagesRead: number;
  thresholdMet: boolean;
}

interface StreakChartSectionProps {
  initialData: DailyReading[];
  threshold: number;
}

async function fetchAnalytics(days: TimePeriod): Promise<DailyReading[]> {
  const response = await fetch(`/api/streak/analytics?days=${days}`, {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("Failed to fetch analytics");
  }

  const json = await response.json();

  if (!json.success) {
    throw new Error(json.error?.message || "Failed to load data");
  }

  return json.data.dailyReadingHistory;
}

export function StreakChartSection({
  initialData,
  threshold,
}: StreakChartSectionProps) {
  const [selectedPeriod, setSelectedPeriod] = useState<TimePeriod>(7);

  // Use TanStack Query for fetching analytics (for area chart)
  const { data, isLoading, error } = useQuery<DailyReading[]>({
    queryKey: ['streak-analytics', selectedPeriod],
    queryFn: () => fetchAnalytics(selectedPeriod),
    initialData: selectedPeriod === 7 ? initialData : undefined,
    staleTime: 60000, // 1 minute - streak data changes slowly
    refetchOnWindowFocus: true,
  });

  // Always fetch 365 days for heatmap (like GitHub's contribution graph)
  const { data: heatmapData, isLoading: isHeatmapLoading } = useQuery<DailyReading[]>({
    queryKey: ['streak-analytics-heatmap', 365],
    queryFn: () => fetchAnalytics(365 as TimePeriod),
    staleTime: 60000,
    refetchOnWindowFocus: true,
  });

  const handlePeriodChange = useCallback(
    (period: TimePeriod) => {
      setSelectedPeriod(period);
    },
    []
  );

  return (
    <div>
      {/* Header with Filter */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
        <h2 className="text-2xl font-serif font-bold text-[var(--heading-text)]">
          Daily Reading Activity
        </h2>
        <TimePeriodFilter
          selected={selectedPeriod}
          onChange={handlePeriodChange}
        />
      </div>

      {/* Error State */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-md mb-4">
          <p className="text-sm font-medium">{error.message || "Failed to load chart data"}</p>
        </div>
      )}

      {/* Loading State */}
      {isLoading && (
        <div className="bg-[var(--card-bg)] border border-[var(--border-color)] rounded-md p-8 text-center">
          <div className="animate-pulse">
            <div className="h-64 bg-[var(--border-color)] rounded" />
          </div>
        </div>
      )}

      {/* Area Chart Container */}
      {!isLoading && data && data.length > 0 ? (
        <div className="bg-[var(--card-bg)] border border-[var(--border-color)] rounded-md p-3 md:p-6 relative">
          <StreakChart data={data} threshold={threshold} />
        </div>
      ) : !isLoading && data && data.length === 0 ? (
        <div className="bg-[var(--card-bg)] border border-[var(--border-color)] p-8 text-center rounded-md">
          <TrendingUp className="w-12 h-12 text-[var(--accent)]/40 mx-auto mb-3" />
          <p className="text-[var(--foreground)]/70 font-medium">
            No reading data available for this period.
          </p>
        </div>
      ) : null}

      {/* Activity Calendar Heatmap - Always shows 365 days */}
      {!isHeatmapLoading && heatmapData && heatmapData.length > 0 && (
        <div className="mt-6">
          <h3 className="text-lg font-semibold text-[var(--heading-text)] mb-3">
            Activity Calendar
          </h3>
          <div className="bg-[var(--card-bg)] border border-[var(--border-color)] rounded-md p-4">
            <StreakHeatmap data={heatmapData} threshold={threshold} />
          </div>
        </div>
      )}
    </div>
  );
}
