"use client";

import { useState } from "react";
import { ChevronDown, BookCheck } from "lucide-react";
import { BookGrid } from "@/components/Books/BookGrid";
import { cn } from "@/utils/cn";

interface CompletedBooksSectionProps {
  year: number;
  books: Array<{
    id: number;
    calibreId: number;
    title: string;
    authors: string[];
    coverPath?: string;
    status: string | null;
    tags: string[];
    totalPages?: number;
  }>;
  count: number;
  loading?: boolean;
}

export function CompletedBooksSection({
  year,
  books,
  count,
  loading = false,
}: CompletedBooksSectionProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="bg-[var(--card-bg)] border border-[var(--border-color)] rounded-md overflow-hidden">
      {/* Header - Clickable to expand/collapse */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-6 py-4 flex items-center justify-between hover:bg-[var(--background)] transition-colors"
        disabled={loading}
      >
        <div className="flex items-center gap-3">
          <BookCheck className="w-5 h-5 text-[var(--accent)]" />
          <h2 className="text-lg font-semibold text-[var(--foreground)]">
            Books Read in {year}
            <span className="ml-2 text-[var(--foreground)]/60 font-normal">
              ({count})
            </span>
          </h2>
        </div>
        <ChevronDown
          className={cn(
            "w-5 h-5 text-[var(--foreground)]/60 transition-transform",
            isExpanded && "rotate-180"
          )}
        />
      </button>

      {/* Expandable Content */}
      {isExpanded && (
        <div className="px-6 pb-6 border-t border-[var(--border-color)]">
          {loading ? (
            <div className="text-center py-12">
              <div className="inline-block w-8 h-8 border-4 border-[var(--accent)] border-t-transparent rounded-full animate-spin"></div>
              <p className="text-[var(--foreground)]/70 mt-4 font-medium">
                Loading books...
              </p>
            </div>
          ) : count === 0 ? (
            <div className="py-12 text-center">
              <BookCheck className="w-12 h-12 text-[var(--foreground)]/20 mx-auto mb-4" />
              <p className="text-[var(--foreground)]/70 font-medium">
                No books read yet this year
              </p>
              <p className="text-[var(--foreground)]/50 text-sm mt-2">
                Start reading and mark books as read to see them here!
              </p>
            </div>
          ) : (
            <div className="mt-6">
              <BookGrid books={books} loading={false} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
