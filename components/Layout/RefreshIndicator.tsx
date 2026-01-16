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
  
  // Container height grows from py-2 to py-6 based on pull progress
  const minPadding = 8; // py-2 = 0.5rem = 8px
  const maxPadding = 24; // py-6 = 1.5rem = 24px
  const paddingY = isRefreshing ? 16 : minPadding + (pullProgress * (maxPadding - minPadding));

  return (
    <div
      className="flex items-center justify-center bg-[var(--card-bg-emphasis)] overflow-hidden transition-all duration-500 ease-out"
      style={{ 
        paddingTop: isActive ? `${paddingY}px` : '0px',
        paddingBottom: isActive ? `${paddingY}px` : '0px',
        maxHeight: isActive ? '100px' : '0px',
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
          opacity: isActive ? 1 : 0,
        }}
      />
    </div>
  );
}
