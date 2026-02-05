"use client";

import { RefreshCw, Library as LibraryIcon, Plus } from "lucide-react";
import { cn } from "@/utils/cn";
import { Button } from "@/components/Utilities/Button";

interface LibraryHeaderProps {
  totalBooks: number;
  syncing: boolean;
  onSync: () => void;
  onAddManualBook: () => void;
  loading?: boolean;
}

export function LibraryHeader({ totalBooks, syncing, onSync, onAddManualBook, loading = false }: LibraryHeaderProps) {
  return (
    <div className="flex items-start justify-between border-b border-[var(--border-color)] pb-6">
      <div>
        <h1 className="text-5xl font-serif font-bold text-[var(--heading-text)] flex items-center gap-3">
          <LibraryIcon className="w-8 h-8" />
          Library
        </h1>
        {loading ? (
          <p className="text-[var(--subheading-text)] mt-2 font-medium">
            <span className="inline-block h-[1.25rem] w-24 bg-[var(--foreground)]/10 rounded animate-pulse align-middle" />
          </p>
        ) : (
          <p className="text-[var(--subheading-text)] mt-2 font-medium">
            {totalBooks} {totalBooks === 1 ? "book" : "books"}
          </p>
        )}
      </div>

      <div className="flex gap-3">
        <Button
          onClick={onAddManualBook}
          variant="secondary"
          size="xl"
          icon={<Plus className="w-4 h-4" />}
          className="mt-3 sm:mt-2"
          title="Add Manual Book"
        >
          <span className="hidden sm:inline">Add Book</span>
        </Button>

        <Button
          onClick={onSync}
          disabled={syncing}
          variant="primary"
          size="xl"
          icon={<RefreshCw className={cn("w-4 h-4", syncing && "animate-spin")} />}
          className="mt-3 sm:mt-2"
          title={syncing ? "Syncing..." : "Sync Calibre"}
        >
          <span className="hidden sm:inline">
            {syncing ? "Syncing..." : "Sync Calibre"}
          </span>
        </Button>
      </div>
    </div>
  );
}
