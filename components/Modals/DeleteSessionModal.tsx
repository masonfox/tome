"use client";

import { X, Trash2 } from "lucide-react";
import { Button } from "@/components/Utilities/Button";
import { useState } from "react";

interface DeleteSessionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  sessionNumber: number;
  progressCount: number;
  bookTitle: string;
  isActive: boolean;
}

export default function DeleteSessionModal({
  isOpen,
  onClose,
  onConfirm,
  sessionNumber,
  progressCount,
  bookTitle,
  isActive,
}: DeleteSessionModalProps) {
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen) return null;

  async function handleConfirm() {
    setSubmitting(true);
    try {
      await onConfirm();
      onClose();
    } catch (error) {
      // Error handling done by parent component (toast)
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-[var(--card-bg)] border border-[var(--border-color)] rounded-lg shadow-lg p-6 max-w-md w-full">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-500/10 rounded-lg">
              <Trash2 className="w-6 h-6 text-red-600 dark:text-red-500" />
            </div>
            <div>
              <h2 className="text-xl font-serif font-bold text-[var(--heading-text)]">
                Delete Read #{sessionNumber}?
              </h2>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-[var(--foreground)]/50 hover:text-[var(--foreground)] transition-colors"
            aria-label="Close"
            disabled={submitting}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="mb-6">
          <p className="text-lg italic font-bold font-serif text-[var(--heading-text)] mb-3">
            {bookTitle}
          </p>
          <div className="text-sm text-[var(--subheading-text)] font-medium space-y-2">
            <p className="font-semibold text-red-600 dark:text-red-500">
              This will permanently delete:
            </p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>
                {progressCount} progress {progressCount === 1 ? "log" : "logs"}
              </li>
              <li>All reading history for this session</li>
              {isActive && (
                <li className="text-[var(--foreground)]/80">
                  A new "Want to Read" session will be created
                </li>
              )}
            </ul>
            <p className="font-semibold text-red-600 dark:text-red-500 pt-2">
              This action cannot be undone.
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3 justify-end">
          <Button
            variant="ghost"
            onClick={onClose}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button
            variant="danger"
            onClick={handleConfirm}
            disabled={submitting}
          >
            {submitting ? "Deleting..." : "Delete Session"}
          </Button>
        </div>
      </div>
    </div>
  );
}
