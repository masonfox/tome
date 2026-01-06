"use client";

import { Target } from "lucide-react";

interface CreateGoalPromptProps {
  onCreateClick?: () => void;
}

export function CreateGoalPrompt({ onCreateClick }: CreateGoalPromptProps) {
  const currentYear = new Date().getFullYear();

  return (
    <div className="bg-[var(--card-bg)] border border-[var(--border-color)] rounded-sm p-12 hover:shadow-md transition-shadow">
      <div className="text-center max-w-md mx-auto">
        <Target className="w-12 h-12 text-[var(--accent)]/60 mx-auto mb-4" />
        <h2 className="text-2xl font-serif font-bold text-[var(--heading-text)] mb-3">
          Set Your {currentYear} Reading Goal
        </h2>
        <p className="text-sm text-[var(--subheading-text)] mb-6 font-medium leading-relaxed">
          Track your reading progress and stay motivated throughout the year.
        </p>
        {onCreateClick ? (
          <button
            onClick={onCreateClick}
            className="px-6 py-2.5 bg-[var(--accent)] text-white rounded-sm hover:bg-[var(--light-accent)] transition-colors font-semibold text-sm"
          >
            Create Goal
          </button>
        ) : (
          <a
            href="/settings"
            className="inline-block px-6 py-2.5 bg-[var(--accent)] text-white rounded-sm hover:bg-[var(--light-accent)] transition-colors font-semibold text-sm"
          >
            Create Goal
          </a>
        )}
      </div>
    </div>
  );
}
