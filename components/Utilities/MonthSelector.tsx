"use client";

import { ChevronDown, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";

interface MonthSelectorProps {
  year: number;
  selectedMonth: number | null; // null = "All Year", 1-12 = Jan-Dec
  onMonthChange: (month: number | null) => void;
  minYear?: number;
  maxYear?: number;
  onYearChange?: (year: number) => void;
  monthsWithBooks?: number[]; // Array of month numbers (1-12) that have books
  loading?: boolean; // Loading state for when monthsWithBooks is being fetched
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
  monthsWithBooks = [],
  loading = false,
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

  // Check if a month has books
  const hasBooks = (month: number): boolean => {
    return monthsWithBooks.includes(month);
  };

  // Check if a month is available (not future and has books)
  const isMonthAvailable = (month: number): boolean => {
    return !isFutureMonth(month) && hasBooks(month);
  };

  // Find previous month with books (may cross year boundaries)
  const findPreviousMonthWithBooks = (fromMonth: number | null, fromYear: number): { month: number; year: number } | null => {
    let searchMonth = fromMonth || 13; // Start from Dec if "All Year"
    let searchYear = fromYear;

    // Search backward through months
    while (searchYear >= (minYear ?? 1900)) {
      searchMonth--;
      
      if (searchMonth < 1) {
        // Move to previous year
        searchYear--;
        searchMonth = 12;
        
        if (searchYear < (minYear ?? 1900)) {
          return null; // Hit min year boundary
        }
      }

      // Check if this month would have books (we can only know for current year from props)
      if (searchYear === year) {
        if (isMonthAvailable(searchMonth)) {
          return { month: searchMonth, year: searchYear };
        }
      } else {
        // For other years, assume they might have books (year change will trigger re-fetch)
        // Only go to previous year if there are books in the current year or we're searching from "All Year"
        if (searchYear < year) {
          return { month: searchMonth, year: searchYear };
        }
      }

      // Safety check: don't loop forever in the same year
      if (searchYear === year && searchMonth === (fromMonth || 12)) {
        return null; // We've looped back to start
      }
    }

    return null;
  };

  // Find next month with books (may cross year boundaries)
  const findNextMonthWithBooks = (fromMonth: number | null, fromYear: number): { month: number; year: number } | null => {
    let searchMonth = fromMonth || 0; // Start from Jan if "All Year"
    let searchYear = fromYear;

    // Search forward through months
    while (searchYear <= (maxYear ?? 2100)) {
      searchMonth++;
      
      if (searchMonth > 12) {
        // Move to next year
        searchYear++;
        searchMonth = 1;
        
        if (searchYear > (maxYear ?? 2100)) {
          return null; // Hit max year boundary
        }
      }

      // Check if this month is available (not future and has books)
      if (searchYear === year) {
        if (isMonthAvailable(searchMonth)) {
          return { month: searchMonth, year: searchYear };
        }
      } else if (searchYear > year) {
        // For future years, assume they might have books (year change will trigger re-fetch)
        // But only if we're moving forward from current year
        if (!isFutureMonth(searchMonth) || searchYear > currentYear) {
          return { month: searchMonth, year: searchYear };
        }
      }

      // Safety check: don't loop forever in the same year
      if (searchYear === year && searchMonth === (fromMonth || 0)) {
        return null; // We've looped back to start
      }
    }

    return null;
  };

  // Handle previous month navigation
  const handlePrevious = () => {
    if (selectedMonth === null) {
      // "All Year" mode → go to previous year, stay on "All Year"
      if (year > (minYear ?? 1900) && onYearChange) {
        onYearChange(year - 1);
        // selectedMonth stays null - don't call onMonthChange
      }
    } else {
      // Specific month mode → find previous month with books
      const result = findPreviousMonthWithBooks(selectedMonth, year);
      
      if (!result) return; // No previous month available

      if (result.year !== year) {
        // Change year first, then set month
        onYearChange?.(result.year);
        // Month will be set after year change completes
        setTimeout(() => onMonthChange(result.month), 0);
      } else {
        onMonthChange(result.month);
      }
    }
  };

  // Handle next month navigation
  const handleNext = () => {
    if (selectedMonth === null) {
      // "All Year" mode → go to next year, stay on "All Year"
      if (year < (maxYear ?? 2100) && onYearChange) {
        onYearChange(year + 1);
        // selectedMonth stays null - don't call onMonthChange
      }
    } else {
      // Specific month mode → find next month with books
      const result = findNextMonthWithBooks(selectedMonth, year);
      
      if (!result) return; // No next month available

      if (result.year !== year) {
        // Change year first, then set month
        onYearChange?.(result.year);
        // Month will be set after year change completes
        setTimeout(() => onMonthChange(result.month), 0);
      } else {
        onMonthChange(result.month);
      }
    }
  };

  // Determine if previous/next buttons should be disabled
  const isPreviousDisabled = () => {
    if (loading) return true;
    
    if (selectedMonth === null) {
      // "All Year" mode → disable if at min year
      return year <= (minYear ?? 1900);
    } else {
      // Specific month mode → check for previous months with books
      return !findPreviousMonthWithBooks(selectedMonth, year);
    }
  };

  const isNextDisabled = () => {
    if (loading) return true;
    
    if (selectedMonth === null) {
      // "All Year" mode → disable if at max year
      return year >= (maxYear ?? 2100);
    } else {
      // Specific month mode → check for next months with books
      return !findNextMonthWithBooks(selectedMonth, year);
    }
  };

  // Check if a month option should be disabled
  const isMonthDisabled = (monthNumber: number): boolean => {
    return isFutureMonth(monthNumber) || !hasBooks(monthNumber);
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
          className="h-[36px] w-[36px] flex items-center justify-center bg-[var(--card-bg)] border border-[var(--border-color)] rounded-sm hover:border-[var(--foreground)]/30 focus:outline-none focus:outline focus:outline-2 focus:outline-[var(--accent)] focus:outline-offset-2 focus:border-transparent transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:border-[var(--border-color)]"
        >
          {loading ? (
            <Loader2 className="w-4 h-4 text-[var(--foreground)] animate-spin" />
          ) : (
            <ChevronLeft className="w-4 h-4 text-[var(--foreground)]" />
          )}
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
            disabled={loading}
            className="appearance-none h-[36px] bg-[var(--card-bg)] border border-[var(--border-color)] rounded-sm px-4 pr-10 text-[var(--foreground)] font-semibold text-sm hover:border-[var(--foreground)]/30 focus:outline-none focus:outline focus:outline-2 focus:outline-[var(--accent)] focus:outline-offset-2 focus:border-transparent transition-colors cursor-pointer min-w-[140px] disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <option value="all">All Year</option>
            {MONTH_NAMES.map((monthName, index) => {
              const monthNumber = index + 1;
              const disabled = isMonthDisabled(monthNumber);
              return (
                <option
                  key={monthNumber}
                  value={monthNumber}
                  disabled={disabled}
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
          className="h-[36px] w-[36px] flex items-center justify-center bg-[var(--card-bg)] border border-[var(--border-color)] rounded-sm hover:border-[var(--foreground)]/30 focus:outline-none focus:outline focus:outline-2 focus:outline-[var(--accent)] focus:outline-offset-2 focus:border-transparent transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:border-[var(--border-color)]"
        >
          {loading ? (
            <Loader2 className="w-4 h-4 text-[var(--foreground)] animate-spin" />
          ) : (
            <ChevronRight className="w-4 h-4 text-[var(--foreground)]" />
          )}
        </button>
      </div>
    </div>
  );
}
