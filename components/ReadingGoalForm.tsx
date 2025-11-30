"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Target, Loader2, X } from "lucide-react";
import type { ReadingGoal } from "@/lib/db/schema";

interface ReadingGoalFormProps {
  onSuccess: () => void;
  onCancel: () => void;
  existingGoal?: ReadingGoal;
  mode: "create" | "edit";
}

export function ReadingGoalForm({
  onSuccess,
  onCancel,
  existingGoal,
  mode,
}: ReadingGoalFormProps) {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(existingGoal?.year || currentYear);
  const [booksGoal, setBooksGoal] = useState(existingGoal?.booksGoal || 40);
  const [saving, setSaving] = useState(false);

  const isPastYear = year < currentYear;
  const canEdit = !isPastYear || mode === "create";

  useEffect(() => {
    if (existingGoal) {
      setYear(existingGoal.year);
      setBooksGoal(existingGoal.booksGoal);
    }
  }, [existingGoal]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    // Validation
    if (booksGoal < 1 || booksGoal > 9999) {
      toast.error("Goal must be between 1 and 9999 books");
      return;
    }

    if (!Number.isInteger(booksGoal)) {
      toast.error("Goal must be a whole number");
      return;
    }

    if (year < 1900 || year > 9999) {
      toast.error("Year must be between 1900 and 9999");
      return;
    }

    setSaving(true);
    try {
      let res;
      if (mode === "create") {
        res = await fetch("/api/reading-goals", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ year, booksGoal }),
        });
      } else {
        res = await fetch(`/api/reading-goals/${existingGoal?.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ booksGoal }),
        });
      }

      const data = await res.json();

      if (res.ok && data.success) {
        toast.success(
          mode === "create" ? "Reading goal created!" : "Reading goal updated!"
        );
        onSuccess();
      } else {
        toast.error(data.error?.message || "Failed to save goal");
      }
    } catch (error) {
      toast.error("Failed to save reading goal");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <Target className="w-6 h-6 text-[var(--accent)]" />
          <h3 className="text-xl font-serif font-bold text-[var(--heading-text)]">
            {mode === "create" ? "Create Reading Goal" : "Edit Reading Goal"}
          </h3>
        </div>
        <button
          type="button"
          onClick={onCancel}
          className="text-[var(--foreground)]/60 hover:text-[var(--foreground)] transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {isPastYear && mode === "edit" && (
        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-md p-4">
          <p className="text-sm text-yellow-700 dark:text-yellow-300 font-medium">
            This goal is from a past year and cannot be edited. You can only
            view the final results.
          </p>
        </div>
      )}

      <div className="space-y-4">
        {/* Year Input */}
        <div>
          <label
            htmlFor="goal-year"
            className="block text-sm font-semibold text-[var(--foreground)]/70 mb-2"
          >
            Year
          </label>
          <input
            id="goal-year"
            type="number"
            min="1900"
            max="9999"
            value={year}
            onChange={(e) => setYear(parseInt(e.target.value) || currentYear)}
            className="w-full px-4 py-2 bg-[var(--card-bg)] border border-[var(--border-color)] rounded-sm text-[var(--foreground)] font-medium focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent"
            disabled={mode === "edit" || saving}
          />
          <p className="text-xs text-[var(--subheading-text)] mt-2 font-medium">
            {mode === "edit"
              ? "Year cannot be changed"
              : "Select the year for this goal"}
          </p>
        </div>

        {/* Books Goal Input */}
        <div>
          <label
            htmlFor="books-goal"
            className="block text-sm font-semibold text-[var(--foreground)]/70 mb-2"
          >
            Books Goal
          </label>
          <input
            id="books-goal"
            type="number"
            min="1"
            max="9999"
            value={booksGoal}
            onChange={(e) => setBooksGoal(parseInt(e.target.value) || 1)}
            className="w-full px-4 py-2 bg-[var(--card-bg)] border border-[var(--border-color)] rounded-sm text-[var(--foreground)] font-medium focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={!canEdit || saving}
          />
          <p className="text-xs text-[var(--subheading-text)] mt-2 font-medium">
            Number of books you want to read in {year}
          </p>
        </div>
      </div>

      <div className="flex gap-3 pt-4">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 px-6 py-2 bg-[var(--card-bg)] border border-[var(--border-color)] text-[var(--foreground)] rounded-sm hover:bg-[var(--border-color)]/50 transition-colors font-semibold"
          disabled={saving}
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={!canEdit || saving}
          className="flex-1 px-6 py-2 bg-[var(--accent)] text-white rounded-sm hover:bg-[var(--light-accent)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-semibold flex items-center justify-center gap-2"
        >
          {saving && <Loader2 className="w-4 h-4 animate-spin" />}
          {mode === "create" ? "Create Goal" : "Update Goal"}
        </button>
      </div>
    </form>
  );
}
