"use client";

import { useState, useEffect } from "react";
import BaseModal from "@/components/BaseModal";
import { MergeIcon } from "lucide-react";

interface MergeTagsModalProps {
  isOpen: boolean;
  onClose: () => void;
  sourceTags: string[];
  onConfirm: (targetTag: string) => void;
  loading?: boolean;
}

export function MergeTagsModal({
  isOpen,
  onClose,
  sourceTags,
  onConfirm,
  loading = false,
}: MergeTagsModalProps) {
  const [targetTag, setTargetTag] = useState(sourceTags[0] || "");
  const [error, setError] = useState<string | null>(null);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setTargetTag(sourceTags[0] || "");
      setError(null);
    }
  }, [isOpen, sourceTags]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validation
    if (!targetTag.trim()) {
      setError("Target tag name cannot be empty");
      return;
    }

    onConfirm(targetTag.trim());
    onClose();
  };

  const handleCancel = () => {
    setError(null);
    onClose();
  };

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={handleCancel}
      title="Merge Tags"
      subtitle={`Merging ${sourceTags.length} tags`}
      size="md"
      loading={loading}
      actions={
        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={handleCancel}
            className="px-4 py-2 rounded-md text-[var(--foreground)] hover:bg-[var(--foreground)]/10 transition-colors font-medium"
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
            Merge Tags
          </button>
        </div>
      }
    >
      <form onSubmit={handleSubmit}>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-[var(--foreground)] mb-2">
              Source tags (will be removed)
            </label>
            <div className="p-3 bg-[var(--background)] border border-[var(--border-color)] rounded-md">
              <div className="flex flex-wrap gap-2">
                {sourceTags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center px-2 py-1 bg-[var(--foreground)]/10 text-[var(--foreground)] text-sm rounded-md"
                  >
                    {tag}
                  </span>
                ))}
              </div>
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
              <span className="font-medium">Note:</span> All books with any of the source tags will be tagged with "{targetTag}". 
              The source tags will then be removed from the system.
            </p>
          </div>
        </div>
      </form>
    </BaseModal>
  );
}
