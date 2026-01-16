"use client";

import { ReactNode, useEffect, useState } from "react";
import PullToRefresh from "react-simple-pull-to-refresh";
import { RefreshIndicator } from "./RefreshIndicator";
import { usePullToRefreshLogic } from "@/hooks/usePullToRefreshLogic";

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

  // On desktop, just render children without PTR
  if (!isMobile) {
    return <>{children}</>;
  }

  // On mobile, wrap with pull-to-refresh
  return (
    <PullToRefresh
      onRefresh={handleRefresh}
      pullingContent={<RefreshIndicator distance={50} />}
      refreshingContent={<RefreshIndicator isRefreshing />}
      pullDownThreshold={80}
      maxPullDownDistance={120}
      resistance={2}
    >
      {children}
    </PullToRefresh>
  );
}
