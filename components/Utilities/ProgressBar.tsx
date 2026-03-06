"use client";

import { useEffect, useRef, useState } from "react";

type ProgressBarVariant = "hero" | "compact";
type TextDisplayMode = "percentage" | "page-count" | "none";

interface ProgressBarProps {
  /** Current progress percentage (0-100) */
  percentage: number;
  /** Visual variant - hero (h-12) or compact (h-2) */
  variant?: ProgressBarVariant;
  /** What text to display inside the bar */
  textDisplay?: TextDisplayMode;
  /** Current page number (required if textDisplay is "page-count") */
  currentPage?: number;
  /** Total pages (required if textDisplay is "page-count") */
  totalPages?: number;
  /** Optional className for the outer container */
  className?: string;
  /** Whether to show pulsing animation (for goal completion) */
  shouldPulse?: boolean;
  /** Optional custom gradient colors (defaults to accent colors) */
  gradientFrom?: string;
  gradientTo?: string;
}

/**
 * Unified progress bar component used across the app
 * Supports two main variants:
 * - hero: Large progress bar (h-12) with text overlay, used on goals and book detail pages
 * - compact: Thin progress bar (h-2) with no text, used on dashboard/list views
 */
export function ProgressBar({
  percentage,
  variant = "hero",
  textDisplay = "percentage",
  currentPage,
  totalPages,
  className = "",
  shouldPulse = false,
  gradientFrom = "var(--accent)",
  gradientTo = "var(--light-accent)",
}: ProgressBarProps) {
  const progressBarRef = useRef<HTMLDivElement>(null);
  const [barWidth, setBarWidth] = useState(0);

  // Measure bar width for text overlay positioning
  useEffect(() => {
    if (progressBarRef.current && variant === "hero" && textDisplay !== "none") {
      setBarWidth(progressBarRef.current.offsetWidth);
    }
  }, [percentage, variant, textDisplay, currentPage, totalPages]);

  // Clamp percentage to 0-100 range
  const displayPercentage = Math.min(Math.max(percentage, 0), 100);

  // Validation for page-count mode
  if (textDisplay === "page-count" && (currentPage === undefined || totalPages === undefined)) {
    console.error("ProgressBar: currentPage and totalPages are required when textDisplay is 'page-count'");
    return null;
  }

  // Generate text content
  const getTextContent = () => {
    if (textDisplay === "percentage") {
      return `${Math.round(displayPercentage)}%`;
    } else if (textDisplay === "page-count") {
      return `Page ${currentPage} of ${totalPages}`;
    }
    return "";
  };

  const textContent = getTextContent();

  // COMPACT VARIANT (thin bar, no text overlay)
  if (variant === "compact") {
    return (
      <div
        className={`bg-[var(--background)] rounded-full h-2 shadow-inner ${className}`}
        role="progressbar"
        aria-valuenow={displayPercentage}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`Progress: ${displayPercentage}%`}
      >
        <div
          className="h-2 rounded-full transition-all duration-300 ease-out"
          style={{
            width: `${displayPercentage}%`,
            backgroundImage: `linear-gradient(to right, ${gradientFrom}, ${gradientTo})`,
          }}
        />
      </div>
    );
  }

  // HERO VARIANT (large bar with text overlay)
  const pulseClass = shouldPulse ? "animate-pulse-subtle" : "";
  const textSizeClass = textDisplay === "percentage" ? "text-2xl font-serif" : "text-sm";

  return (
    <div
      ref={progressBarRef}
      className={`relative w-full h-12 bg-[var(--card-bg-emphasis)] rounded-lg overflow-hidden ${className}`}
      role="progressbar"
      aria-valuenow={displayPercentage}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={textDisplay === "percentage" ? `Reading progress: ${displayPercentage}% complete` : `Page ${currentPage} of ${totalPages}`}
    >
      {/* Progress fill */}
      <div
        className={`h-12 transition-all duration-500 ease-out flex items-center justify-center relative ${pulseClass}`}
        style={{
          width: `${displayPercentage}%`,
          backgroundImage: `linear-gradient(to right, ${gradientFrom}, ${gradientTo})`,
        }}
      />

      {textDisplay !== "none" && (
        <>
          {/* Background text layer (shows on unfilled portion) */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
            <span className={`${textSizeClass} font-bold text-[var(--foreground)]`}>
              {textContent}
            </span>
          </div>

          {/* Overlay text layer (white text on colored progress bar) */}
          {barWidth > 0 && (
            <div
              className="absolute top-0 left-0 h-full overflow-hidden pointer-events-none z-20"
              style={{ width: `${displayPercentage}%` }}
            >
              <div
                className="h-full flex items-center justify-center"
                style={{ width: `${barWidth}px` }}
              >
                <span
                  className={`${textSizeClass} font-bold text-white whitespace-nowrap`}
                  aria-hidden="true"
                >
                  {textContent}
                </span>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
