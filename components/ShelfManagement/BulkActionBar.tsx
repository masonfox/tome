"use client";

import { useState, useRef, useEffect } from "react";
import { Trash2, MoveHorizontal, Copy, ChevronDown } from "lucide-react";
import { cn } from "@/utils/cn";

interface BulkActionBarProps {
  selectedCount: number;
  onMove?: () => void;
  onCopy?: () => void;
  onDelete: () => void;
  onCancel: () => void;
  loading?: boolean;
  className?: string;
}

export function BulkActionBar({
  selectedCount,
  onMove,
  onCopy,
  onDelete,
  onCancel,
  loading = false,
  className,
}: BulkActionBarProps) {
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };

    if (showDropdown) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [showDropdown]);

  if (selectedCount === 0) {
    return null;
  }

  const handleActionClick = (action: () => void) => {
    setShowDropdown(false);
    action();
  };

  // Define actions configuration
  const actions = [
    {
      key: "move",
      label: "Move to...",
      icon: MoveHorizontal,
      onClick: onMove,
      variant: "accent" as const,
    },
    {
      key: "copy",
      label: "Copy to...",
      icon: Copy,
      onClick: onCopy,
      variant: "accent" as const,
    },
    {
      key: "remove",
      label: loading ? "Removing..." : "Remove",
      icon: Trash2,
      onClick: onDelete,
      variant: "danger" as const,
    },
  ].filter((action) => action.onClick !== undefined);

  return (
    <div
      id="bulk-action-bar"
      className={cn(
        "fixed bottom-24 md:bottom-0 left-0 right-0 z-30",
        "bg-[var(--card-bg-emphasis)] backdrop-blur-sm",
        "border-t border-[var(--border-color)]",
        "shadow-lg",
        "animate-in slide-in-from-bottom duration-200",
        className
      )}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <div className="flex items-center justify-between gap-4">
          {/* Selected count */}
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-[var(--foreground)]">
              {selectedCount} {selectedCount === 1 ? "book" : "books"} selected
            </span>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={onCancel}
              disabled={loading}
              className={cn(
                "px-3 py-2 text-sm font-medium rounded-lg transition-colors",
                "bg-[var(--card-bg)] text-[var(--foreground)] hover:bg-[var(--hover-bg)]",
                "border border-[var(--border-color)]",
                "disabled:opacity-50 disabled:cursor-not-allowed"
              )}
            >
              Cancel
            </button>

            {/* Desktop: Show all buttons */}
            <div className="hidden md:flex items-center gap-2">
              {actions.map((action) => (
                <button
                  key={action.key}
                  onClick={action.onClick}
                  disabled={loading || selectedCount === 0}
                  className={cn(
                    "px-4 py-2 text-sm font-medium rounded-lg transition-colors",
                    "disabled:opacity-50 disabled:cursor-not-allowed",
                    "flex items-center gap-2",
                    action.variant === "danger"
                      ? "bg-red-500 text-white hover:bg-red-600"
                      : "bg-[var(--accent)] text-white hover:bg-[var(--light-accent)]"
                  )}
                >
                  <action.icon className="w-4 h-4" />
                  {action.label}
                </button>
              ))}
            </div>

            {/* Mobile: Show dropdown */}
            <div className="md:hidden flex items-center gap-2">
              {actions.length > 0 && (
                <div className="relative" ref={dropdownRef}>
                  <button
                    onClick={() => setShowDropdown(!showDropdown)}
                    disabled={loading || selectedCount === 0}
                    className={cn(
                      "px-3 py-2 text-sm font-medium rounded-lg transition-colors",
                      "bg-[var(--accent)] text-white hover:bg-[var(--light-accent)]",
                      "disabled:opacity-50 disabled:cursor-not-allowed",
                      "flex items-center gap-1"
                    )}
                  >
                    Actions
                    <ChevronDown className="w-4 h-4" />
                  </button>

                  {/* Dropdown Menu */}
                  {showDropdown && (
                    <div className="absolute bottom-full right-0 mb-2 w-48 bg-[var(--card-bg)] border border-[var(--border-color)] rounded-lg shadow-xl overflow-hidden z-50">
                      {actions.map((action) => (
                        <button
                          key={action.key}
                          onClick={() => handleActionClick(action.onClick!)}
                          disabled={loading || selectedCount === 0}
                          className={cn(
                            "w-full px-4 py-3 text-left text-sm font-medium transition-colors",
                            "text-[var(--foreground)] hover:bg-[var(--hover-bg)]",
                            "disabled:opacity-50 disabled:cursor-not-allowed",
                            "flex items-center gap-3",
                            action.variant === "danger" && "border-t border-[var(--border-color)]"
                          )}
                        >
                          <action.icon 
                            className={cn(
                              "w-4 h-4",
                              action.variant === "danger" ? "text-red-500" : "text-[var(--accent)]"
                            )} 
                          />
                          {action.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
