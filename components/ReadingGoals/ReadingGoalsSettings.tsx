"use client";

import { useState } from "react";
import { Target, Plus } from "lucide-react";
import { Button } from "@/components/Utilities/Button";
import { ReadingGoalForm } from "./ReadingGoalForm";
import { ReadingGoalsList } from "./ReadingGoalsList";
import type { ReadingGoal } from "@/lib/db/schema";

interface ReadingGoalsSettingsProps {
  initialGoals: ReadingGoal[];
}

export function ReadingGoalsSettings({ initialGoals }: ReadingGoalsSettingsProps) {
  const [goals, setGoals] = useState<ReadingGoal[]>(initialGoals);
  const [showForm, setShowForm] = useState(false);
  const [editingGoal, setEditingGoal] = useState<ReadingGoal | undefined>();
  const [booksGoal, setBooksGoal] = useState<number | "">(1);

  async function refreshGoals() {
    const res = await fetch("/api/reading-goals");
    const data = await res.json();
    if (data.success) {
      setGoals(data.data);
    }
  }

  function handleCreateNew() {
    setEditingGoal(undefined);
    setBooksGoal(1);
    setShowForm(true);
  }

  function handleEdit(goal: ReadingGoal) {
    setEditingGoal(goal);
    setBooksGoal(goal.booksGoal);
    setShowForm(true);
  }

  function handleFormCancel() {
    setShowForm(false);
    setEditingGoal(undefined);
  }

  function handleDelete() {
    refreshGoals();
  }

  return (
    <div className="bg-[var(--card-bg)] border border-[var(--border-color)] rounded-md p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Target className="w-6 h-6 text-[var(--accent)]" />
          <h3 className="text-xl font-serif font-bold text-[var(--heading-text)]">
            Annual Reading Goals
          </h3>
        </div>
        {!showForm && (
          <Button
            onClick={handleCreateNew}
            variant="primary"
            size="md"
            icon={<Plus className="w-4 h-4" />}
          >
            New Goal
          </Button>
        )}
      </div>

      <p className="text-sm text-[var(--subheading-text)] mb-6 font-medium">
        Set your annual book reading targets and track your progress throughout the year.
      </p>

      {showForm ? (
        <div className="bg-[var(--background)] border border-[var(--border-color)] rounded-md p-6 mb-6">
          <ReadingGoalForm
            mode={editingGoal ? "edit" : "create"}
            existingGoal={editingGoal}
            booksGoal={booksGoal}
            onBooksGoalChange={setBooksGoal}
          />
          <div className="flex justify-end gap-2 mt-4">
            <Button
              onClick={handleFormCancel}
              variant="secondary"
              size="md"
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : null}

      <ReadingGoalsList
        goals={goals}
        onEdit={handleEdit}
        onDelete={handleDelete}
      />
    </div>
  );
}
