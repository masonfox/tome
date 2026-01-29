"use client";

import BaseModal from "@/components/Modals/BaseModal";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/Utilities/Button";
import { TagOperationResults } from "./TagOperationResults";
import type { TagOperationResult } from "@/types/tag-operations";

interface DeleteTagModalProps {
  isOpen: boolean;
  onClose: () => void;
  tagName: string;
  bookCount: number;
  onConfirm: () => void;
  loading?: boolean;
  result?: TagOperationResult | null;  // Add result prop
}

export function DeleteTagModal({
  isOpen,
  onClose,
  tagName,
  bookCount,
  onConfirm,
  loading = false,
  result = null,
}: DeleteTagModalProps) {
  const handleConfirm = () => {
    onConfirm();
  };

  // Show results mode if we have results
  const showingResults = !!result;

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      title={showingResults ? "Delete Results" : "Delete Tag"}
      subtitle={showingResults ? undefined : `"${tagName}"`}
      size="md"
      loading={loading}
      actions={
        showingResults ? (
          <div className="flex items-center justify-end">
            <Button
              variant="primary"
              size="sm"
              onClick={onClose}
            >
              Close
            </Button>
          </div>
        ) : (
          <div className="flex items-center justify-end gap-3">
            <Button
              variant="tertiary"
              size="sm"
              onClick={onClose}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={handleConfirm}
              disabled={loading}
            >
              {loading ? "Deleting..." : "Delete Tag"}
            </Button>
          </div>
        )
      }
    >
      {showingResults ? (
        <TagOperationResults
          operation="delete"
          result={result}
          operationDetails={{
            deletedTag: tagName,
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
              This will remove the tag <span className="font-semibold">&quot;{tagName}&quot;</span> from all{" "}
              <span className="font-semibold">{bookCount}</span>{" "}
              {bookCount === 1 ? "book" : "books"} that currently have it.
            </p>
          </div>
        </div>
        <p className="text-sm text-[var(--foreground)]/70">
          Are you sure you want to delete this tag?
        </p>
      </div>
      )}
    </BaseModal>
  );
}
