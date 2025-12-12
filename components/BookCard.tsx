"use client";

import Link from "next/link";
import Image from "next/image";
import { BookOpen } from "lucide-react";
import { cn } from "@/utils/cn";
import { useState, memo } from "react";
import { StatusBadge, type BookStatus } from "@/components/StatusBadge";

interface BookCardProps {
  id: string;
  title: string;
  authors: string[];
  calibreId: number;
  status?: string | null;
  currentProgress?: number;
  className?: string;
}

export const BookCard = memo(function BookCard({
  id,
  title,
  authors,
  calibreId,
  status,
  currentProgress,
  className,
}: BookCardProps) {
  const [imageError, setImageError] = useState(false);

  return (
    <Link href={`/books/${id}`}>
      <div
        className={cn(
          "bg-[var(--card-bg)] border border-[var(--border-color)] shadow-xl rounded-md hover:shadow-lg transition-shadow cursor-pointer overflow-hidden group",
          className
        )}
      >
        <div className="aspect-[2/3] bg-[var(--light-accent)]/30 flex items-center justify-center overflow-hidden relative">
          {!imageError ? (
            <Image
              src={`/api/books/${calibreId}/cover`}
              alt={title}
              fill
              loading="lazy"
              className="object-cover group-hover:opacity-95 transition-opacity"
              onError={() => setImageError(true)}
            />
          ) : (
            <BookOpen className="w-16 h-16 text-[var(--accent)]/40" />
          )}
        </div>

        <div className="p-4 space-y-2">
          <h3 className="text-md font-semibold text-[var(--heading-text)] line-clamp-2 leading-snug">
            {title}
          </h3>
          <p className="text-md font-serif text-[var(--subheading-text)] line-clamp-1 font-medium">
            {authors.join(", ")}
          </p>

          {status && (
            <div className="pt-2">
              <StatusBadge status={status as BookStatus} size="sm" />
            </div>
          )}

          {currentProgress !== undefined && status !== "read" && (
            <div className="pt-3 mt-1 border-t border-[var(--border-color)]">
              <div className="flex items-center justify-between mb-2.5">
                <span className="text-xs uppercase tracking-wider font-semibold text-[var(--foreground)]/60">Progress</span>
                <span className="text-sm font-mono font-bold text-[var(--accent)]">{Math.round(currentProgress)}%</span>
              </div>
              <div className="w-full bg-[var(--background)] rounded-full h-2.5 shadow-inner">
                <div
                  className="bg-gradient-to-r from-[var(--accent)] to-[var(--light-accent)] h-2.5 rounded-full transition-all duration-300 ease-out shadow-sm"
                  style={{ width: `${Math.min(100, currentProgress)}%` }}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}, (prevProps, nextProps) => {
  // Custom comparison function for memo
  // Only re-render if these key props change
  return (
    prevProps.id === nextProps.id &&
    prevProps.title === nextProps.title &&
    prevProps.status === nextProps.status &&
    prevProps.currentProgress === nextProps.currentProgress &&
    prevProps.calibreId === nextProps.calibreId
  );
});
