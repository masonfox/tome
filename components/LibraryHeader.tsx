"use client";

import { RefreshCw, Library as LibraryIcon } from "lucide-react";
import { cn } from "@/utils/cn";

interface LibraryHeaderProps {
  totalBooks: number;
  syncing: boolean;
  onSync: () => void;
}

export function LibraryHeader({ totalBooks, syncing, onSync }: LibraryHeaderProps) {
  return (
    <div className="flex items-start justify-between border-b border-[var(--border-color)] pb-6">
      <div>
        <h1 className="text-5xl font-serif font-bold text-[var(--heading-text)] flex items-center gap-3">
          <LibraryIcon className="w-8 h-8" />
          Library
        </h1>
        <p className="text-[var(--subheading-text)] mt-2 font-medium">
          {totalBooks} {totalBooks === 1 ? "book" : "books"}
        </p>
      </div>

      <button
        onClick={onSync}
        disabled={syncing}
        className={cn(
          "flex items-center gap-2 px-4 py-2 bg-[var(--accent)] rounded-sm text-white hover:bg-[var(--light-accent)] transition-colors font-medium mt-3 sm:mt-2",
          syncing && "opacity-50 cursor-not-allowed"
        )}
        title={syncing ? "Syncing..." : "Sync Calibre"}
      >
        <RefreshCw className={cn("w-4 h-4", syncing && "animate-spin")} />
        <span className="hidden sm:inline">
          {syncing ? "Syncing..." : "Sync Calibre"}
        </span>
      </button>
    </div>
  );
}