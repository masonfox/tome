"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import type { ReadingGoal } from "@/lib/db/schema";

interface ReadingGoalFormProps {
  existingGoal?: ReadingGoal;
  mode: "create" | "edit";
  selectedYear?: number; // The year context from the parent (for create mode)
  booksGoal: number | "";
  onBooksGoalChange: (value: number | "") => void;
  disabled?: boolean;
}

export function ReadingGoalForm({
  existingGoal,
  mode,
  selectedYear,
  booksGoal,
  onBooksGoalChange,
  disabled = false,
}: ReadingGoalFormProps) {
  const currentYear = new Date().getFullYear();
  
  // Use existingGoal year for edit mode, selectedYear for create mode (to respect user's year selection), fallback to currentYear
  const year = existingGoal?.year || selectedYear || currentYear;

  const isPastYear = year < currentYear;
  const canEdit = !isPastYear || mode === "create";

  return (
    <>
      {isPastYear && mode === "edit" && (
        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-md p-4 mb-4">
          <p className="text-sm text-yellow-700 dark:text-yellow-300 font-medium">
            This goal is from a past year and cannot be edited. You can only
            view the final results.
          </p>
        </div>
      )}

      <div>
        <label
          htmlFor="books-goal"
          className="block text-sm font-medium text-[var(--heading-text)] mb-2"
        >
          Number of Books
        </label>
        <input
          id="books-goal"
          type="number"
          min="1"
          max="9999"
          value={booksGoal}
          onChange={(e) => {
            const val = e.target.value;
            onBooksGoalChange(val === "" ? "" : parseInt(val) || "");
          }}
          className="w-full px-4 py-2 bg-[var(--background)] border border-[var(--border-color)] rounded-lg text-[var(--foreground)] font-medium focus:outline-none focus:ring-2 focus:ring-[var(--accent)] disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={!canEdit || disabled}
        />
      </div>
    </>
  );
}
