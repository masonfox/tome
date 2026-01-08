"use client";

import Link from "next/link";
import { Edit2, Trash2, MoreVertical, FolderOpen } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import type { ShelfWithBookCountAndCovers } from "@/lib/api";
import { getShelfIcon } from "@/components/ShelfManagement/ShelfIconPicker";
import FannedBookCovers from "@/components/Utilities/FannedBookCovers";

interface ShelfItemProps {
  shelf: ShelfWithBookCountAndCovers;
  onEdit: (shelf: ShelfWithBookCountAndCovers) => void;
  onDelete: (shelf: ShelfWithBookCountAndCovers) => void;
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
  const hasCovers = shelf.bookCoverIds && shelf.bookCoverIds.length > 0;

  return (
    <div className="group relative bg-[var(--card-bg)] border-2 border-[var(--border-color)] rounded-lg shadow-md hover:shadow-xl hover:border-[var(--accent)] transition-all duration-300 overflow-hidden">
      <Link href={`/shelves/${shelf.id}`} className="block">
        {/* Cover Preview Section */}
        <div className="relative h-[200px] overflow-hidden">
          {hasCovers ? (
            <FannedBookCovers
              coverIds={shelf.bookCoverIds}
              size="md"
              maxCovers={12}
              className="bg-gradient-to-br from-amber-50/50 to-orange-300/20 [html[data-theme='dark']_&]:from-stone-500/40 [html[data-theme='dark']_&]:to-stone-700/30"
              height={200}
            />
          ) : (
            // Empty state with shelf icon
            <div className="flex items-center justify-center h-full bg-gradient-to-br from-amber-50/50 to-orange-300/20 [html[data-theme='dark']_&]:from-stone-500/40 [html[data-theme='dark']_&]:to-stone-700/30">
              <div
                className="w-20 h-20 rounded-full flex items-center justify-center shadow-lg"
                style={{ backgroundColor: shelf.color || "#3b82f6" }}
              >
                {Icon ? (
                  <Icon className="w-10 h-10 text-white" />
                ) : (
                  <FolderOpen className="w-10 h-10 text-white" />
                )}
              </div>
            </div>
          )}
          
          {/* Colored accent stripe - thicker */}
          <div 
            className="absolute bottom-0 left-0 right-0 h-[3px]"
            style={{ backgroundColor: shelf.color || "#3b82f6" }}
          />
        </div>

        {/* Shelf Info Section */}
        <div className="p-4">
          <div className="flex items-start gap-3">
            {/* Icon badge */}
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

            {/* Content */}
            <div className="flex-1 min-w-0">
              <h3 className="text-lg font-sans font-semibold text-[var(--heading-text)] group-hover:text-[var(--accent)] transition-colors line-clamp-1 mb-1">
                {shelf.name} <span className="text-sm text-[var(--subheading-text)] font-normal">({shelf.bookCount})</span>
              </h3>
              
              {shelf.description && (
                <p className="text-sm text-[var(--subheading-text)] line-clamp-2">
                  {shelf.description}
                </p>
              )}
            </div>
          </div>
        </div>
      </Link>

      {/* Actions menu */}
      <div className="absolute top-3 right-3 z-30" ref={menuRef}>
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setShowMenu(!showMenu);
          }}
          className="p-2 bg-[var(--card-bg)]/90 backdrop-blur-sm hover:bg-[var(--hover-bg)] rounded-lg transition-colors shadow-md border border-[var(--border-color)]"
          aria-label="More actions"
        >
          <MoreVertical className="w-5 h-5 text-[var(--foreground)]/60" />
        </button>

        {showMenu && (
          <div className="absolute right-0 top-full mt-1 w-48 bg-[var(--card-bg)] border border-[var(--border-color)] rounded-lg shadow-lg py-1 z-30">
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onEdit(shelf);
                setShowMenu(false);
              }}
              className="w-full px-4 py-2 text-left text-sm text-[var(--foreground)] hover:bg-[var(--hover-bg)] flex items-center gap-2"
            >
              <Edit2 className="w-4 h-4" />
              Edit Shelf
            </button>
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
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
  );
}

export function ShelfItemSkeleton() {
  return (
    <div className="bg-[var(--card-bg)] border-2 border-[var(--border-color)] rounded-lg shadow-md overflow-hidden animate-pulse">
      {/* Cover area skeleton */}
      <div className="relative h-[200px] bg-gradient-to-br from-amber-50/50 to-orange-300/20 [html[data-theme='dark']_&]:from-stone-500/40 [html[data-theme='dark']_&]:to-stone-700/30">
        {/* Simulate fanned book covers or icon */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-20 h-20 rounded-full bg-[var(--hover-bg)]" />
        </div>
        {/* Colored accent stripe */}
        <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-[var(--hover-bg)]" />
      </div>
      
      {/* Info section skeleton */}
      <div className="p-4">
        <div className="flex items-start gap-3">
          {/* Icon badge skeleton */}
          <div className="w-10 h-10 rounded-full bg-[var(--hover-bg)] flex-shrink-0" />
          
          {/* Content skeleton */}
          <div className="flex-1 min-w-0 space-y-2">
            {/* Title with count */}
            <div className="h-6 bg-[var(--hover-bg)] rounded w-3/4" />
            
            {/* Description lines */}
            <div className="space-y-1.5">
              <div className="h-4 bg-[var(--hover-bg)] rounded w-full" />
              <div className="h-4 bg-[var(--hover-bg)] rounded w-2/3" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
