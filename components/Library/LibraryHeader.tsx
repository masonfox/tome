"use client";

import { RefreshCw, Library as LibraryIcon, Plus, Search, ChevronDown } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { cn } from "@/utils/cn";
import { Button } from "@/components/Utilities/Button";

interface LibraryHeaderProps {
  totalBooks: number;
  syncing: boolean;
  onSync: () => void;
  onAddManualBook: () => void;
  onSearchProviders?: () => void;
  loading?: boolean;
}

export function LibraryHeader({ totalBooks, syncing, onSync, onAddManualBook, onSearchProviders, loading = false }: LibraryHeaderProps) {
  const [showAddMenu, setShowAddMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowAddMenu(false);
      }
    }

    if (showAddMenu) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [showAddMenu]);

  const handleAddManual = () => {
    setShowAddMenu(false);
    onAddManualBook();
  };

  const handleSearchProviders = () => {
    setShowAddMenu(false);
    if (onSearchProviders) {
      onSearchProviders();
    }
  };

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
        {/* Add Book Dropdown */}
        <div className="relative" ref={menuRef}>
          <Button
            onClick={() => setShowAddMenu(!showAddMenu)}
            variant="secondary"
            size="xl"
            icon={<Plus className="w-4 h-4" />}
            className="mt-3 sm:mt-2"
            title="Add Book"
          >
            <span className="hidden sm:inline">Add Book</span>
            <ChevronDown className={cn("w-3.5 h-3.5 ml-1 transition-transform", showAddMenu && "rotate-180")} />
          </Button>

          {showAddMenu && (
            <div className="absolute right-0 mt-2 w-56 bg-[var(--card-bg)] border border-[var(--border-color)] rounded-lg shadow-lg z-50">
              <div className="py-1">
                <button
                  onClick={handleSearchProviders}
                  className="w-full text-left px-4 py-2.5 text-sm hover:bg-[var(--card-bg-emphasis)] flex items-center gap-3"
                >
                  <Search className="w-4 h-4 text-[var(--subheading-text)]" />
                  <div>
                    <div className="font-medium text-[var(--foreground)]">Search Providers</div>
                    <div className="text-xs text-[var(--subheading-text)]">Hardcover, Open Library</div>
                  </div>
                </button>
                <button
                  onClick={handleAddManual}
                  className="w-full text-left px-4 py-2.5 text-sm hover:bg-[var(--card-bg-emphasis)] flex items-center gap-3 border-t border-[var(--border-color)]"
                >
                  <Plus className="w-4 h-4 text-[var(--subheading-text)]" />
                  <div>
                    <div className="font-medium text-[var(--foreground)]">Add Manually</div>
                    <div className="text-xs text-[var(--subheading-text)]">Enter book details yourself</div>
                  </div>
                </button>
              </div>
            </div>
          )}
        </div>

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
