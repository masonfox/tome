"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { MoreHorizontal, LogOut, Sun, Moon } from "lucide-react";
import { clsx } from "clsx";
import { useState, useEffect, useMemo } from "react";
import { BottomSheet } from "./BottomSheet";
import { NAV_LINKS, BOTTOM_SHEET_LINKS, isActiveRoute } from "@/lib/navigation-config";

export function BottomNavigation() {
  const pathname = usePathname();
  const router = useRouter();
  const [isMoreOpen, setIsMoreOpen] = useState(false);
  const [authEnabled, setAuthEnabled] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [darkMode, setDarkMode] = useState(false);

  useEffect(() => {
    setMounted(true);
    
    // Get current theme from DOM (already set by layout script)
    const currentTheme = document.documentElement.getAttribute("data-theme");
    setDarkMode(currentTheme === "dark");
    
    // Check auth status
    fetch("/api/auth/status")
      .then((res) => res.json())
      .then((data) => setAuthEnabled(data.enabled))
      .catch(() => setAuthEnabled(false));
  }, []);

  const toggleDarkMode = () => {
    const newMode = !darkMode;
    const theme = newMode ? "dark" : "light";
    setDarkMode(newMode);
    localStorage.setItem("darkMode", newMode.toString());
    document.documentElement.setAttribute("data-theme", theme);
    document.documentElement.setAttribute("data-color-mode", theme);
  };

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
        <div className="grid grid-cols-4 h-24">
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
        <div className="grid grid-cols-4 h-24">
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
        <div className="space-y-2">
          {/* Bottom Sheet Navigation Links */}
          {BOTTOM_SHEET_LINKS.map((link) => {
            const Icon = link.icon;
            const active = isActiveRoute(pathname, link.href);
            
            return (
              <button
                key={link.href}
                onClick={() => handleSheetItemClick(link.href)}
                className={clsx(
                  "flex items-center gap-3 w-full px-4 py-3 rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]",
                  active
                    ? "bg-[var(--accent)]/10 text-[var(--accent)]"
                    : "text-[var(--foreground)] hover:bg-[var(--border-color)]"
                )}
              >
                <Icon className="w-5 h-5" />
                <span className="font-medium">{link.label}</span>
              </button>
            );
          })}

          {/* Dark Mode Toggle */}
          <button
            onClick={toggleDarkMode}
            className="flex items-center gap-3 w-full px-4 py-3 rounded-lg text-[var(--foreground)] hover:bg-[var(--border-color)] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
          >
            {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            <span className="font-medium">{darkMode ? "Light Mode" : "Dark Mode"}</span>
          </button>

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
      </BottomSheet>
    </>
  );
}
