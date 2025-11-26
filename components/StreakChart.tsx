"use client";

import { useState } from "react";
import {
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Legend,
  Area,
  ComposedChart,
} from "recharts";

interface DailyReading {
  date: string;
  pagesRead: number;
  thresholdMet: boolean;
}

interface StreakChartProps {
  data: DailyReading[];
  threshold: number;
}

export function StreakChart({ data, threshold }: StreakChartProps) {
  // State to track which data series are visible
  const [hiddenSeries, setHiddenSeries] = useState<Set<string>>(new Set());

  // Toggle visibility of a data series
  const handleLegendClick = (dataKey: string) => {
    setHiddenSeries((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(dataKey)) {
        newSet.delete(dataKey);
      } else {
        newSet.add(dataKey);
      }
      return newSet;
    });
  };
  // Calculate moving average
  const calculateMovingAverage = (data: DailyReading[], windowSize: number = 7) => {
    return data.map((item, index) => {
      const start = Math.max(0, index - windowSize + 1);
      const window = data.slice(start, index + 1);
      const sum = window.reduce((acc, d) => acc + d.pagesRead, 0);
      const average = sum / window.length;
      return {
        ...item,
        movingAverage: Math.round(average * 10) / 10, // Round to 1 decimal place
      };
    });
  };

  const dataWithAverage = calculateMovingAverage(data);

  // Format date for display (show MM/DD)
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return `${date.getMonth() + 1}/${date.getDate()}`;
  };

  // Format Y-axis ticks as integers
  const formatYAxis = (value: number) => {
    return Math.round(value).toString();
  };

  // Dynamic tick interval based on data length for better readability
  const getTickInterval = (length: number) => {
    if (length <= 30) return Math.floor(length / 7); // ~7 labels for 30 days
    if (length <= 90) return Math.floor(length / 9); // ~9 labels for 90 days
    return Math.floor(length / 10); // ~10 labels for 365 days
  };

  const tickInterval = getTickInterval(data.length);

  // Calculate Y-axis domain to always show the threshold
  const maxPagesRead = Math.max(...data.map(d => d.pagesRead), 0);
  const yAxisMax = Math.ceil(Math.max(threshold * 1.2, maxPagesRead * 1.1)); // Show at least 120% of threshold or 110% of max data, rounded up

  // Custom tooltip using site design system
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-[var(--card-bg)] p-3 border border-[var(--border-color)] rounded-md shadow-lg">
          <p className="text-sm font-semibold text-[var(--heading-text)]">{data.date}</p>
          <p className="text-sm text-[var(--foreground)] mt-1">
            Pages: <span className="font-bold">{data.pagesRead}</span>
          </p>
          {data.movingAverage !== undefined && !hiddenSeries.has("movingAverage") && (
            <p className="text-sm text-[var(--foreground)] mt-1">
              7-day avg: <span className="font-bold">{data.movingAverage}</span>
            </p>
          )}
          <p className="text-sm text-[var(--foreground)] mt-1">
            Status:{" "}
            <span className={data.thresholdMet ? "text-[var(--accent)] font-semibold" : "text-[var(--foreground)]/60"}>
              {data.thresholdMet ? "Goal met" : "Below goal"}
            </span>
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="w-full h-80 md:h-96">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart
          data={dataWithAverage}
          margin={{ top: 20, right: 10, left: 0, bottom: 40 }}
        >
          <defs>
            <linearGradient id="colorGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#10b981" stopOpacity={0.8} />
              <stop offset="95%" stopColor="#10b981" stopOpacity={0.1} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
          <XAxis
            dataKey="date"
            tickFormatter={formatDate}
            angle={-45}
            textAnchor="end"
            interval={tickInterval}
            height={60}
            tick={{ fontSize: 10 }}
          />
          <YAxis
            domain={[0, yAxisMax]}
            tickFormatter={formatYAxis}
            label={{
              value: "Pages Read",
              angle: -90,
              position: "insideLeft",
              style: { textAnchor: "middle", fontSize: 10 },
            }}
            tick={{ fontSize: 10 }}
            width={40}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend
            verticalAlign="top"
            height={36}
            iconType="line"
            wrapperStyle={{ paddingBottom: "10px", cursor: "pointer" }}
            onClick={(e: any) => handleLegendClick(e.dataKey)}
          />
          <Area
            type="monotone"
            dataKey="pagesRead"
            stroke="#059669"
            strokeWidth={2}
            fill="url(#colorGradient)"
            name="Pages Read"
            hide={hiddenSeries.has("pagesRead")}
          />
          <Line
            type="monotone"
            dataKey="movingAverage"
            stroke="#3b82f6"
            strokeWidth={2}
            dot={false}
            name="7-day Avg"
            hide={hiddenSeries.has("movingAverage")}
          />
          <ReferenceLine
            y={threshold}
            stroke="#f59e0b"
            strokeDasharray="5 5"
            strokeWidth={2}
            label={{
              value: `Goal: ${threshold} pages`,
              position: "insideTopLeft",
              fill: "#f59e0b",
              fontSize: 10,
              fontWeight: 700,
              offset: 5,
            }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
