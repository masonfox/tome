"use client";

import BaseModal from "@/components/BaseModal";
import { AlertTriangle } from "lucide-react";

interface DeleteTagModalProps {
  isOpen: boolean;
  onClose: () => void;
  tagName: string;
  bookCount: number;
  onConfirm: () => void;
  loading?: boolean;
}

export function DeleteTagModal({
  isOpen,
  onClose,
  tagName,
  bookCount,
  onConfirm,
  loading = false,
}: DeleteTagModalProps) {
  const handleConfirm = () => {
    onConfirm();
    onClose();
  };

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      title="Delete Tag"
      subtitle={`"${tagName}"`}
      size="md"
      loading={loading}
      actions={
        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-md text-[var(--foreground)] hover:bg-[var(--foreground)]/10 transition-colors font-medium"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={loading}
            className="px-4 py-2 bg-red-500 text-white rounded-md hover:bg-red-600 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Delete Tag
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="flex items-start gap-3 p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
          <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-medium text-red-500 mb-1">
              Warning: This action cannot be undone
            </p>
            <p className="text-sm text-[var(--foreground)]/70">
              This will remove the tag <span className="font-semibold">"{tagName}"</span> from all{" "}
              <span className="font-semibold">{bookCount}</span>{" "}
              {bookCount === 1 ? "book" : "books"} that currently have it.
            </p>
          </div>
        </div>
        <p className="text-sm text-[var(--foreground)]/70">
          Are you sure you want to delete this tag?
        </p>
      </div>
    </BaseModal>
  );
}
