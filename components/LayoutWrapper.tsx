"use client";

import { Navigation } from "@/components/Navigation";
import { usePathname } from "next/navigation";

export function LayoutWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isLoginPage = pathname === "/login";

  if (isLoginPage) {
    return <>{children}</>;
  }

  return (
    <>
      <Navigation />
      <main className="container mx-auto px-4 py-12 max-w-7xl">
        {children}
      </main>
    </>
  );
}
