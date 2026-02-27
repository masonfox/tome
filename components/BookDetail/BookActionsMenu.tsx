"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { MoreVertical, Edit, Trash2 } from "lucide-react";

interface BookActionsMenuProps {
  onEdit: () => void;
  onDelete: () => void;
}

interface MenuPosition {
  top: number;
  left: number;
}

export function BookActionsMenu({
  onEdit,
  onDelete,
}: BookActionsMenuProps) {
  const [showMenu, setShowMenu] = useState(false);
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
      <button
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onEdit();
          setShowMenu(false);
        }}
        className="w-full px-4 py-2 text-left text-sm text-[var(--foreground)] hover:bg-[var(--hover-bg)] flex items-center gap-2"
      >
        <Edit className="w-4 h-4" />
        Edit Book
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
        Delete Book
      </button>
    </div>
  );

  return (
    <div className="relative inline-block">
      <button
        ref={buttonRef}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setShowMenu(!showMenu);
        }}
        className="p-1.5 text-[var(--foreground)] hover:bg-[var(--hover-bg)] rounded-full transition-colors"
        aria-label="Book actions"
        title="Book actions"
      >
        <MoreVertical className="w-5 h-5" />
      </button>

      {typeof document !== "undefined" && createPortal(menuContent, document.body)}
    </div>
  );
}
