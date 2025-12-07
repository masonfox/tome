import { BookOpen, Library, BarChart3, Settings } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export interface NavLink {
  href: string;
  label: string;
  icon: LucideIcon;
}

// Primary navigation links (shown in both top and bottom navigation)
export const NAV_LINKS: NavLink[] = [
  { href: "/", label: "Dashboard", icon: BookOpen },
  { href: "/library", label: "Library", icon: Library },
  { href: "/stats", label: "Stats", icon: BarChart3 },
];

// Additional link only shown in top navigation (not in bottom nav tabs)
export const TOP_NAV_EXTRA_LINK: NavLink = {
  href: "/settings",
  label: "Settings",
  icon: Settings,
};

// Helper function to check if a route is active
export function isActiveRoute(pathname: string | null, href: string): boolean {
  if (!pathname) return false;
  if (href === "/") {
    return pathname === href;
  }
  return pathname.startsWith(href);
}
