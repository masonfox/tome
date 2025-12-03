"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { BookOpen, Library, BarChart3, Settings, Upload, Sun, Moon, LogOut } from "lucide-react";
import Image from "next/image";
import { clsx } from "clsx";
import { useEffect, useState } from "react";

export function Navigation() {
  const pathname = usePathname();
  const router = useRouter();
  const [darkMode, setDarkMode] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [authEnabled, setAuthEnabled] = useState(false);

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
  }, [pathname]);

  const applyTheme = (isDark: boolean) => {
    const html = document.documentElement;
    html.setAttribute("data-theme", isDark ? "dark" : "light");
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

  const links = [
    { href: "/", label: "DASHBOARD", icon: BookOpen },
    { href: "/library", label: "LIBRARY", icon: Library },
    { href: "/import", label: "IMPORT", icon: Upload },
    { href: "/stats", label: "STATS", icon: BarChart3 },
    { href: "/settings", label: "SETTINGS", icon: Settings },
  ];

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

          {/* Center Navigation */}
          <div className="hidden md:flex items-center gap-8">
            {links.map((link) => {
              const isActive = pathname === link.href;
              const Icon = link.icon;

              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={clsx(
                    "flex items-center gap-2 text-xs font-medium tracking-wider uppercase transition-colors py-2 border-b-2",
                    isActive
                      ? "text-[var(--accent)] border-[var(--accent)]"
                      : "text-[var(--foreground)]/70 border-transparent hover:text-[var(--accent)]"
                  )}
                >
                  <Icon className="w-4 h-4" />
                  {link.label}
                </Link>
              );
            })}
          </div>

          {/* Right side controls */}
          <div className="flex items-center gap-4">
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
            {authEnabled && mounted && (
              <button
                onClick={handleLogout}
                className="hidden md:flex items-center gap-2 px-3 py-2 text-xs font-medium text-[var(--foreground)]/70 hover:text-[var(--accent)] transition-colors"
                title="Logout"
                aria-label="Logout"
              >
                <LogOut className="w-4 h-4" />
                <span className="uppercase tracking-wider">Logout</span>
              </button>
            )}
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
            {links.map((link) => {
              const isActive = pathname === link.href;
              const Icon = link.icon;

              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={clsx(
                    "flex items-center gap-3 px-4 py-3 text-sm font-medium tracking-wider uppercase transition-colors",
                    isActive
                      ? "text-[var(--accent)] bg-[var(--accent)]/10"
                      : "text-[var(--foreground)]/70 hover:text-[var(--accent)] hover:bg-[var(--accent)]/5"
                  )}
                >
                  <Icon className="w-4 h-4" />
                  {link.label}
                </Link>
              );
            })}
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
