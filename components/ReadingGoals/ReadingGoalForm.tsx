"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { useReadingGoals } from "@/hooks/useReadingGoals";
import type { ReadingGoal } from "@/lib/db/schema";

interface ReadingGoalFormProps {
  onSuccess: () => void;
  onCancel: () => void;
  existingGoal?: ReadingGoal;
  mode: "create" | "edit";
  selectedYear?: number; // The year context from the parent (for create mode)
}

export function ReadingGoalForm({
  onSuccess,
  onCancel,
  existingGoal,
  mode,
  selectedYear,
}: ReadingGoalFormProps) {
  const { createGoalAsync, updateGoalAsync } = useReadingGoals();
  
  const currentYear = new Date().getFullYear();
  
  // Use existingGoal year for edit mode, selectedYear for create mode (to respect user's year selection), fallback to currentYear
  const year = existingGoal?.year || selectedYear || currentYear;
  const [booksGoal, setBooksGoal] = useState<number | "">(
    existingGoal?.booksGoal ?? ""
  );
  const [saving, setSaving] = useState(false);

  const isPastYear = year < currentYear;
  const canEdit = !isPastYear || mode === "create";

  useEffect(() => {
    if (existingGoal) {
      setBooksGoal(existingGoal.booksGoal);
    }
  }, [existingGoal]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    // Validation
    if (booksGoal === "" || typeof booksGoal !== "number") {
      toast.error("Please enter a goal");
      return;
    }

    if (booksGoal < 1 || booksGoal > 9999) {
      toast.error("Goal must be between 1 and 9999 books");
      return;
    }

    if (!Number.isInteger(booksGoal)) {
      toast.error("Goal must be a whole number");
      return;
    }

    // Year validation - only allow current year or past years for new goals (no future years)
    if (mode === "create" && year > currentYear) {
      toast.error("Goals can only be created for the current year or past years");
      return;
    }

    setSaving(true);
    try {
      if (mode === "create") {
        await createGoalAsync({ year, booksGoal });
      } else if (existingGoal) {
        await updateGoalAsync({ id: existingGoal.id, data: { booksGoal } });
      }
      onSuccess();
    } catch (error) {
      // Error already handled by mutation
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {isPastYear && mode === "edit" && (
        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-md p-4">
          <p className="text-sm text-yellow-700 dark:text-yellow-300 font-medium">
            This goal is from a past year and cannot be edited. You can only
            view the final results.
          </p>
        </div>
      )}

      <div className="space-y-4">
        {/* Books Goal Input */}
        <div>
          <label
            htmlFor="books-goal"
            className="block text-sm font-medium text-[var(--heading-text)] mb-2"
          >
            Goal {mode === "edit" && `for ${year}`}
          </label>
          <input
            id="books-goal"
            type="number"
            min="1"
            max="9999"
            value={booksGoal}
            onChange={(e) => {
              const val = e.target.value;
              setBooksGoal(val === "" ? "" : parseInt(val) || "");
            }}
            className="w-full px-4 py-2 bg-[var(--background)] border border-[var(--border-color)] rounded-lg text-[var(--foreground)] font-medium focus:outline-none focus:ring-2 focus:ring-[var(--accent)] disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={!canEdit || saving}
          />
          <p className="text-xs text-[var(--subheading-text)] mt-2 font-medium">
            Number of books you want to read in {year}
          </p>
        </div>
      </div>

      <div className="flex gap-3 pt-4 justify-end">
        <button
          type="button"
          onClick={onCancel}
          className="px-6 py-2 text-sm font-medium text-[var(--foreground)] hover:bg-[var(--hover-bg)] rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={saving}
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={!canEdit || saving}
          className="px-6 py-2 text-sm font-medium bg-[var(--accent)] text-white rounded-md hover:bg-[var(--light-accent)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {saving && <Loader2 className="w-4 h-4 animate-spin" />}
          {mode === "create" ? "Create Goal" : "Update Goal"}
        </button>
      </div>
    </form>
  );
}
