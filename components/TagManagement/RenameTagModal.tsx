"use client";

import { useState, useEffect } from "react";
import BaseModal from "@/components/BaseModal";

interface RenameTagModalProps {
  isOpen: boolean;
  onClose: () => void;
  tagName: string;
  onConfirm: (newName: string) => void;
  loading?: boolean;
}

export function RenameTagModal({
  isOpen,
  onClose,
  tagName,
  onConfirm,
  loading = false,
}: RenameTagModalProps) {
  const [newName, setNewName] = useState(tagName);
  const [error, setError] = useState<string | null>(null);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setNewName(tagName);
      setError(null);
    }
  }, [isOpen, tagName]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validation
    if (!newName.trim()) {
      setError("Tag name cannot be empty");
      return;
    }
    
    if (newName === tagName) {
      setError("New name must be different from current name");
      return;
    }

    onConfirm(newName.trim());
  };

  const handleCancel = () => {
    setError(null);
    onClose();
  };

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={handleCancel}
      title="Rename Tag"
      subtitle={`Current name: "${tagName}"`}
      size="md"
      loading={loading}
      actions={
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
            disabled={!newName.trim() || newName === tagName || loading}
            className="px-4 py-2 bg-[var(--accent)] text-white rounded-md hover:bg-[var(--light-accent)] transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "Renaming..." : "Rename"}
          </button>
        </div>
      }
    >
      <form onSubmit={handleSubmit}>
        <div className="space-y-4">
          <div>
            <label
              htmlFor="newTagName"
              className="block text-sm font-medium text-[var(--foreground)] mb-2"
            >
              New tag name
            </label>
            <input
              id="newTagName"
              type="text"
              value={newName}
              onChange={(e) => {
                setNewName(e.target.value);
                setError(null);
              }}
              autoFocus
              className="w-full px-3 py-2 bg-[var(--background)] border border-[var(--border-color)] rounded-md text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent"
              placeholder="Enter new tag name"
            />
            {error && (
              <p className="mt-2 text-sm text-red-500">{error}</p>
            )}
          </div>
          <p className="text-sm text-[var(--foreground)]/70">
            This will rename the tag across all books that have it.
          </p>
        </div>
      </form>
    </BaseModal>
  );
}
