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
    "to-read": "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300",
    reading: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
    read: "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300",
  };

  const statusLabels = {
    "to-read": "To Read",
    reading: "Reading",
    read: "Read",
  };

  return (
    <Link href={`/books/${id}`}>
      <div
        className={cn(
          "bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden border border-gray-200 dark:border-gray-700 hover:shadow-lg transition-shadow cursor-pointer",
          className
        )}
      >
        <div className="aspect-[2/3] bg-gray-200 dark:bg-gray-700 flex items-center justify-center overflow-hidden">
          {coverPath ? (
            <img
              src={coverPath}
              alt={title}
              className="w-full h-full object-cover"
              loading="lazy"
            />
          ) : (
            <BookOpen className="w-16 h-16 text-gray-400" />
          )}
        </div>

        <div className="p-4">
          <h3 className="font-semibold text-gray-900 dark:text-white line-clamp-2 mb-1">
            {title}
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-1">
            {authors.join(", ")}
          </p>

          {status && (
            <div className="mt-3">
              <span
                className={cn(
                  "text-xs px-2 py-1 rounded-full font-medium",
                  statusColors[status as keyof typeof statusColors]
                )}
              >
                {statusLabels[status as keyof typeof statusLabels]}
              </span>
            </div>
          )}

          {currentProgress !== undefined && (
            <div className="mt-3">
              <div className="flex items-center justify-between text-xs text-gray-600 dark:text-gray-400 mb-1">
                <span>Progress</span>
                <span>{Math.round(currentProgress)}%</span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <div
                  className="bg-green-500 h-2 rounded-full transition-all"
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
