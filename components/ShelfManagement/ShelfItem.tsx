"use client";

import Link from "next/link";
import Image from "next/image";
import { BookOpen, Edit2, Trash2, MoreVertical, FolderOpen } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import type { ShelfWithBookCountAndCovers } from "@/hooks/useShelfManagement";
import { getShelfIcon } from "@/components/ShelfIconPicker";

interface ShelfItemProps {
  shelf: ShelfWithBookCountAndCovers;
  onEdit: (shelf: ShelfWithBookCountAndCovers) => void;
  onDelete: (shelf: ShelfWithBookCountAndCovers) => void;
}

export function ShelfItem({ shelf, onEdit, onDelete }: ShelfItemProps) {
  const [showMenu, setShowMenu] = useState(false);
  const [imageErrors, setImageErrors] = useState<Record<number, boolean>>({});
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

  const handleImageError = (calibreId: number) => {
    setImageErrors(prev => ({ ...prev, [calibreId]: true }));
  };

  return (
    <div className="group relative bg-[var(--card-bg)] border-2 border-[var(--border-color)] rounded-lg shadow-md hover:shadow-xl hover:border-[var(--accent)] transition-all duration-300 overflow-hidden">
      <Link href={`/shelves/${shelf.id}`} className="block">
        {/* Cover Preview Section */}
        <div className="relative h-[200px] overflow-hidden bg-gradient-to-br from-amber-50/50 to-orange-300/20 [html[data-theme='dark']_&]:from-stone-500/40 [html[data-theme='dark']_&]:to-stone-700/30">
          {hasCovers ? (
            <div className="absolute inset-0 flex items-center justify-center">
              {/* Overlapping covers like Series cards */}
              {shelf.bookCoverIds.slice(0, 3).map((calibreId, index) => {
                // Define explicit positions and styles for each cover
                const coverStyles = [
                  { 
                    rotation: '-rotate-6',
                    left: 30,
                    zIndex: 10,
                    hoverClass: 'group-hover:translate-x-0'
                  },
                  { 
                    rotation: 'rotate-0',
                    left: 80,
                    zIndex: 20,
                    hoverClass: 'group-hover:translate-x-4'
                  },
                  { 
                    rotation: 'rotate-6',
                    left: 130,
                    zIndex: 30,
                    hoverClass: 'group-hover:translate-x-8'
                  },
                ];
                
                const style = coverStyles[index];
                
                return (
                  <div
                    key={calibreId}
                    className="absolute transition-all duration-300 group-hover:scale-105"
                    style={{
                      left: `${style.left}px`,
                      zIndex: style.zIndex,
                    }}
                  >
                    <div className={`${style.rotation} transition-transform duration-300 ${style.hoverClass}`}>
                      {!imageErrors[calibreId] ? (
                        <Image
                          src={`/api/books/${calibreId}/cover`}
                          alt={`Cover ${index + 1}`}
                          width={90}
                          height={135}
                          className="rounded shadow-xl border-2 border-[var(--card-bg)]"
                          onError={() => handleImageError(calibreId)}
                          unoptimized
                        />
                      ) : (
                        <div className="w-[90px] h-[135px] bg-[var(--hover-bg)] rounded border-2 border-[var(--card-bg)] flex items-center justify-center shadow-xl">
                          <BookOpen className="w-8 h-8 text-[var(--foreground)]/30" />
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            // Empty state with shelf icon
            <div className="flex items-center justify-center h-full">
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
      <div className="absolute top-3 right-3 z-10" ref={menuRef}>
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
          <div className="absolute right-0 top-full mt-1 w-48 bg-[var(--card-bg)] border border-[var(--border-color)] rounded-lg shadow-lg py-1 z-20">
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
      <div className="h-[200px] bg-[var(--hover-bg)]" />
      
      {/* Info section skeleton */}
      <div className="p-4">
        <div className="h-5 bg-[var(--hover-bg)] rounded w-2/3 mb-2" />
        <div className="space-y-2 mb-3">
          <div className="h-4 bg-[var(--hover-bg)] rounded w-full" />
          <div className="h-4 bg-[var(--hover-bg)] rounded w-3/4" />
        </div>
        <div className="h-5 bg-[var(--hover-bg)] rounded w-20" />
      </div>
    </div>
  );
}
