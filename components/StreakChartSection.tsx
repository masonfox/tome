"use client";

import { useState, useCallback, useEffect } from "react";
import { StreakChart } from "@/components/StreakChart";
import { TimePeriodFilter, TimePeriod } from "@/components/TimePeriodFilter";
import { TrendingUp, Loader2 } from "lucide-react";
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

export function StreakChartSection({
  initialData,
  threshold,
}: StreakChartSectionProps) {
  const [selectedPeriod, setSelectedPeriod] = useState<TimePeriod>(7);
  const [data, setData] = useState<DailyReading[]>(initialData);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isInitialLoad, setIsInitialLoad] = useState(true);

  const fetchAnalytics = useCallback(async (days: TimePeriod) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/streak/analytics?days=${days}`, {
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error("Failed to fetch analytics");
      }

      const json = await response.json();

      if (json.success) {
        setData(json.data.dailyReadingHistory);
      } else {
        throw new Error(json.error?.message || "Failed to load data");
      }
    } catch (err) {
      logger.error({ err }, "Failed to fetch analytics");
      setError("Failed to load chart data. Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  const handlePeriodChange = useCallback(
    (period: TimePeriod) => {
      setSelectedPeriod(period);
      fetchAnalytics(period);
    },
    [fetchAnalytics]
  );

  // Fetch 7-day data on initial mount since server provides 365 days by default
  useEffect(() => {
    if (isInitialLoad) {
      setIsInitialLoad(false);
      fetchAnalytics(7);
    }
  }, [isInitialLoad, fetchAnalytics]);

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
          disabled={loading}
        />
      </div>

      {/* Error State */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-md mb-4">
          <p className="text-sm font-medium">{error}</p>
        </div>
      )}

      {/* Chart Container */}
      {data.length > 0 ? (
        <div className="bg-[var(--card-bg)] border border-[var(--border-color)] rounded-md p-3 md:p-6 relative">
          {/* Loading Overlay */}
          {loading && (
            <div className="absolute inset-0 bg-[var(--card-bg)]/80 backdrop-blur-sm flex items-center justify-center rounded-md z-10">
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="w-8 h-8 text-[var(--accent)] animate-spin" />
                <p className="text-sm font-medium text-[var(--foreground)]/70">
                  Loading data...
                </p>
              </div>
            </div>
          )}

          <StreakChart data={data} threshold={threshold} />
        </div>
      ) : (
        <div className="bg-[var(--card-bg)] border border-[var(--border-color)] p-8 text-center rounded-md">
          <TrendingUp className="w-12 h-12 text-[var(--accent)]/40 mx-auto mb-3" />
          <p className="text-[var(--foreground)]/70 font-medium">
            No reading data available for this period.
          </p>
        </div>
      )}
    </div>
  );
}
