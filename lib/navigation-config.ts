import { BookOpen, Library, Target, Flame, Settings, BarChart3, BookMarked } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export interface NavLink {
  href: string;
  label: string;
  icon: LucideIcon;
}

// Primary navigation links (shown in mobile bottom nav - 3 items only)
export const NAV_LINKS: NavLink[] = [
  { href: "/", label: "Dashboard", icon: BookOpen },
  { href: "/library", label: "Library", icon: Library },
  { href: "/streak", label: "Streak", icon: Flame },
];

// Series link (shown in desktop sidebar and bottom sheet menu)
export const SERIES_LINK: NavLink = { href: "/series", label: "Series", icon: BookMarked };

// Desktop dropdown "More" menu links (shown in dropdown on desktop, bottom sheet on mobile)
export const MORE_MENU_LINKS: NavLink[] = [
  { href: "/goals", label: "Goals", icon: Target },
  { href: "/stats", label: "Stats", icon: BarChart3 },
];

// Bottom utility link (shown in bottom section of desktop sidebar)
export const SETTINGS_LINK: NavLink = { href: "/settings", label: "Settings", icon: Settings };

// Additional links shown in bottom sheet "More" menu on mobile (includes series and settings)
export const BOTTOM_SHEET_LINKS: NavLink[] = [
  SERIES_LINK,
  ...MORE_MENU_LINKS,
  SETTINGS_LINK,
];

// Helper function to check if a route is active
export function isActiveRoute(pathname: string | null, href: string): boolean {
  if (!pathname) return false;
  if (href === "/") {
    return pathname === href;
  }
  return pathname.startsWith(href);
}
