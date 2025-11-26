"use client";

import { useState, useCallback, useEffect } from "react";
import { StreakChart } from "@/components/StreakChart";
import { TimePeriodFilter, TimePeriod } from "@/components/TimePeriodFilter";
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

export function StreakChartSection({
  initialData,
  threshold,
}: StreakChartSectionProps) {
  const [selectedPeriod, setSelectedPeriod] = useState<TimePeriod>(7);
  const [data, setData] = useState<DailyReading[]>(initialData);
  const [error, setError] = useState<string | null>(null);

  const fetchAnalytics = useCallback(async (days: TimePeriod) => {
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
    }
  }, []);

  const handlePeriodChange = useCallback(
    (period: TimePeriod) => {
      setSelectedPeriod(period);
      fetchAnalytics(period);
    },
    [fetchAnalytics]
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
          <p className="text-sm font-medium">{error}</p>
        </div>
      )}

      {/* Chart Container */}
      {data.length > 0 ? (
        <div className="bg-[var(--card-bg)] border border-[var(--border-color)] rounded-md p-3 md:p-6 relative">
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
