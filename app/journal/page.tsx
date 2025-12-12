"use client";

import { useState, useEffect } from "react";
import { PageHeader } from "@/components/PageHeader";
import { BookOpen, Calendar } from "lucide-react";
import { formatDateOnly } from "@/utils/dateFormatting";
import { format, parse } from "date-fns";
import dynamic from "next/dynamic";
import "@uiw/react-markdown-preview/markdown.css";
import Link from "next/link";
import Image from "next/image";

const MarkdownPreview = dynamic(
  () => import("@uiw/react-markdown-preview").then((mod) => mod.default),
  { ssr: false }
);

interface JournalEntry {
  id: number;
  bookId: number;
  bookTitle: string;
  bookAuthors: string[];
  bookCalibreId: number;
  sessionId: number | null;
  currentPage: number;
  currentPercentage: number;
  progressDate: Date;
  notes: string | null;
  pagesRead: number;
}

interface GroupedJournalEntry {
  date: string;
  books: {
    bookId: number;
    bookTitle: string;
    bookAuthors: string[];
    bookCalibreId: number;
    entries: JournalEntry[];
  }[];
}

export default function JournalPage() {
  const [entries, setEntries] = useState<GroupedJournalEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchJournalEntries() {
      try {
        setLoading(true);
        // TODO: Get timezone from user settings/detect from browser
        const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        const response = await fetch(`/api/journal?timezone=${encodeURIComponent(timezone)}`);
        
        if (!response.ok) {
          throw new Error("Failed to fetch journal entries");
        }

        const data = await response.json();
        setEntries(data);
      } catch (error) {
        console.error("Error fetching journal entries:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchJournalEntries();
  }, []);

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-6 max-w-6xl">
        <PageHeader
          title="Journal"
          subtitle="Your reading progress across all books"
          icon={BookOpen}
        />
        <div className="text-center py-12 text-[var(--foreground)]/60">
          Loading journal entries...
        </div>
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="container mx-auto px-4 py-6 max-w-6xl">
        <PageHeader
          title="Journal"
          subtitle="Your reading progress across all books"
          icon={BookOpen}
        />
        <div className="text-center py-12 text-[var(--foreground)]/60">
          No journal entries yet. Start reading to build your journal!
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6 max-w-6xl">
      <PageHeader
        title="Journal"
        subtitle="Your reading progress across all books"
        icon={BookOpen}
      />

      <div className="space-y-8 mt-6">
        {entries.map((dayEntry) => (
          <div key={dayEntry.date} className="space-y-4">
            {/* Date Header */}
            <div className="flex items-center gap-2 text-[var(--heading-text)] font-semibold text-lg">
              <Calendar className="w-5 h-5" />
              <h2>{format(parse(dayEntry.date, 'yyyy-MM-dd', new Date()), 'MMM d, yyyy')}</h2>
            </div>

            {/* Books for this day */}
            <div className="space-y-6 ml-6">
              {dayEntry.books.map((bookGroup) => (
                <div
                  key={bookGroup.bookId}
                  className="bg-[var(--card-bg)] border border-[var(--border-color)] rounded-lg p-5"
                >
                  {/* Book Header with Cover */}
                  <Link
                    href={`/books/${bookGroup.bookId}`}
                    className="flex gap-4 mb-4 hover:text-[var(--accent)] transition-colors group"
                  >
                    {/* Book Cover */}
                    <div className="flex-shrink-0 w-16 h-24 bg-[var(--light-accent)]/30 rounded overflow-hidden relative">
                      <Image
                        src={`/api/books/${bookGroup.bookCalibreId}/cover`}
                        alt={bookGroup.bookTitle}
                        fill
                        className="object-cover group-hover:opacity-90 transition-opacity"
                        sizes="64px"
                      />
                    </div>
                    
                    {/* Book Info */}
                    <div className="flex-1 min-w-0">
                      <h3 className="text-xl font-serif font-bold text-[var(--heading-text)] mb-1 truncate">
                        {bookGroup.bookTitle}
                      </h3>
                      {bookGroup.bookAuthors.length > 0 && (
                        <p className="text-sm text-[var(--foreground)]/70 truncate">
                          by {bookGroup.bookAuthors.join(", ")}
                        </p>
                      )}
                    </div>
                  </Link>

                  {/* Progress Entries */}
                  <div className="space-y-4">
                    {bookGroup.entries.map((entry) => (
                      <div
                        key={entry.id}
                        className="p-4 bg-[var(--background)] border border-[var(--border-color)] rounded"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-3">
                            <span className="text-sm font-mono font-semibold text-[var(--accent)]">
                              {Math.round(entry.currentPercentage)}%
                            </span>
                            <span className="text-sm text-[var(--foreground)]/60">
                              Page {entry.currentPage}
                            </span>
                            {entry.pagesRead > 0 && (
                              <span className="text-sm text-[var(--foreground)]/60">
                                +{entry.pagesRead} pages
                              </span>
                            )}
                          </div>
                          <span className="text-xs text-[var(--foreground)]/50">
                            {new Date(entry.progressDate).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        </div>

                        {entry.notes && (
                          <div className="mt-3 text-sm" data-color-mode="light">
                            <MarkdownPreview
                              source={entry.notes}
                              style={{
                                background: "transparent",
                                color: "var(--foreground)",
                                fontSize: "0.875rem",
                              }}
                            />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
