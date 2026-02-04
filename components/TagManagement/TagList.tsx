"use client";

import { useState, useMemo, useRef, useEffect, useImperativeHandle, forwardRef } from "react";
import { Search, CheckSquare, ChevronDown, Check, ArrowDownAZ, ArrowUpAZ, TrendingUp, TrendingDown, X, CheckCheck } from "lucide-react";
import { Button } from "@/components/Utilities/Button";
import { TagItem, type TagWithStats } from "./TagItem";
import { TagListSkeleton } from "./TagListSkeleton";
import { cn } from "@/utils/cn";

type SortOption = "name-asc" | "name-desc" | "count-desc" | "count-asc";

// Sort options with icons and labels
const sortOptions = [
  { value: "name-asc", label: "Name (A-Z)", icon: ArrowDownAZ },
  { value: "name-desc", label: "Name (Z-A)", icon: ArrowUpAZ },
  { value: "count-desc", label: "Most Books", icon: TrendingUp },
  { value: "count-asc", label: "Least Books", icon: TrendingDown },
] as const;

interface TagListProps {
  tags: TagWithStats[];
  selectedTag: string | null;
  loading?: boolean;
  onSelectTag: (tagName: string) => void;
  onRenameTag: (tagName: string) => void;
  onDeleteTag: (tagName: string) => void;
  onMergeTags?: (tagNames: string[]) => void;
  onBulkDeleteTags?: (tagNames: string[]) => void;
}

export interface TagListRef {
  saveScrollPosition: () => void;
  restoreScrollPosition: () => void;
}

