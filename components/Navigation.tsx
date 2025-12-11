"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Sun, Moon, LogOut, ChevronDown } from "lucide-react";
import Image from "next/image";
import { clsx } from "clsx";
import { useEffect, useState, useRef } from "react";
import { NAV_LINKS, MORE_MENU_LINKS, isActiveRoute } from "@/lib/navigation-config";

export function Navigation() {
  const pathname = usePathname();
  const router = useRouter();
  const [darkMode, setDarkMode] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const [authEnabled, setAuthEnabled] = useState(false);
  const moreMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
    // Get current theme from DOM (already set by layout script)
    const currentTheme = document.documentElement.getAttribute("data-theme");
    setDarkMode(currentTheme === "dark");

    // Defer auth check to reduce initial load blocking
    const authCheckTimer = setTimeout(() => {
      fetch("/api/auth/status")
        .then((res) => res.json())
        .then((data) => setAuthEnabled(data.enabled))
        .catch(() => setAuthEnabled(false));
    }, 100);

    return () => clearTimeout(authCheckTimer);
  }, []);

  // Close mobile menu when route changes
  useEffect(() => {
    setMobileMenuOpen(false);
    setMoreMenuOpen(false);
  }, [pathname]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (moreMenuRef.current && !moreMenuRef.current.contains(event.target as Node)) {
        setMoreMenuOpen(false);
      }
    };

    if (moreMenuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [moreMenuOpen]);

  const applyTheme = (isDark: boolean) => {
    const html = document.documentElement;
    const theme = isDark ? "dark" : "light";
    html.setAttribute("data-theme", theme);
    html.setAttribute("data-color-mode", theme);
  };

  const toggleDarkMode = () => {
    const newMode = !darkMode;
    setDarkMode(newMode);
    localStorage.setItem("darkMode", newMode.toString());
    applyTheme(newMode);
  };

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.push("/login");
      router.refresh();
    } catch (error) {
      // Suppress console; optional user feedback could be added
    }
  };

  // Check if any "More" menu item is active
  const isMoreMenuActive = MORE_MENU_LINKS.some(link => isActiveRoute(pathname, link.href));

  return (
    <nav className="bg-[var(--card-bg)] border-b border-[var(--border-color)] sticky top-0 z-50">
      <div className="container mx-auto px-4 max-w-7xl">
        <div className="flex items-center justify-between h-20">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-3 group">
            <div className="w-10 h-10 bg-[var(--border-color)] rounded-md flex items-center justify-center p-1.5">
              <Image 
                src="/logo-small.webp" 
                alt="Tome Logo" 
                width={28} 
                height={28}
                className="rounded-sm"
              />
            </div>
            <span className="text-2xl font-serif font-bold text-[var(--heading-text)] group-hover:text-[var(--accent)] transition-colors">
              Tome
            </span>
          </Link>

          {/* Center Navigation - Primary Links Only */}
          <div className="hidden md:flex items-center gap-8">
            {NAV_LINKS.map((link) => {
              const active = isActiveRoute(pathname, link.href);
              const Icon = link.icon;

              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={clsx(
                    "flex items-center gap-2 text-xs font-medium tracking-wider uppercase transition-colors py-2 border-b-2",
                    active
                      ? "text-[var(--accent)] border-[var(--accent)]"
                      : "text-[var(--foreground)]/70 border-transparent hover:text-[var(--accent)]"
                  )}
                >
                  <Icon className="w-4 h-4" />
                  {link.label.toUpperCase()}
                </Link>
              );
            })}
          </div>

          {/* Right side controls */}
          <div className="flex items-center gap-4">
            {/* Dark Mode Toggle */}
            <button
              onClick={toggleDarkMode}
              className="p-2 text-[var(--foreground)] hover:text-[var(--accent)] transition-colors"
              title={darkMode ? "Light mode" : "Dark mode"}
              aria-label="Toggle dark mode"
            >
              {!mounted ? (
                <Moon className="w-5 h-5" />
              ) : darkMode ? (
                <Sun className="w-5 h-5" />
              ) : (
                <Moon className="w-5 h-5" />
              )}
            </button>

            {/* More Menu Dropdown (Desktop) */}
            <div className="hidden md:block relative" ref={moreMenuRef}>
              <button
                onClick={() => setMoreMenuOpen(!moreMenuOpen)}
                className={clsx(
                  "flex items-center gap-2 px-3 py-2 text-xs font-medium tracking-wider uppercase transition-colors",
                  isMoreMenuActive || moreMenuOpen
                    ? "text-[var(--accent)]"
                    : "text-[var(--foreground)]/70 hover:text-[var(--accent)]"
                )}
                aria-label="More menu"
              >
                <span>MORE</span>
                <ChevronDown className={clsx("w-4 h-4 transition-transform", moreMenuOpen && "rotate-180")} />
              </button>

              {/* Dropdown Menu */}
              {moreMenuOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-[var(--card-bg)] border border-[var(--border-color)] rounded-lg shadow-lg overflow-hidden">
                  {MORE_MENU_LINKS.map((link) => {
                    const active = isActiveRoute(pathname, link.href);
                    const Icon = link.icon;

                    return (
                      <Link
                        key={link.href}
                        href={link.href}
                        className={clsx(
                          "flex items-center gap-3 px-4 py-3 text-sm font-medium transition-colors",
                          active
                            ? "text-[var(--accent)] bg-[var(--accent)]/10"
                            : "text-[var(--foreground)] hover:bg-[var(--border-color)]"
                        )}
                      >
                        <Icon className="w-4 h-4" />
                        {link.label}
                      </Link>
                    );
                  })}
                  
                  {/* Logout in Dropdown */}
                  {authEnabled && mounted && (
                    <>
                      <div className="border-t border-[var(--border-color)]" />
                      <button
                        onClick={handleLogout}
                        className="flex items-center gap-3 px-4 py-3 text-sm font-medium transition-colors text-[var(--foreground)] hover:bg-[var(--border-color)] w-full"
                      >
                        <LogOut className="w-4 h-4" />
                        Logout
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Mobile Menu Toggle */}
            <div className="md:hidden">
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="p-2 text-[var(--foreground)] hover:text-[var(--accent)]"
                aria-label="Toggle mobile menu"
              >
                <svg
                  className="w-6 h-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 6h16M4 12h16M4 18h16"
                  />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden bg-[var(--bg)] border-t border-[var(--border-color)] py-4">
            {/* Primary Nav Links */}
            {NAV_LINKS.map((link) => {
              const active = isActiveRoute(pathname, link.href);
              const Icon = link.icon;

              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={clsx(
                    "flex items-center gap-3 px-4 py-3 text-sm font-medium tracking-wider uppercase transition-colors",
                    active
                      ? "text-[var(--accent)] bg-[var(--accent)]/10"
                      : "text-[var(--foreground)]/70 hover:text-[var(--accent)] hover:bg-[var(--accent)]/5"
                  )}
                >
                  <Icon className="w-4 h-4" />
                  {link.label.toUpperCase()}
                </Link>
              );
            })}
            
            {/* More Menu Links */}
            {MORE_MENU_LINKS.map((link) => {
              const active = isActiveRoute(pathname, link.href);
              const Icon = link.icon;

              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={clsx(
                    "flex items-center gap-3 px-4 py-3 text-sm font-medium tracking-wider uppercase transition-colors",
                    active
                      ? "text-[var(--accent)] bg-[var(--accent)]/10"
                      : "text-[var(--foreground)]/70 hover:text-[var(--accent)] hover:bg-[var(--accent)]/5"
                  )}
                >
                  <Icon className="w-4 h-4" />
                  {link.label.toUpperCase()}
                </Link>
              );
            })}

            {/* Logout */}
            {authEnabled && (
              <button
                onClick={handleLogout}
                className="flex items-center gap-3 px-4 py-3 text-sm font-medium tracking-wider uppercase transition-colors text-[var(--foreground)]/70 hover:text-[var(--accent)] hover:bg-[var(--accent)]/5 w-full"
              >
                <LogOut className="w-4 h-4" />
                LOGOUT
              </button>
            )}
          </div>
        )}
      </div>
    </nav>
  );
}
