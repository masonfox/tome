"use client";

import Link from "next/link";
import { BookOpen } from "lucide-react";
import { cn } from "@/utils/cn";
import { useState } from "react";

interface BookCardProps {
  id: string;
  title: string;
  authors: string[];
  calibreId: number;
  status?: string | null;
  currentProgress?: number;
  className?: string;
}

export function BookCard({
  id,
  title,
  authors,
  calibreId,
  status,
  currentProgress,
  className,
}: BookCardProps) {
  const [imageError, setImageError] = useState(false);

  const statusColors = {
    "to-read": "bg-[#deb887] text-[#5c4033]",
    "read-next": "bg-[#e8c5a0] text-[#4a3728]",
    reading: "bg-[#d4af85] text-[#3a3a3a]",
    read: "bg-[#c9a876] text-[#3a3a3a]",
  };

  const statusLabels = {
    "to-read": "WANT TO READ",
    "read-next": "READ NEXT",
    reading: "READING",
    read: "READ",
  };

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
            <img
              src={`/api/covers/${calibreId}/cover.jpg`}
              alt={title}
              className="w-full h-full object-cover group-hover:opacity-95 transition-opacity"
              loading="lazy"
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
              <span
                className={cn(
                  "inline-block text-xs px-2 py-1 font-medium tracking-wide uppercase rounded-sm",
                  statusColors[status as keyof typeof statusColors]
                )}
              >
                {statusLabels[status as keyof typeof statusLabels]}
              </span>
            </div>
          )}

          {currentProgress !== undefined && (
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
}
