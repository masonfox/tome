"use client";

import { useState, useRef, useEffect } from "react";
import { MoreVertical, ExternalLink, Trash2, ArrowUp } from "lucide-react";
import Link from "next/link";

interface BookActionsDropdownProps {
  bookId: number;
  bookTitle: string;
  isAtTop: boolean;
  onRemove: () => void;
  onMoveToTop: () => void;
  disabled?: boolean;
}

export function BookActionsDropdown({
  bookId,
  bookTitle,
  isAtTop,
  onRemove,
  onMoveToTop,
  disabled = false,
}: BookActionsDropdownProps) {
  const [showMenu, setShowMenu] = useState(false);
  const [isMoving, setIsMoving] = useState(false);
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
    <div className="relative" ref={menuRef}>
      <button
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setShowMenu(!showMenu);
        }}
        disabled={disabled}
        style={{ backgroundColor: 'var(--card-bg-emphasis)' }}
        className="relative left-0 lg:left-3 p-1.5 text-[var(--foreground)]/60 hover:text-[var(--foreground)] hover:bg-[var(--hover-bg)] rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        aria-label="More actions"
        title="More actions"
      >
        <MoreVertical className="w-4 h-4" />
      </button>

      {showMenu && (
        <div className="absolute right-0 top-full mt-1 w-48 bg-[var(--card-bg)] border border-[var(--border-color)] rounded-lg shadow-lg py-1 z-50">
          <Link
            href={`/books/${bookId}`}
            className="w-full px-4 py-2 text-left text-sm text-[var(--foreground)] hover:bg-[var(--hover-bg)] flex items-center gap-2"
            onClick={(e) => {
              e.stopPropagation();
              setShowMenu(false);
            }}
          >
            <ExternalLink className="w-4 h-4" />
            View Book
          </Link>
          
          <button
            onClick={async (e) => {
              e.preventDefault();
              e.stopPropagation();
              setIsMoving(true);
              try {
                await onMoveToTop();
              } finally {
                setIsMoving(false);
                setShowMenu(false);
              }
            }}
            disabled={isAtTop || isMoving}
            className="w-full px-4 py-2 text-left text-sm text-[var(--foreground)] hover:bg-[var(--hover-bg)] flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            title={isAtTop ? "Already at top" : isMoving ? "Moving..." : "Move to top of list"}
          >
            <ArrowUp className="w-4 h-4" />
            {isMoving ? "Moving..." : "Move to Top"}
          </button>

          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onRemove();
              setShowMenu(false);
            }}
            className="w-full px-4 py-2 text-left text-sm text-red-500 hover:bg-red-500/10 flex items-center gap-2"
          >
            <Trash2 className="w-4 h-4" />
            Remove
          </button>
        </div>
      )}
    </div>
  );
}
