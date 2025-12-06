"use client";

import { Navigation } from "@/components/Navigation";
import { BottomNavigation } from "@/components/BottomNavigation";
import { usePathname } from "next/navigation";
import { useBottomNavigation } from "@/hooks/useBottomNavigation";

export function LayoutWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isLoginPage = pathname === "/login";
  const { enabled: bottomNavEnabled, mounted } = useBottomNavigation();

  if (isLoginPage) {
    return <>{children}</>;
  }

  return (
    <>
      {!bottomNavEnabled && <Navigation />}
      <main 
        className={`container mx-auto px-4 max-w-7xl ${
          bottomNavEnabled ? "pb-20 pt-8" : "py-12"
        }`}
      >
        {children}
      </main>
      {mounted && bottomNavEnabled && <BottomNavigation />}
    </>
  );
}
