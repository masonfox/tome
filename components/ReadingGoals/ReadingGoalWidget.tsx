"use client";

import { ReadingGoalWithProgress } from "@/lib/services/reading-goals.service";
import { Target, TrendingUp, TrendingDown, CheckCircle2, Trophy } from "lucide-react";
import { getGoalStatusColors, type PaceStatus } from "@/lib/utils/reading-goal-styles";
import { ProgressBar } from "@/components/Utilities/ProgressBar";

interface PaceIndicatorProps {
  paceStatus: PaceStatus;
  booksAheadBehind: number;
}

export function PaceIndicator({ paceStatus, booksAheadBehind }: PaceIndicatorProps) {
  const colors = getGoalStatusColors(paceStatus, false, false, false);
  const getStatusColor = () => colors.text;

  const getStatusText = () => {
    if (paceStatus === "on-track") {
      return "On Track";
    }
    
    const books = Math.round(Math.abs(booksAheadBehind));
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
        return <TrendingUp className="w-4 h-4" />;
      case "on-track":
        return <CheckCircle2 className="w-4 h-4" />;
      case "behind":
        return <TrendingDown className="w-4 h-4" />;
    }
  };

  return (
    <span className={`inline-flex items-center gap-2 text-sm font-semibold ${getStatusColor()}`}>
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

  // Get colors based on current status
  const statusColors = getGoalStatusColors(paceStatus, isGoalMet, isExceeded, isPastYear);

  // Helper function to get banner gradient
  const getBannerGradient = () => statusColors.banner;

  // Helper function to get color for the books completed number based on pacing
  const getBooksCompletedColor = () => statusColors.text;

  // PAST YEAR: Retrospective view
  if (isPastYear) {
    return (
      <div className="bg-[var(--card-bg)] border border-[var(--border-color)] rounded-md hover:shadow-lg transition-all duration-300 overflow-hidden">
        {/* Status Banner */}
        <div className={`px-6 py-4 h-[56px] flex items-center justify-between ${getBannerGradient()}`}>
          <div className="flex items-center gap-2">
            {!isExceeded && booksRemaining > 0 && (
              <span className="inline-flex items-center gap-2 text-sm font-semibold text-orange-600">
                <TrendingDown className="w-4 h-4" />
                Fell short
              </span>
            )}
            {isExceeded && (
              <span className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-700">
                <Trophy className="w-4 h-4" />
                Goal Exceeded!
              </span>
            )}
            {!isExceeded && isGoalMet && (
              <span className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-700">
                <Trophy className="w-4 h-4" />
                Goal Achieved!
              </span>
            )}
          </div>
        </div>

        {/* Card Content */}
        <div className="p-6">
          {/* Goal Info Header */}
          <div className="flex items-center justify-between mb-4">
            <span className="inline-flex items-center gap-[6px]">              
              <Target className="w-4 h-4 text-[var(--accent)] flex-shrink-0" />
              <span className="text-base font-semibold text-[var(--foreground)]">
                Goal: <span className="text-[var(--heading-text)]">{goal.booksGoal} books</span>
              </span>
            </span>
            <span className="text-base font-bold text-[var(--heading-text)]">
              <span className={getBooksCompletedColor()}>{booksCompleted}</span>/{goal.booksGoal} books
            </span>
          </div>

          {/* Hero Progress Bar */}
          <div className="mb-6">
            <ProgressBar
              percentage={displayPercentage}
              variant="hero"
              textDisplay="percentage"
              shouldPulse={isExceeded || isGoalMet}
            />
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-[var(--card-bg-emphasis)] rounded-md p-4 border-l-[3px] border-[var(--accent)]">
              <p className="text-xs uppercase tracking-wide text-[var(--foreground)]/70 font-semibold mb-2">
                Books Read
              </p>
              <p className="text-5xl font-serif font-bold text-[var(--heading-text)]">
                {booksCompleted}
              </p>
            </div>
            {!isExceeded && booksRemaining > 0 && (
              <div className={`bg-[var(--card-bg-emphasis)] rounded-md p-4 border-l-[3px] ${statusColors.border}`}>
                <p className="text-xs uppercase tracking-wide text-[var(--foreground)]/70 font-semibold mb-2">
                  Fell Short By
                </p>
                <p className="text-5xl font-serif font-bold text-[var(--heading-text)]">
                  {booksRemaining}
                </p>
              </div>
            )}
            {isExceeded && (
              <div className={`bg-[var(--card-bg-emphasis)] rounded-md p-4 border-l-[3px] ${statusColors.border}`}>
                <p className="text-xs uppercase tracking-wide text-[var(--foreground)]/70 font-semibold mb-2">
                  Exceeded By
                </p>
                <p className="text-5xl font-serif font-bold text-[var(--heading-text)]">
                  {booksCompleted - goal.booksGoal}
                </p>
              </div>
            )}
            {!isExceeded && booksRemaining === 0 && (
              <div className={`bg-[var(--card-bg-emphasis)] rounded-md p-4 border-l-[3px] ${statusColors.border}`}>
                <p className="text-xs uppercase tracking-wide text-[var(--foreground)]/70 font-semibold mb-2">
                  Goal
                </p>
                <p className="text-5xl font-serif font-bold text-[var(--heading-text)]">
                  {goal.booksGoal}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // CURRENT YEAR: Active tracking view
  return (
    <div className="bg-[var(--card-bg)] border border-[var(--border-color)] rounded-md hover:shadow-lg transition-all duration-300 overflow-hidden">
      {/* Status Banner */}
      <div className={`px-6 py-4 h-[56px] flex items-center justify-between ${getBannerGradient()}`}>
        <div className="flex items-center gap-2">
          {!isExceeded && !isGoalMet && <PaceIndicator paceStatus={paceStatus} booksAheadBehind={booksAheadBehind} />}
          {isGoalMet && (
            <span className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-700">
              <Trophy className="w-4 h-4" />
              Goal Met!
            </span>
          )}
          {isExceeded && (
            <span className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-700">
              <Trophy className="w-4 h-4" />
              Goal Exceeded!
            </span>
          )}
        </div>
        
        {onEditClick && (
          <button
            onClick={onEditClick}
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--subheading-text)] hover:text-[var(--foreground)] transition-colors"
            aria-label="Edit reading goal"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>
              <path d="m15 5 4 4"/>
            </svg>
            Edit
          </button>
        )}
      </div>

      {/* Card Content */}
      <div className="p-6">
        {/* Goal Info Header */}
        <div className="flex items-center justify-between mb-4">
          <span className="inline-flex items-center gap-[6px]">
            <Target className="w-4 h-4 text-[var(--accent)] flex-shrink-0" />
            <span className="text-base font-semibold text-[var(--foreground)]">
              Goal: <span className="text-[var(--heading-text)]">{goal.booksGoal} books</span>
            </span>
          </span>
          <span className="text-base font-bold text-[var(--heading-text)]">
            <span className={getBooksCompletedColor()}>{booksCompleted}</span>/{goal.booksGoal} books
          </span>
        </div>

        {/* Hero Progress Bar */}
        <div className="mb-6">
          <ProgressBar
            percentage={displayPercentage}
            variant="hero"
            textDisplay="percentage"
            shouldPulse={isExceeded || isGoalMet}
          />
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-[var(--card-bg-emphasis)] rounded-md p-4 border-l-[3px] border-[var(--accent)]">
            <p className="text-xs uppercase tracking-wide text-[var(--foreground)]/70 font-semibold mb-2">
              Completed
            </p>
            <p className="text-5xl font-serif font-bold text-[var(--heading-text)]">
              {booksCompleted}
            </p>
          </div>
          <div className="bg-[var(--card-bg-emphasis)] rounded-md p-4 border-l-[3px] border-[var(--border-color)]">
            <p className="text-xs uppercase tracking-wide text-[var(--foreground)]/70 font-semibold mb-2">
              Remaining
            </p>
            <p className="text-5xl font-serif font-bold text-[var(--heading-text)]">
              {booksRemaining}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
