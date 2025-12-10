"use client";

import { useMemo } from "react";
import {
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ComposedChart,
  ReferenceLine,
} from "recharts";

interface MonthlyData {
  month: number;
  count: number;
}

interface ReadingGoalChartProps {
  monthlyData: MonthlyData[];
  goal: number | null;
  year: number;
}

// Month names for X-axis (defined outside component to avoid recreating)
const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function ReadingGoalChart({ monthlyData, goal, year }: ReadingGoalChartProps) {
  // Prepare chart data - no pace calculation needed
  const chartData = useMemo(() => {
    return monthlyData.map((item) => ({
      month: monthNames[item.month - 1],
      count: item.count,
    }));
  }, [monthlyData]);

  // Calculate Y-axis domain
  const maxCount = Math.max(...monthlyData.map(d => d.count), 0);
  const maxExpected = goal ? goal : 0;
  const yAxisMax = Math.ceil(Math.max(maxCount * 1.1, maxExpected * 1.1) / 10) * 10; // Round up to nearest 10

  // Full month names for tooltip
  const fullMonthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

  // Custom tooltip
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      const monthIndex = monthNames.indexOf(data.month);
      const fullMonthName = monthIndex !== -1 ? fullMonthNames[monthIndex] : data.month;
      
      return (
        <div className="bg-[var(--card-bg)] p-3 border border-[var(--border-color)] rounded-md shadow-lg">
          <p className="text-sm font-semibold text-[var(--heading-text)]">{fullMonthName}</p>
          <p className="text-sm text-[var(--foreground)] mt-1">
            Books read: <span className="font-bold">{data.count}</span>
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
          data={chartData}
          margin={{ top: 20, right: 10, left: 0, bottom: 40 }}
        >
          <defs>
            <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#10b981" stopOpacity={0.8} />
              <stop offset="95%" stopColor="#10b981" stopOpacity={0.3} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
          <XAxis
            dataKey="month"
            angle={-45}
            textAnchor="end"
            height={60}
            tick={{ fontSize: 10 }}
          />
          <YAxis
            domain={[0, yAxisMax]}
            label={{
              value: "Books Completed",
              angle: -90,
              position: "insideLeft",
              style: { textAnchor: "middle", fontSize: 10 },
            }}
            tick={{ fontSize: 10 }}
            width={50}
          />
          <Tooltip content={<CustomTooltip />} />
          <Bar
            dataKey="count"
            fill="url(#barGradient)"
            name="Books Completed"
            radius={[4, 4, 0, 0]}
          />
          {goal && (
            <ReferenceLine
              y={goal}
              stroke="#d97706"
              strokeDasharray="5 5"
              strokeWidth={2}
              label={{
                value: `Goal: ${goal} books`,
                position: "insideTopRight",
                fill: "#d97706",
                fontSize: 11,
                fontWeight: 600,
              }}
            />
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