export const TagList = forwardRef<TagListRef, TagListProps>(function TagList({
  tags,
  selectedTag,
  loading = false,
  onSelectTag,
  onRenameTag,
  onDeleteTag,
  onMergeTags,
  onBulkDeleteTags,
}, ref) {
  const [searchQuery, setSearchQuery] = useState("");
  const [sortOption, setSortOption] = useState<SortOption>("name-asc");
  const [showSortDropdown, setShowSortDropdown] = useState(false);
  const [checkboxMode, setCheckboxMode] = useState(false);
  const [checkedTags, setCheckedTags] = useState<Set<string>>(new Set());
  
  const sortDropdownRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const savedScrollPosition = useRef<number>(0);
  const shouldRestoreScroll = useRef<boolean>(false);

  // Expose scroll position methods to parent via ref
  useImperativeHandle(ref, () => ({
    saveScrollPosition: () => {
      if (scrollContainerRef.current) {
        savedScrollPosition.current = scrollContainerRef.current.scrollTop;
        shouldRestoreScroll.current = true;
      }
    },
    restoreScrollPosition: () => {
      if (scrollContainerRef.current && shouldRestoreScroll.current) {
        // Use requestAnimationFrame to ensure DOM has updated
        requestAnimationFrame(() => {
          if (scrollContainerRef.current) {
            scrollContainerRef.current.scrollTop = savedScrollPosition.current;
            shouldRestoreScroll.current = false;
          }
        });
      }
    },
  }), []);

  // Restore scroll position after tags update (if flagged)
  useEffect(() => {
    if (shouldRestoreScroll.current && !loading && scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = savedScrollPosition.current;
      shouldRestoreScroll.current = false;
    }
  }, [tags, loading]);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (sortDropdownRef.current && !sortDropdownRef.current.contains(event.target as Node)) {
        setShowSortDropdown(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

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

  const handleBulkDeleteClick = () => {
    if (checkedTags.size >= 1 && onBulkDeleteTags) {
      onBulkDeleteTags(Array.from(checkedTags));
      setCheckedTags(new Set());
      setCheckboxMode(false);
    }
  };

  const handleCancelCheckboxMode = () => {
    setCheckboxMode(false);
    setCheckedTags(new Set());
  };

  // Check if all filtered tags are currently checked
  const allFilteredChecked = useMemo(() => {
    if (filteredAndSortedTags.length === 0) return false;
    return filteredAndSortedTags.every(tag => checkedTags.has(tag.name));
  }, [filteredAndSortedTags, checkedTags]);

  // Handle check all / uncheck all toggle
  const handleToggleAllFiltered = () => {
    const newChecked = new Set(checkedTags);
    
    if (allFilteredChecked) {
      // Uncheck all filtered tags
      filteredAndSortedTags.forEach(tag => {
        newChecked.delete(tag.name);
      });
    } else {
      // Add all filtered tags to selection
      filteredAndSortedTags.forEach(tag => {
        newChecked.add(tag.name);
      });
    }
    
    setCheckedTags(newChecked);
    
    // Auto-enter checkbox mode if not already in it
    if (!checkboxMode) {
      setCheckboxMode(true);
    }
  };

  // Show loading skeleton if loading
  if (loading) {
    return <TagListSkeleton />;
  }

  return (
    <div className="flex flex-col lg:h-full">
      {/* Search and controls - grouped with background - sticky on mobile */}
      <div className="sticky top-0 lg:static z-10 bg-[var(--card-bg)] [html[data-theme='dark']_&]:bg-stone-700 rounded-lg p-3 mb-4 border border-[var(--border-color)]">
        <div className="space-y-3">
          {/* Search bar */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-[var(--foreground)]/40" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search tags..."
              className={`w-full pl-10 py-2 bg-[var(--background)] border border-[var(--border-color)] rounded-lg text-[var(--foreground)] placeholder-[var(--foreground)]/50 focus:outline-none focus:border-[var(--accent)] transition-colors ${
                searchQuery ? "pr-10" : "pr-4"
              }`}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--foreground)]/40 hover:text-[var(--foreground)] transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>

          {/* Sort dropdown */}
          <div className="relative" ref={sortDropdownRef}>
            <button
              type="button"
              onClick={() => setShowSortDropdown(!showSortDropdown)}
              className="w-full px-3 py-2 bg-[var(--background)] border border-[var(--border-color)] rounded-lg text-[var(--heading-text)] hover:border-[var(--accent)] transition-colors flex items-center gap-2"
            >
              {(() => {
                const currentOption = sortOptions.find(opt => opt.value === sortOption);
                const Icon = currentOption?.icon || ArrowDownAZ;
                return (
                  <>
                    <Icon className="w-4 h-4 shrink-0 text-[var(--foreground)]/60" />
                    <span className="flex-1 text-left text-sm">
                      {currentOption?.label || "Name (A-Z)"}
                    </span>
                    <ChevronDown
                      className={cn(
                        "w-4 h-4 transition-transform shrink-0 text-[var(--foreground)]/60",
                        showSortDropdown && "rotate-180"
                      )}
                    />
                  </>
                );
              })()}
            </button>

            {showSortDropdown && (
              <div className="absolute z-10 w-full mt-1 bg-[var(--card-bg)] border border-[var(--border-color)] rounded-lg shadow-lg overflow-hidden">
                {sortOptions.map((option) => {
                  const Icon = option.icon;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => {
                        setSortOption(option.value);
                        setShowSortDropdown(false);
                      }}
                      className={cn(
                        "w-full px-4 py-2.5 text-left flex items-center gap-2 transition-colors text-sm",
                        "text-[var(--foreground)] hover:bg-[var(--background)] cursor-pointer",
                        sortOption === option.value && "bg-[var(--accent)]/10"
                      )}
                    >
                      <Icon className="w-4 h-4 text-[var(--foreground)]/60 shrink-0" />
                      <span className="flex-1">{option.label}</span>
                      {sortOption === option.value && (
                        <Check className="w-4 h-4 text-[var(--accent)] shrink-0" />
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Bulk operations toggle */}
          {!checkboxMode ? (
            searchQuery.trim() ? (
              // Show split buttons when actively filtering
              <div className="flex gap-2">
                <button
                  onClick={() => setCheckboxMode(true)}
                  className="flex-[2] flex items-center justify-center gap-2 px-4 py-2 bg-[var(--background)] border border-[var(--border-color)] rounded-lg text-[var(--heading-text)] hover:border-[var(--accent)] hover:bg-[var(--foreground)]/5 transition-colors font-medium"
                >
                  <CheckSquare className="w-4 h-4" />
                  Select Multiple
                </button>
                <Button
                  onClick={handleToggleAllFiltered}
                  variant="primary"
                  size="md"
                  className="flex-1"
                  title={allFilteredChecked ? "Uncheck all filtered tags" : "Check all filtered tags"}
                  icon={<CheckCheck className="w-4 h-4" />}
                >
                  <span className="hidden sm:inline">{allFilteredChecked ? "Uncheck" : "Check"} All</span>
                  <span className="sm:hidden">All</span>
                </Button>
              </div>
            ) : (
              // Show single button when not filtering
              <button
                onClick={() => setCheckboxMode(true)}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-[var(--background)] border border-[var(--border-color)] rounded-lg text-[var(--heading-text)] hover:border-[var(--accent)] hover:bg-[var(--foreground)]/5 transition-colors font-medium"
              >
                <CheckSquare className="w-4 h-4" />
                Select Multiple
              </button>
            )
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
              <Button
                onClick={handleBulkDeleteClick}
                disabled={checkedTags.size < 1}
                variant="danger"
                size="md"
                fullWidth
              >
                Delete Selected
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Tags list */}
      <div ref={scrollContainerRef} className="lg:flex-1 lg:overflow-y-auto space-y-2 custom-scrollbar">
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
});
