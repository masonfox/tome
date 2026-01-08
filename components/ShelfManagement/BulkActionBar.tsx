"use client";

import { Trash2, X } from "lucide-react";
import { cn } from "@/utils/cn";

interface BulkActionBarProps {
  selectedCount: number;
  onDelete: () => void;
  onCancel: () => void;
  loading?: boolean;
  className?: string;
}

export function BulkActionBar({
  selectedCount,
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
      className={cn(
        "fixed bottom-0 left-0 right-0 z-40",
        "bg-[var(--card-bg)]/95 backdrop-blur-sm",
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
          <div className="flex items-center gap-3">
            <button
              onClick={onCancel}
              disabled={loading}
              className={cn(
                "px-4 py-2 text-sm font-medium rounded-lg transition-colors",
                "text-[var(--foreground)] hover:bg-[var(--hover-bg)]",
                "border border-[var(--border-color)]",
                "disabled:opacity-50 disabled:cursor-not-allowed"
              )}
            >
              <span className="flex items-center gap-2">
                <X className="w-4 h-4" />
                Cancel
              </span>
            </button>
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
              {loading ? "Removing..." : "Delete Selected"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
