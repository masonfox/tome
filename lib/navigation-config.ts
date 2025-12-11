import { BookOpen, Library, Target, Flame, Settings, BarChart3 } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export interface NavLink {
  href: string;
  label: string;
  icon: LucideIcon;
}

// Primary navigation links (shown in both mobile bottom nav and desktop top nav)
export const NAV_LINKS: NavLink[] = [
  { href: "/", label: "Dashboard", icon: BookOpen },
  { href: "/library", label: "Library", icon: Library },
  { href: "/streak", label: "Streak", icon: Flame },
];

// Desktop dropdown "More" menu links (shown in dropdown on desktop, bottom sheet on mobile)
export const MORE_MENU_LINKS: NavLink[] = [
  { href: "/goals", label: "Goals", icon: Target },
  { href: "/stats", label: "Stats", icon: BarChart3 },
  { href: "/settings", label: "Settings", icon: Settings },
];

// Additional links shown in bottom sheet "More" menu on mobile (kept for backwards compatibility)
export const BOTTOM_SHEET_LINKS: NavLink[] = MORE_MENU_LINKS;

// Helper function to check if a route is active
export function isActiveRoute(pathname: string | null, href: string): boolean {
  if (!pathname) return false;
  if (href === "/") {
    return pathname === href;
  }
  return pathname.startsWith(href);
}
