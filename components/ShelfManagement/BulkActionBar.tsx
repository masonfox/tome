"use client";

import { Trash2, MoveHorizontal, Copy } from "lucide-react";
import { cn } from "@/utils/cn";

interface BulkActionBarProps {
  selectedCount: number;
  onMove?: () => void;
  onCopy?: () => void;
  onDelete: () => void;
  onCancel: () => void;
  loading?: boolean;
  className?: string;
}

export function BulkActionBar({
  selectedCount,
  onMove,
  onCopy,
  onDelete,
  onCancel,
  loading = false,
  className,
}: BulkActionBarProps) {
  if (selectedCount === 0) {
    return null;
  }

  return (
    <div
      id="bulk-action-bar"
      className={cn(
        "fixed bottom-24 md:bottom-0 left-0 right-0 z-30",
        "bg-[var(--card-bg-emphasis)] backdrop-blur-sm",
        "border-t border-[var(--border-color)]",
        "shadow-lg",
        "animate-in slide-in-from-bottom duration-200",
        className
      )}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <div className="flex items-center justify-between gap-4">
          {/* Selected count */}
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-[var(--foreground)]">
              {selectedCount} {selectedCount === 1 ? "book" : "books"} selected
            </span>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={onCancel}
              disabled={loading}
              className={cn(
                "px-4 py-2 text-sm font-medium rounded-lg transition-colors",
                "bg-[var(--card-bg)] text-[var(--foreground)] hover:bg-[var(--hover-bg)]",
                "border border-[var(--border-color)]",
                "disabled:opacity-50 disabled:cursor-not-allowed",
                "flex items-center gap-2"
              )}
            >
              Cancel
            </button>
            {onMove && (
              <button
                onClick={onMove}
                disabled={loading || selectedCount === 0}
                className={cn(
                  "px-4 py-2 text-sm font-medium rounded-lg transition-colors",
                  "bg-[var(--accent)] text-white hover:bg-[var(--light-accent)]",
                  "disabled:opacity-50 disabled:cursor-not-allowed",
                  "flex items-center gap-2"
                )}
              >
                <MoveHorizontal className="w-4 h-4" />
                Move to...
              </button>
            )}
            {onCopy && (
              <button
                onClick={onCopy}
                disabled={loading || selectedCount === 0}
                className={cn(
                  "px-4 py-2 text-sm font-medium rounded-lg transition-colors",
                  "bg-[var(--accent)] text-white hover:bg-[var(--light-accent)]",
                  "disabled:opacity-50 disabled:cursor-not-allowed",
                  "flex items-center gap-2"
                )}
              >
                <Copy className="w-4 h-4" />
                Copy to...
              </button>
            )}
            <button
              onClick={onDelete}
              disabled={loading || selectedCount === 0}
              className={cn(
                "px-4 py-2 text-sm font-medium rounded-lg transition-colors",
                "bg-red-500 text-white hover:bg-red-600",
                "disabled:opacity-50 disabled:cursor-not-allowed",
                "flex items-center gap-2"
              )}
            >
              <Trash2 className="w-4 h-4" />
              {loading ? "Removing..." : "Remove"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
