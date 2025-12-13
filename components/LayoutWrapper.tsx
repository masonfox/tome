"use client";

import { BottomNavigation } from "@/components/BottomNavigation";
import { DesktopSidebar } from "@/components/DesktopSidebar";
import { usePathname } from "next/navigation";

export function LayoutWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isLoginPage = pathname === "/login";

  if (isLoginPage) {
    return <>{children}</>;
  }

  return (
    <>
      {/* Desktop Sidebar - visible on md+ screens */}
      <DesktopSidebar />

      {/* Main Content */}
      <main
        id="main-content"
        className="container mx-auto px-4 pt-8 pb-32 md:py-12"
      >
        {children}
      </main>

      {/* Bottom Navigation - visible on mobile only (<md) */}
      <div className="md:hidden">
        <BottomNavigation />
      </div>
    </>
  );
}
