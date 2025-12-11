"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { commands } from "@uiw/react-md-editor";
import "@uiw/react-md-editor/markdown-editor.css";
import "@uiw/react-markdown-preview/markdown.css";

const MDEditor = dynamic(
  () => import("@uiw/react-md-editor").then((mod) => mod.default),
  { ssr: false }
);

// Custom toolbar commands (excluding image, comment, code, codeBlock, checkedList)
const customCommands = [
  commands.bold,
  commands.italic,
  commands.strikethrough,
  commands.hr,
  commands.group([commands.title1, commands.title2, commands.title3, commands.title4, commands.title5, commands.title6], {
    name: 'title',
    groupName: 'title',
    buttonProps: { 'aria-label': 'Insert title' }
  }),
  commands.divider,
  commands.link,
  commands.quote,
  commands.table,
  commands.divider,
  commands.unorderedListCommand,
  commands.orderedListCommand,
  commands.divider,
  commands.help,
];

interface ReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (review: string | null) => void;
  bookTitle: string;
  sessionNumber: number;
  currentReview: string | null;
}

export default function ReviewModal({
  isOpen,
  onClose,
  onConfirm,
  bookTitle,
  sessionNumber,
  currentReview,
}: ReviewModalProps) {
  const [review, setReview] = useState(currentReview || "");

  // Reset review when modal opens
  useEffect(() => {
    if (isOpen) {
      setReview(currentReview || "");
    }
  }, [isOpen, currentReview]);

  if (!isOpen) return null;

  const handleSubmit = () => {
    // If review is empty or just whitespace, treat as removing the review
    const trimmedReview = review.trim();
    onConfirm(trimmedReview || null);
  };

  const handleRemove = () => {
    onConfirm(null);
  };

  const handleClose = () => {
    setReview(currentReview || "");
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-[var(--card-bg)] border border-[var(--border-color)] rounded-lg shadow-lg p-6 max-w-md w-full">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-xl font-serif font-bold text-[var(--heading-text)] mb-1">
              {currentReview ? "Edit Review" : "Add Review"}
            </h2>
            <p className="text-sm text-[var(--foreground)]/70 font-medium">
              {bookTitle} - Read #{sessionNumber}
            </p>
          </div>
          <button
            onClick={handleClose}
            className="text-[var(--foreground)]/50 hover:text-[var(--foreground)] transition-colors"
            aria-label="Close"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Review Editor */}
        <div className="mb-6">
          <label
            htmlFor="review"
            className="block text-sm font-semibold text-[var(--foreground)] mb-2"
          >
            Your Review
          </label>
          <div>
            <MDEditor
              value={review}
              onChange={(value) => setReview(value || "")}
              preview="edit"
              height={200}
              visibleDragbar={false}
              commands={customCommands}
              textareaProps={{
                placeholder: "What did you think about this book?",
                id: "review",
                autoFocus: true
              }}
            />
          </div>
          <p className="text-xs text-[var(--foreground)]/50 mt-1">
            Personal notes just for you
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3 justify-between">
          {/* Remove Review Button (left side) */}
          {currentReview && (
            <button
              onClick={handleRemove}
              className="px-4 py-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors font-semibold text-sm"
            >
              Remove Review
            </button>
          )}
          
          {/* Cancel & Save Buttons (right side) */}
          <div className="flex gap-3 ml-auto">
            <button
              onClick={handleClose}
              className="px-4 py-2 bg-[var(--border-color)] text-[var(--foreground)] rounded-lg hover:bg-[var(--light-accent)]/20 transition-colors font-semibold"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              className="px-4 py-2 bg-[var(--accent)] text-white rounded-lg hover:bg-[var(--light-accent)] transition-colors font-semibold"
            >
              Save Review
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
