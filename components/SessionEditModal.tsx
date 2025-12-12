"use client";

import { useState, useEffect, useRef } from "react";
import BaseModal from "./BaseModal";
import { getTodayLocalDate } from "@/utils/dateFormatting";
import MarkdownEditor from "@/components/MarkdownEditor";
import { useDraftField } from "@/hooks/useDraftField";

interface SessionEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (data: {
    startedDate: string | null;
    completedDate: string | null;
    review: string | null;
  }) => void;
  bookTitle: string;
  sessionNumber: number;
  sessionId: number;
  bookId: string;
  currentStartedDate?: string | null;
  currentCompletedDate?: string | null;
  currentReview?: string | null;
}

export default function SessionEditModal({
  isOpen,
  onClose,
  onConfirm,
  bookTitle,
  sessionNumber,
  sessionId,
  bookId,
  currentStartedDate,
  currentCompletedDate,
  currentReview,
}: SessionEditModalProps) {
  const [startedDate, setStartedDate] = useState("");
  const [completedDate, setCompletedDate] = useState("");
  const [review, setReview] = useState("");

  // Track whether we've already restored the draft for this modal session
  const hasRestoredDraft = useRef(false);

  // Draft management for review field
  const {
    draft: draftReview,
    saveDraft,
    clearDraft,
    isInitialized,
  } = useDraftField(`draft-session-edit-${bookId}-${sessionId}`);

  // Reset form when modal opens with current values
  useEffect(() => {
    if (isOpen) {
      // Convert ISO datetime to date-only string (YYYY-MM-DD) for input[type="date"]
      setStartedDate(
        currentStartedDate ? currentStartedDate.split("T")[0] : ""
      );
      setCompletedDate(
        currentCompletedDate ? currentCompletedDate.split("T")[0] : ""
      );
      setReview(currentReview || "");
      hasRestoredDraft.current = false; // Reset draft restoration flag
    }
  }, [isOpen, currentStartedDate, currentCompletedDate, currentReview]);

  // Restore draft only once when modal opens (if no existing review)
  useEffect(() => {
    if (isOpen && isInitialized && !currentReview && draftReview && !hasRestoredDraft.current) {
      setReview(draftReview);
      hasRestoredDraft.current = true;
    }
  }, [isOpen, isInitialized, currentReview, draftReview]);

  // Auto-save draft (only after initialization to prevent race condition)
  useEffect(() => {
    if (isInitialized && review && isOpen) {
      saveDraft(review);
    }
  }, [review, isInitialized, saveDraft, isOpen]);

  function handleSave() {
    // Convert date strings back to ISO format (with time set to midnight UTC)
    const startedISO = startedDate
      ? new Date(startedDate + "T00:00:00.000Z").toISOString()
      : null;
    const completedISO = completedDate
      ? new Date(completedDate + "T00:00:00.000Z").toISOString()
      : null;
    const reviewValue = review.trim() ? review.trim() : null;

    onConfirm({
      startedDate: startedISO,
      completedDate: completedISO,
      review: reviewValue,
    });
    
    // Clear draft after successful save
    clearDraft();
  }

  function handleClearDates() {
    setStartedDate("");
    setCompletedDate("");
  }

  function handleRemoveReview() {
    setReview("");
  }

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      title={`Edit Session - ${bookTitle} (Read #${sessionNumber})`}
      actions={
        <div className="flex justify-end gap-4">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-[var(--card-bg)] border border-[var(--border-color)] text-[var(--foreground)] font-semibold rounded hover:bg-[var(--background)] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 bg-[var(--accent)] text-white font-semibold rounded hover:bg-[var(--light-accent)] transition-colors"
          >
            Save
          </button>
        </div>
      }
    >
      <div className="space-y-6">
        {/* Date Fields */}
        <div className="space-y-4">
          <div>
            <label
              htmlFor="startedDate"
              className="block text-sm font-semibold text-[var(--foreground)]/80 mb-2"
            >
              Started Date
            </label>
            <input
              id="startedDate"
              type="date"
              value={startedDate}
              onChange={(e) => setStartedDate(e.target.value)}
              max={getTodayLocalDate()}
              className="w-full px-3 py-3 bg-[var(--background)] border border-[var(--border-color)] rounded text-[var(--foreground)] font-medium focus:outline-none focus:ring-2 focus:ring-[var(--accent)] max-h-[42px] text-left"
            />
          </div>

          <div>
            <label
              htmlFor="completedDate"
              className="block text-sm font-semibold text-[var(--foreground)]/80 mb-2"
            >
              Completed Date
            </label>
            <input
              id="completedDate"
              type="date"
              value={completedDate}
              onChange={(e) => setCompletedDate(e.target.value)}
              max={getTodayLocalDate()}
              className="w-full px-3 py-3 bg-[var(--background)] border border-[var(--border-color)] rounded text-[var(--foreground)] font-medium focus:outline-none focus:ring-2 focus:ring-[var(--accent)] max-h-[42px] text-left"
            />
          </div>

          {(startedDate || completedDate) && (
            <button
              onClick={handleClearDates}
              className="text-sm text-red-500 hover:text-red-600 font-semibold transition-colors"
            >
              Clear Dates
            </button>
          )}
        </div>

        {/* Review Field */}
        <div>
          <label
            htmlFor="review"
            className="block text-sm font-semibold text-[var(--foreground)]/80 mb-2"
          >
            Review
          </label>
          <div>
            <MarkdownEditor
              value={review}
              onChange={setReview}
              placeholder="Add your thoughts about this reading..."
              height={200}
              id="review"
            />
          </div>
          {review && (
            <button
              onClick={handleRemoveReview}
              className="mt-2 text-sm text-red-500 hover:text-red-600 font-semibold transition-colors"
            >
              Clear Review
            </button>
          )}
        </div>
      </div>
    </BaseModal>
  );
}
