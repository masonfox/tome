"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { createPortal } from "react-dom";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/Layout/PageHeader";
import { BookOpen, Calendar, ChevronRight, Archive } from "lucide-react";
import { format, parse } from "date-fns";
import Link from "next/link";
import Image from "next/image";
import { JournalArchiveTree } from "@/components/Journal/JournalArchiveTree";
import { JournalArchiveDrawer } from "@/components/Journal/JournalArchiveDrawer";
import { JournalEntryCard } from "@/components/Journal/JournalEntryList";
import { Button } from "@/components/Utilities/Button";
import type { ArchiveNode } from "@/lib/utils/archive-builder";
import { matchesDateKey } from "@/lib/utils/archive-builder";
import { journalApi, type GroupedJournalEntry, type JournalEntry } from "@/lib/api";
import { getCoverUrl } from "@/lib/utils/cover-url";

export default function JournalPage() {
  const [collapsedDates, setCollapsedDates] = useState<Set<string>>(new Set());
  const observerTarget = useRef<HTMLDivElement>(null);

  // Archive-related state
  const [currentVisibleDate, setCurrentVisibleDate] = useState<string | null>(null);
  const [archiveDrawerOpen, setArchiveDrawerOpen] = useState(false);
  const [navigating, setNavigating] = useState(false);
  const [mounted, setMounted] = useState(false);

  const LIMIT = 50;

  // Track if component is mounted for portal
  useEffect(() => {
    setMounted(true);
  }, []);

  // Get timezone from browser
  const timezone = typeof window !== 'undefined' 
    ? Intl.DateTimeFormat().resolvedOptions().timeZone 
    : 'UTC';

  // Fetch journal entries with infinite query
  const {
    data,
    isLoading,
    isFetchingNextPage,
    error,
    fetchNextPage,
    hasNextPage,
  } = useInfiniteQuery({
    queryKey: ['journal-entries', timezone],
    queryFn: async ({ pageParam = 0 }) => {
      return journalApi.listEntries({
        timezone,
        limit: LIMIT,
        skip: pageParam,
      });
    },
    getNextPageParam: (lastPage, allPages) => {
      if (!lastPage.hasMore) return undefined;
      const totalLoaded = allPages.reduce((sum, page) => sum + page.entries.length, 0);
      return totalLoaded;
    },
    initialPageParam: 0,
    staleTime: 30000, // 30 seconds
  });

  // Fetch archive data
  const { data: archiveData = [], isLoading: archiveLoading } = useQuery({
    queryKey: ['journal-archive', timezone],
    queryFn: () => journalApi.getArchive({ timezone }),
    staleTime: 60000, // 1 minute
  });

  // Flatten entries from pages and deduplicate
  const entries = useMemo(() => {
    if (!data) return [];
    
    const entriesMap = new Map<string, GroupedJournalEntry>();
    data.pages.forEach(page => {
      page.entries.forEach((entry: GroupedJournalEntry) => {
        if (!entriesMap.has(entry.date)) {
          entriesMap.set(entry.date, entry);
        }
      });
    });
    
    return Array.from(entriesMap.values());
  }, [data]);

  const total = data?.pages[0]?.total || 0;
  const loading = isLoading;
  const loadingMore = isFetchingNextPage;

  // Ref to track current entries for archive navigation
  const entriesRef = useRef<GroupedJournalEntry[]>([]);

  // Keep entriesRef in sync with entries
  useEffect(() => {
    entriesRef.current = entries;
  }, [entries]);

  const loadMore = useCallback(() => {
    if (isFetchingNextPage || !hasNextPage) return;
    fetchNextPage();
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);

  // Set up intersection observer for infinite scroll
  useEffect(() => {
    const currentTarget = observerTarget.current;
    if (!currentTarget) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasNextPage && !loading && !loadingMore) {
          loadMore();
        }
      },
      { threshold: 0.1 }
    );

    observer.observe(currentTarget);

    return () => {
      if (currentTarget) {
        observer.unobserve(currentTarget);
      }
      observer.disconnect();
    };
  }, [loadMore, hasNextPage, loading, loadingMore]);

  // Archive navigation handler
  const handleArchiveNavigate = useCallback(async (dateKey: string) => {

    try {
      setNavigating(true);

      // Check if we need to load more entries
      let matchingEntry = entriesRef.current.find(entry => matchesDateKey(entry.date, dateKey));

      // If not found and we have more entries, keep loading
      if (!matchingEntry && hasNextPage) {
        // Keep loading until we find the date or run out of entries
        let attempts = 0;
        const maxAttempts = 20;

        while (!matchingEntry && attempts < maxAttempts) {
          attempts++;

          // Load next batch
          await fetchNextPage();

          // Wait for state to update
          await new Promise(resolve => setTimeout(resolve, 200));

          // Check again with updated entries
          matchingEntry = entriesRef.current.find(entry => matchesDateKey(entry.date, dateKey));

          // Check if we've loaded everything
          if (entriesRef.current.length >= total || !hasNextPage) {
            break;
          }
        }
      }

      if (!matchingEntry) {
        return;
      }

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

      // Find the date section to scroll to
      const element = document.querySelector(`[data-date-key="${matchingEntry.date}"]`);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    } finally {
      setNavigating(false);
    }
  }, [collapsedDates, hasNextPage, total, fetchNextPage]);

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
                  <div className="flex flex-col xl:flex-row gap-4 xl:gap-6">
                    {/* Cover Skeleton - with book-like appearance */}
                    <div className="flex-shrink-0 mx-auto xl:mx-0">
                      <div className="w-24 h-36 bg-[var(--background)] border border-[var(--border-color)] rounded overflow-hidden relative">
                        {/* Book spine effect */}
                        <div className="absolute left-2 top-2 bottom-2 w-2 bg-[var(--border-color)] rounded" />
                      </div>
                    </div>
                    
                    {/* Book Info Skeleton */}
                    <div className="flex-1 space-y-4">
                      {/* Title skeleton - with actual text for exact height matching */}
                      <div className="text-center xl:text-left leading-tight">
                        <h3 className="text-lg xl:text-xl font-serif font-bold mb-0.5 leading-tight">
                          <span className="inline-block bg-[var(--background)] border border-[var(--border-color)] rounded h-6 w-48 align-middle"></span>
                        </h3>
                        <p className="text-sm xl:text-base font-serif leading-tight">
                          <span className="inline-block bg-[var(--background)] border border-[var(--border-color)] rounded h-4 w-32 align-middle"></span>
                        </p>
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

      {/* Error message with retry */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
          <p className="text-red-800">{error instanceof Error ? error.message : "Failed to load journal entries"}</p>
          <Button 
            onClick={() => fetchNextPage()}
            variant="tertiary"
            size="sm"
            className="mt-2 text-red-600 hover:text-red-800"
          >
            Retry
          </Button>
        </div>
      )}

      {/* Archive navigation loading overlay - Rendered via Portal to document.body */}
      {mounted && navigating && createPortal(
        <div className="fixed top-0 left-0 right-0 bottom-0 bg-black/50 flex items-center justify-center z-[100]">
          <div className="bg-[var(--card-bg)] rounded-lg p-6 shadow-xl">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 border-4 border-[var(--accent)] border-t-transparent rounded-full animate-spin"></div>
              <p className="text-[var(--foreground)]">Loading journal entries...</p>
            </div>
          </div>
        </div>,
        document.body
      )}

      <div className="xl:grid xl:grid-cols-[1fr_280px] xl:gap-6">
        {/* Main Journal Content */}
        <div className="w-full">
          {entries.map((dayEntry) => {
            const isCollapsed = collapsedDates.has(dayEntry.date);

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
                <h2>
                  {format(parse(dayEntry.date, 'yyyy-MM-dd', new Date()), 'MMM d, yyyy')}
                  <span className="text-[var(--subheading-text)]"> ({format(parse(dayEntry.date, 'yyyy-MM-dd', new Date()), 'EEE')})</span>
                </h2>
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
                          src={getCoverUrl(bookGroup.bookCalibreId, bookGroup.bookLastSynced)}
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
                        className="block hover:text-[var(--accent)] transition-colors text-center xl:text-left leading-tight"
                      >
                        <h3 className="text-lg xl:text-xl font-serif font-bold text-[var(--heading-text)] hover:text-[var(--accent)] transition-colors mb-0.5 leading-tight">
                          {bookGroup.bookTitle}
                        </h3>
                        {bookGroup.bookAuthors.length > 0 && (
                          <p className="text-sm xl:text-base font-serif text-[var(--subheading-text)] leading-tight">
                            {bookGroup.bookAuthors.join(", ")}
                          </p>
                        )}
                      </Link>

                      {/* Progress Entries */}
                        {bookGroup.entries.map((entry, index) => (
                          <JournalEntryCard
                            key={entry.id}
                            entry={{
                              id: entry.id,
                              currentPage: entry.currentPage,
                              currentPercentage: entry.currentPercentage,
                              progressDate: entry.progressDate,
                              notes: entry.notes ?? undefined,
                              pagesRead: entry.pagesRead,
                            }}
                            index={index}
                            totalEntries={bookGroup.entries.length}
                          />
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
          {!hasNextPage && entries.length > 0 && (
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
