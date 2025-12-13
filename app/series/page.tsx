"use client";

import { useEffect, useState, useMemo } from "react";
import { Library, BookMarked, Search, X } from "lucide-react";
import SeriesCard from "@/components/SeriesCard";
import SeriesCardSkeleton from "@/components/SeriesCardSkeleton";
import { PageHeader } from "@/components/PageHeader";

interface SeriesInfo {
  name: string;
  bookCount: number;
  bookCoverIds: number[];
}

export default function SeriesPage() {
  const [series, setSeries] = useState<SeriesInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  // Filter series based on search query
  const filteredSeries = useMemo(() => {
    if (!searchQuery.trim()) {
      return series;
    }
    
    const query = searchQuery.toLowerCase();
    return series.filter((s) =>
      s.name.toLowerCase().includes(query)
    );
  }, [series, searchQuery]);

  useEffect(() => {
    async function fetchSeries() {
      try {
        const response = await fetch("/api/series");
        
        if (!response.ok) {
          throw new Error("Failed to fetch series");
        }
        
        const data = await response.json();
        setSeries(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load series");
      } finally {
        setLoading(false);
      }
    }

    fetchSeries();
  }, []);

  if (loading) {
    return (
      <>
        <PageHeader
          title="Series"
          subtitle="Browse books organized by series"
          icon={BookMarked}
        />

        {/* Search Bar Skeleton */}
        <div className="mt-6 mb-8">
          <div className="relative max-w-2xl animate-pulse">
            <div className="w-full h-[52px] bg-[var(--card-bg)] border-2 border-[var(--border-color)] rounded-lg"></div>
          </div>
        </div>

        {/* Skeleton Grid - Show 9 skeleton cards in the same grid layout */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 9 }).map((_, index) => (
            <SeriesCardSkeleton key={index} />
          ))}
        </div>
      </>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-red-500 font-medium">{error}</p>
      </div>
    );
  }

  if (series.length === 0) {
    return (
      <>
        <PageHeader
          title="Series"
          subtitle="Browse books organized by series"
          icon={BookMarked}
        />
        <div className="text-center py-16">
          <Library className="w-16 h-16 mx-auto text-[var(--foreground)]/40 mb-4" />
          <p className="text-[var(--foreground)]/60 font-medium text-lg">No series found in your library</p>
          <p className="text-[var(--foreground)]/40 text-sm mt-2">
            Series information is synced from Calibre
          </p>
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Series"
        subtitle={`${series.length} ${series.length === 1 ? "series" : "series"} in your library`}
        icon={BookMarked}
      />

      {/* Search Bar */}
      <div className="mt-6 mb-8">
        <div className="relative max-w-2xl">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--foreground)]/40" />
          <input
            type="text"
            placeholder="Search series..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-10 py-3 bg-[var(--card-bg)] border-2 border-[var(--border-color)] rounded-lg text-[var(--foreground)] placeholder-[var(--foreground)]/50 focus:outline-none focus:border-[var(--accent)] transition-colors"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--foreground)]/40 hover:text-[var(--foreground)] transition-colors"
              aria-label="Clear search"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
        {searchQuery && (
          <p className="mt-2 text-sm text-[var(--foreground)]/60">
            Found {filteredSeries.length} {filteredSeries.length === 1 ? "series" : "series"}
          </p>
        )}
      </div>

      {/* Series Grid */}
      {filteredSeries.length === 0 ? (
        <div className="text-center py-16">
          <Library className="w-16 h-16 mx-auto text-[var(--foreground)]/40 mb-4" />
          <p className="text-[var(--foreground)]/60 font-medium text-lg">
            No series found matching &ldquo;{searchQuery}&rdquo;
          </p>
          <button
            onClick={() => setSearchQuery("")}
            className="mt-4 text-[var(--accent)] hover:text-[var(--light-accent)] font-medium transition-colors"
          >
            Clear search
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredSeries.map((s) => (
            <SeriesCard
              key={s.name}
              name={s.name}
              bookCount={s.bookCount}
              bookCoverIds={s.bookCoverIds}
            />
          ))}
        </div>
      )}
    </>
  );
}
