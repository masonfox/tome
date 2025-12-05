"use client";

import { useState, useEffect } from "react";
import BaseModal from "./BaseModal";
import { toast } from "@/utils/toast";
import { getLogger } from "@/lib/logger";

interface PageCountEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  bookId: number;
  currentPageCount: number | null;
  onSuccess: () => void;
}

export default function PageCountEditModal({
  isOpen,
  onClose,
  bookId,
  currentPageCount,
  onSuccess,
}: PageCountEditModalProps) {
  const [pageCount, setPageCount] = useState(currentPageCount?.toString() || "");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Reset form when modal opens with different book
  useEffect(() => {
    if (isOpen) {
      setPageCount(currentPageCount?.toString() || "");
    }
  }, [isOpen, currentPageCount]);

  const handleSubmit = async () => {
    // Check for decimal input first
    if (pageCount.includes('.')) {
      toast.error("Please enter a whole number of pages");
      return;
    }
    
    const parsedCount = parseInt(pageCount);
    
    if (!pageCount || parsedCount <= 0 || isNaN(parsedCount)) {
      toast.error("Please enter a valid page count");
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch(`/api/books/${bookId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ totalPages: parsedCount }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to update page count");
      }

      toast.success("Page count updated");
      onSuccess();
      onClose();
    } catch (error) {
      getLogger().error({ err: error, bookId }, "Failed to update page count");
      toast.error(error instanceof Error ? error.message : "Failed to update page count");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      onClose();
    }
  };

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={handleClose}
      title="Edit Page Count"
      subtitle={currentPageCount ? `Current: ${currentPageCount} pages` : undefined}
      actions={
        <div className="flex gap-2">
          <button
            onClick={handleClose}
            disabled={isSubmitting}
            className="flex-1 px-4 py-2 border border-[var(--border-color)] text-[var(--foreground)] rounded hover:bg-[var(--background)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-semibold"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSubmitting || !pageCount || parseInt(pageCount) <= 0}
            className="flex-1 px-4 py-2 bg-[var(--accent)] text-white rounded hover:bg-[var(--light-accent)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-semibold"
          >
            {isSubmitting ? "Saving..." : "Save"}
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-semibold text-[var(--foreground)] mb-2">
            Total Pages
          </label>
          <input
            type="number"
            value={pageCount}
            onChange={(e) => setPageCount(e.target.value)}
            min="1"
            step="1"
            disabled={isSubmitting}
            className="w-full px-3 py-2 border border-[var(--border-color)] rounded bg-[var(--background)] text-[var(--foreground)] focus:outline-none focus:border-[var(--accent)] transition-colors disabled:opacity-50"
            placeholder="e.g. 320"
            autoFocus
          />
        </div>
        
        <div className="text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 p-3 rounded border border-amber-200 dark:border-amber-800">
          <p className="font-semibold">
            ⚠️ This will update progress calculations for all active reading sessions.
          </p>
        </div>
      </div>
    </BaseModal>
  );
}
