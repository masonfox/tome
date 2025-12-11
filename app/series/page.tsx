"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BookMarked, Library } from "lucide-react";

interface SeriesInfo {
  name: string;
  bookCount: number;
}

export default function SeriesPage() {
  const [series, setSeries] = useState<SeriesInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="text-center py-12">
          <div className="inline-block w-8 h-8 border-4 border-[var(--accent)] border-t-transparent rounded-full animate-spin"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="text-center py-12">
          <p className="text-red-500 font-medium">{error}</p>
        </div>
      </div>
    );
  }

  if (series.length === 0) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-4xl font-serif font-bold text-[var(--heading-text)] mb-2">
            Series
          </h1>
          <p className="text-[var(--subheading-text)] font-medium">
            Browse books organized by series
          </p>
        </div>
        <div className="text-center py-16">
          <Library className="w-16 h-16 mx-auto text-[var(--foreground)]/40 mb-4" />
          <p className="text-[var(--foreground)]/60 font-medium text-lg">No series found in your library</p>
          <p className="text-[var(--foreground)]/40 text-sm mt-2">
            Series information is synced from Calibre
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-serif font-bold text-[var(--heading-text)] mb-2">
          Series
        </h1>
        <p className="text-[var(--subheading-text)] font-medium">
          {series.length} {series.length === 1 ? "series" : "series"} in your library
        </p>
      </div>

      {/* Series Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {series.map((s) => (
          <Link
            key={s.name}
            href={`/series/${encodeURIComponent(s.name)}`}
            className="group"
          >
            <div className="bg-[var(--card-bg)] border border-[var(--border-color)] rounded-lg p-6 hover:border-[var(--accent)] hover:shadow-lg transition-all duration-200">
              {/* Icon */}
              <div className="mb-4">
                <div className="w-12 h-12 bg-[var(--accent)]/10 rounded-lg flex items-center justify-center group-hover:bg-[var(--accent)]/20 transition-colors">
                  <BookMarked className="w-6 h-6 text-[var(--accent)]" />
                </div>
              </div>
              
              {/* Series Name */}
              <h2 className="text-lg font-semibold text-[var(--heading-text)] mb-2 line-clamp-2 group-hover:text-[var(--accent)] transition-colors">
                {s.name}
              </h2>
              
              {/* Book Count */}
              <p className="text-sm text-[var(--foreground)]/60 font-medium">
                {s.bookCount} {s.bookCount === 1 ? "book" : "books"}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
