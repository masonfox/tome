"use client";

import { Calendar, FileText, User } from "lucide-react";
import { ProviderBadge } from "./ProviderBadge";
import type { SearchResult } from "@/lib/providers/base/IMetadataProvider";
import type { BookSource } from "@/lib/providers/base/IMetadataProvider";

interface SearchResultCardProps {
  result: SearchResult;
  provider: BookSource;
  onClick: () => void;
}

export function SearchResultCard({ result, provider, onClick }: SearchResultCardProps) {
  const formattedDate = result.pubDate
    ? new Date(result.pubDate).getFullYear().toString()
    : undefined;

  return (
    <button
      onClick={onClick}
      className="w-full text-left p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:border-gray-300 dark:hover:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
    >
      <div className="flex gap-4">
        {/* Cover Image */}
        {result.coverImageUrl ? (
          <div className="flex-shrink-0">
            <img
              src={result.coverImageUrl}
              alt={result.title}
              className="w-16 h-24 object-cover rounded shadow-sm"
              loading="lazy"
            />
          </div>
        ) : (
          <div className="flex-shrink-0 w-16 h-24 bg-gray-200 dark:bg-gray-700 rounded flex items-center justify-center">
            <FileText className="w-6 h-6 text-gray-400 dark:text-gray-500" />
          </div>
        )}

        {/* Metadata */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-2">
            <h3 className="font-semibold text-gray-900 dark:text-gray-100 line-clamp-2">
              {result.title}
            </h3>
            <ProviderBadge source={provider} size="sm" />
          </div>

          {result.authors.length > 0 && (
            <div className="flex items-center gap-1.5 text-sm text-gray-600 dark:text-gray-400 mb-1">
              <User className="w-3.5 h-3.5 flex-shrink-0" />
              <span className="line-clamp-1">{result.authors.join(", ")}</span>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500 dark:text-gray-500">
            {result.isbn && (
              <span className="font-mono">ISBN: {result.isbn}</span>
            )}
            
            {result.publisher && (
              <span className="line-clamp-1">{result.publisher}</span>
            )}
            
            {formattedDate && (
              <div className="flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                <span>{formattedDate}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </button>
  );
}
