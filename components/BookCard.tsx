import Link from "next/link";
import { BookOpen } from "lucide-react";
import { cn } from "@/utils/cn";

interface BookCardProps {
  id: string;
  title: string;
  authors: string[];
  coverPath?: string;
  status?: string | null;
  currentProgress?: number;
  className?: string;
}

export function BookCard({
  id,
  title,
  authors,
  coverPath,
  status,
  currentProgress,
  className,
}: BookCardProps) {
  const statusColors = {
    "to-read": "bg-[#deb887] text-[#5c4033]",
    reading: "bg-[#d4af85] text-[#3a3a3a]",
    read: "bg-[#c9a876] text-[#3a3a3a]",
  };

  const statusLabels = {
    "to-read": "WANT TO READ",
    reading: "READING",
    read: "READ",
  };

  return (
    <Link href={`/books/${id}`}>
      <div
        className={cn(
          "bg-[var(--card-bg)] border border-[var(--border-color)] shadow-md hover:shadow-lg transition-shadow cursor-pointer overflow-hidden group",
          className
        )}
      >
        <div className="aspect-[2/3] bg-[var(--light-accent)]/30 flex items-center justify-center overflow-hidden relative">
          {coverPath ? (
            <img
              src={coverPath}
              alt={title}
              className="w-full h-full object-cover group-hover:opacity-95 transition-opacity"
              loading="lazy"
            />
          ) : (
            <BookOpen className="w-16 h-16 text-[var(--accent)]/40" />
          )}
        </div>

        <div className="p-4 space-y-2">
          <h3 className="font-serif text-sm font-semibold text-[var(--foreground)] line-clamp-2 leading-snug">
            {title}
          </h3>
          <p className="text-xs text-[var(--foreground)]/70 line-clamp-1 font-light">
            {authors.join(", ")}
          </p>

          {status && (
            <div className="pt-2">
              <span
                className={cn(
                  "inline-block text-xs px-2 py-1 font-medium tracking-wide uppercase",
                  statusColors[status as keyof typeof statusColors]
                )}
              >
                {statusLabels[status as keyof typeof statusLabels]}
              </span>
            </div>
          )}

          {currentProgress !== undefined && (
            <div className="pt-3 border-t border-[var(--border-color)]">
              <div className="flex items-center justify-between text-xs text-[var(--foreground)]/60 mb-2">
                <span>READ</span>
                <span className="font-semibold">{Math.round(currentProgress)}%</span>
              </div>
              <div className="w-full bg-[var(--border-color)] h-1.5">
                <div
                  className="bg-[var(--accent)] h-1.5 transition-all"
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
