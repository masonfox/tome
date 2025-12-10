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
        return "text-emerald-700";
      case "on-track":
        return "text-[var(--accent)]";
      case "behind":
        return "text-orange-600";
    }
  };

  const getStatusText = () => {
    if (paceStatus === "on-track") {
      return "On Track";
    }
    
    const books = Math.round(Math.abs(booksAheadBehind)); // Changed to whole number
    const bookText = books === 1 ? "book" : "books";
    
    if (paceStatus === "ahead") {
      return `${books} ${bookText} ahead`;
    } else {
      return `${books} ${bookText} behind`;
    }
  };

  const getIcon = () => {
    switch (paceStatus) {
      case "ahead":
        return <TrendingUp className="w-3.5 h-3.5" />;
      case "on-track":
        return <Target className="w-3.5 h-3.5" />;
      case "behind":
        return <TrendingDown className="w-3.5 h-3.5" />;
    }
  };

  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-semibold ${getStatusColor()}`}>
      {getIcon()}
      {getStatusText()}
    </span>
  );
}

interface ReadingGoalWidgetProps {
  goalData: ReadingGoalWithProgress;
  onEditClick?: () => void;
}

export function ReadingGoalWidget({ goalData, onEditClick }: ReadingGoalWidgetProps) {
  const { goal, progress } = goalData;
  const {
    booksCompleted,
    booksRemaining,
    completionPercentage,
    paceStatus,
    booksAheadBehind,
  } = progress;

  const isExceeded = booksCompleted > goal.booksGoal;
  const displayPercentage = Math.min(completionPercentage, 100);

  return (
    <div className="bg-[var(--card-bg)] border border-[var(--border-color)] rounded-sm p-8 hover:shadow-md transition-shadow relative">
      {/* Edit Button - Top Right */}
      {onEditClick && (
        <button
          onClick={onEditClick}
          className="absolute top-6 right-6 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[var(--subheading-text)] hover:text-[var(--foreground)] border border-[var(--border-color)] hover:border-[var(--foreground)]/30 rounded-sm transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>
            <path d="m15 5 4 4"/>
          </svg>
          Edit
        </button>
      )}

      {/* Header Section */}
      <div className="flex items-start justify-between mb-6 pr-20">
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
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
            <Target className="w-3.5 h-3.5" />
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
        <div className="w-full bg-[var(--border-color)] rounded-sm h-5 overflow-hidden">
          <div
            className={`h-5 transition-all duration-500 ease-out ${
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
    </div>
  );
}
