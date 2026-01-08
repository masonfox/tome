"use client";

import { useMemo, useState, useEffect } from "react";
import { startOfWeek, endOfWeek, eachDayOfInterval, format, parseISO, getMonth } from "date-fns";

interface DailyReading {
  date: string;
  pagesRead: number;
  thresholdMet: boolean;
}

interface StreakHeatmapProps {
  data: DailyReading[];
  threshold: number;
}

interface WeekDay {
  date: Date;
  pagesRead: number;
  thresholdMet: boolean;
  isEmpty: boolean;
}

interface TooltipData {
  x: number;
  y: number;
  date: Date;
  pagesRead: number;
  thresholdMet: boolean;
}

// Calculate intensity level (0-4) based on pages read
function calculateIntensityLevel(pagesRead: number, maxPages: number): number {
  if (pagesRead === 0) return 0;
  if (maxPages === 0) return 1; // Avoid division by zero

  const percentage = pagesRead / maxPages;
  if (percentage <= 0.25) return 1;
  if (percentage <= 0.50) return 2;
  if (percentage <= 0.75) return 3;
  return 4;
}

// Get color for intensity level (supports light/dark mode)
function getColorForLevel(level: number, theme: 'light' | 'dark'): string | null {
  if (level === 0) return null; // Will use CSS variable for empty state

  // Light mode colors (GitHub-style greens)
  const lightColors = [
    null,                  // 0: empty (handled separately)
    'rgb(134, 239, 172)',  // 1: green-300
    'rgb(74, 222, 128)',   // 2: green-400
    'rgb(34, 197, 94)',    // 3: green-500
    'rgb(22, 163, 74)',    // 4: green-600
  ];

  // Dark mode colors (darker green variants)
  const darkColors = [
    null,                  // 0: empty (handled separately)
    'rgb(0, 68, 34)',      // 1: dark green-900
    'rgb(22, 101, 52)',    // 2: green-800
    'rgb(21, 128, 61)',    // 3: green-700
    'rgb(22, 163, 74)',    // 4: green-600
  ];

  return theme === 'dark' ? darkColors[level] : lightColors[level];
}

// Group data into week-based grid
function groupByWeeks(data: DailyReading[]): WeekDay[][] {
  // Always show 365 days ending today (like GitHub)
  const today = new Date();
  const oneYearAgo = new Date(today);
  oneYearAgo.setDate(today.getDate() - 364); // 365 days including today

  // Get Sunday of first week and Saturday of last week
  const gridStart = startOfWeek(oneYearAgo, { weekStartsOn: 0 }); // 0 = Sunday
  const gridEnd = endOfWeek(today, { weekStartsOn: 0 });

  // Create map of date -> data for quick lookup
  const dataMap = new Map<string, DailyReading>();
  data.forEach(d => dataMap.set(d.date, d));

  // Generate all days in range
  const allDays = eachDayOfInterval({ start: gridStart, end: gridEnd });

  // Group into weeks (arrays of 7 days)
  const weeks: WeekDay[][] = [];
  for (let i = 0; i < allDays.length; i += 7) {
    const week = allDays.slice(i, i + 7).map(date => {
      const dateStr = format(date, 'yyyy-MM-dd');
      const reading = dataMap.get(dateStr);

      return {
        date,
        pagesRead: reading?.pagesRead || 0,
        thresholdMet: reading?.thresholdMet || false,
        isEmpty: !reading,
      };
    });
    weeks.push(week);
  }

  return weeks;
}

