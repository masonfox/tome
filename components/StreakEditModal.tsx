"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import BaseModal from "./BaseModal";
import { useStreak } from "@/hooks/useStreak";

interface StreakEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialThreshold: number;
  onSuccess: () => void;
}

export function StreakEditModal({
  isOpen,
  onClose,
  initialThreshold,
  onSuccess,
}: StreakEditModalProps) {
  const [threshold, setThreshold] = useState(initialThreshold);
  const { updateThresholdAsync, isUpdatingThreshold } = useStreak();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    // Validation
    if (threshold < 1 || threshold > 9999) {
      toast.error("Daily goal must be between 1 and 9999 pages");
      return;
    }

    if (!Number.isInteger(threshold)) {
      toast.error("Daily goal must be a whole number");
      return;
    }

    try {
      await updateThresholdAsync(threshold);
      onSuccess();
      onClose();
    } catch (error) {
      // Error handling is done in the hook
    }
  }

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      title="Edit Daily Reading Goal"
      subtitle="Set how many pages you want to read each day to maintain your streak"
      actions={
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-6 py-2 bg-[var(--card-bg)] border border-[var(--border-color)] text-[var(--foreground)] rounded-sm hover:bg-[var(--border-color)]/50 transition-colors font-semibold"
            disabled={isUpdatingThreshold}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isUpdatingThreshold || threshold === initialThreshold}
            className="flex-1 px-6 py-2 bg-[var(--accent)] text-white rounded-sm hover:bg-[var(--light-accent)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-semibold flex items-center justify-center gap-2"
          >
            {isUpdatingThreshold && <Loader2 className="w-4 h-4 animate-spin" />}
            {isUpdatingThreshold ? "Saving..." : "Save"}
          </button>
        </div>
      }
    >
      <form onSubmit={handleSubmit}>
        <div>
          <label
            htmlFor="daily-threshold"
            className="block text-sm font-semibold text-[var(--foreground)]/70 mb-2"
          >
            Pages per day
          </label>
          <input
            id="daily-threshold"
            type="number"
            min="1"
            max="9999"
            value={threshold}
            onChange={(e) => {
              const val = parseInt(e.target.value);
              setThreshold(isNaN(val) ? 1 : val);
            }}
            className="w-full px-4 py-2 bg-[var(--card-bg)] border border-[var(--border-color)] rounded-sm text-[var(--foreground)] font-medium focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent"
            disabled={isUpdatingThreshold}
            autoFocus
          />
          <p className="text-xs text-[var(--subheading-text)] mt-2 font-medium">
            Must be between 1 and 9999
          </p>
        </div>
      </form>
    </BaseModal>
  );
}
