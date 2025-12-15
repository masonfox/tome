"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { PageHeader } from "@/components/PageHeader";
import { BookOpen, Calendar, ChevronDown, ChevronRight, FileText, Plus, TrendingUp, Archive } from "lucide-react";
import { formatDateOnly } from "@/utils/dateFormatting";
import { format, parse } from "date-fns";
import dynamic from "next/dynamic";
import "@uiw/react-markdown-preview/markdown.css";
import Link from "next/link";
import Image from "next/image";
import { JournalArchiveTree } from "@/components/JournalArchiveTree";
import { JournalArchiveDrawer } from "@/components/JournalArchiveDrawer";
import type { ArchiveNode } from "@/lib/utils/archive-builder";
import { matchesDateKey, getDateKeys } from "@/lib/utils/archive-builder";

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

  // Archive-related state
  const [archiveData, setArchiveData] = useState<ArchiveNode[]>([]);
  const [archiveLoading, setArchiveLoading] = useState(true);
  const [currentVisibleDate, setCurrentVisibleDate] = useState<string | null>(null);
  const [archiveDrawerOpen, setArchiveDrawerOpen] = useState(false);

  // Ref to track current entries for archive navigation
  const entriesRef = useRef<GroupedJournalEntry[]>([]);

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

  const fetchArchiveData = useCallback(async () => {
    try {
      setArchiveLoading(true);
      const response = await fetch('/api/journal/archive');

      if (!response.ok) {
        throw new Error("Failed to fetch archive data");
      }

      const data = await response.json();
      setArchiveData(data);
    } catch (error) {
      const { getLogger } = require("@/lib/logger");
      getLogger().error({ err: error }, "Error fetching archive data");
    } finally {
      setArchiveLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchJournalEntries(0);
    fetchArchiveData();
  }, [fetchJournalEntries, fetchArchiveData]);

  // Keep entriesRef in sync with entries state
  useEffect(() => {
    entriesRef.current = entries;
  }, [entries]);

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

  // Archive navigation handler
  const handleArchiveNavigate = useCallback(async (dateKey: string) => {
    const { getLogger } = require("@/lib/logger");

    // Check if we need to load more entries (use ref for current value)
    let matchingEntry = entriesRef.current.find(entry => matchesDateKey(entry.date, dateKey));

    // If not found and we have more entries, keep loading
    if (!matchingEntry && hasMore) {
      getLogger().debug({ dateKey, currentEntries: entriesRef.current.length }, "Date not loaded, fetching more entries");

      // Keep loading until we find the date or run out of entries
      let attempts = 0;
      const maxAttempts = 20; // Prevent infinite loops
      let currentSkip = skip;

      while (!matchingEntry && attempts < maxAttempts) {
        attempts++;

        // Load next batch
        const newSkip = currentSkip + LIMIT;
        await fetchJournalEntries(newSkip, true);
        currentSkip = newSkip;

        // Wait for state to update
        await new Promise(resolve => setTimeout(resolve, 200));

        // Check again with updated entries (from ref)
        matchingEntry = entriesRef.current.find(entry => matchesDateKey(entry.date, dateKey));

        getLogger().debug({
          dateKey,
          attempt: attempts,
          totalEntries: entriesRef.current.length,
          found: !!matchingEntry
        }, "Loading more entries");

        // Check if we've loaded everything
        if (entriesRef.current.length >= total || !hasMore) {
          break;
        }
      }
    }

    if (!matchingEntry) {
      getLogger().warn({ dateKey, totalEntries: entriesRef.current.length }, "Date not found after loading all entries");
      return;
    }

    getLogger().debug({ dateKey, matchedDate: matchingEntry.date }, "Found matching entry");

    // Auto-expand the section if it's collapsed BEFORE scrolling
    if (collapsedDates.has(matchingEntry.date)) {
      setCollapsedDates(prev => {
        const next = new Set(prev);
        next.delete(matchingEntry.date);
        return next;
      });

      // Wait a bit for the expand animation to complete
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // Find the date section to scroll to using the actual date from the matching entry
    const element = document.querySelector(`[data-date-key="${matchingEntry.date}"]`);
    if (element) {
      getLogger().debug({ matchedDate: matchingEntry.date }, "Scrolling to element");
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
      getLogger().warn({ dateKey, matchedDate: matchingEntry.date }, "Element not found in DOM");
    }
  }, [collapsedDates, hasMore, skip, total, LIMIT, fetchJournalEntries]);

  // Journal entry skeleton component
  const JournalEntrySkeleton = () => (
    <div className="xl:grid xl:grid-cols-[1fr_280px] xl:gap-6">
      {/* Main Content Skeleton */}
      <div className="space-y-8 mt-1 animate-pulse">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="space-y-4">
            {/* Date Header Skeleton */}
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 bg-[var(--foreground)]/10 rounded" />
              <div className="w-5 h-5 bg-[var(--foreground)]/10 rounded" />
              <div className="h-6 bg-[var(--foreground)]/10 rounded w-32" />
            </div>

            {/* Book Entry Skeleton */}
            <div className="ml-2 md:ml-6 space-y-6">
              {Array.from({ length: 2 }).map((_, j) => (
                <div
                  key={j}
                  className="bg-[var(--card-bg)] border border-[var(--border-color)] rounded-lg p-4 xl:p-5"
                >
                  {/* Book Header Skeleton */}
                  <div className="flex flex-col xl:flex-row gap-4 xl:gap-6 mb-4">
                    {/* Cover Skeleton */}
                    <div className="flex-shrink-0 w-24 h-36 bg-[var(--foreground)]/10 rounded mx-auto xl:mx-0" />
                    
                    {/* Book Info Skeleton */}
                    <div className="flex-1 space-y-2 text-center xl:text-left">
                      <div className="h-6 bg-[var(--foreground)]/10 rounded w-3/4 mx-auto xl:mx-0" />
                      <div className="h-4 bg-[var(--foreground)]/10 rounded w-1/2 mx-auto xl:mx-0" />
                    </div>
                  </div>

                  {/* Progress Entry Skeleton - 3 columns with dividers */}
                  <div className="p-4 xl:p-5 bg-[var(--background)] border border-[var(--border-color)] rounded">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:divide-x divide-[var(--border-color)]">
                      {/* Column 1 */}
                      <div className="flex items-center gap-2 md:justify-center md:pr-4">
                        <div className="w-8 h-8 bg-[var(--foreground)]/10 rounded-full" />
                        <div className="space-y-1">
                          <div className="h-3 bg-[var(--foreground)]/10 rounded w-12" />
                          <div className="h-4 bg-[var(--foreground)]/10 rounded w-10" />
                        </div>
                      </div>
                      {/* Column 2 */}
                      <div className="flex items-center gap-2 md:justify-center md:px-4">
                        <div className="w-8 h-8 bg-[var(--foreground)]/10 rounded-full" />
                        <div className="space-y-1">
                          <div className="h-3 bg-[var(--foreground)]/10 rounded w-12" />
                          <div className="h-4 bg-[var(--foreground)]/10 rounded w-10" />
                        </div>
                      </div>
                      {/* Column 3 */}
                      <div className="flex items-center gap-2 md:justify-center md:pl-4">
                        <div className="w-8 h-8 bg-[var(--foreground)]/10 rounded-full" />
                        <div className="space-y-1">
                          <div className="h-3 bg-[var(--foreground)]/10 rounded w-16" />
                          <div className="h-4 bg-[var(--foreground)]/10 rounded w-12" />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Archive Panel Skeleton - Desktop Only */}
      <div className="hidden xl:block">
        <div className="sticky top-5 mt-11 bg-[var(--card-bg)] border border-[var(--border-color)] rounded-lg p-4 animate-pulse">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-5 h-5 bg-[var(--foreground)]/10 rounded" />
            <div className="h-6 bg-[var(--foreground)]/10 rounded w-20" />
          </div>
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <div className="h-5 bg-[var(--foreground)]/10 rounded w-16" />
                <div className="ml-4 space-y-1">
                  <div className="h-4 bg-[var(--foreground)]/10 rounded w-20" />
                  <div className="h-4 bg-[var(--foreground)]/10 rounded w-20" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
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

      <div className="xl:grid xl:grid-cols-[1fr_280px] xl:gap-6">
        {/* Main Journal Content */}
        <div className="w-full">
          {entries.map((dayEntry) => {
            const isCollapsed = collapsedDates.has(dayEntry.date);
            const dateKeys = getDateKeys(dayEntry.date);

            return (
              <div
                key={dayEntry.date}
                className={isCollapsed ? "mb-4" : "mb-8"}
                data-date-key={dayEntry.date}
                data-date-section
              >
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
                  className="bg-[var(--card-bg)] border border-[var(--border-color)] rounded-lg p-4 xl:p-5"
                >
                  <div className="flex flex-col xl:flex-row gap-4 xl:gap-6">
                    {/* Book Cover */}
                    <Link
                      href={`/books/${bookGroup.bookId}`}
                      className="flex-shrink-0 hover:opacity-90 transition-opacity mx-auto xl:mx-0"
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
                    <div className="flex-1 space-y-4">
                      {/* Book Title/Author Header */}
                      <Link
                        href={`/books/${bookGroup.bookId}`}
                        className="block hover:text-[var(--accent)] transition-colors text-center xl:text-left"
                      >
                        <h3 className="text-lg xl:text-xl font-serif font-bold text-[var(--heading-text)] hover:text-[var(--accent)] transition-colors mb-1">
                          {bookGroup.bookTitle}
                        </h3>
                        {bookGroup.bookAuthors.length > 0 && (
                          <p className="text-sm xl:text-base font-serif text-[var(--subheading-text)]">
                            {bookGroup.bookAuthors.join(", ")}
                          </p>
                        )}
                      </Link>

                      {/* Progress Entries */}
                        {bookGroup.entries.map((entry, index) => (
                          <div
                            key={entry.id}
                            className="relative p-4 xl:p-5 bg-[var(--background)] border border-[var(--border-color)] rounded-lg transition-all duration-200 hover:shadow-md hover:border-[var(--accent)]/30"
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

        {/* Archive Tree - Desktop Only */}
        <div className="hidden xl:block">
          <JournalArchiveTree
            archiveData={archiveData}
            currentDateRange={currentVisibleDate}
            onNavigate={handleArchiveNavigate}
            loading={archiveLoading}
          />
        </div>
      </div>

      {/* Mobile/Tablet Archive Button - Floating Action Button */}
      <button
        onClick={() => setArchiveDrawerOpen(true)}
        className="xl:hidden fixed bottom-32 md:bottom-6 right-4 z-40 w-14 h-14 rounded-full bg-[var(--accent)] text-white shadow-lg flex items-center justify-center hover:scale-110 transition-transform"
        aria-label="Open archive navigation"
      >
        <Archive className="w-6 h-6" />
      </button>

      {/* Mobile Archive Drawer */}
      <JournalArchiveDrawer
        isOpen={archiveDrawerOpen}
        onClose={() => setArchiveDrawerOpen(false)}
        archiveData={archiveData}
        currentDateRange={currentVisibleDate}
        onNavigate={handleArchiveNavigate}
        loading={archiveLoading}
      />
    </div>
  );
}
