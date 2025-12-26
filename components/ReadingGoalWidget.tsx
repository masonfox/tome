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

  const currentYear = new Date().getFullYear();
  const isPastYear = goal.year < currentYear;
  const isExceeded = booksCompleted > goal.booksGoal;
  const isGoalMet = booksCompleted === goal.booksGoal;
  const displayPercentage = Math.min(completionPercentage, 100);

  // PAST YEAR: Retrospective view
  if (isPastYear) {
    return (
      <div className="bg-[var(--card-bg)] border border-[var(--border-color)] rounded-sm p-8 hover:shadow-md transition-shadow relative">
        {/* Header Section - Status Badge */}
        <div className="flex items-center justify-between mb-6">
          <div className={`inline-flex items-center bg-[var(--card-bg)] rounded-sm px-3 py-2 ${
            isExceeded
              ? "border-2 border-emerald-600"
              : booksCompleted === goal.booksGoal
              ? "border-2 border-emerald-600"
              : "border-2 border-orange-600"
          }`}>
            {!isExceeded && booksRemaining > 0 && (
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-orange-600">
                <TrendingDown className="w-3.5 h-3.5" />
                Fell short
              </span>
            )}
            {isExceeded && (
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
                <Target className="w-3.5 h-3.5" />
                Goal Exceeded!
              </span>
            )}
            {!isExceeded && booksCompleted === goal.booksGoal && (
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
                <Target className="w-3.5 h-3.5" />
                Goal Achieved!
              </span>
            )}
          </div>
        </div>

        {/* Achievement Bar */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs uppercase tracking-wide text-[var(--foreground)]/70 font-semibold">
              <span className="font-bold">Goal:</span> {goal.booksGoal}
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
                  : booksCompleted === goal.booksGoal
                  ? "bg-gradient-to-r from-emerald-700 to-emerald-600"
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
              Books Read
            </p>
            <p className="text-3xl font-serif font-bold text-[var(--heading-text)]">
              {booksCompleted}
            </p>
          </div>
          {!isExceeded && booksRemaining > 0 && (
            <div className="border-l-2 border-orange-300 pl-4">
              <p className="text-xs uppercase tracking-wide text-[var(--foreground)]/70 font-semibold mb-1">
                Fell Short By
              </p>
              <p className="text-3xl font-serif font-bold text-[var(--heading-text)]">
                {booksRemaining}
              </p>
            </div>
          )}
          {isExceeded && (
            <div className="border-l-2 border-emerald-300 pl-4">
              <p className="text-xs uppercase tracking-wide text-[var(--foreground)]/70 font-semibold mb-1">
                Exceeded By
              </p>
              <p className="text-3xl font-serif font-bold text-[var(--heading-text)]">
                {booksCompleted - goal.booksGoal}
              </p>
            </div>
          )}
          {!isExceeded && booksRemaining === 0 && (
            <div className="border-l-2 border-emerald-300 pl-4">
              <p className="text-xs uppercase tracking-wide text-[var(--foreground)]/70 font-semibold mb-1">
                Goal
              </p>
              <p className="text-3xl font-serif font-bold text-[var(--heading-text)]">
                {goal.booksGoal}
              </p>
            </div>
          )}
        </div>
      </div>
    );
  }

  // CURRENT YEAR: Active tracking view
  return (
    <div className="bg-[var(--card-bg)] border border-[var(--border-color)] rounded-sm p-8 hover:shadow-md transition-shadow relative">
      {/* Header Section */}
      <div className="flex items-center justify-between mb-6">
        <div className={`inline-flex items-center bg-[var(--card-bg)] rounded-sm px-3 py-2 ${
          isExceeded || isGoalMet
            ? "border-2 border-emerald-600"
            : paceStatus === "ahead"
            ? "border-2 border-emerald-600"
            : paceStatus === "on-track"
            ? "border-2 border-[var(--accent)]"
            : "border-2 border-orange-600"
        }`}>
          {!isExceeded && !isGoalMet && <PaceIndicator paceStatus={paceStatus} booksAheadBehind={booksAheadBehind} />}
          {isGoalMet && (
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
              <Target className="w-3.5 h-3.5" />
              Goal Met!
            </span>
          )}
          {isExceeded && (
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
              <Target className="w-3.5 h-3.5" />
              Goal Exceeded!
            </span>
          )}
        </div>
        
        {onEditClick && (
          <button
            onClick={onEditClick}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[var(--subheading-text)] hover:text-[var(--foreground)] transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>
              <path d="m15 5 4 4"/>
            </svg>
            Edit
          </button>
        )}
      </div>

      {/* Progress Bar */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs uppercase tracking-wide text-[var(--foreground)]/70 font-semibold">
            <span className="font-bold">Goal:</span> {goal.booksGoal}
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
                : isGoalMet
                ? "bg-gradient-to-r from-emerald-700 to-emerald-600"
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
