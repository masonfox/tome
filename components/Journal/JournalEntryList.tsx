"use client";

import { useState } from "react";
import { Calendar, ChevronRight, Pencil, FileText, Plus, TrendingUp } from "lucide-react";
import { format, parse } from "date-fns";
import MarkdownRenderer from "@/components/MarkdownRenderer";

export interface JournalEntry {
  id: number;
  currentPage: number;
  currentPercentage: number;
  progressDate: string;
  notes?: string;
  pagesRead: number;
}

interface JournalEntryListProps {
  entries: JournalEntry[];
  onEdit?: (entry: JournalEntry) => void;
  title?: string;
  emptyMessage?: string;
  showTitle?: boolean;
}

export function JournalEntryList({
  entries,
  onEdit,
  title = "Journal",
  emptyMessage = "No entries yet",
  showTitle = true,
}: JournalEntryListProps) {
  const [collapsedDates, setCollapsedDates] = useState<Set<string>>(new Set());

  // Group entries by date
  const groupedByDate = entries.reduce((acc, entry) => {
    // Parse ISO timestamp and extract LOCAL calendar date using date-fns
    // For Tokyo user with "2025-01-07T15:00:00.000Z":
    // - new Date() creates Date object for that moment in time
    // - format() extracts date in LOCAL timezone (browser timezone)
    // - In Tokyo: Jan 8 00:00 → dateKey = "2025-01-08" ✅
    const dateKey = format(new Date(entry.progressDate), 'yyyy-MM-dd');
    if (!acc[dateKey]) {
      acc[dateKey] = [];
    }
    acc[dateKey].push(entry);
    return acc;
  }, {} as Record<string, JournalEntry[]>);

  const sortedDates = Object.keys(groupedByDate).sort((a, b) => b.localeCompare(a)); // Most recent first

  const toggleDate = (dateKey: string) => {
    setCollapsedDates(prev => {
      const next = new Set(prev);
      if (next.has(dateKey)) {
        next.delete(dateKey);
      } else {
        next.add(dateKey);
      }
      return next;
    });
  };

  return (
    <div>
      {showTitle && (
        <h3 className="text-2xl font-serif font-bold text-[var(--heading-text)] mb-6">
          {title}
        </h3>
      )}

      {entries.length === 0 ? (
        <p className="text-sm text-[var(--foreground)]/60 italic">
          {emptyMessage}
        </p>
      ) : (
        <div className="space-y-6">
          {sortedDates.map((dateKey) => {
            const dateEntries = groupedByDate[dateKey];
            const isCollapsed = collapsedDates.has(dateKey);

            return (
              <div key={dateKey}>
                {/* Date Header - Clickable */}
                <button
                  onClick={() => toggleDate(dateKey)}
                  className="flex items-center gap-2 text-[var(--heading-text)] font-semibold text-lg hover:text-[var(--accent)] transition-colors cursor-pointer w-full text-left mb-4"
                >
                  <span 
                    className="transition-transform duration-200" 
                    style={{ transform: isCollapsed ? 'rotate(0deg)' : 'rotate(90deg)' }}
                  >
                    <ChevronRight className="w-5 h-5" />
                  </span>
                  <Calendar className="w-5 h-5" />
                  <h4>
                    {format(parse(dateKey, 'yyyy-MM-dd', new Date()), 'MMM d, yyyy')}
                    <span className="text-[var(--subheading-text)]"> ({format(parse(dateKey, 'yyyy-MM-dd', new Date()), 'EEE')})</span>
                  </h4>
                </button>

                {/* Entries for this date */}
                {!isCollapsed && (
                  <div className="ml-2 md:ml-6 space-y-6">
                    {dateEntries.map((entry, index) => (
                      <JournalEntryCard
                        key={entry.id}
                        entry={entry}
                        index={index}
                        totalEntries={dateEntries.length}
                        onEdit={onEdit}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

interface JournalEntryCardProps {
  entry: JournalEntry;
  index: number;
  totalEntries: number;
  onEdit?: (entry: JournalEntry) => void;
}

export function JournalEntryCard({ entry, index, totalEntries, onEdit }: JournalEntryCardProps) {
  return (
    <div
      className="relative p-4 xl:p-5 bg-[var(--background)] border border-[var(--border-color)] rounded-lg transition-all duration-200 hover:shadow-md hover:border-[var(--accent)]/30"
    >
      {/* Entry number badge (only show if multiple entries on same day) */}
      {totalEntries > 1 && (
        <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-[var(--accent)]/10 flex items-center justify-center">
          <span className="text-xs font-bold text-[var(--subheading-text)]">
            {index + 1}
          </span>
        </div>
      )}

      {/* Edit button */}
      {onEdit && (
        <button
          onClick={() => onEdit(entry)}
          className={`absolute top-2 ${totalEntries > 1 ? 'right-10' : 'right-2'} p-1.5 text-[var(--accent)] hover:bg-[var(--accent)]/5 rounded transition-colors`}
          title="Edit progress entry"
        >
          <Pencil className="w-4 h-4" />
        </button>
      )}

      {/* Metadata grid */}
      <div className={`grid grid-cols-1 md:grid-cols-3 gap-4 md:divide-x divide-[var(--border-color)] ${entry.notes ? 'mb-4 pb-4 border-b border-[var(--border-color)]' : ''}`}>
        {/* Percentage */}
        <div className="flex items-center gap-2 md:justify-center md:pr-4">
          <div className="w-8 h-8 rounded-full bg-[var(--accent)]/10 flex items-center justify-center flex-shrink-0">
            <TrendingUp className="w-4 h-4 text-[var(--accent)]" />
          </div>
          <div className="min-w-0">
            <div className="text-xs text-[var(--subheading-text)] font-medium">Progress</div>
            <div className="text-sm font-mono font-bold text-[var(--heading-text)]">
              {Math.round(entry.currentPercentage)}%
            </div>
          </div>
        </div>

        {/* Current Page */}
        <div className="flex items-center gap-2 md:justify-center md:px-4">
          <div className="w-8 h-8 rounded-full bg-[var(--accent)]/10 flex items-center justify-center flex-shrink-0">
            <FileText className="w-4 h-4 text-[var(--accent)]" />
          </div>
          <div className="min-w-0">
            <div className="text-xs text-[var(--subheading-text)] font-medium">Page</div>
            <div className="text-sm font-semibold text-[var(--heading-text)]">
              {entry.currentPage}
            </div>
          </div>
        </div>

        {/* Pages Read */}
        {entry.pagesRead > 0 && (
          <div className="flex items-center gap-2 md:justify-center md:pl-4">
            <div className="w-8 h-8 rounded-full bg-[var(--accent)]/10 flex items-center justify-center flex-shrink-0">
              <Plus className="w-4 h-4 text-[var(--accent)]" />
            </div>
            <div className="min-w-0">
              <div className="text-xs text-[var(--subheading-text)] font-medium">Read</div>
              <div className="text-sm font-semibold text-[var(--heading-text)]">
                {entry.pagesRead} pages
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Notes section */}
      {entry.notes && (
        <MarkdownRenderer content={entry.notes} />
      )}
    </div>
  );
}
