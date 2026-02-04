"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { MoreHorizontal, LogOut } from "lucide-react";
import { clsx } from "clsx";
import { useState, useMemo, useEffect } from "react";
import { BottomSheet } from "./BottomSheet";
import { NAV_LINKS, BOTTOM_SHEET_LINKS, isActiveRoute } from "@/lib/navigation-config";
import { useAuth } from "@/lib/contexts/AuthContext";

export function BottomNavigation() {
  const pathname = usePathname();
  const router = useRouter();
  const [isMoreOpen, setIsMoreOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const { authEnabled } = useAuth();

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      setIsMoreOpen(false);
      router.push("/login");
      router.refresh();
    } catch (error) {
      // Suppress console; optional user feedback could be added
    }
  };

  const handleMoreClick = () => {
    setIsMoreOpen(true);
  };

  const handleSheetItemClick = (href: string) => {
    setIsMoreOpen(false);
    router.push(href);
  };

  // Memoize skeleton navigation items (only computed once since NAV_LINKS is static)
  const skeletonNavItems = useMemo(
    () =>
      NAV_LINKS.map((link) => {
        const Icon = link.icon;
        return (
          <div
            key={link.href}
            className="flex flex-col items-center justify-center gap-1 text-[var(--foreground)]/60"
          >
            <Icon className="w-6 h-6" />
            <span className="text-xs font-medium">{link.label}</span>
          </div>
        );
      }),
    [] // Empty dependency array since NAV_LINKS is static
  );

  // Memoize active navigation items (recomputed only when pathname changes)
  const activeNavItems = useMemo(
    () =>
      NAV_LINKS.map((link) => {
        const Icon = link.icon;
        const active = isActiveRoute(pathname, link.href);

        return (
          <Link
            key={link.href}
            href={link.href}
            className={clsx(
              "flex flex-col items-center justify-center gap-1 transition-colors",
              active
                ? "text-[var(--accent)]"
                : "text-[var(--foreground)]/60 hover:text-[var(--foreground)]"
            )}
          >
            <Icon className="w-6 h-6" />
            <span className="text-xs font-medium">{link.label}</span>
          </Link>
        );
      }),
    [pathname] // Only recompute when pathname changes
  );

  // Render skeleton immediately to prevent flash
  if (!mounted) {
    return (
      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-[var(--card-bg)] border-t border-[var(--border-color)] pb-safe">
        <div className="grid grid-cols-4 h-20">
          {skeletonNavItems}
          <div className="flex flex-col items-center justify-center gap-1 text-[var(--foreground)]/60">
            <MoreHorizontal className="w-6 h-6" />
            <span className="text-xs font-medium">More</span>
          </div>
        </div>
      </nav>
    );
  }

  return (
    <>
      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-[var(--card-bg)] border-t border-[var(--border-color)] pb-safe">
        <div className="grid grid-cols-4 h-20">
          {activeNavItems}

          {/* More Button */}
          <button
            onClick={handleMoreClick}
            className={clsx(
              "flex flex-col items-center justify-center gap-1 transition-colors",
              isMoreOpen
                ? "text-[var(--accent)]"
                : "text-[var(--foreground)]/60 hover:text-[var(--foreground)]"
            )}
          >
            <MoreHorizontal className="w-6 h-6" />
            <span className="text-xs font-medium">More</span>
          </button>
        </div>
      </nav>

      {/* Bottom Sheet for More Menu */}
      <BottomSheet isOpen={isMoreOpen} onClose={() => setIsMoreOpen(false)}>
        <div className="space-y-6">
          {/* Navigation Grid with Circle Icons */}
          <div className="grid grid-cols-3 gap-4">
            {BOTTOM_SHEET_LINKS.map((link) => {
              const Icon = link.icon;
              const active = isActiveRoute(pathname, link.href);
              
              return (
                <button
                  key={link.href}
                  onClick={() => handleSheetItemClick(link.href)}
                  className="flex flex-col items-center gap-2 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] rounded-lg p-2"
                >
                  <div
                    className={clsx(
                      "w-16 h-16 rounded-full flex items-center justify-center transition-colors",
                      active
                        ? "bg-[var(--accent)] text-white"
                        : "bg-[var(--border-color)] text-[var(--foreground)] hover:bg-[var(--accent)]/20"
                    )}
                  >
                    <Icon className="w-7 h-7" />
                  </div>
                  <span
                    className={clsx(
                      "text-sm font-medium text-center",
                      active ? "text-[var(--accent)]" : "text-[var(--foreground)]"
                    )}
                  >
                    {link.label}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Separator */}
          <div className="border-t border-[var(--border-color)]" />

          {/* Action Items */}
          <div className="space-y-2">
            {/* Logout */}
            {authEnabled && (
              <button
                onClick={handleLogout}
                className="flex items-center gap-3 w-full px-4 py-3 rounded-lg text-[var(--foreground)] hover:bg-[var(--border-color)] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
              >
                <LogOut className="w-5 h-5" />
                <span className="font-medium">Logout</span>
              </button>
            )}
          </div>
        </div>
      </BottomSheet>
    </>
  );
}
