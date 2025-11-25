"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Legend,
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
  // Format date for display (show MM/DD)
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return `${date.getMonth() + 1}/${date.getDate()}`;
  };

  // Determine if we should show every label or skip some based on data length
  const tickInterval = data.length > 30 ? Math.floor(data.length / 10) : 0;

  // Custom tooltip
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-white dark:bg-gray-800 p-3 border border-gray-300 dark:border-gray-600 rounded shadow-lg">
          <p className="text-sm font-medium">{data.date}</p>
          <p className="text-sm">
            Pages: <span className="font-bold">{data.pagesRead}</span>
          </p>
          <p className="text-sm">
            Status:{" "}
            <span
              className={
                data.thresholdMet ? "text-green-600" : "text-gray-500"
              }
            >
              {data.thresholdMet ? "Goal met" : "Below goal"}
            </span>
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="w-full h-96">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
        >
          <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
          <XAxis
            dataKey="date"
            tickFormatter={formatDate}
            angle={-45}
            textAnchor="end"
            interval={tickInterval}
            height={80}
            tick={{ fontSize: 12 }}
          />
          <YAxis
            label={{
              value: "Pages Read",
              angle: -90,
              position: "insideLeft",
              style: { textAnchor: "middle" },
            }}
            tick={{ fontSize: 12 }}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend
            verticalAlign="top"
            height={36}
            iconType="line"
            wrapperStyle={{ paddingBottom: "10px" }}
          />
          <ReferenceLine
            y={threshold}
            stroke="#ef4444"
            strokeDasharray="3 3"
            strokeWidth={2}
            label={{
              value: `Daily Goal: ${threshold} pages`,
              position: "right",
              fill: "#ef4444",
              fontSize: 12,
            }}
          />
          <Bar
            dataKey="pagesRead"
            fill="#3b82f6"
            name="Pages Read"
            radius={[4, 4, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