export function StreakHeatmap({ data, threshold }: StreakHeatmapProps) {
  const [tooltip, setTooltip] = useState<TooltipData | null>(null);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  // Detect theme on mount and when it changes
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const htmlElement = document.documentElement;
      const currentTheme = htmlElement.getAttribute('data-theme') || 'light';
      setTheme(currentTheme as 'light' | 'dark');

      // Watch for theme changes
      const observer = new MutationObserver(() => {
        const newTheme = htmlElement.getAttribute('data-theme') || 'light';
        setTheme(newTheme as 'light' | 'dark');
      });

      observer.observe(htmlElement, { attributes: true, attributeFilter: ['data-theme'] });

      return () => observer.disconnect();
    }
  }, []);

  // Transform data into week grid
  const weeks = useMemo(() => groupByWeeks(data), [data]);

  // Calculate max pages for intensity scaling
  const maxPages = useMemo(
    () => Math.max(...data.map(d => d.pagesRead), 1),
    [data]
  );

  // Cell dimensions (in pixels)
  const cellSize = 11;
  const gap = 4;
  const labelOffsetX = 32;
  const labelOffsetY = 16;

  // Calculate grid dimensions
  const gridWidth = weeks.length * (cellSize + gap) - gap;
  const gridHeight = 7 * (cellSize + gap) - gap;
  const totalWidth = gridWidth + labelOffsetX + 4;
  const totalHeight = gridHeight + labelOffsetY + 4;

  // Month labels: show month name above first week of each month
  const monthLabels = useMemo(() => {
    if (weeks.length === 0) return [];

    const labels: { month: string; weekIndex: number }[] = [];
    let currentMonth = -1;

    weeks.forEach((week, weekIndex) => {
      const firstDay = week[0];
      const month = getMonth(firstDay.date);

      if (month !== currentMonth) {
        labels.push({
          month: format(firstDay.date, 'MMM'),
          weekIndex,
        });
        currentMonth = month;
      }
    });

    return labels;
  }, [weeks]);

  // Day labels (Mon, Wed, Fri)
  const dayLabels = ['Mon', 'Wed', 'Fri'];
  const dayIndices = [1, 3, 5]; // Monday = 1, Wednesday = 3, Friday = 5

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-32 text-[var(--foreground)]/60">
        <p>No reading activity data available</p>
      </div>
    );
  }

  return (
    <div className="relative flex flex-col md:items-center">
      <div className="overflow-x-auto">
        <svg
          width={totalWidth}
          height={totalHeight}
          className="min-w-full"
          role="img"
          aria-label="Daily reading activity heatmap"
        >
        {/* Month labels */}
        {monthLabels.map(({ month, weekIndex }) => (
          <text
            key={`month-${weekIndex}`}
            x={labelOffsetX + weekIndex * (cellSize + gap)}
            y={10}
            fontSize="9"
            fill="currentColor"
            className="text-[var(--foreground)]"
            opacity="0.6"
          >
            {month}
          </text>
        ))}

        {/* Day labels */}
        {dayLabels.map((label, i) => (
          <text
            key={`day-${i}`}
            x={26}
            y={labelOffsetY + dayIndices[i] * (cellSize + gap) + cellSize / 2 + 3}
            fontSize="8"
            fill="currentColor"
            className="text-[var(--foreground)]"
            opacity="0.5"
            textAnchor="end"
          >
            {label}
          </text>
        ))}

        {/* Heatmap grid */}
        {weeks.map((week, weekIndex) =>
          week.map((day, dayIndex) => {
            const level = calculateIntensityLevel(day.pagesRead, maxPages);
            const color = getColorForLevel(level, theme);
            const x = labelOffsetX + weekIndex * (cellSize + gap);
            const y = labelOffsetY + dayIndex * (cellSize + gap);

            return (
              <rect
                key={`cell-${weekIndex}-${dayIndex}`}
                x={x}
                y={y}
                width={cellSize}
                height={cellSize}
                fill={color || 'var(--background)'}
                stroke={level === 0 ? 'var(--border-color)' : 'none'}
                strokeWidth={level === 0 ? 0.5 : 0}
                rx={1.5}
                className="transition-all hover:opacity-75 hover:stroke-[var(--accent)] hover:stroke-1 cursor-pointer"
                onMouseEnter={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  setTooltip({
                    x: rect.left + rect.width / 2,
                    y: rect.top - 10,
                    date: day.date,
                    pagesRead: day.pagesRead,
                    thresholdMet: day.thresholdMet,
                  });
                }}
                onMouseLeave={() => setTooltip(null)}
              />
            );
          })
        )}
        </svg>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-2 mt-3 text-xs text-[var(--foreground)]/70">
        <span>Less</span>
        {[0, 1, 2, 3, 4].map((level) => {
          const color = getColorForLevel(level, theme);
          return (
            <div
              key={level}
              className="w-3 h-3 rounded-sm border"
              style={{
                backgroundColor: color || 'var(--background)',
                borderColor: level === 0 ? 'var(--border-color)' : 'transparent'
              }}
            />
          );
        })}
        <span>More</span>
      </div>

      {/* Tooltip */}
      {tooltip && (
        <div
          className="fixed z-50 bg-[var(--card-bg)] border border-[var(--border-color)] rounded-md shadow-lg px-3 py-2 pointer-events-none"
          style={{
            left: tooltip.x,
            top: tooltip.y,
            transform: 'translate(-50%, -100%)',
          }}
        >
          <p className="text-sm font-semibold text-[var(--heading-text)] whitespace-nowrap">
            {format(tooltip.date, 'MMM d, yyyy')}
          </p>
          <p className="text-sm text-[var(--foreground)] mt-1">
            Pages: <span className="font-bold">{tooltip.pagesRead}</span>
          </p>
          <p className="text-sm text-[var(--foreground)] mt-1">
            Status:{' '}
            <span
              className={
                tooltip.thresholdMet
                  ? 'text-[var(--accent)] font-semibold'
                  : 'text-[var(--foreground)]/60'
              }
            >
              {tooltip.thresholdMet ? 'Goal met' : 'Below goal'}
            </span>
          </p>
        </div>
      )}
    </div>
  );
}
