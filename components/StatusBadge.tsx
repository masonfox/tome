"use client";

import { BookOpen, BookCheck, Bookmark, Clock, LucideIcon } from "lucide-react";
import { cn } from "@/utils/cn";

type BookStatus = "reading" | "read" | "to-read" | "read-next";
type BadgeSize = "sm" | "md" | "lg";

interface StatusConfig {
  label: string;
  icon: LucideIcon;
  lightGradient: string;
  darkGradient: string;
  textColor: string;
  borderColor: string;
}

const STATUS_CONFIG: Record<BookStatus, StatusConfig> = {
  reading: {
    label: "Reading",
    icon: BookOpen,
    lightGradient: "from-blue-500 to-blue-600",
    darkGradient: "from-blue-500 to-blue-600",
    textColor: "text-white",
    borderColor: "border-transparent",
  },
  read: {
    label: "Read",
    icon: BookCheck,
    lightGradient: "from-emerald-500 to-emerald-600",
    darkGradient: "from-emerald-500 to-emerald-600",
    textColor: "text-white",
    borderColor: "border-transparent",
  },
  "to-read": {
    label: "Want to Read",
    icon: Bookmark,
    lightGradient: "from-amber-500 to-orange-500",
    darkGradient: "from-amber-500 to-orange-500",
    textColor: "text-white",
    borderColor: "border-transparent",
  },
  "read-next": {
    label: "Read Next",
    icon: Clock,
    lightGradient: "from-purple-500 to-purple-600",
    darkGradient: "from-purple-500 to-purple-600",
    textColor: "text-white",
    borderColor: "border-transparent",
  },
};

const SIZE_CONFIG = {
  sm: {
    container: "px-2.5 py-1.5 text-xs",
    icon: "w-3 h-3",
    gap: "gap-1.5",
  },
  md: {
    container: "px-3.5 py-2 text-sm",
    icon: "w-4 h-4",
    gap: "gap-2",
  },
  lg: {
    container: "px-4 py-2.5 text-base",
    icon: "w-5 h-5",
    gap: "gap-2.5",
  },
};

interface StatusBadgeProps {
  status: BookStatus;
  size?: BadgeSize;
  showIcon?: boolean;
  className?: string;
}

export function StatusBadge({
  status,
  size = "sm",
  showIcon = true,
  className,
}: StatusBadgeProps) {
  const config = STATUS_CONFIG[status];
  const sizeConfig = SIZE_CONFIG[size];
  const Icon = config.icon;

  return (
    <div
      className={cn(
        "inline-flex items-center rounded-md font-semibold shadow-sm hover:shadow-md transition-all",
        "bg-gradient-to-r",
        config.lightGradient,
        config.textColor,
        sizeConfig.container,
        sizeConfig.gap,
        className
      )}
    >
      {showIcon && <Icon className={sizeConfig.icon} />}
      <span>{config.label}</span>
    </div>
  );
}

// Export the status config for use in other components
export { STATUS_CONFIG, type BookStatus };
