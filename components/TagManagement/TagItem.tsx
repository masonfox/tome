"use client";

import { Tag, Pencil, Trash2 } from "lucide-react";
import { cn } from "@/utils/cn";

export interface TagWithStats {
  name: string;
  bookCount: number;
}

interface TagItemProps {
  tag: TagWithStats;
  isSelected: boolean;
  isCheckboxMode: boolean;
  isChecked: boolean;
  onSelect: () => void;
  onCheckboxChange: (checked: boolean) => void;
  onRename: () => void;
  onDelete: () => void;
}

export function TagItem({
  tag,
  isSelected,
  isCheckboxMode,
  isChecked,
  onSelect,
  onCheckboxChange,
  onRename,
  onDelete,
}: TagItemProps) {
  return (
    <div
      className={cn(
        "group flex items-center gap-3 p-3 rounded-lg border transition-all cursor-pointer shadow-sm",
        isSelected
          ? "bg-[var(--accent)]/10 border-[var(--accent)] shadow-md"
          : "bg-[var(--background)] border-[var(--border-color)] hover:border-[var(--accent)]/50 hover:shadow-md"
      )}
      onClick={isCheckboxMode ? undefined : onSelect}
    >
      {isCheckboxMode && (
        <input
          type="checkbox"
          checked={isChecked}
          onChange={(e) => {
            e.stopPropagation();
            onCheckboxChange(e.target.checked);
          }}
          className="w-4 h-4 rounded border-[var(--border-color)] text-[var(--accent)] focus:ring-[var(--accent)] cursor-pointer"
        />
      )}

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <Tag className="w-4 h-4 text-[var(--subheading-text)] flex-shrink-0" />
          <span
            className={cn(
              "font-medium truncate",
              isSelected ? "text-[var(--accent)]" : "text-[var(--heading-text)]"
            )}
          >
            {tag.name}
          </span>
        </div>
      </div>

      <span
        className={cn(
          "text-sm font-medium px-2 py-1 rounded-full flex-shrink-0",
          isSelected
            ? "bg-[var(--accent)] text-white"
            : "bg-[var(--foreground)]/10 text-[var(--subheading-text)]"
        )}
      >
        {tag.bookCount}
      </span>

      {!isCheckboxMode && (
        <div className="flex items-center gap-1">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onRename();
            }}
            className="p-1.5 rounded hover:bg-[var(--foreground)]/10 transition-colors"
            title="Rename tag"
          >
            <Pencil className="w-4 h-4 text-[var(--subheading-text)]" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className="p-1.5 rounded hover:bg-red-500/10 transition-colors"
            title="Delete tag"
          >
            <Trash2 className="w-4 h-4 text-red-500" />
          </button>
        </div>
      )}
    </div>
  );
}
