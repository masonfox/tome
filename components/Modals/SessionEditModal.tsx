"use client";

import { useState, useEffect, useRef } from "react";
import BaseModal from "./BaseModal";
import { getTodayLocalDate } from '@/utils/dateHelpers';
import MarkdownEditor from "@/components/Markdown/MarkdownEditor";
import { useDraftField } from "@/hooks/useDraftField";
import { Button } from "@/components/Utilities/Button";

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

  // Reset states and draft restoration flag when modal opens
  useEffect(() => {
    if (isOpen) {
      hasRestoredDraft.current = false;
      // Dates are already in YYYY-MM-DD format from API
      setStartedDate(currentStartedDate || "");
      setCompletedDate(currentCompletedDate || "");
      // Set review to current value if it exists (editing existing review)
      if (currentReview) {
        setReview(currentReview);
      }
    }
  }, [isOpen, currentStartedDate, currentCompletedDate, currentReview]);

  // Restore draft only once when modal opens (if no current review exists)
  // This allows draft recovery when adding a review to a session that doesn't have one
  useEffect(() => {
    if (isOpen && isInitialized && !currentReview && !review && draftReview && !hasRestoredDraft.current) {
      setReview(draftReview);
      hasRestoredDraft.current = true;
    }
  }, [isOpen, isInitialized, currentReview, review, draftReview]);

  // Auto-save draft (only after initialization to prevent race condition)
  useEffect(() => {
    if (isInitialized && review && isOpen) {
      saveDraft(review);
    }
  }, [review, isInitialized, saveDraft, isOpen]);

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
        <div className="flex justify-end gap-3">
          <Button
            variant="ghost"
            onClick={onClose}
            size="md"
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleSave}
            size="md"
          >
            Save
          </Button>
        </div>
      }
    >
      <div className="space-y-6">
        {/* Date Fields */}
        <div className="space-y-4">
          <div>
            <label
              htmlFor="startedDate"
              className="block text-sm font-medium text-[var(--heading-text)] mb-2"
            >
              Started Date
            </label>
            <input
              id="startedDate"
              type="date"
              value={startedDate}
              onChange={(e) => setStartedDate(e.target.value)}
              max={getTodayLocalDate()}
              className="w-full px-3 py-3 bg-[var(--background)] border border-[var(--border-color)] rounded-lg text-[var(--foreground)] font-medium focus:outline-none focus:ring-2 focus:ring-[var(--accent)] max-h-[42px] text-left"
            />
          </div>

          <div>
            <label
              htmlFor="completedDate"
              className="block text-sm font-medium text-[var(--heading-text)] mb-2"
            >
              Completed Date
            </label>
            <input
              id="completedDate"
              type="date"
              value={completedDate}
              onChange={(e) => setCompletedDate(e.target.value)}
              max={getTodayLocalDate()}
              className="w-full px-3 py-3 bg-[var(--background)] border border-[var(--border-color)] rounded-lg text-[var(--foreground)] font-medium focus:outline-none focus:ring-2 focus:ring-[var(--accent)] max-h-[42px] text-left"
            />
          </div>

          {(startedDate || completedDate) && (
            <Button
              variant="danger-ghost"
              onClick={handleClearDates}
              size="md"
            >
              Clear Dates
            </Button>
          )}
        </div>

        {/* Review Field */}
        <div>
          <label
            htmlFor="review"
            className="block text-sm font-medium text-[var(--heading-text)] mb-2"
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
            <Button
              variant="danger-ghost"
              onClick={handleRemoveReview}
              size="md"
              className="mt-2"
            >
              Clear Review
            </Button>
          )}
        </div>
      </div>
    </BaseModal>
  );
}
