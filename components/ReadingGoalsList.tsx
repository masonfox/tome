"use client";

import { useState } from "react";
import { toast } from "sonner";
import { BookOpen, Pencil, Trash2, Loader2 } from "lucide-react";
import type { ReadingGoal } from "@/lib/db/schema";

interface ReadingGoalsListProps {
  goals: ReadingGoal[];
  onEdit: (goal: ReadingGoal) => void;
  onDelete: () => void;
}

export function ReadingGoalsList({ goals, onEdit, onDelete }: ReadingGoalsListProps) {
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const currentYear = new Date().getFullYear();

  async function handleDelete(goal: ReadingGoal) {
    if (goal.year < currentYear) {
      toast.error("Cannot delete goals for past years");
      return;
    }

    if (!confirm(`Are you sure you want to delete your ${goal.year} reading goal?`)) {
      return;
    }

    setDeletingId(goal.id);
    try {
      const res = await fetch(`/api/reading-goals/${goal.id}`, {
        method: "DELETE",
      });

      const data = await res.json();

      if (res.ok && data.success) {
        toast.success("Reading goal deleted");
        onDelete();
      } else {
        toast.error(data.error?.message || "Failed to delete goal");
      }
    } catch (error) {
      toast.error("Failed to delete reading goal");
    } finally {
      setDeletingId(null);
    }
  }

  if (goals.length === 0) {
    return (
      <div className="text-center py-12 text-[var(--subheading-text)]">
        <BookOpen className="w-12 h-12 mx-auto mb-4 opacity-50" />
        <p className="font-medium">No reading goals yet</p>
        <p className="text-sm mt-2">Create your first goal to start tracking your progress</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {goals.map((goal) => {
        const isPastYear = goal.year < currentYear;
        const isCurrentYear = goal.year === currentYear;
        const isFutureYear = goal.year > currentYear;

        return (
          <div
            key={goal.id}
            className="bg-[var(--card-bg)] border border-[var(--border-color)] rounded-md p-4 flex items-center justify-between hover:border-[var(--accent)]/30 transition-colors"
          >
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-1">
                <h4 className="text-lg font-serif font-bold text-[var(--heading-text)]">
                  {goal.year}
                </h4>
                {isCurrentYear && (
                  <span className="px-2 py-0.5 text-xs font-semibold bg-[var(--accent)]/20 text-[var(--accent)] rounded">
                    Current
                  </span>
                )}
                {isPastYear && (
                  <span className="px-2 py-0.5 text-xs font-semibold bg-[var(--foreground)]/10 text-[var(--foreground)]/60 rounded">
                    Completed
                  </span>
                )}
                {isFutureYear && (
                  <span className="px-2 py-0.5 text-xs font-semibold bg-blue-500/20 text-blue-600 dark:text-blue-400 rounded">
                    Upcoming
                  </span>
                )}
              </div>
              <p className="text-[var(--foreground)] font-medium">
                Goal: <span className="text-[var(--accent)] font-bold">{goal.booksGoal}</span> books
              </p>
              <p className="text-xs text-[var(--subheading-text)] mt-1">
                Created {new Date(goal.createdAt).toLocaleDateString()}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => onEdit(goal)}
                disabled={deletingId === goal.id}
                className="p-2 text-[var(--foreground)]/60 hover:text-[var(--accent)] hover:bg-[var(--accent)]/10 rounded transition-colors disabled:opacity-50"
                title={isPastYear ? "View goal (read-only)" : "Edit goal"}
              >
                <Pencil className="w-4 h-4" />
              </button>
              <button
                onClick={() => handleDelete(goal)}
                disabled={isPastYear || deletingId === goal.id}
                className="p-2 text-[var(--foreground)]/60 hover:text-red-600 hover:bg-red-600/10 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                title={isPastYear ? "Cannot delete past goals" : "Delete goal"}
              >
                {deletingId === goal.id ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Trash2 className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
