"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { BookOpen, Library, BarChart3, MoreHorizontal, Settings, LogOut } from "lucide-react";
import { clsx } from "clsx";
import { useState, useEffect } from "react";
import { BottomSheet } from "./BottomSheet";

export function BottomNavigation() {
  const pathname = usePathname();
  const router = useRouter();
  const [isMoreOpen, setIsMoreOpen] = useState(false);
  const [authEnabled, setAuthEnabled] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    // Check auth status
    fetch("/api/auth/status")
      .then((res) => res.json())
      .then((data) => setAuthEnabled(data.enabled))
      .catch(() => setAuthEnabled(false));
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

  const navItems = [
    { href: "/", label: "Dashboard", icon: BookOpen },
    { href: "/library", label: "Library", icon: Library },
    { href: "/stats", label: "Stats", icon: BarChart3 },
  ];

  const isActive = (href: string) => {
    if (!pathname) return false;
    if (href === "/") {
      return pathname === href;
    }
    return pathname.startsWith(href);
  };

  const handleMoreClick = () => {
    setIsMoreOpen(true);
  };

  const handleSheetItemClick = (href: string) => {
    setIsMoreOpen(false);
    router.push(href);
  };

  if (!mounted) return null;

  return (
    <>
      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-[var(--card-bg)] border-t border-[var(--border-color)] pb-safe">
        <div className="grid grid-cols-4 h-16">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={clsx(
                  "flex flex-col items-center justify-center gap-1 transition-colors",
                  active
                    ? "text-[var(--accent)]"
                    : "text-[var(--foreground)]/60 hover:text-[var(--foreground)]"
                )}
              >
                <Icon className="w-6 h-6" />
                <span className="text-xs font-medium">{item.label}</span>
              </Link>
            );
          })}

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
          <button
            onClick={() => handleSheetItemClick("/settings")}
            className={clsx(
              "flex items-center gap-3 w-full px-4 py-3 rounded-lg transition-colors",
              pathname === "/settings"
                ? "bg-[var(--accent)]/10 text-[var(--accent)]"
                : "text-[var(--foreground)] hover:bg-[var(--border-color)]"
            )}
          >
            <Settings className="w-5 h-5" />
            <span className="font-medium">Settings</span>
          </button>

          {authEnabled && (
            <button
              onClick={handleLogout}
              className="flex items-center gap-3 w-full px-4 py-3 rounded-lg text-[var(--foreground)] hover:bg-[var(--border-color)] transition-colors"
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
