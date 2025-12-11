"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import BaseModal from "./BaseModal";

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
  const [saving, setSaving] = useState(false);

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

    setSaving(true);
    try {
      const res = await fetch("/api/streak", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dailyThreshold: threshold }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        toast.success("Daily reading goal updated!");
        onSuccess();
        onClose();
      } else {
        toast.error(data.error?.message || "Failed to update goal");
      }
    } catch (error) {
      toast.error("Failed to update daily reading goal");
    } finally {
      setSaving(false);
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
            disabled={saving}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={saving || threshold === initialThreshold}
            className="flex-1 px-6 py-2 bg-[var(--accent)] text-white rounded-sm hover:bg-[var(--light-accent)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-semibold flex items-center justify-center gap-2"
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            {saving ? "Saving..." : "Save"}
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
            disabled={saving}
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
