"use client";

import { useState, useEffect } from "react";
import BaseModal from "./BaseModal";
import { getTodayLocalDate } from '@/utils/dateHelpers';
import MarkdownEditor from "@/components/Markdown/MarkdownEditor";
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
  const [isFormReady, setIsFormReady] = useState(false);

  // Draft management for review field
  const {
    draft: draftReview,
    saveDraft,
    clearDraft,
    isInitialized,
  } = useDraftField(`draft-session-edit-${bookId}-${sessionId}`);

  // Coordinated form initialization - wait for draft hook to initialize before setting values
  // This prevents the race condition where form resets before draft loads from localStorage
  useEffect(() => {
    if (isOpen && isInitialized) {
      // Convert ISO datetime to date-only string (YYYY-MM-DD) for input[type="date"]
      setStartedDate(
        currentStartedDate ? currentStartedDate.split("T")[0] : ""
      );
      setCompletedDate(
        currentCompletedDate ? currentCompletedDate.split("T")[0] : ""
      );
      
      // Prioritize current review over draft
      // If there's a current review, use it; otherwise use draft if available
      if (currentReview) {
        setReview(currentReview);
      } else if (draftReview) {
        setReview(draftReview);
      } else {
        setReview("");
      }
      
      setIsFormReady(true);
    } else if (!isOpen) {
      // Reset form ready state when modal closes
      setIsFormReady(false);
    }
  }, [isOpen, isInitialized, currentStartedDate, currentCompletedDate, currentReview, draftReview]);

  // Auto-save draft (only after form is ready to prevent race condition)
  useEffect(() => {
    if (isFormReady && review && isOpen) {
      saveDraft(review);
    }
  }, [review, isFormReady, saveDraft, isOpen]);

  function handleSave() {
    // Date inputs already provide YYYY-MM-DD format, send as-is
    const startedValue = startedDate || null;
    const completedValue = completedDate || null;
    const reviewValue = review.trim() ? review.trim() : null;

    onConfirm({
      startedDate: startedValue,
      completedDate: completedValue,
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
      size="2xl"
      allowBackdropClose={false}
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
              className="w-full px-3 py-3 bg-[var(--background)] border border-[var(--border-color)] rounded text-[var(--foreground)] font-medium focus:outline-none focus:outline focus:outline-2 focus:outline-[var(--accent)] focus:outline-offset-2 max-h-[42px] text-left"
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
              className="w-full px-3 py-3 bg-[var(--background)] border border-[var(--border-color)] rounded text-[var(--foreground)] font-medium focus:outline-none focus:outline focus:outline-2 focus:outline-[var(--accent)] focus:outline-offset-2 max-h-[42px] text-left"
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
              height={280}
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
