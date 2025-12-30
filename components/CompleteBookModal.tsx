"use client";

import { useState, useEffect, useRef } from "react";
import { Star } from "lucide-react";
import { cn } from "@/utils/cn";
import BaseModal from "./BaseModal";
import MarkdownEditor from "@/components/MarkdownEditor";
import { useDraftField } from "@/hooks/useDraftField";
import { getLogger } from "@/lib/logger";

const logger = getLogger().child({ component: "CompleteBookModal" });

export interface CompleteBookData {
  totalPages?: number;
  startDate: string;
  endDate: string;
  rating?: number;
  review?: string;
}

interface CompleteBookModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (data: CompleteBookData) => Promise<void>;
  bookTitle: string;
  bookId: string;
  currentPageCount: number | null;
  currentRating?: number | null;
  defaultStartDate?: Date;
}

export default function CompleteBookModal({
  isOpen,
  onClose,
  onConfirm,
  bookTitle,
  bookId,
  currentPageCount,
  currentRating,
  defaultStartDate,
}: CompleteBookModalProps) {
  // Page count state (only shown if not already set)
  const [pageCount, setPageCount] = useState("");

  // Date states
  const today = new Date().toISOString().split('T')[0];
  const [startDate, setStartDate] = useState(
    defaultStartDate ? defaultStartDate.toISOString().split('T')[0] : today
  );
  const [endDate, setEndDate] = useState(today);

  // Rating state
  const [rating, setRating] = useState(currentRating || 0);
  const [hoverRating, setHoverRating] = useState(0);

  // Review state
  const [review, setReview] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Track whether we've already restored the draft for this modal session
  const hasRestoredDraft = useRef(false);

  // Draft management for review field
  const {
    draft: draftReview,
    saveDraft,
    clearDraft,
    isInitialized,
  } = useDraftField(`draft-complete-review-${bookId}`);

  // Reset states when modal opens
  useEffect(() => {
    if (isOpen) {
      hasRestoredDraft.current = false;
      setPageCount(currentPageCount?.toString() || "");
      const defaultStart = defaultStartDate
        ? defaultStartDate.toISOString().split('T')[0]
        : today;
      setStartDate(defaultStart);
      setEndDate(today);
      setRating(currentRating || 0);
    }
  }, [isOpen, currentPageCount, currentRating, defaultStartDate, today]);

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
    logger.debug({ isOpen, bookId }, 'CompleteBookModal state changed');
  }, [isOpen, bookId]);

  const validateForm = (): string | null => {
    // Validate page count if it needs to be set
    if (!currentPageCount) {
      if (pageCount.includes('.')) {
        return "Please enter a whole number of pages";
      }
      const parsedCount = parseInt(pageCount);
      if (!pageCount || parsedCount <= 0 || isNaN(parsedCount)) {
        return "Please enter a valid page count";
      }
    }

    // Validate dates
    if (!startDate || !endDate) {
      return "Please select both start and end dates";
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    const now = new Date();
    now.setHours(23, 59, 59, 999); // End of today

    // Prevent future dates
    if (start > now) {
      return "Start date cannot be in the future";
    }

    if (end > now) {
      return "End date cannot be in the future";
    }

    // Validate date ordering
    if (end < start) {
      return "End date must be on or after start date";
    }

    // Warn for very long reading durations
    const daysDiff = Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    if (daysDiff > 365) {
      // This is a warning, not an error - still allow it
      logger.warn({ startDate, endDate, daysDiff }, "Book took over a year to read");
    }

    return null;
  };

  const handleSubmit = async () => {
    const validationError = validateForm();
    if (validationError) {
      logger.warn({ validationError }, "Form validation failed");
      return;
    }

    setIsSubmitting(true);

    try {
      const data: CompleteBookData = {
        startDate,
        endDate,
      };

      // Only include totalPages if it's being set/updated
      if (!currentPageCount) {
        data.totalPages = parseInt(pageCount);
      }

      // Only include rating if user selected one
      if (rating > 0) {
        data.rating = rating;
      }

      // Only include review if user wrote one
      if (review) {
        data.review = review;
      }

      await onConfirm(data);
      clearDraft();
      onClose();
    } catch (error) {
      logger.error({ err: error }, "Failed to complete book");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      setRating(0);
      setHoverRating(0);
      setReview("");
      setPageCount("");
      onClose();
    }
  };

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={handleClose}
      title="Complete Book"
      size="2xl"
      actions={
        <div className="flex gap-3 justify-end">
          <button
            onClick={handleClose}
            disabled={isSubmitting}
            className="px-4 py-2 bg-[var(--border-color)] text-[var(--foreground)] rounded-lg hover:bg-[var(--light-accent)]/20 transition-colors font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="px-4 py-2 bg-[var(--accent)] text-white rounded-lg hover:bg-[var(--light-accent)] transition-colors font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? "Completing..." : "Complete Book"}
          </button>
        </div>
      }
    >
      {/* Subtitle explaining the flow */}
      <p className="text-sm text-[var(--subheading-text)] mb-6">
        Mark <i>{bookTitle}</i> as read. Fill in the details below to track your reading journey.
      </p>

      {/* Page Count (only shown if not already set) */}
      {!currentPageCount && (
        <div className="mb-6">
          <label htmlFor="complete-page-count" className="block text-sm font-semibold text-[var(--foreground)] mb-2">
            Total Pages
          </label>
          <input
            id="complete-page-count"
            type="number"
            value={pageCount}
            onChange={(e) => setPageCount(e.target.value)}
            min="1"
            step="1"
            disabled={isSubmitting}
            className="w-full px-3 py-2 border border-[var(--border-color)] rounded bg-[var(--background)] text-[var(--foreground)] focus:outline-none focus:border-[var(--accent)] transition-colors disabled:opacity-50"
            placeholder="e.g. 320"
          />
        </div>
      )}

      {/* Date Range */}
      <div className="mb-6 grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="complete-start-date" className="block text-sm font-semibold text-[var(--foreground)] mb-2">
            Start Date
          </label>
          <input
            id="complete-start-date"
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            max={today}
            disabled={isSubmitting}
            className="w-full px-3 py-2 border border-[var(--border-color)] rounded bg-[var(--background)] text-[var(--foreground)] focus:outline-none focus:border-[var(--accent)] transition-colors disabled:opacity-50"
          />
        </div>
        <div>
          <label htmlFor="complete-end-date" className="block text-sm font-semibold text-[var(--foreground)] mb-2">
            End Date
          </label>
          <input
            id="complete-end-date"
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            max={today}
            disabled={isSubmitting}
            className="w-full px-3 py-2 border border-[var(--border-color)] rounded bg-[var(--background)] text-[var(--foreground)] focus:outline-none focus:border-[var(--accent)] transition-colors disabled:opacity-50"
          />
        </div>
      </div>

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
              disabled={isSubmitting}
              className="focus:outline-none transition-transform hover:scale-110 disabled:opacity-50 disabled:cursor-not-allowed"
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

      {/* Review */}
      <div className="mb-6">
        <label
          htmlFor="complete-review"
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
            id="complete-review"
          />
        </div>
        <p className="text-xs italic text-[var(--subheading-text)] mt-1">
          Personal notes just for you
        </p>
      </div>
    </BaseModal>
  );
}
