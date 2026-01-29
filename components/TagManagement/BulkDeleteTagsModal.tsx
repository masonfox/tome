"use client";

import BaseModal from "@/components/Modals/BaseModal";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/Utilities/Button";
import { TagOperationResults } from "./TagOperationResults";
import type { TagOperationResult } from "@/types/tag-operations";

interface BulkDeleteTagsModalProps {
  isOpen: boolean;
  onClose: () => void;
  tags: Array<{ name: string; bookCount: number }>;
  onConfirm: () => void;
  loading?: boolean;
  result?: TagOperationResult | null;  // Add result prop
}

export function BulkDeleteTagsModal({
  isOpen,
  onClose,
  tags,
  onConfirm,
  loading = false,
  result = null,
}: BulkDeleteTagsModalProps) {
  const handleConfirm = () => {
    onConfirm();
  };

  const totalBooks = tags.reduce((sum, tag) => sum + tag.bookCount, 0);
  const tagCount = tags.length;
  
  // Show results mode if we have results
  const showingResults = !!result;

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      title={showingResults ? "Bulk Delete Results" : "Delete Tags"}
      subtitle={showingResults ? undefined : `${tagCount} ${tagCount === 1 ? "tag" : "tags"} selected`}
      size="md"
      loading={loading}
      actions={
        showingResults ? (
          <div className="flex items-center justify-end">
            <Button
              variant="primary"
              size="md"
              onClick={onClose}
            >
              Close
            </Button>
          </div>
        ) : (
          <div className="flex items-center justify-end gap-3">
            <Button
              variant="ghost"
              size="md"
              onClick={onClose}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              size="md"
              onClick={handleConfirm}
              disabled={loading}
            >
              {loading ? "Deleting..." : `Delete ${tagCount} ${tagCount === 1 ? "Tag" : "Tags"}`}
            </Button>
          </div>
        )
      }
    >
      {showingResults ? (
        <TagOperationResults
          operation="bulk-delete"
          result={result}
          operationDetails={{
            deletedTags: tags.map(t => t.name),
          }}
        />
      ) : (
        <div className="space-y-4">
        <div className="flex items-start gap-3 p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
          <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-medium text-red-500 mb-1">
              Warning: This action cannot be undone
            </p>
            <p className="text-sm text-[var(--foreground)]/70">
              This will remove {tagCount === 1 ? "this tag" : "these tags"} from a total of{" "}
              <span className="font-semibold">{totalBooks}</span>{" "}
              {totalBooks === 1 ? "book" : "books"}.
            </p>
          </div>
        </div>

        {/* List of tags to be deleted */}
        <div className="space-y-2">
          <p className="text-sm font-medium text-[var(--foreground)]">
            Tags to be deleted:
          </p>
          <div className="max-h-[200px] overflow-y-auto space-y-1 custom-scrollbar">
            {tags.map((tag) => (
              <div
                key={tag.name}
                className="flex items-center justify-between px-3 py-2 bg-[var(--background)] rounded-md"
              >
                <span className="text-sm text-[var(--foreground)]">
                  {tag.name}
                </span>
                <span className="text-xs text-[var(--subheading-text)]">
                  {tag.bookCount} {tag.bookCount === 1 ? "book" : "books"}
                </span>
              </div>
            ))}
          </div>
        </div>

        <p className="text-sm text-[var(--foreground)]/70">
          Are you sure you want to delete {tagCount === 1 ? "this tag" : "these tags"}?
        </p>
      </div>
      )}
    </BaseModal>
  );
}
