"use client";

import { useEffect, useState } from "react";
import { Library, BookMarked } from "lucide-react";
import SeriesCard from "@/components/SeriesCard";
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
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <PageHeader
        title="Series"
        subtitle={`${series.length} ${series.length === 1 ? "series" : "series"} in your library`}
        icon={BookMarked}
      />

      {/* Series Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mt-8">
        {series.map((s) => (
          <SeriesCard
            key={s.name}
            name={s.name}
            bookCount={s.bookCount}
            bookCoverIds={s.bookCoverIds}
          />
        ))}
      </div>
    </div>
  );
}
