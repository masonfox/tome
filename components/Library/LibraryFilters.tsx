"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { Search, Filter, X, Tag, ChevronDown, Check, Bookmark, Clock, BookOpen, BookCheck, BookX, Library as LibraryIcon, Star, ArrowUpDown, ArrowDownAZ, ArrowUpAZ, TrendingUp, TrendingDown, CalendarPlus, FileText, FolderOpen, Database, User, Globe } from "lucide-react";
import { Button } from "@/components/Utilities/Button";
import { cn } from "@/utils/cn";
import { STATUS_CONFIG } from "@/utils/statusConfig";
import { getShelfIcon } from "@/components/ShelfManagement/ShelfIconPicker";
import { ShelfAvatar } from "@/components/ShelfManagement/ShelfAvatar";
import { StarRating } from "@/components/Utilities/StarRating";

// Helper function to render star ratings
function renderStars(rating: number) {
  return <StarRating rating={rating} size="sm" />;
}

// Move static options outside component to avoid recreation
const statusOptions = [
  { value: "all", label: "All Statuses", icon: LibraryIcon },
  { value: "to-read", label: "To Read", icon: Bookmark },
  { value: "read-next", label: "Read Next", icon: Clock },
  { value: "reading", label: "Reading", icon: BookOpen },
  { value: "read", label: "Read", icon: BookCheck },
  { value: "dnf", label: "DNF", icon: BookX },
];

// T051: Source filter options
const sourceOptions = [
  { value: "calibre", label: "Calibre", icon: Database },
  { value: "manual", label: "Manual", icon: User },
  { value: "hardcover", label: "Hardcover", icon: BookOpen },
  { value: "openlibrary", label: "Open Library", icon: Globe },
];

// Grouped rating options with star rendering support
const ratingOptionGroups = [
  {
    label: "General",
    options: [
      { value: "all", label: "All Ratings", stars: null as number | null },
      { value: "rated", label: "Rated", stars: null as number | null },
      { value: "unrated", label: "Unrated", stars: null as number | null },
    ],
  },
  {
    label: "By Rating",
    options: [
      { value: "5", label: "5 Stars", stars: 5 as number | null },
      { value: "4", label: "4 Stars", stars: 4 as number | null },
      { value: "3", label: "3 Stars", stars: 3 as number | null },
      { value: "2", label: "2 Stars", stars: 2 as number | null },
      { value: "1", label: "1 Star", stars: 1 as number | null },
    ],
  },
];

// Flatten for easy lookup
const ratingOptions = ratingOptionGroups.flatMap(group => group.options);

// Grouped sort options for better organization
const sortOptionGroups = [
  {
    label: "By Date",
    options: [
      { value: "created", label: "Recently Added", icon: CalendarPlus },
      { value: "recently_read", label: "Recently Read", icon: BookCheck },
      { value: "created_desc", label: "Oldest First", icon: CalendarPlus },
    ],
  },
  {
    label: "By Title & Author",
    options: [
      { value: "title", label: "Title A-Z", icon: ArrowDownAZ },
      { value: "title_desc", label: "Title Z-A", icon: ArrowUpAZ },
      { value: "author", label: "Author A-Z", icon: ArrowDownAZ },
      { value: "author_desc", label: "Author Z-A", icon: ArrowUpAZ },
    ],
  },
  {
    label: "By Rating & Length",
    options: [
      { value: "rating", label: "Highest Rated", icon: TrendingUp },
      { value: "rating_asc", label: "Lowest Rated", icon: TrendingDown },
      { value: "pages", label: "Shortest First", icon: FileText },
      { value: "pages_desc", label: "Longest First", icon: FileText },
    ],
  },
];

// Flatten for easy lookup
const sortOptions = sortOptionGroups.flatMap(group => group.options);

