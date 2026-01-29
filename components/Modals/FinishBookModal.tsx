"use client";

import { useState, useEffect, useRef } from "react";
import { cn } from "@/utils/cn";
import BaseModal from "./BaseModal";
import MarkdownEditor from "@/components/Markdown/MarkdownEditor";
import { useDraftField } from "@/hooks/useDraftField";
import { getLogger } from "@/lib/logger";
import { StarRating } from "@/components/Utilities/StarRating";
import { Button } from "@/components/Utilities/Button";

const logger = getLogger().child({ component: "FinishBookModal" });

interface FinishBookModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (rating?: number, review?: string) => void;
  bookTitle: string;
  bookId: string;
  sessionId?: number; // Session ID to update with review (when auto-completed)
}

export default function FinishBookModal({
  isOpen,
  onClose,
  onConfirm,
  bookTitle,
  bookId,
  sessionId,
}: FinishBookModalProps) {
  const [rating, setRating] = useState(0);
  const [review, setReview] = useState("");

  // Track whether we've already restored the draft for this modal session
  const hasRestoredDraft = useRef(false);

  // Draft management for review field
  const {
    draft: draftReview,
    saveDraft,
    clearDraft,
    isInitialized,
  } = useDraftField(`draft-finish-review-${bookId}`);

  // Reset the restoration flag when modal opens
  useEffect(() => {
    if (isOpen) {
      hasRestoredDraft.current = false;
    }
  }, [isOpen]);

  // Restore draft only once when modal opens (if no review content exists)
  useEffect(() => {
    if (isOpen && isInitialized && !review && draftReview && !hasRestoredDraft.current) {
      setReview(draftReview);
      hasRestoredDraft.current = true;
    }
  }, [isOpen, isInitialized, review, draftReview]);

  // Auto-save draft (only after initialization to prevent race condition)
  useEffect(() => {
    if (isInitialized && review) {
      saveDraft(review);
    }
  }, [review, isInitialized, saveDraft]);

  // Debug logging
  useEffect(() => {
    logger.debug({ isOpen, bookId }, 'FinishBookModal state changed');
  }, [isOpen, bookId]);

  const handleSubmit = async () => {
    // Only pass rating if it's > 0 (user actually selected a rating)
    await onConfirm(rating > 0 ? rating : undefined, review || undefined);
    clearDraft(); // Clear draft after successful submission
    onClose(); // Explicitly close the modal after successful confirmation
  };

  const handleClose = async () => {
    // If this is a manual mark-as-read flow (no sessionId), we should still mark the book as read
    // Otherwise, clicking Skip cancels the entire status change
    if (!sessionId) {
      await onConfirm(undefined, undefined); // Mark as read without rating/review
      clearDraft();
    }
    setRating(0);
    setReview("");
    onClose();
  };

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={handleClose}
      title="Book Completed!"
      size="2xl"
      allowBackdropClose={false}
      actions={
        <div className="flex gap-3 justify-end">
          <Button
            variant="ghost"
            onClick={handleClose}
            size="md"
          >
            Skip
          </Button>
          <Button
            variant="primary"
            onClick={handleSubmit}
            size="md"
          >
            Save Rating & Review
          </Button>
        </div>
      }
    >
      {/* Subtitle explaining the book is already completed */}
      <p className="text-sm text-[var(--subheading-text)] mb-6">
        You&apos;ve finished reading <i>{bookTitle}</i>! Would you like to rate and review it?
      </p>

      {/* Rating */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-[var(--heading-text)] mb-3">
          Rating <span className="text-[var(--subheading-text)] font-normal">(optional)</span>
        </label>
        <StarRating 
          rating={rating} 
          size="lg" 
          interactive={true} 
          onRatingChange={setRating}
          showCount={true}
        />
      </div>

      {/* Review (Optional) */}
      <div className="mb-6">
        <label
          htmlFor="review"
          className="block text-sm font-medium text-[var(--heading-text)] mb-2"
        >
          <span>Review</span>
          <span className="ml-1 text-[var(--subheading-text)] font-normal">(optional)</span>
        </label>
        <div>
          <MarkdownEditor
            value={review}
            onChange={setReview}
            placeholder="What did you think about this book?"
            height={280}
            id="review"
          />
        </div>
        <p className="text-xs italic text-[var(--subheading-text)] mt-1">
          Personal notes just for you
        </p>
      </div>
    </BaseModal>
  );
}
