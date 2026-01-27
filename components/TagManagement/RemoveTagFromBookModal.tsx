"use client";

import BaseModal from "@/components/Modals/BaseModal";
import { AlertTriangle } from "lucide-react";

interface RemoveTagFromBookModalProps {
  isOpen: boolean;
  onClose: () => void;
  tagName: string;
  bookTitle: string;
  onConfirm: () => void;
  loading?: boolean;
}

export function RemoveTagFromBookModal({
  isOpen,
  onClose,
  tagName,
  bookTitle,
  onConfirm,
  loading = false,
}: RemoveTagFromBookModalProps) {
  const handleConfirm = () => {
    onConfirm();
  };

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      title="Remove Tag from Book"
      size="md"
      loading={loading}
      actions={
        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 text-sm font-medium text-[var(--foreground)] hover:bg-[var(--hover-bg)] rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={loading}
            className="px-4 py-2 text-sm font-medium bg-red-500 text-white rounded-md hover:bg-red-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "Removing..." : "Remove Tag"}
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="flex items-start gap-3 p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
          <AlertTriangle className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm text-[var(--foreground)]/70">
              Remove the tag <span className="font-semibold">&quot;{tagName}&quot;</span> from{" "}
              <span className="font-semibold">&quot;{bookTitle}&quot;</span>?
            </p>
          </div>
        </div>

        <p className="text-xs text-[var(--foreground)]/50">
          You can still add the tag back by going to the book&apos;s detail page.
        </p>
      </div>
    </BaseModal>
  );
}
