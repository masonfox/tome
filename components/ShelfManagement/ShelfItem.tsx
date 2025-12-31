"use client";

import Link from "next/link";
import { BookOpen, Edit2, Trash2, MoreVertical, FolderOpen } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import type { ShelfWithBookCount } from "@/hooks/useShelfManagement";
import { getShelfIcon } from "@/components/ShelfIconPicker";

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

  const Icon = shelf.icon ? getShelfIcon(shelf.icon) : null;

  return (
    <div className="group relative bg-[var(--background)] border border-[var(--border-color)] rounded-lg p-4 hover:border-[var(--accent)]/50 hover:shadow-md transition-all shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <Link
          href={`/library/shelves/${shelf.id}`}
          className="flex-1 min-w-0"
        >
          <div className="flex items-center gap-3 mb-2">
            {/* Icon or color circle */}
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 shadow-sm"
              style={{ backgroundColor: shelf.color || "#3b82f6" }}
            >
              {Icon ? (
                <Icon className="w-5 h-5 text-white" />
              ) : (
                <FolderOpen className="w-5 h-5 text-white" />
              )}
            </div>

            <h3 className="text-lg font-serif font-semibold text-[var(--heading-text)] group-hover:text-[var(--accent)] transition-colors truncate">
              {shelf.name}
            </h3>
          </div>

          {shelf.description && (
            <p className="text-sm text-[var(--foreground)]/70 mb-3 line-clamp-2 ml-[52px]">
              {shelf.description}
            </p>
          )}

          <div className="flex items-center gap-2 text-sm ml-[52px]">
            <span className="bg-[var(--foreground)]/10 text-[var(--subheading-text)] px-2 py-1 rounded-full font-medium">
              {shelf.bookCount}
            </span>
            <span className="text-[var(--foreground)]/60">
              {shelf.bookCount === 1 ? "book" : "books"}
            </span>
          </div>
        </Link>

        {/* Actions menu */}
        <div className="relative flex-shrink-0" ref={menuRef}>
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
    <div className="bg-[var(--background)] border border-[var(--border-color)] rounded-lg p-4 animate-pulse shadow-sm">
      <div className="flex items-start gap-3 mb-2">
        <div className="w-10 h-10 bg-[var(--hover-bg)] rounded-full flex-shrink-0" />
        <div className="flex-1">
          <div className="h-5 bg-[var(--hover-bg)] rounded w-2/3" />
        </div>
      </div>
      <div className="ml-[52px] space-y-2">
        <div className="h-4 bg-[var(--hover-bg)] rounded w-full" />
        <div className="h-4 bg-[var(--hover-bg)] rounded w-3/4" />
        <div className="h-6 bg-[var(--hover-bg)] rounded-full w-16 mt-3" />
      </div>
    </div>
  );
}
