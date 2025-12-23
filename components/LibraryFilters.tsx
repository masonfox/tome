"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { Search, Filter, X, Tag, ChevronDown, Check, Bookmark, Clock, BookOpen, BookCheck, Library as LibraryIcon, Star, ArrowUpDown, ArrowDownAZ, ArrowUpAZ, TrendingUp, TrendingDown, CalendarPlus, FileText } from "lucide-react";
import { cn } from "@/utils/cn";
import { STATUS_CONFIG } from "@/utils/statusConfig";

// Helper function to render star ratings
function renderStars(rating: number) {
  return (
    <span className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className={cn(
            "w-4 h-4",
            star <= rating 
              ? "fill-[var(--accent)] text-[var(--accent)]" 
              : "text-[var(--foreground)]/30"
          )}
        />
      ))}
    </span>
  );
}

// Move static options outside component to avoid recreation
const statusOptions = [
  { value: "all", label: "All Books", icon: LibraryIcon },
  { value: "to-read", label: "To Read", icon: Bookmark },
  { value: "read-next", label: "Read Next", icon: Clock },
  { value: "reading", label: "Reading", icon: BookOpen },
  { value: "read", label: "Read", icon: BookCheck },
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
  selectedTags: string[];
  onTagsChange: (tags: string[]) => void;
  availableTags: string[];
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
  selectedTags,
  onTagsChange,
  availableTags,
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
  const [showSortDropdown, setShowSortDropdown] = useState(false);
  
  const statusDropdownRef = useRef<HTMLDivElement>(null);
  const ratingDropdownRef = useRef<HTMLDivElement>(null);
  const sortDropdownRef = useRef<HTMLDivElement>(null);
  const tagInputRef = useRef<HTMLInputElement>(null);
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
      if (sortDropdownRef.current && !sortDropdownRef.current.contains(event.target as Node)) {
        setShowSortDropdown(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

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
    setTagSearchInput("");
    setShowTagSuggestions(false);
  };

  const handleTagRemove = (tagToRemove: string) => {
    onTagsChange(selectedTags.filter((tag) => tag !== tagToRemove));
  };

  const clearAllTags = () => {
    onTagsChange([]);
  };

  // Memoize expensive filtering operation
  const filteredTagSuggestions = useMemo(() => 
    availableTags
      .filter((tag) =>
        tag.toLowerCase().includes(tagSearchInput.toLowerCase()) &&
        !selectedTags.includes(tag)
      )
      .slice(0, 15),
    [availableTags, tagSearchInput, selectedTags]
  );

  // Memoize filter check
  const hasActiveFilters = useMemo(() => 
    search || statusFilter !== "all" || ratingFilter !== "all" || selectedTags.length > 0,
    [search, statusFilter, ratingFilter, selectedTags.length]
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
            <button
              type="button"
              onClick={onClearAll}
              disabled={loading || !hasActiveFilters}
              className={`px-3 py-1 text-sm text-[var(--foreground)]/70 hover:text-[var(--accent)] hover:bg-[var(--background)] rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                !hasActiveFilters ? 'invisible' : ''
              }`}
            >
              Clear All
            </button>
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
            <button
              type="submit"
              disabled={loading}
              className="px-4 bg-[var(--accent)] text-white rounded-md hover:bg-[var(--light-accent)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium shrink-0 self-stretch"
            >
              Search
            </button>
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
              className={`w-full px-3 bg-[var(--background)] border border-[var(--border-color)] rounded-md text-[var(--foreground)] hover:border-[var(--accent)] transition-colors flex items-center gap-2 disabled:opacity-50 h-[42px]`}
            >
              <LibraryIcon className="w-4 h-4 shrink-0" />
              <span className="flex-1 text-left min-w-0 truncate">
                {statusOptions.find(option => option.value === statusFilter)?.label || "All Books"}
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
                  {statusOptions.map((option) => {
                    const Icon = option.icon;
                    const statusConfig = option.value !== "all" ? STATUS_CONFIG[option.value as keyof typeof STATUS_CONFIG] : null;
                    return (
                      <button
                        key={option.value}
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
              className={`w-full px-3 bg-[var(--background)] border border-[var(--border-color)] rounded-md text-[var(--foreground)] hover:border-[var(--accent)] transition-colors flex items-center disabled:opacity-50 h-[42px]`}
            >
              <Star className="w-4 h-4 shrink-0 mr-2" />
              <div className="flex-1 min-w-0 overflow-hidden flex items-center">
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
                  "w-4 h-4 transition-transform shrink-0 ml-2",
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

        {/* Tag Filter Row */}
        {(availableTags.length > 0 || loadingTags) && (
          <div className="flex gap-3 items-start">
            <div className="flex-1 min-w-0">
              {/* Tag search input */}
              <div className="relative" ref={tagInputRef}>
                <Tag className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--foreground)]/40" />
                <input
                  type="text"
                  placeholder="Search tags..."
                  value={tagSearchInput}
                  onChange={(e) => {
                    setTagSearchInput(e.target.value);
                    setShowTagSuggestions(true);
                  }}
                  onFocus={() => setShowTagSuggestions(true)}
                  onBlur={() => {
                    // Delay to allow clicking on suggestions
                    setTimeout(() => setShowTagSuggestions(false), 200);
                  }}
                  disabled={loading || loadingTags}
                  className={`w-full pl-10 py-2 bg-[var(--background)] border border-[var(--border-color)] rounded-md text-[var(--foreground)] placeholder-[var(--foreground)]/50 focus:outline-none focus:border-[var(--accent)] transition-colors disabled:opacity-50`}
                />

                {/* Tag suggestions dropdown */}
                {showTagSuggestions && tagSearchInput.trim() && !loadingTags && (
                  <div className="absolute z-10 w-full mt-1 bg-[var(--card-bg)] border border-[var(--border-color)] max-h-60 overflow-y-auto shadow-lg">
                    {filteredTagSuggestions.length > 0 ? (
                      filteredTagSuggestions.map((tag) => (
                        <button
                          key={tag}
                          type="button"
                          onClick={() => handleTagSelect(tag)}
                          disabled={loading}
                          className="w-full px-4 py-2 text-left text-sm text-[var(--foreground)] hover:bg-[var(--background)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {tag}
                        </button>
                      ))
                    ) : (
                      <div className="px-4 py-2 text-sm text-[var(--foreground)]/50">
                        No matching tags found
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {selectedTags.length > 0 && (
              <button
                type="button"
                onClick={clearAllTags}
                disabled={loading || loadingTags}
                className={`px-3 py-2 text-sm text-[var(--foreground)]/70 hover:text-[var(--accent)] transition-colors shrink-0 disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                Clear ({selectedTags.length})
              </button>
            )}
          </div>
        )}

        {/* Selected tags */}
        {selectedTags.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {selectedTags.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => handleTagRemove(tag)}
                disabled={loading}
                className={`px-3 py-1 text-sm bg-[var(--accent)] text-white border border-[var(--accent)] flex items-center gap-1 hover:bg-[var(--light-accent)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {tag}
                <X className="w-3 h-3" />
              </button>
            ))}
          </div>
        )}
      </form>
    </div>
  );
}