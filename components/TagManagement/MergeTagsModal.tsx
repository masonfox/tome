"use client";

import { useState, useEffect, useMemo } from "react";
import BaseModal from "@/components/BaseModal";
import { MergeIcon } from "lucide-react";
import { TagOperationResults } from "./TagOperationResults";
import type { TagOperationResult } from "@/types/tag-operations";

interface TagWithCount {
  name: string;
  bookCount: number;
}

interface MergeTagsModalProps {
  isOpen: boolean;
  onClose: () => void;
  sourceTags: string[];
  tagStats?: TagWithCount[];
  onConfirm: (targetTag: string) => void;
  loading?: boolean;
  result?: TagOperationResult | null;  // Add result prop
}

export function MergeTagsModal({
  isOpen,
  onClose,
  sourceTags,
  tagStats = [],
  onConfirm,
  loading = false,
  result = null,
}: MergeTagsModalProps) {
  /**
   * Smart default: Select the tag with the most books as the target.
   * This way, the target tag already exists and won't be deleted,
   * preventing the "can't merge a tag into itself" error.
   */
  const defaultTargetTag = useMemo(() => {
    if (sourceTags.length === 0) return "";
    
    // If we have stats, use the tag with the most books
    if (tagStats.length > 0) {
      const relevantStats = tagStats.filter(stat => 
        sourceTags.includes(stat.name)
      );
      
      if (relevantStats.length > 0) {
        const maxTag = relevantStats.reduce((max, tag) => 
          tag.bookCount > max.bookCount ? tag : max
        );
        return maxTag.name;
      }
    }
    
    // Fallback to first tag if no stats available
    return sourceTags[0];
  }, [sourceTags, tagStats]);

  const [targetTag, setTargetTag] = useState(defaultTargetTag);
  const [error, setError] = useState<string | null>(null);

  // Compute source tags to display (excluding the current target tag)
  const displaySourceTags = useMemo(() => {
    return sourceTags.filter(tag => tag !== targetTag);
  }, [sourceTags, targetTag]);

  // Reset state when modal opens or when result is cleared
  useEffect(() => {
    if (isOpen && !result) {
      setTargetTag(defaultTargetTag);
      setError(null);
    }
  }, [isOpen, defaultTargetTag, result]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validation
    if (!targetTag.trim()) {
      setError("Target tag name cannot be empty");
      return;
    }

    onConfirm(targetTag.trim());
  };

  const handleCancel = () => {
    setError(null);
    onClose();
  };

  // Show results mode if we have results
  const showingResults = !!result;

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={handleCancel}
      title={showingResults ? "Merge Results" : "Merge Tags"}
      subtitle={showingResults ? undefined : `Merging ${sourceTags.length} tags`}
      size="md"
      loading={loading}
      allowBackdropClose={showingResults}
      actions={
        showingResults ? (
          <div className="flex items-center justify-end">
            <button
              type="button"
              onClick={handleCancel}
              className="px-4 py-2 bg-[var(--accent)] text-white rounded-md hover:bg-[var(--light-accent)] transition-colors font-medium"
            >
              Close
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={handleCancel}
              disabled={loading}
              className="px-4 py-2 rounded-md text-[var(--foreground)] hover:bg-[var(--foreground)]/10 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <button
              type="submit"
              onClick={handleSubmit}
              disabled={!targetTag.trim() || loading}
              className="px-4 py-2 bg-[var(--accent)] text-white rounded-md hover:bg-[var(--light-accent)] transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <MergeIcon className="w-4 h-4" />
              {loading ? "Merging..." : "Merge Tags"}
            </button>
          </div>
        )
      }
    >
      {showingResults ? (
        <TagOperationResults
          operation="merge"
          result={result}
          operationDetails={{
            sourceTags: displaySourceTags,
            targetTag,
          }}
        />
      ) : (
        <form onSubmit={handleSubmit}>
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="block text-sm font-medium text-[var(--foreground)]">
              Source tags (will be removed)
            </label>
            <div className="max-h-[200px] overflow-y-auto space-y-1 custom-scrollbar">
              {displaySourceTags.map((tag) => {
                const tagStat = tagStats.find(stat => stat.name === tag);
                const bookCount = tagStat?.bookCount ?? 0;
                return (
                  <div
                    key={tag}
                    className="flex items-center justify-between px-3 py-2 bg-[var(--background)] rounded-md"
                  >
                    <span className="text-sm text-[var(--foreground)]">
                      {tag}
                    </span>
                    <span className="text-xs text-[var(--subheading-text)]">
                      {bookCount} {bookCount === 1 ? "book" : "books"}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <div>
            <label
              htmlFor="targetTag"
              className="block text-sm font-medium text-[var(--foreground)] mb-2"
            >
              Target tag (all books will be tagged with this)
            </label>
            <input
              id="targetTag"
              type="text"
              value={targetTag}
              onChange={(e) => {
                setTargetTag(e.target.value);
                setError(null);
              }}
              autoFocus
              className="w-full px-3 py-2 bg-[var(--background)] border border-[var(--border-color)] rounded-md text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent"
              placeholder="Enter target tag name"
            />
            {error && (
              <p className="mt-2 text-sm text-red-500">{error}</p>
            )}
          </div>

          <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
            <p className="text-sm text-[var(--foreground)]/70">
              <span className="font-medium">Note:</span> All books with any of the source tags will be tagged with &quot;{targetTag}&quot;. 
              The source tags will then be removed from the system.
            </p>
          </div>
        </div>
      </form>
      )}
    </BaseModal>
  );
}
