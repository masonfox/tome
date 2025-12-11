"use client";

import { ChevronDown } from "lucide-react";

interface YearSelectorProps {
  years: number[];
  selectedYear: number;
  onYearChange: (year: number) => void;
}

export function YearSelector({ years, selectedYear, onYearChange }: YearSelectorProps) {
  if (years.length === 0) {
    return null;
  }

  return (
    <div className="flex items-center gap-2">
      <label htmlFor="year-select" className="text-sm font-semibold text-[var(--subheading-text)]">
        Year
      </label>
      <div className="relative">
        <select
          id="year-select"
          value={selectedYear}
          onChange={(e) => onYearChange(parseInt(e.target.value))}
          className="appearance-none bg-[var(--card-bg)] border border-[var(--border-color)] rounded-sm px-4 py-2 pr-10 text-[var(--foreground)] font-semibold text-sm hover:border-[var(--foreground)]/30 focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent transition-colors cursor-pointer"
        >
          {years.map((year) => (
            <option key={year} value={year}>
              {year}
            </option>
          ))}
        </select>
        <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-[var(--foreground)]/60 pointer-events-none" />
      </div>
    </div>
  );
}
