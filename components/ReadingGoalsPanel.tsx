"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Target, Plus, Loader2 } from "lucide-react";
import { ReadingGoalForm } from "./ReadingGoalForm";
import { ReadingGoalsList } from "./ReadingGoalsList";
import { useReadingGoals } from "@/hooks/useReadingGoals";
import { useStreak } from "@/hooks/useStreak";
import type { ReadingGoal } from "@/lib/db/schema";

interface ReadingGoalsPanelProps {
  initialGoals: ReadingGoal[];
  initialThreshold: number;
}

export function ReadingGoalsPanel({ initialGoals, initialThreshold }: ReadingGoalsPanelProps) {
  // Use TanStack Query hooks
  const { goals: fetchedGoals, isLoading: goalsLoading } = useReadingGoals();
  const { updateThreshold } = useStreak();

  // Use fetched goals if available, otherwise use initial goals
  const goals = goalsLoading ? initialGoals : (fetchedGoals.length > 0 ? fetchedGoals : initialGoals);

  // Annual goals state
  const [showForm, setShowForm] = useState(false);
  const [editingGoal, setEditingGoal] = useState<ReadingGoal | undefined>();

  // Daily goal state
  const [threshold, setThreshold] = useState(initialThreshold);
  const [saving, setSaving] = useState(false);

  // Annual goals handlers
  function handleCreateNew() {
    setEditingGoal(undefined);
    setShowForm(true);
  }

  function handleEdit(goal: ReadingGoal) {
    setEditingGoal(goal);
    setShowForm(true);
  }

  function handleFormSuccess() {
    setShowForm(false);
    setEditingGoal(undefined);
    // Goals will auto-refresh via TanStack Query
  }

  function handleFormCancel() {
    setShowForm(false);
    setEditingGoal(undefined);
  }

  function handleDelete() {
    // Goals will auto-refresh via TanStack Query
  }

  // Daily goal handlers
  async function handleSaveDailyGoal() {
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
      await updateThreshold(threshold);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="bg-[var(--card-bg)] border border-[var(--border-color)] rounded-md p-6">
      <div className="flex items-center gap-3 mb-6">
        <Target className="w-6 h-6 text-[var(--accent)]" />
        <h3 className="text-xl font-serif font-bold text-[var(--heading-text)]">
          Reading Goals
        </h3>
      </div>

      <p className="text-sm text-[var(--subheading-text)] mb-6 font-medium">
        Set your daily and annual reading targets to track your progress.
      </p>

      {/* Daily Reading Goal */}
      <div className="mb-8 pb-8 border-b border-[var(--border-color)]">
        <h4 className="text-lg font-semibold text-[var(--heading-text)] mb-4">
          Daily Goal
        </h4>
        <p className="text-sm text-[var(--subheading-text)] mb-4">
          Set how many pages you want to read each day to maintain your streak.
        </p>

        <div className="flex items-start gap-4">
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
            <p className="text-xs text-[var(--subheading-text)] mt-2 font-medium">
              Must be between 1 and 9999
            </p>
          </div>

          <div className="pt-7">
            <button
              onClick={handleSaveDailyGoal}
              disabled={saving || threshold === initialThreshold}
              className="px-6 py-2 bg-[var(--accent)] text-white rounded-sm hover:bg-[var(--light-accent)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-semibold flex items-center gap-2"
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              {saving ? "Saving..." : "Save"}
            </button>
          </div>
        </div>
      </div>

      {/* Annual Reading Goals */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-lg font-semibold text-[var(--heading-text)]">
            Annual Goals
          </h4>
          {!showForm && (
            <button
              onClick={handleCreateNew}
              className="px-4 py-2 bg-[var(--accent)] text-white rounded-sm hover:bg-[var(--light-accent)] transition-colors font-semibold flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              New Goal
            </button>
          )}
        </div>

        <p className="text-sm text-[var(--subheading-text)] mb-6">
          Set your annual book reading targets and track your progress throughout the year.
        </p>

        {showForm ? (
          <div className="bg-[var(--background)] border border-[var(--border-color)] rounded-md p-6 mb-6">
            <ReadingGoalForm
              mode={editingGoal ? "edit" : "create"}
              existingGoal={editingGoal}
              onSuccess={handleFormSuccess}
              onCancel={handleFormCancel}
            />
          </div>
        ) : null}

        <ReadingGoalsList
          goals={goals}
          onEdit={handleEdit}
          onDelete={handleDelete}
        />
      </div>
    </div>
  );
}
