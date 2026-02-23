"use client";

import { useState, useRef, useEffect, useLayoutEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { MoreVertical, Pencil, Trash2 } from "lucide-react";

interface SessionActionsDropdownProps {
  onEdit: () => void;
  onDelete: () => void;
  disabled?: boolean;
}

interface MenuPosition {
  top: number;
  left: number;
}

export function SessionActionsDropdown({
  onEdit,
  onDelete,
  disabled = false,
}: SessionActionsDropdownProps) {
  const [showMenu, setShowMenu] = useState(false);
  const [menuPosition, setMenuPosition] = useState<MenuPosition>({ top: 0, left: 0 });
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const updateMenuPosition = useCallback(() => {
    if (!buttonRef.current) return;

    const rect = buttonRef.current.getBoundingClientRect();
    const menuWidth = 192; // w-48 = 12rem = 192px
    const gap = 4;

    // Get menu height (may be 0 on first render before content is measured)
    const menuHeight = menuRef.current?.offsetHeight || 0;

    // If we don't have a height yet, position below temporarily
    // This will be recalculated in useLayoutEffect once menu renders
    if (menuHeight === 0) {
      setMenuPosition({
        top: rect.bottom + gap,
        left: rect.right - menuWidth,
      });
      return;
    }

    // Calculate available space in viewport
    const viewportHeight = window.innerHeight;
    const spaceBelow = viewportHeight - rect.bottom;
    const spaceAbove = rect.top;

    let top: number;

    // Smart positioning: choose above or below based on available space
    if (spaceBelow >= menuHeight + gap) {
      // Enough space below - position below button (default)
      top = rect.bottom + gap;
    } else if (spaceAbove >= menuHeight + gap) {
      // Not enough space below, but enough above - position above button
      top = rect.top - menuHeight - gap;
    } else {
      // Not enough space either way - use the side with more space
      // Ensure menu doesn't go above viewport top
      top = spaceBelow > spaceAbove
        ? rect.bottom + gap
        : Math.max(gap, rect.top - menuHeight - gap);
    }

    setMenuPosition({
      top,
      left: rect.right - menuWidth,
    });
  }, []);

  // Update position when menu opens
  useEffect(() => {
    if (showMenu) {
      updateMenuPosition();
    }
  }, [showMenu, updateMenuPosition]);

  // Recalculate position after menu renders to get accurate height
  // useLayoutEffect runs synchronously after DOM mutations but before paint
  useLayoutEffect(() => {
    if (showMenu && menuRef.current) {
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
      <button
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onEdit();
          setShowMenu(false);
        }}
        className="w-full px-4 py-2 text-left text-sm text-[var(--foreground)] hover:bg-[var(--hover-bg)] flex items-center gap-2"
      >
        <Pencil className="w-4 h-4" />
        Edit Session
      </button>

      <button
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onDelete();
          setShowMenu(false);
        }}
        className="w-full px-4 py-2 text-left text-sm text-red-500 hover:bg-red-500/10 flex items-center gap-2"
      >
        <Trash2 className="w-4 h-4" />
        Delete Session
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
        className="p-1.5 text-[var(--foreground)]/70 hover:text-[var(--foreground)] hover:bg-[var(--hover-bg)] rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        aria-label="Session actions"
        title="Session actions"
      >
        <MoreVertical className="w-4 h-4" />
      </button>

      {typeof document !== "undefined" && createPortal(menuContent, document.body)}
    </div>
  );
}
