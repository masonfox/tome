/**
 * Reading Goal Style Utilities
 * Centralized color and styling logic for reading goal components
 * Ensures consistent visual feedback across all goal-related UI
 */

export type PaceStatus = "ahead" | "on-track" | "behind";

interface GoalStatusColors {
  text: string;
  gradient: string;
  banner: string;
  border: string;
}

/**
 * Get color classes based on pace status and goal completion
 * Used for text, progress bars, banners, and borders
 * 
 * @param paceStatus - Current pace status (ahead, on-track, behind)
 * @param isGoalMet - Whether the goal has been exactly met
 * @param isExceeded - Whether the goal has been exceeded
 * @param isPastYear - Whether this is a retrospective view
 * @returns Object with color classes for different UI elements
 * 
 * @example
 * const colors = getGoalStatusColors("ahead", false, false, false);
 * // => { text: "text-emerald-700", gradient: "bg-gradient-to-r from-emerald-700 to-emerald-600", ... }
 */
export function getGoalStatusColors(
  paceStatus: PaceStatus,
  isGoalMet: boolean,
  isExceeded: boolean,
  isPastYear: boolean
): GoalStatusColors {
  // Goal met or exceeded - always green
  if (isExceeded || isGoalMet) {
    return {
      text: "text-emerald-700",
      gradient: "bg-gradient-to-r from-emerald-700 to-emerald-600",
      banner: "bg-gradient-to-r from-emerald-700/10 via-emerald-600/10 to-emerald-500/10 border-b border-emerald-600/40",
      border: "border-emerald-400",
    };
  }

  // Past year incomplete - orange
  if (isPastYear) {
    return {
      text: "text-orange-600",
      gradient: "bg-gradient-to-r from-orange-600 to-orange-500",
      banner: "bg-gradient-to-r from-orange-600/10 via-orange-500/10 to-orange-400/10 border-b border-orange-600/40",
      border: "border-orange-400",
    };
  }

  // Current year - based on pacing
  switch (paceStatus) {
    case "ahead":
      return {
        text: "text-emerald-700",
        gradient: "bg-gradient-to-r from-emerald-700 to-emerald-600",
        banner: "bg-gradient-to-r from-emerald-700/10 via-emerald-600/10 to-emerald-500/10 border-b border-emerald-600/40",
        border: "border-emerald-400",
      };
    
    case "on-track":
      return {
        text: "text-[var(--accent)]",
        gradient: "bg-gradient-to-r from-[var(--accent)] to-[var(--light-accent)]",
        banner: "bg-[var(--card-bg-emphasis)] border-b border-[var(--border-color)]",
        border: "border-[var(--accent)]",
      };
    
    case "behind":
      return {
        text: "text-orange-600",
        gradient: "bg-gradient-to-r from-orange-600 to-orange-500",
        banner: "bg-gradient-to-r from-orange-600/10 via-orange-500/10 to-orange-400/10 border-b border-orange-600/40",
        border: "border-orange-400",
      };
  }
}

/**
 * Get text color class for books completed number
 * Simpler helper that only returns the text color
 * 
 * @param paceStatus - Current pace status (ahead, on-track, behind)
 * @param isGoalMet - Whether the goal has been exactly met
 * @param isExceeded - Whether the goal has been exceeded
 * @param isPastYear - Whether this is a retrospective view
 * @returns Text color class
 * 
 * @example
 * const color = getBooksCompletedColor("ahead");
 * // => "text-emerald-700"
 */
export function getBooksCompletedColor(
  paceStatus: PaceStatus,
  isGoalMet: boolean,
  isExceeded: boolean,
  isPastYear: boolean
): string {
  return getGoalStatusColors(paceStatus, isGoalMet, isExceeded, isPastYear).text;
}
