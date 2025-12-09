"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { Search, Filter, X, Tag, ChevronDown, Check, Bookmark, Clock, BookOpen, BookCheck, Library as LibraryIcon, Star } from "lucide-react";
import { cn } from "@/utils/cn";

// Move static options outside component to avoid recreation
const statusOptions = [
  { value: "all", label: "All Books", icon: LibraryIcon },
  { value: "to-read", label: "To Read", icon: Bookmark },
  { value: "read-next", label: "Read Next", icon: Clock },
  { value: "reading", label: "Reading", icon: BookOpen },
  { value: "read", label: "Read", icon: BookCheck },
];

const ratingOptions = [
  { value: "all", label: "All Ratings" },
  { value: "5", label: "5 Stars" },
  { value: "4", label: "4 Stars" },
  { value: "3", label: "3 Stars" },
  { value: "2", label: "2 Stars" },
  { value: "1", label: "1 Stars" },
  { value: "unrated", label: "Unrated" },
];

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
  loading?: boolean;
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
  loading = false,
  onClearAll,
}: LibraryFiltersProps) {
  const [tagSearchInput, setTagSearchInput] = useState("");
  const [showTagSuggestions, setShowTagSuggestions] = useState(false);
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);
  const [showRatingDropdown, setShowRatingDropdown] = useState(false);
  
  const statusDropdownRef = useRef<HTMLDivElement>(null);
  const ratingDropdownRef = useRef<HTMLDivElement>(null);
  const tagInputRef = useRef<HTMLInputElement>(null);

  // Close dropdowns when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (statusDropdownRef.current && !statusDropdownRef.current.contains(event.target as Node)) {
        setShowStatusDropdown(false);
      }
      if (ratingDropdownRef.current && !ratingDropdownRef.current.contains(event.target as Node)) {
        setShowRatingDropdown(false);
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

  return (
    <div className="bg-[var(--card-bg)] border border-[var(--border-color)] rounded-md p-4">
      {/* Header with Clear All button */}
      <div className="flex justify-between items-center mb-3">
        <div className="flex items-center gap-2">
          <Filter className="w-5 h-5 text-[var(--foreground)]/40" />
          <span className="text-sm font-medium text-[var(--foreground)]/70">Filters</span>
        </div>
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
              className={`w-full px-3 py-2 bg-[var(--background)] border border-[var(--border-color)] rounded-md text-[var(--foreground)] hover:border-[var(--accent)] transition-colors flex items-center gap-2 disabled:opacity-50`}
            >
              <span className="truncate flex-1 text-left">
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
                        <Icon className="w-4 h-4 text-[var(--foreground)]/60" />
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
              className={`w-full px-3 py-2 bg-[var(--background)] border border-[var(--border-color)] rounded-md text-[var(--foreground)] hover:border-[var(--accent)] transition-colors flex items-center gap-2 disabled:opacity-50`}
            >
              <Star className="w-4 h-4 shrink-0" />
              <span className="truncate flex-1 text-left">
                {ratingOptions.find(option => option.value === ratingFilter)?.label || "All Ratings"}
              </span>
              <ChevronDown
                className={cn(
                  "w-4 h-4 transition-transform shrink-0",
                  showRatingDropdown && "rotate-180"
                )}
              />
            </button>

            {showRatingDropdown && (
              <div className="absolute z-10 w-full mt-1 bg-[var(--card-bg)] border border-[var(--border-color)] rounded shadow-lg overflow-hidden">
                {ratingOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => {
                      onRatingFilterChange(option.value);
                      setShowRatingDropdown(false);
                    }}
                    disabled={loading}
                    className={cn(
                      "w-full px-4 py-2.5 text-left flex items-center gap-2 transition-colors",
                      "text-[var(--foreground)] hover:bg-[var(--background)] cursor-pointer",
                      ratingFilter === option.value && "bg-[var(--accent)]/10",
                      loading && "opacity-50 cursor-not-allowed"
                    )}
                  >
                    <span className="font-medium flex-1">{option.label}</span>
                    {ratingFilter === option.value && (
                      <Check className="w-5 h-5 text-[var(--accent)]" />
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Tag Filter Row */}
        {availableTags.length > 0 && (
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
                  disabled={loading}
                  className={`w-full pl-10 py-2 bg-[var(--background)] border border-[var(--border-color)] rounded-md text-[var(--foreground)] placeholder-[var(--foreground)]/50 focus:outline-none focus:border-[var(--accent)] transition-colors disabled:opacity-50`}
                />

                {/* Tag suggestions dropdown */}
                {showTagSuggestions && tagSearchInput.trim() && (
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
                disabled={loading}
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