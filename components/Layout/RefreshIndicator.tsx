"use client";

import { Loader2 } from "lucide-react";

interface RefreshIndicatorProps {
  /** Distance pulled down in pixels */
  distance?: number;
  /** Whether refresh is currently in progress */
  isRefreshing?: boolean;
  /** Pull threshold to trigger refresh (default: 80px) */
  threshold?: number;
}

/**
 * Visual indicator for pull-to-refresh functionality
 * Shows a spinner that rotates based on pull distance
 */
export function RefreshIndicator({
  distance = 0,
  isRefreshing = false,
  threshold = 80,
}: RefreshIndicatorProps) {
  // Calculate rotation based on pull distance (0-360 degrees)
  const rotation = Math.min((distance / threshold) * 360, 360);
  
  // Calculate opacity based on pull progress (0-1)
  const opacity = Math.min(distance / threshold, 1);

  if (!isRefreshing && distance === 0) {
    return null;
  }

  return (
    <div
      className="flex items-center justify-center py-4"
      style={{ opacity: isRefreshing ? 1 : opacity }}
    >
      <Loader2
        className={`w-6 h-6 text-[var(--accent)] ${
          isRefreshing ? "animate-spin" : ""
        }`}
        style={{
          transform: isRefreshing ? undefined : `rotate(${rotation}deg)`,
          transition: isRefreshing ? undefined : "none",
        }}
      />
    </div>
  );
}
