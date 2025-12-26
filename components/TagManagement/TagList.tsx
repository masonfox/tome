"use client";

import { useState, useMemo } from "react";
import { Search, CheckSquare, X } from "lucide-react";
import { TagItem, type TagWithStats } from "./TagItem";
import { cn } from "@/utils/cn";

type SortOption = "name-asc" | "name-desc" | "count-desc" | "count-asc";

interface TagListProps {
  tags: TagWithStats[];
  selectedTag: string | null;
  onSelectTag: (tagName: string) => void;
  onRenameTag: (tagName: string) => void;
  onDeleteTag: (tagName: string) => void;
  onMergeTags?: (tagNames: string[]) => void;
}

export function TagList({
  tags,
  selectedTag,
  onSelectTag,
  onRenameTag,
  onDeleteTag,
  onMergeTags,
}: TagListProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [sortOption, setSortOption] = useState<SortOption>("name-asc");
  const [checkboxMode, setCheckboxMode] = useState(false);
  const [checkedTags, setCheckedTags] = useState<Set<string>>(new Set());

  // Filter and sort tags
  const filteredAndSortedTags = useMemo(() => {
    let filtered = tags;

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = tags.filter((tag) =>
        tag.name.toLowerCase().includes(query)
      );
    }

    // Apply sort
    const sorted = [...filtered];
    switch (sortOption) {
      case "name-asc":
        sorted.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case "name-desc":
        sorted.sort((a, b) => b.name.localeCompare(a.name));
        break;
      case "count-desc":
        sorted.sort((a, b) => b.bookCount - a.bookCount);
        break;
      case "count-asc":
        sorted.sort((a, b) => a.bookCount - b.bookCount);
        break;
    }

    return sorted;
  }, [tags, searchQuery, sortOption]);

  const handleCheckboxChange = (tagName: string, checked: boolean) => {
    const newChecked = new Set(checkedTags);
    if (checked) {
      newChecked.add(tagName);
    } else {
      newChecked.delete(tagName);
    }
    setCheckedTags(newChecked);
  };

  const handleMergeClick = () => {
    if (checkedTags.size >= 2 && onMergeTags) {
      onMergeTags(Array.from(checkedTags));
      setCheckedTags(new Set());
      setCheckboxMode(false);
    }
  };

  const handleCancelCheckboxMode = () => {
    setCheckboxMode(false);
    setCheckedTags(new Set());
  };

  return (
    <div className="flex flex-col h-full">
      {/* Search and controls */}
      <div className="space-y-3 mb-4">
        {/* Search bar */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-[var(--subheading-text)]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search tags..."
            className="w-full pl-10 pr-4 py-2 bg-[var(--card-bg)] border border-[var(--border-color)] rounded-lg text-[var(--heading-text)] placeholder:text-[var(--subheading-text)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent"
          />
        </div>

        {/* Sort dropdown */}
        <select
          value={sortOption}
          onChange={(e) => setSortOption(e.target.value as SortOption)}
          className="w-full px-3 py-2 bg-[var(--card-bg)] border border-[var(--border-color)] rounded-lg text-[var(--heading-text)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent"
        >
          <option value="name-asc">Name (A-Z)</option>
          <option value="name-desc">Name (Z-A)</option>
          <option value="count-desc">Most books</option>
          <option value="count-asc">Least books</option>
        </select>

        {/* Bulk operations toggle */}
        {!checkboxMode ? (
          <button
            onClick={() => setCheckboxMode(true)}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-[var(--card-bg)] border border-[var(--border-color)] rounded-lg text-[var(--heading-text)] hover:border-[var(--accent)] transition-colors font-medium"
          >
            <CheckSquare className="w-4 h-4" />
            Select Multiple
          </button>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm text-[var(--subheading-text)]">
              <span>{checkedTags.size} selected</span>
              <button
                onClick={handleCancelCheckboxMode}
                className="text-[var(--accent)] hover:text-[var(--light-accent)] font-medium"
              >
                Cancel
              </button>
            </div>
            <button
              onClick={handleMergeClick}
              disabled={checkedTags.size < 2}
              className={cn(
                "w-full px-4 py-2 rounded-lg font-medium transition-colors",
                checkedTags.size >= 2
                  ? "bg-[var(--accent)] text-white hover:bg-[var(--light-accent)]"
                  : "bg-[var(--foreground)]/10 text-[var(--subheading-text)] cursor-not-allowed"
              )}
            >
              Merge Selected
            </button>
          </div>
        )}
      </div>

      {/* Tags list */}
      <div className="flex-1 overflow-y-auto space-y-2">
        {filteredAndSortedTags.length === 0 ? (
          <div className="text-center py-8 text-[var(--subheading-text)]">
            {searchQuery ? "No tags found" : "No tags yet"}
          </div>
        ) : (
          filteredAndSortedTags.map((tag) => (
            <TagItem
              key={tag.name}
              tag={tag}
              isSelected={selectedTag === tag.name}
              isCheckboxMode={checkboxMode}
              isChecked={checkedTags.has(tag.name)}
              onSelect={() => onSelectTag(tag.name)}
              onCheckboxChange={(checked) =>
                handleCheckboxChange(tag.name, checked)
              }
              onRename={() => onRenameTag(tag.name)}
              onDelete={() => onDeleteTag(tag.name)}
            />
          ))
        )}
      </div>
    </div>
  );
}
