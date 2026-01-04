"use client";

import { Tag, Pencil, Trash2 } from "lucide-react";
import { memo, useCallback } from "react";
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

export const TagItem = memo(function TagItem({
  tag,
  isSelected,
  isCheckboxMode,
  isChecked,
  onSelect,
  onCheckboxChange,
  onRename,
  onDelete,
}: TagItemProps) {
  const handleCheckboxClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
  }, []);

  const handleCheckboxChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    onCheckboxChange(e.target.checked);
  }, [onCheckboxChange]);

  const handleRenameClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onRename();
  }, [onRename]);

  const handleDeleteClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onDelete();
  }, [onDelete]);

  return (
    <div
      className={cn(
        "group flex items-center gap-3 p-3 rounded-lg border transition-all shadow-sm",
        isCheckboxMode ? "" : "cursor-pointer",
        isSelected
          ? "bg-[var(--accent)]/10 border-[var(--accent)] shadow-md"
          : "bg-[var(--background)] border-[var(--border-color)] hover:border-[var(--accent)]/50 hover:shadow-md"
      )}
    >
      {isCheckboxMode && (
        <div
          onClick={handleCheckboxClick}
          className="flex items-center"
        >
          <input
            type="checkbox"
            checked={isChecked}
            onChange={handleCheckboxChange}
            className="w-4 h-4 rounded border-[var(--border-color)] focus:ring-[var(--accent)] cursor-pointer"
            style={{ accentColor: 'var(--accent)' }}
          />
        </div>
      )}

      <div 
        className="flex-1 min-w-0 flex items-center gap-3 cursor-pointer"
        onClick={onSelect}
      >
        <div className="flex items-center gap-2 flex-1 min-w-0">
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
      </div>

      {!isCheckboxMode && (
        <div className="flex items-center gap-1">
          <button
            onClick={handleRenameClick}
            className="p-1.5 rounded hover:bg-[var(--foreground)]/10 transition-colors"
            title="Rename tag"
          >
            <Pencil className="w-4 h-4 text-[var(--subheading-text)]" />
          </button>
          <button
            onClick={handleDeleteClick}
            className="p-1.5 rounded hover:bg-red-500/10 transition-colors"
            title="Delete tag"
          >
            <Trash2 className="w-4 h-4 text-red-500" />
          </button>
        </div>
      )}
    </div>
  );
}, (prevProps, nextProps) => {
  // Custom comparison for optimal re-renders
  return (
    prevProps.tag.name === nextProps.tag.name &&
    prevProps.tag.bookCount === nextProps.tag.bookCount &&
    prevProps.isSelected === nextProps.isSelected &&
    prevProps.isCheckboxMode === nextProps.isCheckboxMode &&
    prevProps.isChecked === nextProps.isChecked &&
    prevProps.onSelect === nextProps.onSelect &&
    prevProps.onCheckboxChange === nextProps.onCheckboxChange &&
    prevProps.onRename === nextProps.onRename &&
    prevProps.onDelete === nextProps.onDelete
  );
});
