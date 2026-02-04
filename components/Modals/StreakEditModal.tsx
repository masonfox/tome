"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import BaseModal from "./BaseModal";
import { useStreak } from "@/hooks/useStreak";
import { Button } from "@/components/Utilities/Button";

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
      allowBackdropClose={false}
      actions={
        <div className="flex gap-3">
          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
            disabled={isUpdatingThreshold}
            size="md"
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="primary"
            onClick={handleSubmit}
            disabled={isUpdatingThreshold || threshold === initialThreshold}
            size="md"
            icon={isUpdatingThreshold ? <Loader2 className="w-4 h-4 animate-spin" /> : undefined}
          >
            {isUpdatingThreshold ? "Saving..." : "Save"}
          </Button>
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
            className="w-full px-3 py-2 bg-[var(--background)] border border-[var(--border-color)] rounded-lg text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
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
