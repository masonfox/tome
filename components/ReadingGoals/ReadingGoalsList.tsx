"use client";

import { useState } from "react";
import { BookOpen, Pencil, Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/Utilities/Button";
import { useReadingGoals } from "@/hooks/useReadingGoals";
import type { ReadingGoal } from "@/lib/db/schema";

interface ReadingGoalsListProps {
  goals: ReadingGoal[];
  onEdit: (goal: ReadingGoal) => void;
  onDelete: () => void;
}

export function ReadingGoalsList({ goals, onEdit, onDelete }: ReadingGoalsListProps) {
  const { deleteGoalAsync } = useReadingGoals();
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const currentYear = new Date().getFullYear();

  async function handleDelete(goal: ReadingGoal) {
    if (!confirm(`Are you sure you want to delete your ${goal.year} reading goal?`)) {
      return;
    }

    setDeletingId(goal.id);
    try {
      await deleteGoalAsync(goal.id);
      onDelete();
    } catch (error) {
      // Error already handled by mutation
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
              </div>
              <p className="text-[var(--foreground)] font-medium">
                Goal: <span className="text-[var(--accent)] font-bold">{goal.booksGoal}</span> books
              </p>
              <p className="text-xs text-[var(--subheading-text)] mt-1">
                Created {new Date(goal.createdAt).toLocaleDateString()}
              </p>
            </div>

            {!isPastYear && (
              <div className="flex items-center gap-2">
                <Button
                  onClick={() => onEdit(goal)}
                  disabled={deletingId === goal.id}
                  variant="icon-danger"
                  className="text-[var(--foreground)]/60 hover:text-[var(--accent)] hover:bg-[var(--accent)]/10"
                  title="Edit goal"
                  icon={<Pencil className="w-4 h-4" />}
                />
                <Button
                  onClick={() => handleDelete(goal)}
                  disabled={deletingId === goal.id}
                  variant="icon-danger"
                  title="Delete goal"
                  icon={deletingId === goal.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
