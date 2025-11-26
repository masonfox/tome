"use client";

import { cn } from "@/utils/cn";
import { ChevronDown } from "lucide-react";

export type TimePeriod = 7 | 30 | 90 | 180 | "this-year" | "all-time";

interface TimePeriodOption {
  value: TimePeriod;
  label: string;
}

interface TimePeriodFilterProps {
  selected: TimePeriod;
  onChange: (period: TimePeriod) => void;
  disabled?: boolean;
}

export function TimePeriodFilter({
  selected,
  onChange,
  disabled = false,
}: TimePeriodFilterProps) {
  const options: TimePeriodOption[] = [
    { value: 7, label: "7 days" },
    { value: 30, label: "30 days" },
    { value: 90, label: "3 months" },
    { value: 180, label: "6 months" },
    { value: "this-year", label: "This Year" },
    { value: "all-time", label: "All Time" },
  ];

  const selectedOption = options.find((opt) => opt.value === selected);

  return (
    <div className="relative inline-block">
      <select
        value={selected}
        onChange={(e) => {
          const value = e.target.value;
          // Parse numeric values, keep string values as-is
          const period = /^\d+$/.test(value) ? Number(value) : value;
          onChange(period as TimePeriod);
        }}
        disabled={disabled}
        className={cn(
          // Base styles
          "appearance-none px-4 py-2 pr-10 rounded-md font-semibold text-sm",
          "border border-[var(--border-color)] bg-[var(--background)]",
          "text-[var(--foreground)] cursor-pointer transition-colors",
          "focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:ring-offset-2",
          "hover:border-[var(--accent)]",

          // Disabled state
          disabled && "opacity-50 cursor-not-allowed"
        )}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <ChevronDown
        className={cn(
          "absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4",
          "text-[var(--foreground)]/60 pointer-events-none",
          disabled && "opacity-50"
        )}
      />
    </div>
  );
}
