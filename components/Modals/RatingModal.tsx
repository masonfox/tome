"use client";

import { useState, useEffect } from "react";
import { X } from "lucide-react";
import { cn } from "@/utils/cn";
import { StarRating } from "@/components/Utilities/StarRating";

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

  // Reset rating when modal opens
  useEffect(() => {
    if (isOpen) {
      setRating(currentRating || 0);
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
          <StarRating 
            rating={rating} 
            size="xl" 
            interactive={true} 
            onRatingChange={setRating}
            showCount={true}
          />
          {currentRating && (
            <div className="text-center mt-2">
              <button
                onClick={handleRemove}
                className="text-xs text-red-600 dark:text-red-400 hover:underline transition-colors"
              >
                Remove rating
              </button>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3 justify-end">
          <button
            onClick={handleClose}
            className="px-4 py-2 text-sm font-medium text-[var(--foreground)] hover:bg-[var(--hover-bg)] rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={rating === 0}
            className={cn(
              "px-4 py-2 text-sm font-medium rounded-md transition-colors",
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
  );
}
