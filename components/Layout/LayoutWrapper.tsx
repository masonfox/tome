"use client";

import { BottomNavigation } from "@/components/Layout/BottomNavigation";
import { DemoBanner } from "@/components/Layout/DemoBanner";
import { DesktopSidebar } from "@/components/Layout/DesktopSidebar";
import { PullToRefreshWrapper } from "@/components/Layout/PullToRefreshWrapper";
import { AuthProvider } from "@/lib/contexts/AuthContext";
import { DemoProvider } from "@/lib/contexts/DemoContext";
import { usePathname } from "next/navigation";

export function LayoutWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isLoginPage = pathname === "/login";

  if (isLoginPage) {
    return <>{children}</>;
  }

  return (
    <DemoProvider>
      <AuthProvider>
        {/* Demo Mode Banner - visible when NODE_ENV=demo */}
        <DemoBanner />

        {/* Desktop Sidebar - visible on md+ screens */}
        <DesktopSidebar />

        {/* Main Content with Pull-to-Refresh */}
        <PullToRefreshWrapper>
          <main
            id="main-content"
            className="px-6 py-8 pb-32 md:px-0 md:py-12"
          >
            {children}
          </main>
        </PullToRefreshWrapper>

        {/* Bottom Navigation - visible on mobile only (<md) */}
        <div className="md:hidden">
          <BottomNavigation />
        </div>
      </AuthProvider>
    </DemoProvider>
  );
}
