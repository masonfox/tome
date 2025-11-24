"use client";

import { X, BookOpen } from "lucide-react";

interface RereadConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  bookTitle: string;
}

export default function RereadConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  bookTitle,
}: RereadConfirmModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-[var(--card-bg)] border border-[var(--border-color)] rounded-lg shadow-lg p-6 max-w-md w-full">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-[var(--accent)]/10 rounded-lg">
              <BookOpen className="w-6 h-6 text-[var(--accent)]" />
            </div>
            <div>
              <h2 className="text-xl font-serif font-bold text-[var(--heading-text)]">
                Start Re-reading?
              </h2>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-[var(--foreground)]/50 hover:text-[var(--foreground)] transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="mb-6">
          <p className="text-lg italic font-bold font-serif text-[var(--heading-text)]  mb-3">
            {bookTitle}
          </p>
          <p className="text-sm text-[var(--subheading-text)] font-medium">
            This will start a new reading session. Your previous reading history will be preserved.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-[var(--border-color)] text-[var(--foreground)] rounded-lg hover:bg-[var(--light-accent)]/20 transition-colors font-semibold"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 bg-[var(--accent)] text-white rounded-lg hover:bg-[var(--light-accent)] transition-colors font-semibold"
          >
            Start Re-reading
          </button>
        </div>
      </div>
    </div>
  );
}