interface LibraryFiltersProps {
  search: string;
  onSearchChange: (search: string) => void;
  onSearchSubmit?: () => void;
  onSearchClear?: () => void;
  statusFilter: string;
  onStatusFilterChange: (status: string) => void;
  ratingFilter: string;
  onRatingFilterChange: (rating: string) => void;
  shelfFilter?: number | null;
  onShelfFilterChange?: (shelfId: number | null) => void;
  availableShelves?: Array<{ id: number; name: string; color: string | null; icon?: string | null }>;
  loadingShelves?: boolean;
  selectedTags: string[];
  onTagsChange: (tags: string[]) => void;
  availableTags: string[];
  noTags?: boolean;
  onNoTagsChange?: (noTags: boolean) => void;
  selectedSources?: string[]; // T051: Add source filter
  onSourcesChange?: (sources: string[]) => void; // T051: Add source filter
  sortBy: string;
  onSortChange: (sort: string) => void;
  loading?: boolean;
  loadingTags?: boolean;
  onClearAll?: () => void;
}

export function LibraryFilters({
  search,
  onSearchChange,
  onSearchSubmit,
  onSearchClear,
  statusFilter,
  onStatusFilterChange,
  ratingFilter,
  onRatingFilterChange,
  shelfFilter,
  onShelfFilterChange,
  availableShelves = [],
  loadingShelves = false,
  selectedTags,
  onTagsChange,
  availableTags,
  noTags = false,
  onNoTagsChange,
  selectedSources = [], // T051: Add source filter
  onSourcesChange, // T051: Add source filter
  sortBy,
  onSortChange,
  loading = false,
  loadingTags = false,
  onClearAll,
}: LibraryFiltersProps) {
  const [tagSearchInput, setTagSearchInput] = useState("");
  const [showTagSuggestions, setShowTagSuggestions] = useState(false);
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);
  const [showRatingDropdown, setShowRatingDropdown] = useState(false);
  const [showShelfDropdown, setShowShelfDropdown] = useState(false);
  const [showSourceDropdown, setShowSourceDropdown] = useState(false); // T051: Add source dropdown state
  const [showSortDropdown, setShowSortDropdown] = useState(false);
  
  const statusDropdownRef = useRef<HTMLDivElement>(null);
  const ratingDropdownRef = useRef<HTMLDivElement>(null);
  const shelfDropdownRef = useRef<HTMLDivElement>(null);
  const sourceDropdownRef = useRef<HTMLDivElement>(null); // T051: Add source dropdown ref
  const sortDropdownRef = useRef<HTMLDivElement>(null);
  const tagDropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Close dropdowns when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (statusDropdownRef.current && !statusDropdownRef.current.contains(event.target as Node)) {
        setShowStatusDropdown(false);
      }
      if (ratingDropdownRef.current && !ratingDropdownRef.current.contains(event.target as Node)) {
        setShowRatingDropdown(false);
      }
      if (shelfDropdownRef.current && !shelfDropdownRef.current.contains(event.target as Node)) {
        setShowShelfDropdown(false);
      }
      if (sourceDropdownRef.current && !sourceDropdownRef.current.contains(event.target as Node)) {
        setShowSourceDropdown(false);
      }
      if (sortDropdownRef.current && !sortDropdownRef.current.contains(event.target as Node)) {
        setShowSortDropdown(false);
      }
      if (tagDropdownRef.current && !tagDropdownRef.current.contains(event.target as Node)) {
        setShowTagSuggestions(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Clear tag search input when dropdown closes
  useEffect(() => {
    if (!showTagSuggestions) {
      setTagSearchInput("");
    }
  }, [showTagSuggestions]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (onSearchSubmit) {
      onSearchSubmit();
    }
    // Blur the search input to dismiss the keyboard on mobile
    if (searchInputRef.current) {
      searchInputRef.current.blur();
    }
  };

  const handleTagSelect = (tag: string) => {
    onTagsChange([...selectedTags, tag]);
    setTagSearchInput(""); // Clear search but keep dropdown open
  };

  const handleTagRemove = (tagToRemove: string) => {
    onTagsChange(selectedTags.filter((tag) => tag !== tagToRemove));
  };

  const clearAllTags = () => {
    onTagsChange([]);
  };

  // Memoize expensive filtering operation
  const filteredTagSuggestions = useMemo(() => {
    // Show all unselected tags if no search input
    if (!tagSearchInput.trim()) {
      return availableTags.filter((tag) => !selectedTags.includes(tag));
    }
    // Otherwise filter by search input
    return availableTags
      .filter((tag) =>
        tag.toLowerCase().includes(tagSearchInput.toLowerCase()) &&
        !selectedTags.includes(tag)
      )
      .slice(0, 50); // Increased limit for better UX in dropdown
  }, [availableTags, tagSearchInput, selectedTags]);

  // Memoize filter check
  const hasActiveFilters = useMemo(() =>
    search || statusFilter !== "all" || ratingFilter !== "all" || shelfFilter || selectedTags.length > 0 || noTags || selectedSources.length > 0,
    [search, statusFilter, ratingFilter, shelfFilter, selectedTags.length, noTags, selectedSources.length]
  );

  // Clear all filters on Escape key
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && hasActiveFilters && onClearAll && !loading) {
        // Don't clear filters if user is actively typing in an input or textarea
        const activeElement = document.activeElement;
        const isInputActive = activeElement?.tagName === 'INPUT' || 
                              activeElement?.tagName === 'TEXTAREA' ||
                              activeElement?.getAttribute('contenteditable') === 'true';
        
        if (isInputActive) {
          return; // Let the input handle Escape (e.g., blur, clear suggestions)
        }
        
        event.preventDefault();
        onClearAll();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [hasActiveFilters, onClearAll, loading]);

  return (
    <div className="bg-[var(--card-bg)] border border-[var(--border-color)] rounded-md p-4">
      {/* Header with Filters label, Clear All, and Sort */}
      <div className="flex justify-between items-center mb-3">
        <div className="flex items-center gap-2">
          <Filter className="w-5 h-5 text-[var(--foreground)]/40" />
          <span className="text-sm font-medium text-[var(--foreground)]/70">Filters & Sort</span>
        </div>
        
        <div className="flex items-center gap-2">
          {/* Clear All Button */}
          {onClearAll && (
            <Button
              type="button"
              onClick={onClearAll}
              disabled={loading || !hasActiveFilters}
              variant="ghost"
              size="sm"
              className={`${!hasActiveFilters ? 'invisible' : ''}`}
            >
              Clear All
            </Button>
          )}
          
          {/* Sort Dropdown */}
          <div className="relative" ref={sortDropdownRef}>
            <button
              type="button"
              onClick={() => setShowSortDropdown(!showSortDropdown)}
              disabled={loading}
              className="px-3 py-1 bg-[var(--background)] border border-[var(--border-color)] rounded-md text-sm text-[var(--foreground)] hover:border-[var(--accent)] transition-colors flex items-center gap-2 disabled:opacity-50"
            >
              <ArrowUpDown className="w-4 h-4 shrink-0" />
              <span className="hidden sm:inline">
                {sortOptions.find(option => option.value === sortBy)?.label || "Recently Added"}
              </span>
              <ChevronDown
                className={cn(
                  "w-4 h-4 transition-transform shrink-0",
                  showSortDropdown && "rotate-180"
                )}
              />
            </button>

            {showSortDropdown && (
              <div className="absolute z-10 right-0 mt-1 bg-[var(--card-bg)] border border-[var(--border-color)] rounded shadow-lg overflow-hidden min-w-[200px] max-h-[70vh] overflow-y-auto">
                {sortOptionGroups.map((group, groupIndex) => (
                  <div key={group.label}>
                    {/* Group Header */}
                    <div className="px-3 py-1.5 text-xs font-semibold text-[var(--foreground)]/50 uppercase tracking-wide bg-[var(--card-bg)] sticky top-0 z-10">
                      {group.label}
                    </div>
                    
                    {/* Group Options */}
                    {group.options.map((option) => {
                      const Icon = option.icon;
                      return (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => {
                            onSortChange(option.value);
                            setShowSortDropdown(false);
                          }}
                          disabled={loading}
                          className={cn(
                            "w-full px-4 py-2 text-left flex items-center gap-2 transition-colors text-sm",
                            "text-[var(--foreground)] hover:bg-[var(--background)] cursor-pointer",
                            sortBy === option.value && "bg-[var(--accent)]/10",
                            loading && "opacity-50 cursor-not-allowed"
                          )}
                        >
                          <Icon className="w-4 h-4 text-[var(--foreground)]/60 shrink-0" />
                          <span className="flex-1">{option.label}</span>
                          {sortBy === option.value && (
                            <Check className="w-4 h-4 text-[var(--accent)] shrink-0" />
                          )}
                        </button>
                      );
                    })}
                    
                    {/* Divider between groups (except last) */}
                    {groupIndex < sortOptionGroups.length - 1 && (
                      <div className="h-px bg-[var(--border-color)] my-1" />
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <form onSubmit={handleSearchSubmit} className="space-y-3">
        {/* Search Bar - Full Width with Button */}
        <div className="w-full">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--foreground)]/40" />
              <input
                type="text"
                placeholder="Search books..."
                value={search}
                onChange={(e) => onSearchChange(e.target.value)}
                disabled={loading}
                ref={searchInputRef}
                className={`w-full pl-10 py-2 bg-[var(--background)] border border-[var(--border-color)] rounded-md text-[var(--foreground)] placeholder-[var(--foreground)]/50 focus:outline-none focus:border-[var(--accent)] transition-colors disabled:opacity-50 ${
                  search ? "pr-10" : "pr-4"
                }`}
              />
              {search && (
                <button
                  type="button"
                  onClick={() => {
                    onSearchChange("");
                    if (onSearchClear) {
                      onSearchClear();
                    }
                  }}
                  disabled={loading}
                  className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--foreground)]/40 hover:text-[var(--foreground)] transition-colors disabled:opacity-50"
                >
                  <X className="w-5 h-5" />
                </button>
              )}
            </div>
            <Button
              type="submit"
              disabled={loading}
              variant="primary"
              size="md"
              className="shrink-0 self-stretch"
            >
              Search
            </Button>
          </div>
        </div>

        {/* Status and Rating Filters Row - 50% Each */}
        <div className="grid grid-cols-2 gap-3">
          {/* Status Dropdown */}
          <div className="relative" ref={statusDropdownRef}>
            <button
              type="button"
              onClick={() => setShowStatusDropdown(!showStatusDropdown)}
              disabled={loading}
              className={`w-full px-3 py-2 bg-[var(--background)] border border-[var(--border-color)] rounded-md text-[var(--foreground)] hover:border-[var(--accent)] transition-colors flex items-center gap-2 disabled:opacity-50 min-h-[42px]`}
            >
              <LibraryIcon className="w-4 h-4 shrink-0" />
              <span className="flex-1 truncate text-left text-sm">
                {statusOptions.find(option => option.value === statusFilter)?.label || "All Statuses"}
              </span>
              <ChevronDown
                className={cn(
                  "w-4 h-4 transition-transform shrink-0",
                  showStatusDropdown && "rotate-180"
                )}
              />
            </button>

              {showStatusDropdown && (
                <div className="absolute z-10 w-full mt-1 bg-[var(--card-bg)] border border-[var(--border-color)] rounded shadow-lg overflow-hidden">
                  {statusOptions.map((option, index) => {
                    const Icon = option.icon;
                    const statusConfig = option.value !== "all" ? STATUS_CONFIG[option.value as keyof typeof STATUS_CONFIG] : null;
                    const isFirstItem = index === 0;
                    const showDivider = isFirstItem;
                    
                    return (
                      <div key={option.value}>
                        <button
                          type="button"
                          onClick={() => {
                            onStatusFilterChange(option.value);
                            setShowStatusDropdown(false);
                          }}
                          disabled={loading}
                          className={cn(
                            "w-full px-4 py-2.5 text-left flex items-center gap-2 transition-colors",
                            "text-[var(--foreground)] hover:bg-[var(--background)] cursor-pointer",
                            statusFilter === option.value && "bg-[var(--accent)]/10",
                            loading && "opacity-50 cursor-not-allowed"
                          )}
                        >
                          {statusConfig ? (
                            <div className={cn(
                              "w-7 h-7 rounded-md flex items-center justify-center bg-gradient-to-r shadow-sm",
                              statusConfig.lightGradient
                            )}>
                              <Icon className="w-4 h-4 text-white" />
                            </div>
                          ) : (
                            <Icon className="w-4 h-4 text-[var(--foreground)]/60" />
                          )}
                          <span className="font-medium flex-1">{option.label}</span>
                          {statusFilter === option.value && (
                            <Check className="w-5 h-5 text-[var(--accent)]" />
                          )}
                        </button>
                        
                        {/* Divider after "All Statuses" */}
                        {showDivider && (
                          <div className="h-px bg-[var(--border-color)]" />
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

          {/* Rating Dropdown */}
          <div className="relative" ref={ratingDropdownRef}>
            <button
              type="button"
              onClick={() => setShowRatingDropdown(!showRatingDropdown)}
              disabled={loading}
              className={`w-full px-3 py-2 bg-[var(--background)] border border-[var(--border-color)] rounded-md text-[var(--foreground)] hover:border-[var(--accent)] transition-colors flex items-center gap-2 disabled:opacity-50 min-h-[42px]`}
            >
              <Star className="w-4 h-4 shrink-0" />
              <div className="flex-1 min-w-0 overflow-hidden flex items-center text-sm h-[20px]">
                {(() => {
                  const selected = ratingOptions.find(option => option.value === ratingFilter);
                  if (selected?.stars) {
                    return renderStars(selected.stars);
                  }
                  return selected?.label || "All Ratings";
                })()}
              </div>
              <ChevronDown
                className={cn(
                  "w-4 h-4 transition-transform shrink-0",
                  showRatingDropdown && "rotate-180"
                )}
              />
            </button>

            {showRatingDropdown && (
              <div className="absolute z-10 w-full mt-1 bg-[var(--card-bg)] border border-[var(--border-color)] rounded shadow-lg overflow-hidden max-h-[70vh] overflow-y-auto">
                {ratingOptionGroups.map((group, groupIndex) => (
                  <div key={group.label}>
                    {/* Group Header */}
                    <div className="px-3 py-1.5 text-xs font-semibold text-[var(--foreground)]/50 uppercase tracking-wide bg-[var(--card-bg)] sticky top-0 z-10">
                      {group.label}
                    </div>
                    
                    {/* Group Options */}
                    {group.options.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => {
                          onRatingFilterChange(option.value);
                          setShowRatingDropdown(false);
                        }}
                        disabled={loading}
                        className={cn(
                          "w-full px-4 py-2 text-left flex items-center gap-2 transition-colors text-sm",
                          "text-[var(--foreground)] hover:bg-[var(--background)] cursor-pointer",
                          ratingFilter === option.value && "bg-[var(--accent)]/10",
                          loading && "opacity-50 cursor-not-allowed"
                        )}
                      >
                        <span className="flex-1 flex items-center">
                          {option.stars ? renderStars(option.stars) : option.label}
                        </span>
                        {ratingFilter === option.value && (
                          <Check className="w-4 h-4 text-[var(--accent)] shrink-0" />
                        )}
                      </button>
                    ))}
                    
                    {/* Divider between groups (except last) */}
                    {groupIndex < ratingOptionGroups.length - 1 && (
                      <div className="h-px bg-[var(--border-color)] my-1" />
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Source Filter - Multi-select dropdown */}
        <div className="w-full">
          <div className="relative" ref={sourceDropdownRef}>
            <button
              type="button"
              onClick={() => setShowSourceDropdown(!showSourceDropdown)}
              disabled={loading}
              className={cn(
                "w-full px-3 py-2 bg-[var(--background)] border border-[var(--border-color)] rounded-md text-[var(--foreground)] hover:border-[var(--accent)] transition-colors flex items-center gap-2 disabled:opacity-50 min-h-[42px]",
                selectedSources.length > 0 && "ring-2 ring-[var(--accent)]"
              )}
            >
              <Database className="w-4 h-4 shrink-0" />
              <span className="flex-1 truncate text-left text-sm">
                {selectedSources.length > 0
                  ? `Source (${selectedSources.length})`
                  : "All Sources"}
              </span>
              <ChevronDown
                className={cn(
                  "w-4 h-4 transition-transform shrink-0",
                  showSourceDropdown && "rotate-180"
                )}
              />
            </button>

            {showSourceDropdown && (
              <div className="absolute z-10 w-full mt-1 bg-[var(--card-bg)] border border-[var(--border-color)] rounded shadow-lg overflow-hidden max-h-[70vh] overflow-y-auto">
                {sourceOptions.map((option) => {
                  const Icon = option.icon;
                  const isSelected = selectedSources.includes(option.value);
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => {
                        if (isSelected) {
                          onSourcesChange?.(selectedSources.filter(s => s !== option.value));
                        } else {
                          onSourcesChange?.([...selectedSources, option.value]);
                        }
                      }}
                      disabled={loading}
                      className={cn(
                        "w-full px-4 py-2.5 text-left flex items-center gap-2 transition-colors text-sm",
                        "text-[var(--foreground)] hover:bg-[var(--background)] cursor-pointer",
                        isSelected && "bg-[var(--accent)]/10",
                        loading && "opacity-50 cursor-not-allowed"
                      )}
                    >
                      <Icon className="w-4 h-4 text-[var(--foreground)]/60 shrink-0" />
                      <span className="flex-1">{option.label}</span>
                      {isSelected && (
                        <Check className="w-4 h-4 text-[var(--accent)] shrink-0" />
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Tag Filter Dropdown */}
        {(availableTags.length > 0 || loadingTags) && (
          <div className="w-full">
            <div className="relative" ref={tagDropdownRef}>
              <button
                type="button"
                onClick={() => setShowTagSuggestions(!showTagSuggestions)}
                disabled={loading || loadingTags}
                className={`w-full px-3 py-2 bg-[var(--background)] border border-[var(--border-color)] rounded-md text-[var(--foreground)] hover:border-[var(--accent)] transition-colors flex items-center gap-2 disabled:opacity-50 min-h-[42px]`}
              >
                <Tag className="w-4 h-4 shrink-0" />
                <span className="flex-1 truncate text-left text-sm">
                  {noTags
                    ? "Books Without Tags"
                    : selectedTags.length > 0
                    ? `${selectedTags.length} tag${selectedTags.length === 1 ? '' : 's'} selected`
                    : "All Tags"}
                </span>
                <ChevronDown
                  className={cn(
                    "w-4 h-4 transition-transform shrink-0",
                    showTagSuggestions && "rotate-180"
                  )}
                />
              </button>

              {showTagSuggestions && (
                <div className="absolute z-10 w-full mt-1 bg-[var(--card-bg)] border border-[var(--border-color)] rounded shadow-lg overflow-hidden max-h-[70vh] overflow-y-auto">
                  {/* All Tags Option */}
                  <button
                    type="button"
                    onClick={() => {
                      if (noTags) {
                        onNoTagsChange?.(false);
                      }
                      if (selectedTags.length > 0) {
                        onTagsChange([]);
                      }
                      setShowTagSuggestions(false);
                    }}
                    disabled={loading || loadingTags}
                    className={cn(
                      "w-full px-4 py-2.5 text-left text-sm text-[var(--foreground)] hover:bg-[var(--background)] transition-colors flex items-center justify-between disabled:opacity-50 disabled:cursor-not-allowed",
                      !noTags && selectedTags.length === 0 && "bg-[var(--accent)]/10"
                    )}
                  >
                    <span>All Tags</span>
                    {!noTags && selectedTags.length === 0 && (
                      <Check className="w-4 h-4 text-[var(--accent)] shrink-0" />
                    )}
                  </button>

                  {/* Books Without Tags Option */}
                  {onNoTagsChange && (
                    <button
                      type="button"
                      onClick={() => {
                        onNoTagsChange(true);
                        if (selectedTags.length > 0) {
                          onTagsChange([]);
                        }
                        setShowTagSuggestions(false);
                      }}
                      disabled={loading || loadingTags}
                      className={cn(
                        "w-full px-4 py-2.5 text-left text-sm text-[var(--foreground)] hover:bg-[var(--background)] transition-colors flex items-center justify-between disabled:opacity-50 disabled:cursor-not-allowed",
                        noTags && "bg-[var(--accent)]/10"
                      )}
                    >
                      <span>Books Without Tags</span>
                      {noTags && (
                        <Check className="w-4 h-4 text-[var(--accent)] shrink-0" />
                      )}
                    </button>
                  )}

                  {/* Divider */}
                  <div className="h-px bg-[var(--border-color)]" />

                  {/* Search input within dropdown */}
                  <div className="py-2 sticky top-0 bg-[var(--card-bg-emphasis)]">
                    <input
                      type="text"
                      placeholder="Search tags..."
                      value={tagSearchInput}
                      onChange={(e) => setTagSearchInput(e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                      disabled={loading || loadingTags}
                      className="w-full px-4 py-1.5 bg-transparent text-sm text-[var(--foreground)] placeholder-[var(--foreground)]/50 focus:outline-none transition-colors disabled:opacity-50"
                    />
                  </div>

                  {/* Divider */}
                  <div className="h-px bg-[var(--border-color)]" />

                  {/* Tag list */}
                  <div className="max-h-60 overflow-y-auto">
                    {filteredTagSuggestions.length > 0 ? (
                      filteredTagSuggestions.map((tag) => {
                        const isSelected = selectedTags.includes(tag);
                        return (
                          <button
                            key={tag}
                            type="button"
                            onClick={() => {
                              // Clear noTags if selecting a tag
                              if (noTags) {
                                onNoTagsChange?.(false);
                              }
                              handleTagSelect(tag);
                            }}
                            disabled={loading}
                            className={cn(
                              "w-full px-4 py-2.5 text-left text-sm text-[var(--foreground)] hover:bg-[var(--background)] transition-colors flex items-center justify-between disabled:opacity-50 disabled:cursor-not-allowed",
                              isSelected && "bg-[var(--accent)]/10"
                            )}
                          >
                            <span>{tag}</span>
                            {isSelected && (
                              <Check className="w-4 h-4 text-[var(--accent)] shrink-0" />
                            )}
                          </button>
                        );
                      })
                    ) : (
                      <div className="px-4 py-2 text-sm text-[var(--foreground)]/50">
                        No matching tags found
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Selected tags pills */}
        {selectedTags.length > 0 && !noTags && (
          <div className="flex flex-wrap gap-2">
            {selectedTags.map((tag) => (
              <Button
                key={tag}
                type="button"
                onClick={() => handleTagRemove(tag)}
                disabled={loading}
                variant="primary"
                size="sm"
                iconAfter={<X className="w-3 h-3" />}
              >
                {tag}
              </Button>
            ))}
          </div>
        )}

        {/* Shelf Filter Row */}
        {onShelfFilterChange && (
          <div className="w-full">
            <div className="relative" ref={shelfDropdownRef}>
              <button
                type="button"
                onClick={() => setShowShelfDropdown(!showShelfDropdown)}
                disabled={loading || loadingShelves}
                className={`w-full px-3 py-2 bg-[var(--background)] border border-[var(--border-color)] rounded-md text-[var(--foreground)] hover:border-[var(--accent)] transition-colors flex items-center gap-2 disabled:opacity-50 min-h-[42px]`}
              >
                <FolderOpen className="w-4 h-4 shrink-0" />
                <span className="flex-1 truncate text-left text-sm">
                  {shelfFilter
                    ? availableShelves.find((s) => s.id === shelfFilter)?.name || "All Shelves"
                    : "All Shelves"}
                </span>
                <ChevronDown
                  className={cn(
                    "w-4 h-4 transition-transform shrink-0",
                    showShelfDropdown && "rotate-180"
                  )}
                />
              </button>

              {showShelfDropdown && (
                <div className="absolute z-10 w-full mt-1 bg-[var(--card-bg)] border border-[var(--border-color)] rounded shadow-lg overflow-hidden max-h-[70vh] overflow-y-auto">
                  {/* All Shelves Option */}
                  <button
                    type="button"
                    onClick={() => {
                      onShelfFilterChange(null);
                      setShowShelfDropdown(false);
                    }}
                    disabled={loading}
                    className={cn(
                      "w-full px-4 py-2.5 text-left flex items-center gap-2 transition-colors",
                      "text-[var(--foreground)] hover:bg-[var(--background)] cursor-pointer",
                      !shelfFilter && "bg-[var(--accent)]/10",
                      loading && "opacity-50 cursor-not-allowed"
                    )}
                  >
                    <FolderOpen className="w-4 h-4 text-[var(--foreground)]/60" />
                    <span className="font-medium flex-1">All Shelves</span>
                    {!shelfFilter && (
                      <Check className="w-5 h-5 text-[var(--accent)]" />
                    )}
                  </button>

                  {/* Divider */}
                  {availableShelves.length > 0 && (
                    <div className="h-px bg-[var(--border-color)]" />
                  )}

                  {/* Individual Shelves */}
                  {loadingShelves ? (
                    <div className="px-4 py-2.5 text-sm text-[var(--foreground)]/50">
                      Loading shelves...
                    </div>
                  ) : availableShelves.length === 0 ? (
                    <div className="px-4 py-2.5 text-sm text-[var(--foreground)]/50">
                      No shelves available
                    </div>
                  ) : (
                    availableShelves.map((shelf) => {
                      const ShelfIcon = (shelf.icon ? getShelfIcon(shelf.icon) : null) || FolderOpen;
                      return (
                        <button
                          key={shelf.id}
                          type="button"
                          onClick={() => {
                            onShelfFilterChange(shelf.id);
                            setShowShelfDropdown(false);
                          }}
                          disabled={loading}
                          className={cn(
                            "w-full px-4 py-2.5 text-left flex items-center gap-2 transition-colors",
                            "text-[var(--foreground)] hover:bg-[var(--background)] cursor-pointer",
                            shelfFilter === shelf.id && "bg-[var(--accent)]/10",
                            loading && "opacity-50 cursor-not-allowed"
                          )}
                        >
                          <ShelfAvatar
                            color={shelf.color || "var(--foreground-20)"}
                            icon={shelf.icon}
                            size="sm"
                            shape="rounded"
                            className="w-7 h-7"
                          />
                          <span className="font-medium flex-1">{shelf.name}</span>
                          {shelfFilter === shelf.id && (
                            <Check className="w-5 h-5 text-[var(--accent)]" />
                          )}
                        </button>
                      );
                    })
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </form>
    </div>
  );
}