"use client";

import { useMemo, ReactNode } from "react";
import { BookCheck } from "lucide-react";
import { BookCard } from "@/components/Books/BookCard";
import { BookCardSkeleton } from "@/components/Books/BookCardSkeleton";

interface CompletedBooksSectionProps {
  year: number;
  books: Array<{
    id: number;
    sessionId: number;
    calibreId: number | null;
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
  monthSelector?: ReactNode;
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
  monthSelector,
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
      return `Read in ${MONTH_NAMES[selectedMonth - 1]} ${year}`;
    }
    return `Read in ${year}`;
  }, [selectedMonth, year]);
  return (
    <div>
      {/* Heading with Icon and Month Selector */}
      <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-6 sm:gap-4 mb-4">
        <h2 className="text-2xl font-serif font-bold text-[var(--heading-text)] flex items-center justify-center sm:justify-start gap-2">
          <BookCheck className="w-6 h-6 text-[var(--accent)]" />
          {displayTitle}
          <span className="text-[var(--accent)]">
            ({filteredCount})
          </span>
        </h2>
        {monthSelector && (
          <div className="flex justify-center sm:justify-end flex-shrink-0">
            {monthSelector}
          </div>
        )}
      </div>

      {/* Books Grid - No Panel */}
      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-8 gap-4">
          {Array.from({ length: 6 }).map((_, index) => (
            <BookCardSkeleton key={index} variant="with-status" />
          ))}
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
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-8 gap-4">
          {filteredBooks.map((book) => (
            <BookCard
              key={book.sessionId}
              id={book.id.toString()}
              title={book.title}
              authors={book.authors}
              status={book.status}
            />
          ))}
        </div>
      )}
    </div>
  );
}
