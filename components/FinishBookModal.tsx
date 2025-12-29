"use client";

import { useState, useEffect, useRef } from "react";
import { Star } from "lucide-react";
import { cn } from "@/utils/cn";
import BaseModal from "./BaseModal";
import MarkdownEditor from "@/components/MarkdownEditor";
import { useDraftField } from "@/hooks/useDraftField";
import { getLogger } from "@/lib/logger";

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
  const [hoverRating, setHoverRating] = useState(0);
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
    setHoverRating(0);
    setReview("");
    onClose();
  };

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={handleClose}
      title="Book Completed!"
      size="2xl"
      actions={
        <div className="flex gap-3 justify-end">
          <button
            onClick={handleClose}
            className="px-4 py-2 bg-[var(--border-color)] text-[var(--foreground)] rounded-lg hover:bg-[var(--light-accent)]/20 transition-colors font-semibold"
          >
            Skip
          </button>
          <button
            onClick={handleSubmit}
            className="px-4 py-2 bg-[var(--accent)] text-white rounded-lg hover:bg-[var(--light-accent)] transition-colors font-semibold"
          >
            Save Rating & Review
          </button>
        </div>
      }
    >
      {/* Subtitle explaining the book is already completed */}
      <p className="text-sm text-[var(--subheading-text)] mb-6">
        You've finished reading <i>{bookTitle}</i>! Would you like to rate and review it?
      </p>

      {/* Rating */}
      <div className="mb-6">
        <label className="block text-sm text-[var(--foreground)] mb-3">
          Rating <span className="text-[var(--subheading-text)] font-normal">(optional)</span>
        </label>
        <div className="flex gap-2">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              type="button"
              onClick={() => setRating(star)}
              onMouseEnter={() => setHoverRating(star)}
              onMouseLeave={() => setHoverRating(0)}
              className="focus:outline-none transition-transform hover:scale-110"
            >
              <Star
                className={cn(
                  "w-8 h-8 transition-colors",
                  star <= (hoverRating || rating)
                    ? "fill-[var(--accent)] text-[var(--accent)]"
                    : "text-[var(--foreground)]/30"
                )}
              />
            </button>
          ))}
        </div>
        {rating > 0 && (
          <p className="text-xs text-[var(--foreground)]/50 mt-2 font-medium">
            {rating} {rating === 1 ? "star" : "stars"}
          </p>
        )}
      </div>

      {/* Review (Optional) */}
      <div className="mb-6">
        <label
          htmlFor="review"
          className="block text-sm font-semibold text-[var(--foreground)] mb-2"
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
