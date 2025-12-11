"use client";

import { useState } from "react";
import { Target, TrendingUp, BookOpen } from "lucide-react";
import { toast } from "sonner";

interface GoalsOnboardingProps {
  onCreateGoal: (year: number, booksGoal: number) => Promise<void>;
}

export function GoalsOnboarding({ onCreateGoal }: GoalsOnboardingProps) {
  const currentYear = new Date().getFullYear();
  const [booksGoal, setBooksGoal] = useState(12);
  const [isCreating, setIsCreating] = useState(false);

  async function handleCreate() {
    if (booksGoal < 1 || booksGoal > 9999) {
      toast.error("Books goal must be between 1 and 9999");
      return;
    }

    setIsCreating(true);
    try {
      await onCreateGoal(currentYear, booksGoal);
      toast.success("Reading goal created! Start tracking your progress today.");
    } catch (error) {
      toast.error("Failed to create reading goal. Please try again.");
      setIsCreating(false);
    }
  }

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      {/* Hero Section */}
      <div className="text-center space-y-4">
        <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full mb-4">
          <Target className="w-10 h-10 text-white" />
        </div>
        <h1 className="text-4xl font-serif font-bold text-[var(--heading-text)]">
          Set Your Reading Goals
        </h1>
        <p className="text-lg text-[var(--subheading-text)] max-w-2xl mx-auto">
          Track your annual reading targets and watch your progress throughout the year.
          Set a realistic goal and celebrate every book you complete.
        </p>
      </div>

      {/* Features Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-[var(--card-bg)] border border-[var(--border-color)] rounded-md p-6 space-y-3">
          <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center">
            <Target className="w-6 h-6 text-white" />
          </div>
          <h3 className="text-lg font-serif font-bold text-[var(--heading-text)]">
            Annual Targets
          </h3>
          <p className="text-sm text-[var(--subheading-text)]">
            Set a yearly books goal and track your progress as you read throughout the year.
          </p>
        </div>

        <div className="bg-[var(--card-bg)] border border-[var(--border-color)] rounded-md p-6 space-y-3">
          <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg flex items-center justify-center">
            <TrendingUp className="w-6 h-6 text-white" />
          </div>
          <h3 className="text-lg font-serif font-bold text-[var(--heading-text)]">
            Progress Tracking
          </h3>
          <p className="text-sm text-[var(--subheading-text)]">
            Visualize your reading journey with charts showing monthly progress and pace.
          </p>
        </div>

        <div className="bg-[var(--card-bg)] border border-[var(--border-color)] rounded-md p-6 space-y-3">
          <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-green-600 rounded-lg flex items-center justify-center">
            <BookOpen className="w-6 h-6 text-white" />
          </div>
          <h3 className="text-lg font-serif font-bold text-[var(--heading-text)]">
            Multi-Year History
          </h3>
          <p className="text-sm text-[var(--subheading-text)]">
            Create goals for any year and review your reading achievements over time.
          </p>
        </div>
      </div>

      {/* Setup Section */}
      <div className="bg-[var(--card-bg)] border border-[var(--border-color)] rounded-md p-8 space-y-6">
        <div className="space-y-2">
          <h2 className="text-2xl font-serif font-bold text-[var(--heading-text)]">
            Create Your First Goal
          </h2>
          <p className="text-[var(--subheading-text)]">
            Choose how many books you want to read this year. You can update this later or create goals for other years.
          </p>
        </div>

        <div className="space-y-4">
          <div>
            <label
              htmlFor="books-goal"
              className="block text-sm font-semibold text-[var(--foreground)]/70 mb-2"
            >
              Books to read
            </label>
            <input
              id="books-goal"
              type="number"
              min="1"
              max="9999"
              value={booksGoal}
              onChange={(e) => {
                const val = parseInt(e.target.value);
                setBooksGoal(isNaN(val) ? 1 : val);
              }}
              className="w-full px-4 py-3 bg-[var(--card-bg)] border border-[var(--border-color)] rounded-sm text-[var(--foreground)] text-lg font-medium focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent"
              disabled={isCreating}
            />
          </div>
          
          <p className="text-xs text-[var(--subheading-text)]">
            Suggested: 12-24 books for casual readers, 30-50 for avid readers
          </p>

          <div className="flex gap-3">
            <button
              onClick={handleCreate}
              disabled={isCreating}
              className="flex-1 px-6 py-3 bg-[var(--accent)] text-white rounded-sm hover:bg-[var(--light-accent)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-semibold text-lg"
            >
              {isCreating ? "Creating..." : "Create Reading Goal"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
