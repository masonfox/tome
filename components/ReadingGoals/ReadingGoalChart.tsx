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
} from "recharts";

interface MonthlyData {
  month: number;
  count: number;
}

interface ReadingGoalChartProps {
  monthlyData: MonthlyData[];
  onMonthClick?: (month: number) => void;
  selectedMonth?: number | null;
}

// Month names for X-axis (defined outside component to avoid recreating)
const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function ReadingGoalChart({ monthlyData, onMonthClick, selectedMonth }: ReadingGoalChartProps) {
  // Prepare chart data
  const chartData = useMemo(() => {
    return monthlyData.map((item) => ({
      month: monthNames[item.month - 1],
      monthNumber: item.month,
      count: item.count,
    }));
  }, [monthlyData]);

  // Calculate Y-axis domain based on actual data with dynamic rounding
  const maxCount = Math.max(...monthlyData.map(d => d.count), 0);
  const paddedMax = maxCount * 1.2; // Add 20% padding
  
  let yAxisMax: number;
  if (paddedMax <= 15) {
    // For small values (0-15): round to nearest 2, minimum 5
    yAxisMax = Math.max(Math.ceil(paddedMax / 2) * 2, 5);
  } else if (paddedMax <= 50) {
    // For medium values (16-50): round to nearest 5
    yAxisMax = Math.ceil(paddedMax / 5) * 5;
  } else {
    // For large values (51+): round to nearest 20
    yAxisMax = Math.ceil(paddedMax / 20) * 20;
  }

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

  // Handle bar click
  const handleBarClick = (data: any) => {
    if (onMonthClick && data && data.monthNumber) {
      onMonthClick(data.monthNumber);
    }
  };

  // Custom Bar Shape with click handler and hover effect
  const CustomBar = (props: any) => {
    const { x, y, width, height, payload } = props;
    const isSelected = selectedMonth === payload.monthNumber;
    
    return (
      <g>
        <defs>
          <linearGradient id={`barGradient-${payload.monthNumber}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#10b981" stopOpacity={0.8} />
            <stop offset="95%" stopColor="#10b981" stopOpacity={0.3} />
          </linearGradient>
        </defs>
        <rect
          x={x}
          y={y}
          width={width}
          height={height}
          fill={`url(#barGradient-${payload.monthNumber})`}
          stroke={isSelected ? "#059669" : "transparent"}
          strokeWidth={isSelected ? 3 : 0}
          rx={4}
          ry={4}
          style={{ cursor: onMonthClick ? "pointer" : "default" }}
          onClick={() => handleBarClick(payload)}
          className="transition-all hover:opacity-80"
        />
      </g>
    );
  };

  return (
    <div className="w-full h-64 md:h-80">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart
          data={chartData}
          margin={{ top: 20, right: 10, left: 0, bottom: 20 }}
        >
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
            shape={<CustomBar />}
            name="Books Completed"
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
