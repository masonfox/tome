"use client";

import { Loader2 } from "lucide-react";

interface RefreshIndicatorProps {
  /** Distance pulled down in pixels */
  distance?: number;
  /** Whether refresh is currently in progress */
  isRefreshing?: boolean;
  /** Whether user is currently pulling */
  isPulling?: boolean;
  /** Pull threshold to trigger refresh (default: 80px) */
  threshold?: number;
}

/**
 * Visual indicator for pull-to-refresh functionality
 * Shows a spinner that rotates and grows based on pull distance
 */
export function RefreshIndicator({
  distance = 0,
  isRefreshing = false,
  isPulling = false,
  threshold = 80,
}: RefreshIndicatorProps) {
  const isActive = isPulling || isRefreshing || distance > 0;
  
  // Calculate rotation based on pull distance (0-360 degrees)
  const rotation = Math.min((distance / threshold) * 360, 360);
  
  // Calculate opacity based on pull progress (0-1)
  const pullProgress = Math.min(distance / threshold, 1);
  const opacity = isRefreshing ? 1 : pullProgress;
  
  // Calculate scale: grows from 0.6 (small) to 1.2 (larger) as you pull
  // When refreshing or closing, stays at 1.0 (normal size)
  const scale = (isRefreshing || !isPulling) ? 1.0 : 0.6 + (pullProgress * 0.6); // 0.6 -> 1.2
  
  // Container height grows from 0 to full height based on pull progress
  const maxHeight = 56; // Enough for icon (28px) + padding
  const containerHeight = isRefreshing ? maxHeight : pullProgress * maxHeight; // 0 -> 56px

  return (
    <div
      className="flex items-center justify-center bg-[var(--card-bg-emphasis)] overflow-hidden"
      style={{ 
        height: isActive ? `${containerHeight}px` : '0px',
        // Only transition when closing (not active), instant when pulling/opening
        transition: isActive ? 'none' : 'height 500ms ease-out',
        // Inset shadow for subtle depth
        boxShadow: 'inset 0 -20px 24px -12px rgba(0, 0, 0, 0.10)',
      }}
    >
      <Loader2
        className={`w-7 h-7 text-[var(--accent)] ${
          isRefreshing ? "animate-spin" : ""
        }`}
        style={{
          transform: isRefreshing 
            ? undefined 
            : `rotate(${rotation}deg) scale(${scale})`,
          transition: isRefreshing ? undefined : "none",
          transformOrigin: 'center',
          opacity: 1, // Always visible when rendered
        }}
      />
    </div>
  );
}
