"use client";

import { ReadingGoalWithProgress } from "@/lib/services/reading-goals.service";

interface PaceIndicatorProps {
  paceStatus: "ahead" | "on-track" | "behind";
  daysAheadBehind: number;
}

export function PaceIndicator({ paceStatus, daysAheadBehind }: PaceIndicatorProps) {
  const getStatusColor = () => {
    switch (paceStatus) {
      case "ahead":
        return "text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20";
      case "on-track":
        return "text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20";
      case "behind":
        return "text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20";
    }
  };

  const getStatusText = () => {
    if (paceStatus === "on-track") {
      return "On Track";
    }
    
    const days = Math.abs(daysAheadBehind);
    const dayText = days === 1 ? "day" : "days";
    
    if (paceStatus === "ahead") {
      return `${days} ${dayText} ahead`;
    } else {
      return `${days} ${dayText} behind`;
    }
  };

  return (
    <span className={`px-2 py-1 rounded-md text-xs font-medium ${getStatusColor()}`}>
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
    daysAheadBehind,
  } = progress;

  const isExceeded = booksCompleted > goal.booksGoal;
  const displayPercentage = Math.min(completionPercentage, 100);

  return (
    <div className="bg-white dark:bg-neutral-800 rounded-lg border border-neutral-200 dark:border-neutral-700 p-6">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
            {goal.year} Reading Goal
          </h3>
          <p className="text-sm text-neutral-600 dark:text-neutral-400 mt-1">
            {booksCompleted} of {goal.booksGoal} books
            {isExceeded && " (Goal exceeded!)"}
          </p>
        </div>
        {!isExceeded && <PaceIndicator paceStatus={paceStatus} daysAheadBehind={daysAheadBehind} />}
        {isExceeded && (
          <span className="px-2 py-1 rounded-md text-xs font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20">
            Goal Exceeded! 🎉
          </span>
        )}
      </div>

      {/* Progress Bar */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
            Progress
          </span>
          <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
            {displayPercentage}%
          </span>
        </div>
        <div className="w-full bg-neutral-200 dark:bg-neutral-700 rounded-full h-3">
          <div
            className={`h-3 rounded-full transition-all duration-300 ${
              isExceeded
                ? "bg-emerald-500 dark:bg-emerald-600"
                : paceStatus === "ahead"
                ? "bg-green-500 dark:bg-green-600"
                : paceStatus === "on-track"
                ? "bg-blue-500 dark:bg-blue-600"
                : "bg-amber-500 dark:bg-amber-600"
            }`}
            style={{ width: `${displayPercentage}%` }}
          />
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <p className="text-neutral-600 dark:text-neutral-400">Completed</p>
          <p className="text-xl font-semibold text-neutral-900 dark:text-neutral-100">
            {booksCompleted}
          </p>
        </div>
        <div>
          <p className="text-neutral-600 dark:text-neutral-400">Remaining</p>
          <p className="text-xl font-semibold text-neutral-900 dark:text-neutral-100">
            {booksRemaining}
          </p>
        </div>
      </div>

      {/* Projected Finish Date */}
      {projectedFinishDate && !isExceeded && (
        <div className="mt-4 pt-4 border-t border-neutral-200 dark:border-neutral-700">
          <p className="text-xs text-neutral-600 dark:text-neutral-400">
            Projected finish:{" "}
            <span className="font-medium text-neutral-900 dark:text-neutral-100">
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
