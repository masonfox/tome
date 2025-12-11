import { BookOpen, Library, Target, Flame, Settings, BarChart3 } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export interface NavLink {
  href: string;
  label: string;
  icon: LucideIcon;
}

// Primary navigation links (shown in bottom navigation on mobile, all in top nav on desktop)
export const NAV_LINKS: NavLink[] = [
  { href: "/", label: "Dashboard", icon: BookOpen },
  { href: "/library", label: "Library", icon: Library },
  { href: "/goals", label: "Goals", icon: Target },
];

// Desktop-only top navigation links (not shown in bottom nav on mobile)
export const DESKTOP_NAV_LINKS: NavLink[] = [
  { href: "/stats", label: "Stats", icon: BarChart3 },
  { href: "/settings", label: "Settings", icon: Settings },
];

// Additional links shown in bottom sheet "More" menu on mobile
export const BOTTOM_SHEET_LINKS: NavLink[] = [
  { href: "/streak", label: "Streak", icon: Flame },
  { href: "/stats", label: "Stats", icon: BarChart3 },
];

// Helper function to check if a route is active
export function isActiveRoute(pathname: string | null, href: string): boolean {
  if (!pathname) return false;
  if (href === "/") {
    return pathname === href;
  }
  return pathname.startsWith(href);
}
