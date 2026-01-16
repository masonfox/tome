"use client";

import { useEffect, useRef, useState } from "react";

interface UsePullToRefreshOptions {
  onRefresh: () => Promise<void>;
  threshold?: number;
  maxDistance?: number;
  resistance?: number;
  enabled?: boolean;
}

/**
 * Custom pull-to-refresh hook with full control over pull distance
 */
export function usePullToRefresh({
  onRefresh,
  threshold = 80,
  maxDistance = 120,
  resistance = 2,
  enabled = true,
}: UsePullToRefreshOptions) {
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isPulling, setIsPulling] = useState(false);
  
  const startY = useRef(0);
  const currentY = useRef(0);

  useEffect(() => {
    if (!enabled) return;

    const handleTouchStart = (e: TouchEvent) => {
      // Only start if at the top of the page
      if (window.scrollY === 0 && !isRefreshing) {
        startY.current = e.touches[0].clientY;
        setIsPulling(true);
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!isPulling || isRefreshing) return;

      currentY.current = e.touches[0].clientY;
      const diff = currentY.current - startY.current;

      if (diff > 0) {
        // Prevent default scroll behavior
        e.preventDefault();
        
        // Apply resistance
        const distance = Math.min(diff / resistance, maxDistance);
        setPullDistance(distance);
      }
    };

    const handleTouchEnd = async () => {
      if (!isPulling) return;

      setIsPulling(false);

      if (pullDistance >= threshold) {
        setIsRefreshing(true);
        // Keep the pullDistance during refresh so indicator stays visible
        try {
          await onRefresh();
        } finally {
          setIsRefreshing(false);
          // Wait for the next frame before starting the close animation
          // This ensures React renders the final refresh state before animating closed
          requestAnimationFrame(() => {
            setTimeout(() => setPullDistance(0), 16); // One more frame delay
          });
        }
      } else {
        setPullDistance(0);
      }
    };

    // Use passive: false to allow preventDefault
    document.addEventListener("touchstart", handleTouchStart, { passive: true });
    document.addEventListener("touchmove", handleTouchMove, { passive: false });
    document.addEventListener("touchend", handleTouchEnd);
    document.addEventListener("touchcancel", handleTouchEnd);

    return () => {
      document.removeEventListener("touchstart", handleTouchStart);
      document.removeEventListener("touchmove", handleTouchMove);
      document.removeEventListener("touchend", handleTouchEnd);
      document.removeEventListener("touchcancel", handleTouchEnd);
    };
  }, [enabled, isPulling, isRefreshing, pullDistance, threshold, maxDistance, resistance, onRefresh]);

  return {
    pullDistance,
    isRefreshing,
    isPulling,
  };
}
