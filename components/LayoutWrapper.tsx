"use client";

import { BottomNavigation } from "@/components/BottomNavigation";
import { DesktopSidebar } from "@/components/DesktopSidebar";
import { AuthProvider } from "@/lib/contexts/AuthContext";
import { usePathname } from "next/navigation";

export function LayoutWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isLoginPage = pathname === "/login";

  if (isLoginPage) {
    return <>{children}</>;
  }

  return (
    <AuthProvider>
      {/* Desktop Sidebar - visible on md+ screens */}
      <DesktopSidebar />

      {/* Main Content */}
      <main
        id="main-content"
        className="px-6 py-8 pb-32 md:px-0 md:py-12"
      >
        {children}
      </main>

      {/* Bottom Navigation - visible on mobile only (<md) */}
      <div className="md:hidden">
        <BottomNavigation />
      </div>
    </AuthProvider>
  );
}
