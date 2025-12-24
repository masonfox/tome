"use client";

import { useState, useEffect, useRef } from "react";
import { X, Tag as TagIcon } from "lucide-react";
import { cn } from "@/utils/cn";

interface TagEditorProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (tags: string[]) => Promise<void>;
  bookTitle: string;
  currentTags: string[];
  availableTags: string[];
}

export default function TagEditor({
  isOpen,
  onClose,
  onSave,
  bookTitle,
  currentTags,
  availableTags,
}: TagEditorProps) {
  const [tags, setTags] = useState<string[]>(currentTags);
  const [tagInput, setTagInput] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setTags(currentTags);
      setTagInput("");
      setShowSuggestions(false);
      setSaving(false);
    }
  }, [isOpen, currentTags]);

  // Filter suggestions based on input and exclude already selected tags
  const filteredSuggestions = availableTags
    .filter((tag) => 
      tag.toLowerCase().includes(tagInput.toLowerCase().trim()) &&
      !tags.includes(tag)
    )
    .slice(0, 10); // Limit to 10 suggestions

  const handleAddTag = (tag: string) => {
    const trimmedTag = tag.trim();
    if (trimmedTag && !tags.includes(trimmedTag)) {
      setTags([...tags, trimmedTag]);
      setTagInput("");
      setShowSuggestions(false);
      inputRef.current?.focus();
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter((tag) => tag !== tagToRemove));
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      const trimmedInput = tagInput.trim();
      
      // If there are suggestions and input matches one exactly, use that
      if (filteredSuggestions.length > 0) {
        const exactMatch = filteredSuggestions.find(
          (tag) => tag.toLowerCase() === trimmedInput.toLowerCase()
        );
        if (exactMatch) {
          handleAddTag(exactMatch);
          return;
        }
      }
      
      // Otherwise, add the input as a new tag
      if (trimmedInput) {
        handleAddTag(trimmedInput);
      }
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(tags);
      onClose();
    } catch (error) {
      // Error is handled by the parent component with toast
      console.error("Failed to save tags:", error);
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    if (!saving) {
      setTags(currentTags);
      setTagInput("");
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
      onClick={handleClose}
    >
      <div 
        className="bg-[var(--card-bg)] border border-[var(--border-color)] rounded-lg shadow-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <h2 className="text-xl font-serif font-bold text-[var(--heading-text)] mb-1">
              Edit Tags
            </h2>
            <p className="text-sm text-[var(--foreground)]/70 font-medium">
              {bookTitle}
            </p>
          </div>
          <button
            onClick={handleClose}
            disabled={saving}
            className="text-[var(--foreground)]/50 hover:text-[var(--foreground)] transition-colors disabled:opacity-50"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tag Input */}
        <div className="mb-6">
          <label className="block text-sm font-semibold text-[var(--foreground)] mb-3">
            Add Tags
          </label>
          <div className="relative">
            <TagIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--foreground)]/40" />
            <input
              ref={inputRef}
              type="text"
              placeholder="Search or create tags..."
              value={tagInput}
              onChange={(e) => {
                setTagInput(e.target.value);
                setShowSuggestions(true);
              }}
              onKeyDown={handleKeyDown}
              onFocus={() => setShowSuggestions(true)}
              onBlur={() => {
                // Delay to allow clicking on suggestions
                setTimeout(() => setShowSuggestions(false), 200);
              }}
              disabled={saving}
              className="w-full pl-10 pr-4 py-2 bg-[var(--background)] border border-[var(--border-color)] rounded-md text-[var(--foreground)] placeholder-[var(--foreground)]/50 focus:outline-none focus:border-[var(--accent)] transition-colors disabled:opacity-50"
            />

            {/* Tag suggestions dropdown */}
            {showSuggestions && tagInput.trim() && (
              <div className="absolute z-10 w-full mt-1 bg-[var(--card-bg)] border border-[var(--border-color)] max-h-60 overflow-y-auto shadow-lg rounded-md">
                {filteredSuggestions.length > 0 ? (
                  filteredSuggestions.map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => handleAddTag(tag)}
                      disabled={saving}
                      className="w-full px-4 py-2 text-left text-sm text-[var(--foreground)] hover:bg-[var(--background)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {tag}
                    </button>
                  ))
                ) : (
                  <div className="px-4 py-2 text-sm text-[var(--foreground)]/70">
                    Press Enter to create &quot;{tagInput.trim()}&quot;
                  </div>
                )}
              </div>
            )}
          </div>
          <p className="text-xs text-[var(--foreground)]/50 mt-2">
            Type and press Enter to add a tag, or select from suggestions
          </p>
        </div>

        {/* Current Tags */}
        <div className="mb-6">
          <label className="block text-sm font-semibold text-[var(--foreground)] mb-3">
            Current Tags {tags.length > 0 && `(${tags.length})`}
          </label>
          {tags.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {tags.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => handleRemoveTag(tag)}
                  disabled={saving}
                  className="px-3 py-1 text-sm bg-[var(--accent)] text-white rounded flex items-center gap-1 hover:bg-[var(--light-accent)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {tag}
                  <X className="w-3 h-3" />
                </button>
              ))}
            </div>
          ) : (
            <p className="text-sm text-[var(--foreground)]/50">
              No tags added yet
            </p>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3 justify-end">
          <button
            onClick={handleClose}
            disabled={saving}
            className="px-4 py-2 bg-[var(--border-color)] text-[var(--foreground)] rounded-lg hover:bg-[var(--light-accent)]/20 transition-colors font-semibold disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className={cn(
              "px-4 py-2 rounded-lg transition-colors font-semibold",
              saving
                ? "bg-[var(--border-color)] text-[var(--foreground)]/50 cursor-not-allowed"
                : "bg-[var(--accent)] text-white hover:bg-[var(--light-accent)]"
            )}
          >
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}
