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
        return <Target className="w-4 h-4" />;
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

  // Helper function to get banner gradient
  const getBannerGradient = () => {
    if (isPastYear) {
      if (isExceeded || isGoalMet) {
        return "bg-gradient-to-r from-emerald-700/10 via-emerald-600/10 to-emerald-500/10 border-b border-emerald-600/20";
      }
      return "bg-gradient-to-r from-orange-600/10 via-orange-500/10 to-orange-400/10 border-b border-orange-600/20";
    }
    
    if (isExceeded || isGoalMet) {
      return "bg-gradient-to-r from-emerald-700/10 via-emerald-600/10 to-emerald-500/10 border-b border-emerald-600/20";
    }
    if (paceStatus === "ahead") {
      return "bg-gradient-to-r from-emerald-700/10 via-emerald-600/10 to-emerald-500/10 border-b border-emerald-600/20";
    }
    if (paceStatus === "on-track") {
      return "bg-gradient-to-r from-[var(--accent)]/10 via-[var(--accent)]/8 to-[var(--light-accent)]/10 border-b border-[var(--accent)]/20";
    }
    return "bg-gradient-to-r from-orange-600/10 via-orange-500/10 to-orange-400/10 border-b border-orange-600/20";
  };

  // Helper function to get progress bar gradient and animation
  const getProgressBarClasses = () => {
    const shouldPulse = isExceeded || isGoalMet;
    const baseClasses = "h-12 transition-all duration-500 ease-out flex items-center justify-center relative";
    
    let gradientClasses = "";
    if (isPastYear) {
      if (isExceeded || isGoalMet) {
        gradientClasses = "bg-gradient-to-r from-emerald-700 to-emerald-600";
      } else {
        gradientClasses = "bg-gradient-to-r from-orange-600 to-orange-500";
      }
    } else {
      if (isExceeded) {
        gradientClasses = "bg-gradient-to-r from-emerald-600 to-emerald-500";
      } else if (isGoalMet) {
        gradientClasses = "bg-gradient-to-r from-emerald-700 to-emerald-600";
      } else if (paceStatus === "ahead") {
        gradientClasses = "bg-gradient-to-r from-emerald-700 to-emerald-600";
      } else if (paceStatus === "on-track") {
        gradientClasses = "bg-gradient-to-r from-[var(--accent)] to-[var(--light-accent)]";
      } else {
        gradientClasses = "bg-gradient-to-r from-orange-600 to-orange-500";
      }
    }
    
    const pulseClasses = shouldPulse ? "animate-pulse-subtle" : "";
    return `${baseClasses} ${gradientClasses} ${pulseClasses}`;
  };

  // PAST YEAR: Retrospective view
  if (isPastYear) {
    return (
      <div className="bg-[var(--card-bg)] border border-[var(--border-color)] rounded-md hover:shadow-lg transition-all duration-300 overflow-hidden">
        {/* Status Banner */}
        <div className={`px-6 py-4 flex items-center justify-between ${getBannerGradient()}`}>
          <div className="flex items-center gap-2">
            {!isExceeded && booksRemaining > 0 && (
              <span className="inline-flex items-center gap-2 text-sm font-semibold text-orange-600">
                <TrendingDown className="w-4 h-4" />
                Fell short
              </span>
            )}
            {isExceeded && (
              <span className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-700">
                <Target className="w-4 h-4" />
                Goal Exceeded!
              </span>
            )}
            {!isExceeded && isGoalMet && (
              <span className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-700">
                <Target className="w-4 h-4" />
                Goal Achieved!
              </span>
            )}
          </div>
        </div>

        {/* Card Content */}
        <div className="p-6">
          {/* Goal Info Header */}
          <div className="flex items-center justify-between mb-4">
            <span className="text-base font-semibold text-[var(--foreground)]">
              Goal: <span className="text-[var(--heading-text)]">{goal.booksGoal} books</span>
            </span>
            <span className="text-base font-bold text-[var(--heading-text)]">
              {displayPercentage}%
            </span>
          </div>

          {/* Hero Progress Bar */}
          <div className="mb-6">
            <div className="relative w-full bg-[var(--border-color)] rounded-lg h-12 overflow-hidden shadow-inner">
              <div
                className={getProgressBarClasses()}
                style={{ width: `${displayPercentage}%` }}
              >
                {/* Percentage inside bar - positioned based on bar width */}
                {displayPercentage > 0 && (
                  <span 
                    className={`text-2xl font-bold font-serif text-white drop-shadow-md ${
                      displayPercentage < 30 ? 'absolute right-2' : ''
                    }`}
                    style={{
                      textShadow: '0 2px 4px rgba(0,0,0,0.3), 0 1px 2px rgba(0,0,0,0.2)'
                    }}
                  >
                    {displayPercentage}%
                  </span>
                )}
              </div>
            </div>
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
              <div className="bg-[var(--card-bg-emphasis)] rounded-md p-4 border-l-[3px] border-orange-400">
                <p className="text-xs uppercase tracking-wide text-[var(--foreground)]/70 font-semibold mb-2">
                  Fell Short By
                </p>
                <p className="text-5xl font-serif font-bold text-[var(--heading-text)]">
                  {booksRemaining}
                </p>
              </div>
            )}
            {isExceeded && (
              <div className="bg-[var(--card-bg-emphasis)] rounded-md p-4 border-l-[3px] border-emerald-400">
                <p className="text-xs uppercase tracking-wide text-[var(--foreground)]/70 font-semibold mb-2">
                  Exceeded By
                </p>
                <p className="text-5xl font-serif font-bold text-[var(--heading-text)]">
                  {booksCompleted - goal.booksGoal}
                </p>
              </div>
            )}
            {!isExceeded && booksRemaining === 0 && (
              <div className="bg-[var(--card-bg-emphasis)] rounded-md p-4 border-l-[3px] border-emerald-400">
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
      <div className={`px-6 py-4 flex items-center justify-between ${getBannerGradient()}`}>
        <div className="flex items-center gap-2">
          {!isExceeded && !isGoalMet && <PaceIndicator paceStatus={paceStatus} booksAheadBehind={booksAheadBehind} />}
          {isGoalMet && (
            <span className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-700">
              <Target className="w-4 h-4" />
              Goal Met!
            </span>
          )}
          {isExceeded && (
            <span className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-700">
              <Target className="w-4 h-4" />
              Goal Exceeded!
            </span>
          )}
        </div>
        
        {onEditClick && (
          <button
            onClick={onEditClick}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold text-[var(--subheading-text)] hover:text-[var(--foreground)] hover:bg-[var(--card-bg-emphasis)] rounded-md transition-all"
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
          <span className="text-base font-semibold text-[var(--foreground)]">
            Goal: <span className="text-[var(--heading-text)]">{goal.booksGoal} books</span>
          </span>
          <span className="text-base font-bold text-[var(--heading-text)]">
            {displayPercentage}%
          </span>
        </div>

        {/* Hero Progress Bar */}
        <div className="mb-6">
          <div 
            className="relative w-full bg-[var(--border-color)] rounded-lg h-12 overflow-hidden shadow-inner"
            role="progressbar"
            aria-valuenow={displayPercentage}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`Reading progress: ${displayPercentage}% complete`}
          >
            <div
              className={getProgressBarClasses()}
              style={{ width: `${displayPercentage}%` }}
            >
              {/* Percentage inside bar - positioned based on bar width */}
              {displayPercentage > 0 && (
                <span 
                  className={`text-2xl font-bold font-serif text-white drop-shadow-md ${
                    displayPercentage < 30 ? 'absolute right-2' : ''
                  }`}
                  style={{
                    textShadow: '0 2px 4px rgba(0,0,0,0.3), 0 1px 2px rgba(0,0,0,0.2)'
                  }}
                  aria-hidden="true"
                >
                  {displayPercentage}%
                </span>
              )}
            </div>
          </div>
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
