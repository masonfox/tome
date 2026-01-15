"use client";

/**
 * BookListControls Component
 * 
 * Shared filter and control UI for book list views (shelves, read-next, etc.)
 * Handles search/filter input, select mode toggle, and optional sort controls.
 * 
 * Extracts common UI patterns from /shelves/[id] and /read-next pages.
 */

import { Search, X, ArrowUp, ArrowDown } from "lucide-react";
import { cn } from "@/utils/cn";

interface BookListControlsProps {
  // Filter props
  filterText: string;
  onFilterChange: (value: string) => void;
  onClearFilter: () => void;
  filterPlaceholder?: string;

  // Select mode props
  isSelectMode: boolean;
  onToggleSelectMode: () => void;
  selectButtonText?: { active: string; inactive: string };

  // Sort controls (optional - only for shelves)
  showSortControls?: boolean;
  sortBy?: string;
  sortDirection?: "asc" | "desc";
  onSortChange?: (sortBy: string) => void;
  onDirectionToggle?: () => void;
  sortOptions?: Array<{ value: string; label: string }>;

  // Results count
  totalCount: number;
  filteredCount: number;
  itemName?: string; // "books", "items", etc.
}

export function BookListControls({
  filterText,
  onFilterChange,
  onClearFilter,
  filterPlaceholder = "Filter by title, author, or series...",
  isSelectMode,
  onToggleSelectMode,
  selectButtonText = { active: "Cancel", inactive: "Select" },
  showSortControls = false,
  sortBy,
  sortDirection = "asc",
  onSortChange,
  onDirectionToggle,
  sortOptions = [],
  totalCount,
  filteredCount,
  itemName = "books",
}: BookListControlsProps) {
  const itemWord = totalCount === 1 ? itemName.replace(/s$/, "") : itemName;

  return (
    <div className="mb-6">
      {/* Filter Input with Select Button */}
      <div className="flex gap-3 mb-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--foreground)]/40" />
          <input
            type="text"
            placeholder={filterPlaceholder}
            value={filterText}
            onChange={(e) => onFilterChange(e.target.value)}
            className={cn(
              "w-full pl-10 py-2 bg-[var(--card-bg)] border border-[var(--border-color)] rounded-lg",
              "text-[var(--foreground)] placeholder:text-[var(--foreground)]/50",
              "focus:outline-none focus:ring-2 focus:ring-[var(--accent)]",
              filterText ? "pr-10" : "pr-4"
            )}
          />
          {filterText && (
            <button
              type="button"
              onClick={onClearFilter}
              className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--foreground)]/40 hover:text-[var(--foreground)] transition-colors"
              aria-label="Clear filter"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Select/Cancel Button */}
        <button
          onClick={onToggleSelectMode}
          className={cn(
            "px-4 py-2 rounded-lg font-medium transition-colors whitespace-nowrap",
            isSelectMode
              ? "bg-[var(--card-bg)] text-[var(--foreground)] border border-[var(--border-color)] hover:bg-[var(--hover-bg)]"
              : "bg-[var(--accent)] text-white hover:bg-[var(--light-accent)]"
          )}
        >
          {isSelectMode ? selectButtonText.active : selectButtonText.inactive}
        </button>
      </div>

      {/* Sort Controls - Only show on mobile when NOT in select mode and when enabled */}
      {showSortControls && !isSelectMode && sortBy && onSortChange && onDirectionToggle && (
        <div className="flex gap-2 mt-2 lg:hidden">
          {/* Sort By Dropdown */}
          <div className="flex-1">
            <select
              value={sortBy}
              onChange={(e) => onSortChange(e.target.value)}
              className="w-full h-[42px] px-3 py-2 bg-[var(--card-bg)] border border-[var(--border-color)] rounded-lg text-[var(--foreground)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
            >
              {sortOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          {/* Direction Toggle Button */}
          <button
            onClick={onDirectionToggle}
            className="h-[42px] px-3 bg-[var(--card-bg)] border border-[var(--border-color)] rounded-lg text-[var(--foreground)] transition-colors flex items-center justify-center"
            aria-label={sortDirection === "asc" ? "Sort ascending" : "Sort descending"}
          >
            {sortDirection === "asc" ? (
              <ArrowUp className="w-5 h-5" />
            ) : (
              <ArrowDown className="w-5 h-5" />
            )}
          </button>
        </div>
      )}

      {/* Filter Results Count */}
      {filterText && (
        <p className="text-sm text-[var(--foreground)]/60 mt-2">
          Showing {filteredCount} of {totalCount} {itemWord}
        </p>
      )}
    </div>
  );
}
