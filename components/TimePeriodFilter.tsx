"use client";

import { cn } from "@/utils/cn";

export type TimePeriod = 30 | 90 | 365;

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
    { value: 30, label: "Last 30 days" },
    { value: 90, label: "Last 90 days" },
    { value: 365, label: "All time" },
  ];

  return (
    <div className="flex flex-wrap gap-2">
      {options.map((option) => {
        const isActive = selected === option.value;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            disabled={disabled}
            className={cn(
              // Base styles
              "px-4 py-2 rounded-md font-semibold text-sm transition-colors",
              "border focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:ring-offset-2",

              // Active state
              isActive &&
                "bg-[var(--accent)] text-white border-[var(--accent)]",

              // Inactive state
              !isActive &&
                "bg-[var(--background)] text-[var(--foreground)] border-[var(--border-color)] hover:border-[var(--accent)]",

              // Disabled state
              disabled && "opacity-50 cursor-not-allowed"
            )}
            aria-pressed={isActive}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
