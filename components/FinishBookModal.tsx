"use client";

import { useState, useEffect } from "react";
import { Star, X } from "lucide-react";
import { cn } from "@/utils/cn";
import MarkdownEditor from "@/components/MarkdownEditor";
import { useDraftField } from "@/hooks/useDraftField";

interface FinishBookModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (rating: number, review?: string) => void;
  bookTitle: string;
  bookId: string;
}

export default function FinishBookModal({
  isOpen,
  onClose,
  onConfirm,
  bookTitle,
  bookId,
}: FinishBookModalProps) {
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [review, setReview] = useState("");

  // Draft management for review field
  const {
    draft: draftReview,
    saveDraft,
    clearDraft,
    isInitialized,
  } = useDraftField(`draft-finish-review-${bookId}`);

  // Restore draft on mount if no review content exists
  useEffect(() => {
    if (draftReview && !review && isOpen) {
      setReview(draftReview);
    }
  }, [draftReview, review, isOpen]);

  // Auto-save draft (only after initialization to prevent race condition)
  useEffect(() => {
    if (isInitialized && review) {
      saveDraft(review);
    }
  }, [review, isInitialized, saveDraft]);

  if (!isOpen) return null;

  const handleSubmit = () => {
    onConfirm(rating, review || undefined);
    clearDraft(); // Clear draft after successful submission
  };

  const handleClose = () => {
    setRating(0);
    setHoverRating(0);
    setReview("");
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-[var(--card-bg)] border border-[var(--border-color)] rounded-lg shadow-lg p-6 max-w-md w-full">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-xl font-serif font-bold text-[var(--heading-text)] mb-1">
              Finished Reading?
            </h2>
          </div>
          <button
            onClick={handleClose}
            className="text-[var(--foreground)]/50 hover:text-[var(--foreground)] transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Rating */}
        <div className="mb-6">
          <label className="block text-sm text-[var(--foreground)] mb-3">
            Rate <i>{bookTitle}</i>:
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
              height={150}
              id="review"
            />
          </div>
          <p className="text-xs italic text-[var(--subheading-text)] mt-1">
            Personal notes just for you
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3 justify-end">
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
            Mark as Read
          </button>
        </div>
      </div>
    </div>
  );
}
