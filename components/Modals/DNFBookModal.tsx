"use client";

import { useState, useEffect, useRef } from "react";
import { cn } from "@/utils/cn";
import BaseModal from "./BaseModal";
import MarkdownEditor from "@/components/Markdown/MarkdownEditor";
import { useDraftField } from "@/hooks/useDraftField";
import { getTodayLocalDate } from "@/utils/dateHelpers";
import { getLogger } from "@/lib/logger";
import { StarRating } from "@/components/Utilities/StarRating";
import { Button } from "@/components/Utilities/Button";

const logger = getLogger().child({ component: "DNFBookModal" });

interface DNFBookModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (rating?: number, review?: string, dnfDate?: string) => void;
  bookTitle: string;
  bookId: string;
  lastProgressDate?: string; // Prefill for DNF date
  lastProgressPage?: number; // Show context
  lastProgressPercentage?: number; // Show context
}

export default function DNFBookModal({
  isOpen,
  onClose,
  onConfirm,
  bookTitle,
  bookId,
  lastProgressDate,
  lastProgressPage,
  lastProgressPercentage,
}: DNFBookModalProps) {
  const [rating, setRating] = useState(0);
  const [review, setReview] = useState("");
  const [dnfDate, setDnfDate] = useState("");

  // Track whether we've already restored the draft for this modal session
  const hasRestoredDraft = useRef(false);

  // Draft management for review field
  const {
    draft: draftReview,
    saveDraft,
    clearDraft,
    isInitialized,
  } = useDraftField(`draft-dnf-review-${bookId}`);

  // Reset the restoration flag and prefill date when modal opens
  useEffect(() => {
    if (isOpen) {
      hasRestoredDraft.current = false;
      // Prefill DNF date with last progress date, or today if no progress
      setDnfDate(lastProgressDate || getTodayLocalDate());
    }
  }, [isOpen, lastProgressDate]);

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
    logger.debug({ isOpen, bookId }, 'DNFBookModal state changed');
  }, [isOpen, bookId]);

  const handleSubmit = async () => {
    // Only pass rating if it's > 0 (user actually selected a rating)
    await onConfirm(
      rating > 0 ? rating : undefined,
      review || undefined,
      dnfDate || undefined
    );
    clearDraft(); // Clear draft after successful submission
    setRating(0);
    setReview("");
    setDnfDate("");
    onClose();
  };

  const handleClose = () => {
    setRating(0);
    setReview("");
    setDnfDate("");
    onClose();
  };

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={handleClose}
      title="Mark as Did Not Finish"
      size="2xl"
      allowBackdropClose={false}
      actions={
        <div className="flex gap-3 justify-end">
          <Button
            variant="tertiary"
            onClick={handleClose}
            size="sm"
          >
            Cancel
          </Button>
          <Button
            variant="danger"
            onClick={handleSubmit}
            size="sm"
          >
            Mark as DNF
          </Button>
        </div>
      }
    >
      {/* Subtitle with last progress context */}
      <p className="text-sm text-[var(--subheading-text)] mb-6">
        You&apos;re marking <i>{bookTitle}</i> as Did Not Finish.
        {lastProgressPage && lastProgressPercentage && (
          <span className="block mt-1 text-xs">
            You last read page {lastProgressPage} ({Math.round(lastProgressPercentage)}%) on {lastProgressDate}
          </span>
        )}
      </p>

      {/* DNF Date */}
      <div className="mb-6">
        <label htmlFor="dnfDate" className="block text-sm font-medium text-[var(--heading-text)] mb-2">
          Stopped Reading Date
        </label>
        <input
          type="date"
          id="dnfDate"
          value={dnfDate}
          onChange={(e) => setDnfDate(e.target.value)}
          className="w-full px-3 py-2 bg-[var(--background)] border border-[var(--border-color)] rounded-lg text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
        />
      </div>

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
          <span>Notes / Reasoning</span>
          <span className="ml-1 text-[var(--subheading-text)] font-normal">(optional)</span>
        </label>
        <div>
          <MarkdownEditor
            value={review}
            onChange={setReview}
            placeholder="Why did you stop reading?"
            height={280}
            id="review"
          />
        </div>
      </div>
    </BaseModal>
  );
}
