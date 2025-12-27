"use client";

import { RefreshCw, Tag } from "lucide-react";
import { cn } from "@/utils/cn";

interface TagManagementHeaderProps {
  totalTags: number;
  totalBooks: number;
  loading: boolean;
  onRefresh: () => void;
  confirmRemoval: boolean;
  onConfirmRemovalChange: (value: boolean) => void;
}

export function TagManagementHeader({
  totalTags,
  totalBooks,
  loading,
  onRefresh,
  confirmRemoval,
  onConfirmRemovalChange,
}: TagManagementHeaderProps) {
  return (
    <div className="border-b border-[var(--border-color)] pb-6 space-y-4">
      {/* Header with title and refresh button */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-5xl font-serif font-bold text-[var(--heading-text)] flex items-center gap-3">
            <Tag className="w-8 h-8" />
            Tags
          </h1>
          {loading ? (
            <p className="text-[var(--subheading-text)] mt-2 font-medium">
              <span className="inline-block h-[1.25rem] w-48 bg-[var(--foreground)]/10 rounded animate-pulse align-middle" />
            </p>
          ) : (
            <p className="text-[var(--subheading-text)] mt-2 font-medium">
              {totalTags} {totalTags === 1 ? "tag" : "tags"} across {totalBooks}{" "}
              {totalBooks === 1 ? "book" : "books"}
            </p>
          )}
        </div>

        <button
          onClick={onRefresh}
          disabled={loading}
          className={cn(
            "flex items-center gap-2 px-4 py-2 bg-[var(--accent)] rounded-md text-white hover:bg-[var(--light-accent)] transition-colors font-medium mt-3 sm:mt-2",
            loading && "opacity-50 cursor-not-allowed"
          )}
          title="Refresh tags"
        >
          <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
          <span className="hidden sm:inline">Refresh</span>
        </button>
      </div>

      {/* Settings row */}
      <div className="flex items-center gap-2">
        <label className="flex items-center gap-2 cursor-pointer text-sm text-[var(--foreground)]/70 hover:text-[var(--foreground)] transition-colors">
          <input
            type="checkbox"
            checked={confirmRemoval}
            onChange={(e) => onConfirmRemovalChange(e.target.checked)}
            className="w-4 h-4 rounded border-[var(--border-color)] text-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)] focus:ring-offset-0"
          />
          <span>Confirm before removing tags from books</span>
        </label>
      </div>
    </div>
  );
}
