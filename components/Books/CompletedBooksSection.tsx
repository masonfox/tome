"use client";

import { useMemo } from "react";
import { BookCheck } from "lucide-react";
import { BookGrid } from "@/components/Books/BookGrid";

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
    completedDate: string; // YYYY-MM-DD format
  }>;
  count: number;
  loading?: boolean;
  selectedMonth?: number | null;
  onMonthChange?: (month: number | null) => void;
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

export function CompletedBooksSection({
  year,
  books,
  count,
  loading = false,
  selectedMonth = null,
  onMonthChange,
}: CompletedBooksSectionProps) {
  // Filter books by selected month
  const filteredBooks = useMemo(() => {
    if (!selectedMonth) return books;
    
    return books.filter(book => {
      if (!book.completedDate) return false;
      const month = parseInt(book.completedDate.split('-')[1], 10);
      return month === selectedMonth;
    });
  }, [books, selectedMonth]);

  const filteredCount = filteredBooks.length;

  // Get display title based on filter
  const displayTitle = useMemo(() => {
    if (selectedMonth) {
      return `Books Read in ${MONTH_NAMES[selectedMonth - 1]} ${year}`;
    }
    return `Books Read in ${year}`;
  }, [selectedMonth, year]);
  return (
    <div className="bg-[var(--card-bg)] border border-[var(--border-color)] rounded-md overflow-hidden">
      {/* Header - Static */}
      <div className="px-6 py-4 border-b border-[var(--border-color)]">
        <div className="flex items-center gap-3">
          <BookCheck className="w-5 h-5 text-[var(--accent)]" />
          <h2 className="text-lg font-semibold text-[var(--foreground)]">
            {displayTitle}
            <span className="ml-2 text-[var(--foreground)]/60 font-normal">
              ({filteredCount})
            </span>
          </h2>
        </div>
      </div>

      {/* Content - Always visible */}
      <div className="px-6 pb-6 pt-6 bg-[var(--card-bg-emphasis)]">
        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block w-8 h-8 border-4 border-[var(--accent)] border-t-transparent rounded-full animate-spin"></div>
            <p className="text-[var(--foreground)]/70 mt-4 font-medium">
              Loading books...
            </p>
          </div>
        ) : filteredCount === 0 ? (
          <div className="py-12 text-center">
            <BookCheck className="w-12 h-12 text-[var(--foreground)]/20 mx-auto mb-4" />
            <p className="text-[var(--foreground)]/70 font-medium">
              {selectedMonth 
                ? `No books read in ${MONTH_NAMES[selectedMonth - 1]}` 
                : "No books read yet this year"}
            </p>
            <p className="text-[var(--foreground)]/50 text-sm mt-2">
              Start reading and mark books as read to see them here!
            </p>
          </div>
        ) : (
          <BookGrid books={filteredBooks} loading={false} />
        )}
      </div>
    </div>
  );
}
