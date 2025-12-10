"use client";

import { ReadingGoalWithProgress } from "@/lib/services/reading-goals.service";
import { Target, TrendingUp, TrendingDown } from "lucide-react";

interface PaceIndicatorProps {
  paceStatus: "ahead" | "on-track" | "behind";
  booksAheadBehind: number;
}

export function PaceIndicator({ paceStatus, booksAheadBehind }: PaceIndicatorProps) {
  const getStatusColor = () => {
    switch (paceStatus) {
      case "ahead":
        return "text-emerald-700 bg-emerald-50/50";
      case "on-track":
        return "text-[var(--accent)] bg-[var(--accent)]/10";
      case "behind":
        return "text-orange-700 bg-orange-50/50";
    }
  };

  const getStatusText = () => {
    if (paceStatus === "on-track") {
      return "On Track";
    }
    
    const books = Math.abs(booksAheadBehind);
    const bookText = books === 1 ? "book" : "books";
    
    if (paceStatus === "ahead") {
      return `${books.toFixed(1)} ${bookText} ahead`;
    } else {
      return `${books.toFixed(1)} ${bookText} behind`;
    }
  };

  const getIcon = () => {
    switch (paceStatus) {
      case "ahead":
        return <TrendingUp className="w-3 h-3" />;
      case "on-track":
        return <Target className="w-3 h-3" />;
      case "behind":
        return <TrendingDown className="w-3 h-3" />;
    }
  };

  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-sm text-xs font-semibold ${getStatusColor()}`}>
      {getIcon()}
      {getStatusText()}
    </span>
  );
}

interface ReadingGoalWidgetProps {
  goalData: ReadingGoalWithProgress;
}

export function ReadingGoalWidget({ goalData }: ReadingGoalWidgetProps) {
  const { goal, progress } = goalData;
  const {
    booksCompleted,
    booksRemaining,
    completionPercentage,
    paceStatus,
    projectedFinishDate,
    booksAheadBehind,
  } = progress;

  const isExceeded = booksCompleted > goal.booksGoal;
  const displayPercentage = Math.min(completionPercentage, 100);

  return (
    <div className="bg-[var(--card-bg)] border border-[var(--border-color)] rounded-sm p-8 hover:shadow-md transition-shadow">
      {/* Header Section */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h2 className="text-2xl font-serif font-bold text-[var(--heading-text)]">
            {goal.year} Reading Goal
          </h2>
          <p className="text-sm text-[var(--subheading-text)] mt-1 font-medium">
            {booksCompleted} of {goal.booksGoal} books completed
          </p>
        </div>
        {!isExceeded && <PaceIndicator paceStatus={paceStatus} booksAheadBehind={booksAheadBehind} />}
        {isExceeded && (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-sm text-xs font-semibold text-emerald-700 bg-emerald-50/50">
            <Target className="w-3 h-3" />
            Goal Exceeded!
          </span>
        )}
      </div>

      {/* Progress Bar */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs uppercase tracking-wide text-[var(--foreground)]/70 font-semibold">
            Progress
          </span>
          <span className="text-sm font-bold text-[var(--heading-text)]">
            {displayPercentage}%
          </span>
        </div>
        <div className="w-full bg-[var(--border-color)] rounded-sm h-4 overflow-hidden">
          <div
            className={`h-4 transition-all duration-500 ease-out ${
              isExceeded
                ? "bg-gradient-to-r from-emerald-600 to-emerald-500"
                : paceStatus === "ahead"
                ? "bg-gradient-to-r from-emerald-700 to-emerald-600"
                : paceStatus === "on-track"
                ? "bg-gradient-to-r from-[var(--accent)] to-[var(--light-accent)]"
                : "bg-gradient-to-r from-orange-600 to-orange-500"
            }`}
            style={{ width: `${displayPercentage}%` }}
          />
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-6">
        <div className="border-l-2 border-[var(--accent)] pl-4">
          <p className="text-xs uppercase tracking-wide text-[var(--foreground)]/70 font-semibold mb-1">
            Completed
          </p>
          <p className="text-3xl font-serif font-bold text-[var(--heading-text)]">
            {booksCompleted}
          </p>
        </div>
        <div className="border-l-2 border-[var(--border-color)] pl-4">
          <p className="text-xs uppercase tracking-wide text-[var(--foreground)]/70 font-semibold mb-1">
            Remaining
          </p>
          <p className="text-3xl font-serif font-bold text-[var(--heading-text)]">
            {booksRemaining}
          </p>
        </div>
      </div>

      {/* Projected Finish Date */}
      {projectedFinishDate && !isExceeded && (
        <div className="mt-6 pt-6 border-t border-[var(--border-color)]">
          <p className="text-sm text-[var(--foreground)]/80">
            <span className="text-xs uppercase tracking-wide text-[var(--foreground)]/70 font-semibold">
              Projected finish:
            </span>{" "}
            <span className="font-semibold text-[var(--heading-text)]">
              {new Date(projectedFinishDate).toLocaleDateString("en-US", {
                month: "long",
                day: "numeric",
                year: "numeric",
              })}
            </span>
          </p>
        </div>
      )}
    </div>
  );
}
