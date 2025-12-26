import { BookOpen, BookCheck, Bookmark, Clock, LucideIcon } from "lucide-react";

export type BookStatus = "reading" | "read" | "to-read" | "read-next";

export interface StatusConfig {
  labels: {
    short: string;
    long: string;
  };
  icon: LucideIcon;
  lightGradient: string;
  darkGradient: string;
  textColor: string;
  borderColor: string;
}

/**
 * Centralized status configuration for book statuses.
 * Used across StatusBadge, BookHeader, LibraryFilters, and other components.
 * 
 * - labels.short: Used in compact contexts (e.g., library filters, badges)
 * - labels.long: Used in detailed contexts (e.g., book detail page)
 * - icon: Lucide icon component
 * - lightGradient/darkGradient: Tailwind gradient classes
 * - textColor: Text color class
 * - borderColor: Border color class
 */
export const STATUS_CONFIG: Record<BookStatus, StatusConfig> = {
  reading: {
    labels: {
      short: "Reading",
      long: "Reading",
    },
    icon: BookOpen,
    lightGradient: "from-blue-500 to-blue-600",
    darkGradient: "from-blue-500 to-blue-600",
    textColor: "text-white",
    borderColor: "border-transparent",
  },
  read: {
    labels: {
      short: "Read",
      long: "Read",
    },
    icon: BookCheck,
    lightGradient: "from-emerald-500 to-emerald-600",
    darkGradient: "from-emerald-500 to-emerald-600",
    textColor: "text-white",
    borderColor: "border-transparent",
  },
  "to-read": {
    labels: {
      short: "To Read",
      long: "Want to Read",
    },
    icon: Bookmark,
    lightGradient: "from-amber-500 to-orange-500",
    darkGradient: "from-amber-500 to-orange-500",
    textColor: "text-white",
    borderColor: "border-transparent",
  },
  "read-next": {
    labels: {
      short: "Read Next",
      long: "Read Next",
    },
    icon: Clock,
    lightGradient: "from-purple-500 to-purple-600",
    darkGradient: "from-purple-500 to-purple-600",
    textColor: "text-white",
    borderColor: "border-transparent",
  },
};
