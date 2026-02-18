"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { Tag as TagIcon, Check } from "lucide-react";
import { cn } from "@/utils/cn";

interface TagSelectorProps {
  availableTags: string[];
  selectedTags: string[];
  onTagsChange: (tags: string[]) => void;
  disabled?: boolean;
  placeholder?: string;
  allowCreate?: boolean;
}

export function TagSelector({
  availableTags,
  selectedTags,
  onTagsChange,
  disabled = false,
  placeholder = "Search or create tags...",
  allowCreate = true,
}: TagSelectorProps) {
  const [showDropdown, setShowDropdown] = useState(false);
  const [filterInput, setFilterInput] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Filter tags based on input and exclude already selected tags
  const filteredTags = useMemo(() => {
    const input = filterInput.trim().toLowerCase();
    
    return availableTags
      .filter(tag => 
        !selectedTags.includes(tag) && 
        tag.toLowerCase().includes(input)
      )
      .sort((a, b) => a.localeCompare(b));
  }, [availableTags, selectedTags, filterInput]);

  // Check if input matches an existing tag (case-insensitive)
  const exactMatch = useMemo(() => {
    const input = filterInput.trim().toLowerCase();
    if (!input) return null;
    
    return availableTags.find(
      tag => tag.toLowerCase() === input
    );
  }, [availableTags, filterInput]);

  // Handle input focus - open dropdown
  const handleFocus = () => {
    if (!disabled) {
      setShowDropdown(true);
    }
  };

  // Handle input change - filter tags
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFilterInput(e.target.value);
    setShowDropdown(true);
  };

  // Handle tag selection from dropdown (mouse/click)
  const handleTagClick = (tag: string) => {
    if (disabled) return;
    
    onTagsChange([...selectedTags, tag]);
    
    // Context-aware dropdown behavior:
    // - If user was searching (filterInput has content), close dropdown (they found what they wanted)
    // - If user was browsing (filterInput empty), keep open for rapid multi-selection
    const wasSearching = filterInput.trim().length > 0;
    
    setFilterInput(""); // Always clear search
    
    if (wasSearching) {
      setShowDropdown(false); // Close if user was searching
    }
    // else: keep dropdown open for browsing workflow
  };

  // Handle keyboard events
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      const trimmedInput = filterInput.trim();
      
      if (!trimmedInput) return;
      
      // Case-insensitive exact match
      if (exactMatch) {
        // Select existing tag (with its original casing)
        onTagsChange([...selectedTags, exactMatch]);
      } else if (allowCreate) {
        // Create new tag with user's casing
        onTagsChange([...selectedTags, trimmedInput]);
      }
      
      setFilterInput("");
      inputRef.current?.focus();
      // Keep dropdown open for keyboard power users (rapid-fire additions)
    } else if (e.key === "Escape") {
      setShowDropdown(false);
      inputRef.current?.blur();
    }
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current && 
        !dropdownRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setShowDropdown(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Determine empty state message
  const getEmptyMessage = () => {
    if (availableTags.length === 0) {
      return "No tags yet. Start typing to create your first tag!";
    }
    
    if (filterInput.trim()) {
      if (exactMatch) {
        return null; // Will show the matching tag
      }
      return allowCreate 
        ? `Press Enter to create "${filterInput.trim()}"`
        : "No matching tags found";
    }
    
    return "All tags are already selected";
  };

  const emptyMessage = getEmptyMessage();
  const showEmptyMessage = filteredTags.length === 0 && emptyMessage;

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Input Field */}
      <div className="relative">
        <TagIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--foreground)]/40 pointer-events-none z-10" />
        <input
          ref={inputRef}
          type="text"
          placeholder={placeholder}
          value={filterInput}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={handleFocus}
          disabled={disabled}
          className="w-full pl-10 pr-4 py-2 bg-[var(--background)] border border-[var(--border-color)] rounded-md text-[var(--foreground)] placeholder-[var(--foreground)]/50 focus:outline-none focus:border-[var(--accent)] transition-colors disabled:opacity-50"
        />
      </div>

      {/* Dropdown */}
      {showDropdown && !disabled && (
        <div className="absolute z-[60] w-full mt-1 bg-[var(--card-bg)] border border-[var(--border-color)] rounded-md shadow-xl max-h-60 overflow-y-auto">
          {showEmptyMessage ? (
            <div className="px-4 py-6 text-center text-sm text-[var(--foreground)]/50">
              {emptyMessage}
            </div>
          ) : (
            <>
              {filteredTags.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => handleTagClick(tag)}
                  className={cn(
                    "w-full px-4 py-2.5 text-left text-sm text-[var(--foreground)] hover:bg-[var(--background)] transition-colors flex items-center justify-between border-b border-[var(--border-color)] last:border-b-0"
                  )}
                >
                  <span>{tag}</span>
                  {/* Optional: show checkmark if we want to indicate it's being added */}
                </button>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}
