"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { PageHeader } from "@/components/PageHeader";
import { BookOpen, Calendar, ChevronDown, ChevronRight, FileText, Plus, Clock, TrendingUp } from "lucide-react";
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
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [total, setTotal] = useState(0);
  const [skip, setSkip] = useState(0);
  const [collapsedDates, setCollapsedDates] = useState<Set<string>>(new Set());
  const observerTarget = useRef<HTMLDivElement>(null);
  
  const LIMIT = 50;

  const fetchJournalEntries = useCallback(async (skipCount: number, append = false) => {
    try {
      if (append) {
        setLoadingMore(true);
      } else {
        setLoading(true);
      }
      
      // TODO: Get timezone from user settings/detect from browser
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const response = await fetch(
        `/api/journal?timezone=${encodeURIComponent(timezone)}&limit=${LIMIT}&skip=${skipCount}`
      );
      
      if (!response.ok) {
        throw new Error("Failed to fetch journal entries");
      }

      const data = await response.json();
      
      if (append) {
        setEntries((prev) => [...prev, ...data.entries]);
      } else {
        setEntries(data.entries);
      }
      
      setTotal(data.total);
      setHasMore(data.hasMore);
    } catch (error) {
      const { getLogger } = require("@/lib/logger");
      getLogger().error({ err: error }, "Error fetching journal entries");
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    fetchJournalEntries(0);
  }, [fetchJournalEntries]);

  const loadMore = useCallback(() => {
    if (loadingMore || !hasMore) return;
    
    const newSkip = skip + LIMIT;
    setSkip(newSkip);
    fetchJournalEntries(newSkip, true);
  }, [skip, loadingMore, hasMore, fetchJournalEntries]);

  // Set up intersection observer for infinite scroll
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loading && !loadingMore) {
          loadMore();
        }
      },
      { threshold: 0.1 }
    );

    if (observerTarget.current) {
      observer.observe(observerTarget.current);
    }

    return () => observer.disconnect();
  }, [loadMore, hasMore, loading, loadingMore]);

  // Journal entry skeleton component
  const JournalEntrySkeleton = () => (
    <div className="space-y-8 mt-6 animate-pulse">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="space-y-4">
          {/* Date Header Skeleton */}
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 bg-[var(--foreground)]/10 rounded" />
            <div className="h-6 bg-[var(--foreground)]/10 rounded w-32" />
          </div>

          {/* Book Entry Skeleton */}
          <div className="ml-6 space-y-6">
            {Array.from({ length: 2 }).map((_, j) => (
              <div
                key={j}
                className="bg-[var(--card-bg)] border border-[var(--border-color)] rounded-lg p-5"
              >
                {/* Book Header Skeleton */}
                <div className="flex gap-4 mb-4">
                  {/* Cover Skeleton */}
                  <div className="flex-shrink-0 w-16 h-24 bg-[var(--foreground)]/10 rounded" />
                  
                  {/* Book Info Skeleton */}
                  <div className="flex-1 space-y-2">
                    <div className="h-6 bg-[var(--foreground)]/10 rounded w-3/4" />
                    <div className="h-4 bg-[var(--foreground)]/10 rounded w-1/2" />
                  </div>
                </div>

                {/* Progress Entry Skeleton */}
                <div className="p-4 bg-[var(--background)] border border-[var(--border-color)] rounded space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-4 bg-[var(--foreground)]/10 rounded w-12" />
                      <div className="h-4 bg-[var(--foreground)]/10 rounded w-16" />
                    </div>
                    <div className="h-3 bg-[var(--foreground)]/10 rounded w-12" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );

  if (loading) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Journal"
          subtitle="Your reading progress across all books"
          icon={BookOpen}
        />
        <JournalEntrySkeleton />
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="space-y-6">
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
    <div className="space-y-6">
      <PageHeader
        title="Journal"
        subtitle="Your reading progress across all books"
        icon={BookOpen}
      />

      <div>
        {entries.map((dayEntry) => {
          const isCollapsed = collapsedDates.has(dayEntry.date);
          
          return (
            <div key={dayEntry.date} className={isCollapsed ? "mb-4" : "mb-8"}>
              {/* Date Header - Clickable */}
              <button
                onClick={() => {
                  setCollapsedDates(prev => {
                    const next = new Set(prev);
                    if (next.has(dayEntry.date)) {
                      next.delete(dayEntry.date);
                    } else {
                      next.add(dayEntry.date);
                    }
                    return next;
                  });
                }}
                className="flex items-center gap-2 text-[var(--heading-text)] font-semibold text-lg hover:text-[var(--accent)] transition-colors cursor-pointer w-full text-left mb-4"
              >
                <span className="transition-transform duration-200" style={{ transform: isCollapsed ? 'rotate(0deg)' : 'rotate(90deg)' }}>
                  <ChevronRight className="w-5 h-5" />
                </span>
                <Calendar className="w-5 h-5" />
                <h2>{format(parse(dayEntry.date, 'yyyy-MM-dd', new Date()), 'MMM d, yyyy')}</h2>
              </button>

              {/* Books for this day */}
              <div 
                className="overflow-hidden transition-all duration-300 ease-in-out ml-2 md:ml-6"
                style={{
                  maxHeight: isCollapsed ? '0px' : '10000px',
                  opacity: isCollapsed ? 0 : 1,
                }}
              >
                <div className="space-y-6">
                  {dayEntry.books.map((bookGroup) => (
                <div
                  key={bookGroup.bookId}
                  className="bg-[var(--card-bg)] border border-[var(--border-color)] rounded-lg p-4 md:p-5 max-w-3xl"
                >
                  <div className="flex flex-col md:flex-row gap-4 md:gap-6">
                    {/* Book Cover */}
                    <Link
                      href={`/books/${bookGroup.bookId}`}
                      className="flex-shrink-0 hover:opacity-90 transition-opacity mx-auto md:mx-0"
                    >
                      <div className="w-24 h-36 bg-[var(--light-accent)]/30 rounded overflow-hidden relative">
                        <Image
                          src={`/api/books/${bookGroup.bookCalibreId}/cover`}
                          alt={bookGroup.bookTitle}
                          fill
                          className="object-cover"
                          sizes="96px"
                        />
                      </div>
                    </Link>

                    {/* Book Title/Author + Progress Entries */}
                    <div className="flex-1 max-w-2xl space-y-4">
                      {/* Book Title/Author Header */}
                      <Link
                        href={`/books/${bookGroup.bookId}`}
                        className="block hover:text-[var(--accent)] transition-colors text-center md:text-left"
                      >
                        <h3 className="text-lg md:text-xl font-serif font-bold text-[var(--heading-text)] hover:text-[var(--accent)] transition-colors mb-1">
                          {bookGroup.bookTitle}
                        </h3>
                        {bookGroup.bookAuthors.length > 0 && (
                          <p className="text-sm md:text-base font-serif text-[var(--subheading-text)]">
                            {bookGroup.bookAuthors.join(", ")}
                          </p>
                        )}
                      </Link>

                      {/* Progress Entries */}
                        {bookGroup.entries.map((entry, index) => (
                          <div
                            key={entry.id}
                            className="relative p-4 md:p-5 bg-[var(--background)] border border-[var(--border-color)] rounded-lg transition-all duration-200 hover:shadow-md hover:border-[var(--accent)]/30"
                          >
                            {/* Entry number badge (only show if multiple entries) */}
                            {bookGroup.entries.length > 1 && (
                              <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-[var(--accent)]/10 flex items-center justify-center">
                                <span className="text-xs font-bold text-[var(--subheading-text)]">
                                  {index + 1}
                                </span>
                              </div>
                            )}

                            {/* Metadata grid */}
                            <div className={`grid grid-cols-2 md:grid-cols-4 gap-4 ${entry.notes ? 'mb-4 pb-4 border-b border-[var(--border-color)]' : ''}`}>
                            {/* Percentage */}
                            <div className="flex items-center gap-2">
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
                            <div className="flex items-center gap-2">
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
                              <div className="flex items-center gap-2">
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

                            {/* Time */}
                            <div className="flex items-center gap-2">
                              <div className="w-8 h-8 rounded-full bg-[var(--accent)]/10 flex items-center justify-center flex-shrink-0">
                                <Clock className="w-4 h-4 text-[var(--accent)]" />
                              </div>
                              <div className="min-w-0">
                                <div className="text-xs text-[var(--subheading-text)] font-medium">Time</div>
                                <div className="text-sm font-semibold text-[var(--heading-text)]">
                                  {new Date(entry.progressDate).toLocaleTimeString([], {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })}
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Notes section */}
                          {entry.notes && (
                            <div className="text-sm" data-color-mode="light">
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
                </div>
              ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Loading more indicator */}
      {loadingMore && (
        <div className="text-center py-8">
          <div className="inline-block w-8 h-8 border-4 border-[var(--accent)] border-t-transparent rounded-full animate-spin"></div>
        </div>
      )}

      {/* Infinite scroll trigger */}
      <div ref={observerTarget} className="py-8" />

      {/* End of results message */}
      {!hasMore && entries.length > 0 && (
        <div className="text-center py-8 text-[var(--foreground)]/60">
          You&apos;ve reached the end of your journal entries ({total} total)
        </div>
      )}
    </div>
  );
}
