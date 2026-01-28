"use client";

import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";

interface YearSelectorProps {
  years: number[];
  selectedYear: number;
  onYearChange: (year: number) => void;
}

export function YearSelector({ years, selectedYear, onYearChange }: YearSelectorProps) {
  if (years.length === 0) {
    return null;
  }

  const currentIndex = years.indexOf(selectedYear);
  const canGoPrevious = currentIndex < years.length - 1; // Years are sorted descending
  const canGoNext = currentIndex > 0;

  const handlePrevious = () => {
    if (canGoPrevious) {
      onYearChange(years[currentIndex + 1]);
    }
  };

  const handleNext = () => {
    if (canGoNext) {
      onYearChange(years[currentIndex - 1]);
    }
  };

  return (
    <div className="flex items-center justify-center sm:justify-start gap-3">
      <label htmlFor="year-select" className="text-sm font-semibold text-[var(--foreground)]">
        Year
      </label>
      
      <div className="flex items-center gap-2">
        {/* Previous Year Button */}
        <button
          onClick={handlePrevious}
          disabled={!canGoPrevious}
          aria-label="Previous year"
          className="h-[36px] w-[36px] flex items-center justify-center bg-[var(--card-bg)] border border-[var(--border-color)] rounded-md hover:border-[var(--foreground)]/30 focus:outline-none focus:outline focus:outline-2 focus:outline-[var(--accent)] focus:outline-offset-2 focus:border-transparent transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:border-[var(--border-color)]"
        >
          <ChevronLeft className="w-4 h-4 text-[var(--foreground)]" />
        </button>

        {/* Year Dropdown */}
        <div className="relative">
          <select
            id="year-select"
            value={selectedYear}
            onChange={(e) => onYearChange(parseInt(e.target.value))}
            className="appearance-none h-[36px] bg-[var(--card-bg)] border border-[var(--border-color)] rounded-md px-4 pr-10 text-[var(--foreground)] font-semibold text-sm hover:border-[var(--foreground)]/30 focus:outline-none focus:outline focus:outline-2 focus:outline-[var(--accent)] focus:outline-offset-2 focus:border-transparent transition-colors cursor-pointer"
          >
            {years.map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
          <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-[var(--foreground)]/60 pointer-events-none" />
        </div>

        {/* Next Year Button */}
        <button
          onClick={handleNext}
          disabled={!canGoNext}
          aria-label="Next year"
          className="h-[36px] w-[36px] flex items-center justify-center bg-[var(--card-bg)] border border-[var(--border-color)] rounded-md hover:border-[var(--foreground)]/30 focus:outline-none focus:outline focus:outline-2 focus:outline-[var(--accent)] focus:outline-offset-2 focus:border-transparent transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:border-[var(--border-color)]"
        >
          <ChevronRight className="w-4 h-4 text-[var(--foreground)]" />
        </button>
      </div>
    </div>
  );
}
