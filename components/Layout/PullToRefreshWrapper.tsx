"use client";

import { ReactNode, useEffect, useState } from "react";
import { RefreshIndicator } from "./RefreshIndicator";
import { usePullToRefreshLogic } from "@/hooks/usePullToRefreshLogic";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";

interface PullToRefreshWrapperProps {
  children: ReactNode;
}

/**
 * Wrapper component that adds pull-to-refresh functionality
 * Only active on mobile devices (width < 768px)
 */
export function PullToRefreshWrapper({ children }: PullToRefreshWrapperProps) {
  const handleRefresh = usePullToRefreshLogic();
  const [isMobile, setIsMobile] = useState(false);

  // Detect if we're on mobile
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.matchMedia("(max-width: 768px)").matches);
    };

    // Check initially
    checkMobile();

    // Listen for resize events
    const mediaQuery = window.matchMedia("(max-width: 768px)");
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    
    mediaQuery.addEventListener("change", handler);
    return () => mediaQuery.removeEventListener("change", handler);
  }, []);

  // Use our custom pull-to-refresh hook
  const { pullDistance, isRefreshing, isPulling } = usePullToRefresh({
    onRefresh: handleRefresh,
    threshold: 80,
    maxDistance: 120,
    resistance: 2,
    enabled: isMobile,
  });

  // On desktop, just render children without PTR
  if (!isMobile) {
    return <>{children}</>;
  }

  // On mobile, always render the refresh indicator and let it manage its own visibility
  return (
    <>
      <RefreshIndicator 
        distance={pullDistance} 
        isRefreshing={isRefreshing}
        isPulling={isPulling}
        threshold={80}
      />
      {children}
    </>
  );
}
