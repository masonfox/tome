"use client";

import { useState, useEffect } from "react";
import { Star, X } from "lucide-react";
import { cn } from "@/utils/cn";

interface RatingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (rating: number | null) => void;
  bookTitle: string;
  currentRating: number | null;
}

export default function RatingModal({
  isOpen,
  onClose,
  onConfirm,
  bookTitle,
  currentRating,
}: RatingModalProps) {
  const [rating, setRating] = useState(currentRating || 0);
  const [hoverRating, setHoverRating] = useState(0);

  // Reset rating when modal opens
  useEffect(() => {
    if (isOpen) {
      setRating(currentRating || 0);
      setHoverRating(0);
    }
  }, [isOpen, currentRating]);

  if (!isOpen) return null;

  const handleSubmit = () => {
    if (rating > 0) {
      onConfirm(rating);
    }
  };

  const handleRemove = () => {
    onConfirm(null);
  };

  const handleClose = () => {
    setRating(currentRating || 0);
    setHoverRating(0);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-[var(--card-bg)] border border-[var(--border-color)] rounded-lg shadow-lg p-6 max-w-md w-full">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-xl font-serif text-[var(--heading-text)] mb-7">
              <span className="mr-1 font-bold">Rate Book:</span>
              <span>{bookTitle}</span>
            </h2>
            <p className="text-sm text-[var(--foreground)]/70 font-medium">
              
            </p>
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
        <div className="mb-7">
          {/* <label className="block text-sm font-semibold text-[var(--foreground)] mb-5">
            {currentRating ? "Change your rating" : "Rate this book"}
          </label> */}
          <div className="flex gap-2 justify-center">
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
                    "w-10 h-10 transition-colors",
                    star <= (hoverRating || rating)
                      ? "fill-[var(--accent)] text-[var(--accent)]"
                      : "text-[var(--foreground)]/30"
                  )}
                />
              </button>
            ))}
          </div>
          {rating > 0 && (
            <p className="text-sm text-[var(--foreground)]/70 mt-3 font-medium text-center">
              {rating} {rating === 1 ? "star" : "stars"}
            </p>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3 justify-between">
          {/* Remove Rating Button (left side) */}
          {currentRating && (
            <button
              onClick={handleRemove}
              className="px-4 py-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors font-semibold text-sm"
            >
              Remove Rating
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
              disabled={rating === 0}
              className={cn(
                "px-4 py-2 rounded-lg transition-colors font-semibold",
                rating > 0
                  ? "bg-[var(--accent)] text-white hover:bg-[var(--light-accent)]"
                  : "bg-[var(--border-color)] text-[var(--foreground)]/50 cursor-not-allowed"
              )}
            >
              Save Rating
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
