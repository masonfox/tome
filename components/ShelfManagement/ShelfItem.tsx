"use client";

import Link from "next/link";
import { BookOpen, Edit2, Trash2, MoreVertical } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import type { ShelfWithBookCount } from "@/hooks/useShelfManagement";

interface ShelfItemProps {
  shelf: ShelfWithBookCount;
  onEdit: (shelf: ShelfWithBookCount) => void;
  onDelete: (shelf: ShelfWithBookCount) => void;
}

export function ShelfItem({ shelf, onEdit, onDelete }: ShelfItemProps) {
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false);
      }
    }

    if (showMenu) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [showMenu]);

  return (
    <div className="group relative bg-[var(--card-bg)] border border-[var(--border-color)] rounded-lg p-4 hover:border-[var(--accent-color)] transition-all">
      {/* Color indicator */}
      {shelf.color && (
        <div
          className="absolute top-0 left-0 w-1 h-full rounded-l-lg"
          style={{ backgroundColor: shelf.color }}
        />
      )}

      <div className="flex items-start justify-between pl-3">
        <Link
          href={`/library/shelves/${shelf.id}`}
          className="flex-1 min-w-0"
        >
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-lg font-serif font-semibold text-[var(--heading-text)] group-hover:text-[var(--accent-color)] transition-colors truncate">
              {shelf.name}
            </h3>
          </div>

          {shelf.description && (
            <p className="text-sm text-[var(--foreground)]/70 mb-2 line-clamp-2">
              {shelf.description}
            </p>
          )}

          <div className="flex items-center gap-2 text-sm text-[var(--foreground)]/60">
            <BookOpen className="w-4 h-4" />
            <span>
              {shelf.bookCount} {shelf.bookCount === 1 ? "book" : "books"}
            </span>
          </div>
        </Link>

        {/* Actions menu */}
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="p-2 hover:bg-[var(--hover-bg)] rounded-lg transition-colors opacity-0 group-hover:opacity-100"
            aria-label="More actions"
          >
            <MoreVertical className="w-5 h-5 text-[var(--foreground)]/60" />
          </button>

          {showMenu && (
            <div className="absolute right-0 top-full mt-1 w-48 bg-[var(--card-bg)] border border-[var(--border-color)] rounded-lg shadow-lg py-1 z-10">
              <button
                onClick={() => {
                  onEdit(shelf);
                  setShowMenu(false);
                }}
                className="w-full px-4 py-2 text-left text-sm text-[var(--foreground)] hover:bg-[var(--hover-bg)] flex items-center gap-2"
              >
                <Edit2 className="w-4 h-4" />
                Edit Shelf
              </button>
              <button
                onClick={() => {
                  onDelete(shelf);
                  setShowMenu(false);
                }}
                className="w-full px-4 py-2 text-left text-sm text-red-500 hover:bg-red-500/10 flex items-center gap-2"
              >
                <Trash2 className="w-4 h-4" />
                Delete Shelf
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function ShelfItemSkeleton() {
  return (
    <div className="bg-[var(--card-bg)] border border-[var(--border-color)] rounded-lg p-4 animate-pulse">
      <div className="pl-3">
        <div className="h-6 bg-[var(--hover-bg)] rounded w-2/3 mb-2" />
        <div className="h-4 bg-[var(--hover-bg)] rounded w-full mb-1" />
        <div className="h-4 bg-[var(--hover-bg)] rounded w-3/4 mb-3" />
        <div className="h-4 bg-[var(--hover-bg)] rounded w-24" />
      </div>
    </div>
  );
}
