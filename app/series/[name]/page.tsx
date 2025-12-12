"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, BookOpen, Star, BookMarked } from "lucide-react";
import { cn } from "@/utils/cn";

interface SeriesBook {
  id: number;
  calibreId: number;
  title: string;
  authors: string[];
  seriesIndex: number;
  totalPages?: number;
  rating?: number | null;
  status?: string | null;
  tags: string[];
  description?: string | null;
}

interface SeriesInfo {
  name: string;
  bookCount: number;
}

interface SeriesData {
  series: SeriesInfo;
  books: SeriesBook[];
}

export default function SeriesDetailPage() {
  const params = useParams();
  const seriesName = params?.name ? decodeURIComponent(params.name as string) : "";
  
  const [data, setData] = useState<SeriesData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [imageErrors, setImageErrors] = useState<Record<number, boolean>>({});

  useEffect(() => {
    if (!seriesName) return;

    async function fetchSeriesBooks() {
      try {
        const response = await fetch(`/api/series/${encodeURIComponent(seriesName)}`);
        
        if (!response.ok) {
          if (response.status === 404) {
            setError("Series not found");
          } else {
            throw new Error("Failed to fetch series");
          }
          return;
        }
        
        const seriesData = await response.json();
        setData(seriesData);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load series");
      } finally {
        setLoading(false);
      }
    }

    fetchSeriesBooks();
  }, [seriesName]);

  const handleImageError = (calibreId: number) => {
    setImageErrors(prev => ({ ...prev, [calibreId]: true }));
  };

  const getStatusColor = (status?: string | null) => {
    switch (status) {
      case "reading":
        return "bg-[var(--accent)]/20 text-[var(--accent)] border border-[var(--accent)]/30";
      case "read":
        return "bg-[var(--light-accent)]/30 text-[var(--accent)] border border-[var(--light-accent)]/40";
      case "to-read":
        return "bg-[var(--accent)]/15 text-[var(--accent)] border border-[var(--accent)]/25";
      case "read-next":
        return "bg-[var(--light-accent)]/20 text-[var(--light-accent)] border border-[var(--light-accent)]/30";
      default:
        return "bg-[var(--card-bg)] text-[var(--foreground)]/60 border border-[var(--border-color)]";
    }
  };

  const getStatusLabel = (status?: string | null) => {
    switch (status) {
      case "reading":
        return "Reading";
      case "read":
        return "Read";
      case "to-read":
        return "Want to Read";
      case "read-next":
        return "Read Next";
      default:
        return "Unread";
    }
  };

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="inline-block w-8 h-8 border-4 border-[var(--accent)] border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div>
        <Link
          href="/series"
          className="inline-flex items-center gap-2 text-[var(--accent)] hover:text-[var(--light-accent)] mb-5 font-medium transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Series
        </Link>
        <div className="text-center py-12">
          <p className="text-red-500 font-medium">{error || "Series not found"}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-10">
      {/* Back Button */}
      <Link
        href="/series"
        className="inline-flex items-center gap-2 text-[var(--accent)] hover:text-[var(--light-accent)] mb-5 font-medium transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Series
      </Link>

      {/* Header */}
      <div className="border-b border-[var(--border-color)] pb-6">
        <h1 className="text-5xl font-serif font-bold text-[var(--heading-text)] flex items-center gap-3 mb-2">
          <BookMarked className="w-8 h-8" />
          {data.series.name}
        </h1>
        <p className="text-[var(--subheading-text)] mt-2 font-medium">
          {data.books.length} {data.books.length === 1 ? "book" : "books"} in this series
        </p>
      </div>

      {/* Books List */}
      <div className="space-y-6">
        {data.books.map((book) => (
          <Link
            key={book.id}
            href={`/books/${book.id}`}
            className="block group"
          >
            <div className="bg-[var(--card-bg)] border border-[var(--border-color)] rounded-lg px-4 py-6 sm:p-4 hover:border-[var(--accent)] hover:shadow-xl transition-all duration-200">
              <div className="flex flex-col sm:flex-row gap-4">
                {/* Book Cover */}
                <div className="flex-shrink-0 w-40 sm:w-32 md:w-40 mx-auto sm:mx-0">
                  <div className="relative aspect-[2/3] bg-[var(--light-accent)]/30 rounded border border-[var(--border-color)] overflow-hidden">
                    {!imageErrors[book.calibreId] ? (
                      <Image
                        src={`/api/covers/${book.calibreId}/cover.jpg`}
                        alt={`Cover for ${book.title}`}
                        fill
                        sizes="(max-width: 768px) 160px, 128px"
                        className="object-cover group-hover:opacity-95 transition-opacity"
                        onError={() => handleImageError(book.calibreId)}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <BookOpen className="w-8 h-8 text-[var(--foreground)]/40" />
                      </div>
                    )}
                  </div>
                </div>

                {/* Book Info */}
                <div className="flex-1 min-w-0 text-center sm:text-left">
                  <div className="flex flex-col sm:flex-row items-center sm:items-start justify-between gap-3 sm:gap-4 mb-3">
                    <div className="flex-1 min-w-0 w-full">
                      {/* Series Index Circle */}
                      <div className="mb-3 flex justify-center sm:justify-start">
                        <div className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-[var(--accent)] text-white text-sm font-bold shadow-sm">
                          {book.seriesIndex}
                        </div>
                      </div>

                      {/* Title */}
                      <h2 className="text-xl font-serif font-semibold text-[var(--heading-text)] mb-2 group-hover:text-[var(--accent)] transition-colors line-clamp-2">
                        {book.title}
                      </h2>

                      {/* Authors */}
                      <p className="text-sm text-[var(--subheading-text)] font-medium">
                        by {book.authors.join(", ")}
                      </p>
                    </div>

                    {/* Status Badge */}
                    {book.status && (
                      <span className={cn(
                        "px-3.5 py-1.5 rounded text-xs font-semibold whitespace-nowrap transition-colors",
                        getStatusColor(book.status)
                      )}>
                        {getStatusLabel(book.status)}
                      </span>
                    )}
                  </div>

                  {/* Metadata Row */}
                  {book.rating && (
                    <div className="flex items-center justify-center sm:justify-start gap-1 mb-3">
                      {[...Array(5)].map((_, i) => (
                        <Star
                          key={i}
                          className={cn(
                            "w-4 h-4",
                            i < book.rating!
                              ? "fill-[var(--accent)] text-[var(--accent)]"
                              : "text-[var(--foreground)]/20"
                          )}
                        />
                      ))}
                    </div>
                  )}

                  {/* Description */}
                  {book.description && (
                    <p className="text-sm text-[var(--subheading-text)] line-clamp-3 font-medium">
                      {book.description.replace(/<[^>]*>/g, "")}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
