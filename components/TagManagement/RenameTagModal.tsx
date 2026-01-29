"use client";

import { useState, useEffect } from "react";
import BaseModal from "@/components/Modals/BaseModal";
import { Button } from "@/components/Utilities/Button";
import { TagOperationResults } from "./TagOperationResults";
import type { TagOperationResult } from "@/types/tag-operations";

interface RenameTagModalProps {
  isOpen: boolean;
  onClose: () => void;
  tagName: string;
  onConfirm: (newName: string) => void;
  loading?: boolean;
  result?: TagOperationResult | null;  // Add result prop
}

export function RenameTagModal({
  isOpen,
  onClose,
  tagName,
  onConfirm,
  loading = false,
  result = null,
}: RenameTagModalProps) {
  const [newName, setNewName] = useState(tagName);
  const [error, setError] = useState<string | null>(null);

  // Reset state when modal opens or when result is cleared
  useEffect(() => {
    if (isOpen && !result) {
      setNewName(tagName);
      setError(null);
    }
  }, [isOpen, tagName, result]);

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

  // Show results mode if we have results
  const showingResults = !!result;

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={handleCancel}
      title={showingResults ? "Rename Results" : "Rename Tag"}
      subtitle={showingResults ? undefined : `Current name: "${tagName}"`}
      size="md"
      loading={loading}
      allowBackdropClose={showingResults}
      actions={
        showingResults ? (
          <div className="flex items-center justify-end">
            <Button
              variant="primary"
              size="sm"
              onClick={handleCancel}
            >
              Close
            </Button>
          </div>
        ) : (
          <div className="flex items-center justify-end gap-3">
            <Button
              variant="tertiary"
              size="sm"
              onClick={handleCancel}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              type="submit"
              onClick={handleSubmit}
              disabled={!newName.trim() || newName === tagName || loading}
            >
              {loading ? "Renaming..." : "Rename"}
            </Button>
          </div>
        )
      }
    >
      {showingResults ? (
        <TagOperationResults
          operation="rename"
          result={result}
          operationDetails={{
            oldName: tagName,
            newName,
          }}
        />
      ) : (
        <form onSubmit={handleSubmit}>
        <div className="space-y-4">
          <div>
            <label
              htmlFor="newTagName"
              className="block text-sm font-medium text-[var(--heading-text)] mb-2"
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
              className="w-full px-3 py-2 bg-[var(--background)] border border-[var(--border-color)] rounded-lg text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent"
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
      )}
    </BaseModal>
  );
}
