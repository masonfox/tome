"use client";

import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";

interface MonthSelectorProps {
  year: number;
  selectedMonth: number | null; // null = "All Year", 1-12 = Jan-Dec
  onMonthChange: (month: number | null) => void;
  minYear?: number;
  maxYear?: number;
  onYearChange?: (year: number) => void;
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

export function MonthSelector({
  year,
  selectedMonth,
  onMonthChange,
  minYear,
  maxYear,
  onYearChange,
}: MonthSelectorProps) {
  const currentDate = new Date();
  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth() + 1; // 0-based to 1-based

  // Check if a month is in the future
  const isFutureMonth = (month: number): boolean => {
    if (year > currentYear) return true;
    if (year < currentYear) return false;
    return month > currentMonth;
  };

  // Handle previous month navigation
  const handlePrevious = () => {
    if (!selectedMonth) {
      // From "All Year" -> go to December of this year (or previous year if January)
      if (year > (minYear ?? 1900)) {
        onMonthChange(12);
        onYearChange?.(year - 1);
      }
      return;
    }

    if (selectedMonth === 1) {
      // From January -> go to December of previous year
      if (year > (minYear ?? 1900)) {
        onMonthChange(12);
        onYearChange?.(year - 1);
      }
    } else {
      // Go to previous month in same year
      onMonthChange(selectedMonth - 1);
    }
  };

  // Handle next month navigation
  const handleNext = () => {
    if (!selectedMonth) {
      // From "All Year" -> go to January of next year
      if (year < (maxYear ?? 2100)) {
        onMonthChange(1);
        onYearChange?.(year + 1);
      }
      return;
    }

    if (selectedMonth === 12) {
      // From December -> go to January of next year
      if (year < (maxYear ?? 2100)) {
        onMonthChange(1);
        onYearChange?.(year + 1);
      }
    } else {
      // Go to next month in same year
      const nextMonth = selectedMonth + 1;
      // Don't go to future months
      if (!isFutureMonth(nextMonth)) {
        onMonthChange(nextMonth);
      }
    }
  };

  // Determine if previous/next buttons should be disabled
  const isPreviousDisabled = () => {
    if (!selectedMonth) {
      return year <= (minYear ?? 1900);
    }
    return selectedMonth === 1 && year <= (minYear ?? 1900);
  };

  const isNextDisabled = () => {
    if (!selectedMonth) {
      return year >= (maxYear ?? 2100);
    }
    if (selectedMonth === 12) {
      return year >= (maxYear ?? 2100);
    }
    // Check if next month would be in the future
    return isFutureMonth(selectedMonth + 1);
  };

  return (
    <div className="flex items-center gap-3">
      <label htmlFor="month-select" className="text-sm font-semibold text-[var(--subheading-text)]">
        Month
      </label>
      
      <div className="flex items-center gap-2">
        {/* Previous Month Button */}
        <button
          onClick={handlePrevious}
          disabled={isPreviousDisabled()}
          aria-label="Previous month"
          className="p-2 bg-[var(--card-bg)] border border-[var(--border-color)] rounded-sm hover:border-[var(--foreground)]/30 focus:outline-none focus:outline focus:outline-2 focus:outline-[var(--accent)] focus:outline-offset-2 focus:border-transparent transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:border-[var(--border-color)]"
        >
          <ChevronLeft className="w-4 h-4 text-[var(--foreground)]" />
        </button>

        {/* Month Dropdown */}
        <div className="relative">
          <select
            id="month-select"
            value={selectedMonth ?? "all"}
            onChange={(e) => {
              const value = e.target.value;
              onMonthChange(value === "all" ? null : parseInt(value));
            }}
            className="appearance-none bg-[var(--card-bg)] border border-[var(--border-color)] rounded-sm px-4 py-2 pr-10 text-[var(--foreground)] font-semibold text-sm hover:border-[var(--foreground)]/30 focus:outline-none focus:outline focus:outline-2 focus:outline-[var(--accent)] focus:outline-offset-2 focus:border-transparent transition-colors cursor-pointer min-w-[140px]"
          >
            <option value="all">All Year</option>
            {MONTH_NAMES.map((monthName, index) => {
              const monthNumber = index + 1;
              const isFuture = isFutureMonth(monthNumber);
              return (
                <option
                  key={monthNumber}
                  value={monthNumber}
                  disabled={isFuture}
                >
                  {monthName}
                </option>
              );
            })}
          </select>
          <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-[var(--foreground)]/60 pointer-events-none" />
        </div>

        {/* Next Month Button */}
        <button
          onClick={handleNext}
          disabled={isNextDisabled()}
          aria-label="Next month"
          className="p-2 bg-[var(--card-bg)] border border-[var(--border-color)] rounded-sm hover:border-[var(--foreground)]/30 focus:outline-none focus:outline focus:outline-2 focus:outline-[var(--accent)] focus:outline-offset-2 focus:border-transparent transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:border-[var(--border-color)]"
        >
          <ChevronRight className="w-4 h-4 text-[var(--foreground)]" />
        </button>
      </div>
    </div>
  );
}
