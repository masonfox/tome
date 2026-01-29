"use client";

import { useState, useEffect } from "react";
import { X, Tag as TagIcon } from "lucide-react";
import { getLogger } from "@/lib/logger";
import { BottomSheet } from "@/components/Layout/BottomSheet";
import { TagSelector } from "@/components/TagManagement/TagSelector";
import { Button } from "@/components/Utilities/Button";

interface TagEditorProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (tags: string[]) => Promise<void>;
  bookTitle: string;
  currentTags: string[];
  availableTags: string[];
  isMobile?: boolean;
}

export default function TagEditor({
  isOpen,
  onClose,
  onSave,
  bookTitle,
  currentTags,
  availableTags,
  isMobile = false,
}: TagEditorProps) {
  const [tags, setTags] = useState<string[]>(currentTags);
  const [saving, setSaving] = useState(false);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setTags(currentTags);
      setSaving(false);
    }
  }, [isOpen, currentTags]);

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter((tag) => tag !== tagToRemove));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(tags);
      onClose();
    } catch (error) {
      // Error is handled by the parent component with toast
      getLogger().error({ err: error }, "Failed to save tags");
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    if (!saving) {
      setTags(currentTags);
      onClose();
    }
  };

  // Shared content for both mobile and desktop
  const tagContent = (
    <>
      {/* Subtitle - only show on mobile in BottomSheet */}
      {isMobile && (
        <p className="text-sm text-[var(--foreground)]/70 font-medium mb-4">
          {bookTitle}
        </p>
      )}

      {/* Tag Selector */}
      <div className="mb-6">
        <label className="block text-sm font-semibold text-[var(--foreground)] mb-3">
          Add Tags
        </label>
        <TagSelector
          availableTags={availableTags}
          selectedTags={tags}
          onTagsChange={setTags}
          disabled={saving}
          allowCreate={true}
          placeholder="Search or create tags..."
        />
        <p className="text-xs text-[var(--foreground)]/50 mt-2">
          Click tags to select, or press Enter to add and continue typing
        </p>
      </div>

      {/* Current Tags */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <label className="block text-sm font-semibold text-[var(--foreground)]">
            Current Tags {tags.length > 0 && `(${tags.length})`}
          </label>
          {tags.length > 0 && (
            <button
              type="button"
              onClick={() => setTags([])}
              disabled={saving}
              className="text-sm text-[var(--subheading-text)] hover:text-[var(--text)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Remove All
            </button>
          )}
        </div>
        {tags.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {tags.map((tag) => (
              <Button
                key={tag}
                type="button"
                onClick={() => handleRemoveTag(tag)}
                disabled={saving}
                variant="primary"
                size="sm"
                iconAfter={<X className="w-3.5 h-3.5" />}
              >
                {tag}
              </Button>
            ))}
          </div>
        ) : (
          <p className="text-sm text-[var(--foreground)]/50">
            No tags added yet
          </p>
        )}
      </div>
    </>
  );

  // Shared button elements
  const buttons = (
    <>
      <Button
        onClick={handleClose}
        disabled={saving}
        variant="secondary"
        size="sm"
      >
        Cancel
      </Button>
      <Button
        onClick={handleSave}
        disabled={saving}
        variant="primary"
        size="sm"
        isLoading={saving}
      >
        {saving ? "Saving..." : "Save Changes"}
      </Button>
    </>
  );

  // Mobile: Use BottomSheet
  if (isMobile) {
    return (
      <BottomSheet
        isOpen={isOpen}
        onClose={handleClose}
        title="Manage Tags"
        icon={<TagIcon className="w-5 h-5" />}
        size="default"
        allowBackdropClose={!saving}
      >
        <div className="min-h-[40vh] flex flex-col">
          {tagContent}
        </div>
        
        {/* Action Buttons */}
        <div className="mt-6 pt-4 border-t border-[var(--border-color)] flex gap-3 justify-end">
          {buttons}
        </div>
      </BottomSheet>
    );
  }

  // Desktop: Use centered modal
  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
      onClick={handleClose}
    >
      <div 
        className="bg-[var(--card-bg)] border border-[var(--border-color)] rounded-lg shadow-lg max-w-4xl w-full max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header - Fixed */}
        <div className="flex items-start justify-between p-6 pb-4 border-b border-[var(--border-color)] flex-shrink-0">
          <div className="flex-1 min-w-0 pr-4">
            <h2 className="text-xl font-serif font-bold text-[var(--heading-text)] mb-1">
              Edit Tags
            </h2>
            <p className="text-sm text-[var(--foreground)]/70 font-medium truncate">
              {bookTitle}
            </p>
          </div>
          <button
            onClick={handleClose}
            disabled={saving}
            className="text-[var(--foreground)]/50 hover:text-[var(--foreground)] transition-colors disabled:opacity-50 flex-shrink-0"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content - Scrollable */}
        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
          {tagContent}
        </div>

        {/* Action Buttons - Fixed at bottom */}
        <div className="p-6 pt-4 border-t border-[var(--border-color)] flex gap-3 justify-end flex-shrink-0">
          {buttons}
        </div>
      </div>
    </div>
  );
}
