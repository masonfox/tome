"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
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

interface MenuPosition {
  top: number;
  left: number;
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
  const [menuPosition, setMenuPosition] = useState<MenuPosition>({ top: 0, left: 0 });
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const updateMenuPosition = useCallback(() => {
    if (!buttonRef.current) return;

    const rect = buttonRef.current.getBoundingClientRect();
    const menuWidth = 192; // w-48 = 12rem = 192px

    setMenuPosition({
      top: rect.bottom + 4, // 4px gap below button
      left: rect.right - menuWidth, // Align right edge with button
    });
  }, []);

  // Update position when menu opens
  useEffect(() => {
    if (showMenu) {
      updateMenuPosition();
    }
  }, [showMenu, updateMenuPosition]);

  // Close menu when clicking outside
  useEffect(() => {
    if (!showMenu) return;

    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      if (
        menuRef.current &&
        !menuRef.current.contains(target) &&
        buttonRef.current &&
        !buttonRef.current.contains(target)
      ) {
        setShowMenu(false);
      }
    }

    function handleScroll() {
      setShowMenu(false);
    }

    document.addEventListener("mousedown", handleClickOutside);
    window.addEventListener("scroll", handleScroll, true);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      window.removeEventListener("scroll", handleScroll, true);
    };
  }, [showMenu]);

  const menuContent = showMenu && (
    <div
      ref={menuRef}
      className="fixed w-48 bg-[var(--card-bg)] border border-[var(--border-color)] rounded-lg shadow-lg py-1 z-50"
      style={{ top: menuPosition.top, left: menuPosition.left }}
    >
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
  );

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setShowMenu(!showMenu);
        }}
        disabled={disabled}
        className="relative left-0 lg:left-3 p-1.5 text-[var(--foreground)] bg-[var(--card-bg-emphasis)] hover:shadow-xl rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        aria-label="More actions"
        title="More actions"
      >
        <MoreVertical className="w-4 h-4" />
      </button>

      {typeof document !== "undefined" && createPortal(menuContent, document.body)}
    </div>
  );
}
