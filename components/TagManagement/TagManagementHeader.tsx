"use client";

import { RefreshCw, Tag } from "lucide-react";
import { cn } from "@/utils/cn";
import { Button } from "@/components/Utilities/Button";

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

        <Button
          onClick={onRefresh}
          disabled={loading}
          variant="primary"
          size="xl"
          icon={<RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />}
          className="mt-3 sm:mt-2"
          title="Refresh tags"
        >
          <span className="hidden sm:inline">Refresh</span>
        </Button>
      </div>

      {/* Settings row */}
      <div className="flex items-center gap-2">
        <label className="flex items-center gap-2 cursor-pointer text-sm text-[var(--foreground)]/70 hover:text-[var(--foreground)] transition-colors">
          <input
            type="checkbox"
            checked={confirmRemoval}
            onChange={(e) => onConfirmRemovalChange(e.target.checked)}
            className="w-4 h-4 rounded border-[var(--border-color)] focus:ring-2 focus:ring-[var(--accent)] focus:ring-offset-0 cursor-pointer"
            style={{ accentColor: 'var(--accent)' }}
          />
          <span>Confirm before removing tags from books</span>
        </label>
      </div>
    </div>
  );
}
