"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { BookOpen, Star, BookMarked } from "lucide-react";
import { cn } from "@/utils/cn";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge, type BookStatus } from "@/components/StatusBadge";

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
  const [imageErrors, setImageErrors] = useState<Record<number, boolean>>({});

  const { data, isLoading, error } = useQuery({
    queryKey: ['series', seriesName],
    queryFn: async () => {
      const response = await fetch(`/api/series/${encodeURIComponent(seriesName)}`);
      
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error("Series not found");
        }
        throw new Error("Failed to fetch series");
      }
      
      return response.json() as Promise<SeriesData>;
    },
    staleTime: 30000, // 30 seconds
    enabled: !!seriesName,
  });

  const handleImageError = (calibreId: number) => {
    setImageErrors(prev => ({ ...prev, [calibreId]: true }));
  };

  if (isLoading) {
    return (
      <div className="text-center py-12">
        <div className="inline-block w-8 h-8 border-4 border-[var(--accent)] border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div>
        <PageHeader
          title="Series Not Found"
          subtitle={error instanceof Error ? error.message : "The requested series could not be found"}
          icon={BookMarked}
          backLink={{
            href: "/series",
            label: "Back to Series"
          }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-10">
      <PageHeader
        title={data.series.name}
        subtitle={`${data.books.length} ${data.books.length === 1 ? "book" : "books"} in this series`}
        icon={BookMarked}
        backLink={{
          href: "/series",
          label: "Back to Series"
        }}
      />

      {/* Books List */}
      <div className="space-y-6">
        {data.books.map((book) => (
          <Link
            key={book.id}
            href={`/books/${book.id}`}
            className="block group"
          >
            <div className="bg-[var(--card-bg)] border border-[var(--border-color)] rounded-lg px-6 py-8 sm:p-6 md:p-8 hover:border-[var(--accent)] hover:shadow-xl transition-all duration-200">
              <div className="flex flex-col sm:flex-row gap-4">
                {/* Book Cover */}
                <div className="flex-shrink-0 w-40 sm:w-32 md:w-40 mx-auto sm:mx-0">
                  <div className="relative aspect-[2/3] bg-[var(--light-accent)]/30 rounded border border-[var(--border-color)] overflow-hidden">
                    {!imageErrors[book.calibreId] ? (
                      <Image
                        src={`/api/books/${book.calibreId}/cover`}
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
                <div className="flex-1 text-center sm:text-left">
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
                      <div className="flex-shrink-0">
                        <StatusBadge 
                          status={book.status as BookStatus} 
                          size="md"
                        />
                      </div>
                    )}
                  </div>

                  {/* Rating or rating prompt for read books */}
                  {book.status === 'read' && (
                    <div className="flex items-center justify-center sm:justify-start gap-1 mb-3">
                      {book.rating ? (
                        // Show filled stars for rated books
                        [...Array(5)].map((_, i) => (
                          <Star
                            key={i}
                            className={cn(
                              "w-4 h-4",
                              i < book.rating!
                                ? "fill-[var(--accent)] text-[var(--accent)]"
                                : "text-[var(--foreground)]/20"
                            )}
                          />
                        ))
                      ) : (
                        // Show empty stars with prompt for unrated read books
                        <>
                          {[...Array(5)].map((_, i) => (
                            <Star
                              key={i}
                              className="w-4 h-4 text-[var(--foreground)]/20"
                            />
                          ))}
                          <span className="ml-2 text-xs text-[var(--accent)] italic font-medium">
                            Not rated yet
                          </span>
                        </>
                      )}
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
