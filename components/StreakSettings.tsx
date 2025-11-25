"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Target, Loader2 } from "lucide-react";

interface StreakSettingsProps {
  initialThreshold: number;
}

export function StreakSettings({ initialThreshold }: StreakSettingsProps) {
  const [threshold, setThreshold] = useState(initialThreshold);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    // Validate threshold
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
    <div className="bg-[var(--card-bg)] border border-[var(--border-color)] rounded-md p-6">
      <div className="flex items-center gap-3 mb-4">
        <Target className="w-6 h-6 text-[var(--accent)]" />
        <h3 className="text-xl font-serif font-bold text-[var(--heading-text)]">
          Daily Reading Goal
        </h3>
      </div>

      <p className="text-sm text-[var(--foreground)]/70 mb-4 font-medium">
        Set how many pages you want to read each day to maintain your streak.
      </p>

      <div className="flex items-end gap-4">
        <div className="flex-1">
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
            onChange={(e) => setThreshold(parseInt(e.target.value) || 1)}
            className="w-full px-4 py-2 bg-[var(--card-bg)] border border-[var(--border-color)] rounded-sm text-[var(--foreground)] font-medium focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent"
            disabled={saving}
          />
          <p className="text-xs text-[var(--foreground)]/60 mt-1 font-medium">
            Must be between 1 and 9999
          </p>
        </div>

        <button
          onClick={handleSave}
          disabled={saving || threshold === initialThreshold}
          className="px-6 py-2 bg-[var(--accent)] text-white rounded-sm hover:bg-[var(--light-accent)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-semibold flex items-center gap-2"
        >
          {saving && <Loader2 className="w-4 h-4 animate-spin" />}
          {saving ? "Saving..." : "Save"}
        </button>
      </div>
    </div>
  );
}
