"use client";

import { Navigation } from "@/components/Navigation";
import { BottomNavigation } from "@/components/BottomNavigation";
import { DesktopSidebar } from "@/components/DesktopSidebar";
import { usePathname } from "next/navigation";
import { useBottomNavigation } from "@/hooks/useBottomNavigation";

export function LayoutWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isLoginPage = pathname === "/login";
  const { enabled: bottomNavEnabled } = useBottomNavigation();

  if (isLoginPage) {
    return <>{children}</>;
  }

  return (
    <>
      {/* Desktop Sidebar - CSS handles visibility based on screen size */}
      <DesktopSidebar />

      {/* Top Navigation - CSS handles visibility based on screen size and data-bottom-nav attribute */}
      <div id="top-navigation">
        <Navigation />
      </div>

      {/* Main Content - CSS handles margin based on sidebar state */}
      <main
        id="main-content"
        className="container mx-auto px-4 max-w-7xl"
      >
        {children}
      </main>

      {/* Bottom Navigation - CSS handles visibility based on data-bottom-nav attribute */}
      <div id="bottom-navigation">
        <BottomNavigation />
      </div>
    </>
  );
}
