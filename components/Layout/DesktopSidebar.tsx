"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LogOut, ChevronLeft, ChevronRight } from "lucide-react";
import Image from "next/image";
import { clsx } from "clsx";
import { NAV_LINKS, JOURNAL_LINK, READ_NEXT_LINK, SERIES_LINK, TAGS_LINK, SHELVES_LINK, MORE_MENU_LINKS, SETTINGS_LINK, isActiveRoute } from "@/lib/navigation-config";
import { useSidebarCollapsed } from "@/hooks/useSidebarCollapsed";
import { useAuth } from "@/lib/contexts/AuthContext";

export function DesktopSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { authEnabled } = useAuth();
  const { collapsed, toggleCollapsed, mounted } = useSidebarCollapsed();

  // Combine all navigation links into one flat list
  // Order: Dashboard, Library, Read Next, Journal, Series, Tags, Shelves, Streak, Goals, Stats
  const allNavLinks = [
    NAV_LINKS[0], // Dashboard
    NAV_LINKS[1], // Library
    READ_NEXT_LINK, // Read Next (after Library)
    JOURNAL_LINK, // Journal (after Read Next)
    SERIES_LINK,  // Series (after Journal)
    TAGS_LINK,    // Tags (after Series)
    SHELVES_LINK, // Shelves (after Tags)
    NAV_LINKS[2], // Streak
    ...MORE_MENU_LINKS,
  ];

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.push("/login");
      router.refresh();
    } catch (error) {
      // Suppress console; optional user feedback could be added
    }
  };

  // Show skeleton while mounting to prevent hydration mismatch
  if (!mounted) {
    return (
      <aside
        id="desktop-sidebar-skeleton"
        className="hidden md:block fixed left-0 top-0 bottom-0 h-full bg-[var(--card-bg)] border-r border-[var(--border-color)] z-40"
      >
        <div className="animate-pulse h-full flex flex-col">
          <div className="h-20 border-b border-[var(--border-color)] flex items-center px-3">
            <div className="w-10 h-10 bg-[var(--border-color)] rounded-md" />
          </div>
          <div className="flex-1 p-2 space-y-2">
            {[...Array(7)].map((_, i) => (
              <div key={i} className="h-12 bg-[var(--border-color)] rounded-md" />
            ))}
          </div>
        </div>
      </aside>
    );
  }

  return (
    <aside
      id="desktop-sidebar"
      role="navigation"
      aria-label="Main navigation"
      className={clsx(
        "hidden md:block fixed left-0 top-0 bottom-0 h-full bg-[var(--card-bg)] border-r border-[var(--border-color)] z-40",
        collapsed ? "w-16" : "w-52"
      )}
    >
      <div className="h-full flex flex-col">
        {/* Logo Section */}
        <div className="h-20 border-b border-[var(--border-color)] flex items-center px-3">
          <Link href="/" className="flex items-center gap-3 group overflow-hidden">
            <div className="w-10 h-10 bg-[var(--border-color)] rounded-md flex items-center justify-center p-1.5 flex-shrink-0">
              <Image
                src="/logo-small.webp"
                alt="Tome Logo"
                width={28}
                height={28}
                className="rounded-sm"
              />
            </div>
            <span
              className={clsx(
                "text-2xl font-serif font-bold text-[var(--heading-text)] group-hover:text-[var(--accent)] transition-all whitespace-nowrap",
                collapsed ? "opacity-0 w-0" : "opacity-100"
              )}
            >
              Tome
            </span>
          </Link>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 overflow-y-auto py-4">
          <div className="space-y-1 px-2">
            {allNavLinks.map((link) => {
              const active = isActiveRoute(pathname, link.href);
              const Icon = link.icon;

              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={clsx(
                    "flex items-center gap-3 px-3 py-3 rounded-md text-sm font-medium transition-all",
                    active
                      ? "text-[var(--accent)] bg-[var(--accent)]/10"
                      : "text-[var(--foreground)]/70 hover:text-[var(--accent)] hover:bg-[var(--border-color)]"
                  )}
                  title={collapsed ? link.label : undefined}
                  aria-label={link.label}
                >
                  <Icon className="w-5 h-5 flex-shrink-0" />
                  <span
                    className={clsx(
                      "transition-all whitespace-nowrap overflow-hidden",
                      collapsed ? "opacity-0 w-0" : "opacity-100"
                    )}
                  >
                    {link.label}
                  </span>
                </Link>
              );
            })}
          </div>
        </nav>

        {/* Bottom Utilities */}
        <div className="border-t border-[var(--border-color)] p-2 space-y-1">
          {/* Collapse Toggle */}
          <button
            onClick={toggleCollapsed}
            className="flex items-center gap-3 px-3 py-3 rounded-md text-sm font-medium transition-all text-[var(--foreground)]/70 hover:text-[var(--accent)] hover:bg-[var(--border-color)] w-full"
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? (
              <ChevronRight className="w-5 h-5 flex-shrink-0" />
            ) : (
              <ChevronLeft className="w-5 h-5 flex-shrink-0" />
            )}
            <span
              className={clsx(
                "transition-all whitespace-nowrap overflow-hidden",
                collapsed ? "opacity-0 w-0" : "opacity-100"
              )}
            >
              Collapse
            </span>
          </button>

          {/* Settings */}
          <Link
            href={SETTINGS_LINK.href}
            className={clsx(
              "flex items-center gap-3 px-3 py-3 rounded-md text-sm font-medium transition-all",
              isActiveRoute(pathname, SETTINGS_LINK.href)
                ? "text-[var(--accent)] bg-[var(--accent)]/10"
                : "text-[var(--foreground)]/70 hover:text-[var(--accent)] hover:bg-[var(--border-color)]"
            )}
            title={collapsed ? SETTINGS_LINK.label : undefined}
            aria-label={SETTINGS_LINK.label}
          >
            <SETTINGS_LINK.icon className="w-5 h-5 flex-shrink-0" />
            <span
              className={clsx(
                "transition-all whitespace-nowrap overflow-hidden",
                collapsed ? "opacity-0 w-0" : "opacity-100"
              )}
            >
              {SETTINGS_LINK.label}
            </span>
          </Link>

          {/* Logout */}
          {authEnabled && (
            <button
              onClick={handleLogout}
              className="flex items-center gap-3 px-3 py-3 rounded-md text-sm font-medium transition-all text-[var(--foreground)]/70 hover:text-[var(--accent)] hover:bg-[var(--border-color)] w-full"
              title={collapsed ? "Logout" : undefined}
              aria-label="Logout"
            >
              <LogOut className="w-5 h-5 flex-shrink-0" />
              <span
                className={clsx(
                  "transition-all whitespace-nowrap overflow-hidden",
                  collapsed ? "opacity-0 w-0" : "opacity-100"
                )}
              >
                Logout
              </span>
            </button>
          )}
        </div>
      </div>
    </aside>
  );
}
