"use client";

import { Navigation } from "@/components/Navigation";
import { BottomNavigation } from "@/components/BottomNavigation";
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
      {/* Always render both navs - CSS handles visibility based on data-bottom-nav attribute */}
      <div id="top-navigation">
        <Navigation />
      </div>
      <main 
        id="main-content"
        className="container mx-auto px-4 max-w-7xl"
      >
        {children}
      </main>
      <div id="bottom-navigation">
        <BottomNavigation />
      </div>
    </>
  );
}
