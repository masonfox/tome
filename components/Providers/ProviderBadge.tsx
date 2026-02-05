"use client";

import { Database, User, BookOpen, Globe } from "lucide-react";
import { cn } from "@/utils/cn";

export type BookSource = "calibre" | "manual" | "hardcover" | "openlibrary";

interface ProviderBadgeProps {
  source: BookSource;
  className?: string;
  size?: "sm" | "md" | "lg";
}

const sourceConfig: Record<
  BookSource,
  {
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    bgColor: string;
    textColor: string;
    iconColor: string;
  }
> = {
  calibre: {
    label: "Calibre",
    icon: Database,
    bgColor: "bg-blue-100 dark:bg-blue-900/30",
    textColor: "text-blue-800 dark:text-blue-300",
    iconColor: "text-blue-600 dark:text-blue-400",
  },
  manual: {
    label: "Manual",
    icon: User,
    bgColor: "bg-purple-100 dark:bg-purple-900/30",
    textColor: "text-purple-800 dark:text-purple-300",
    iconColor: "text-purple-600 dark:text-purple-400",
  },
  hardcover: {
    label: "Hardcover",
    icon: BookOpen,
    bgColor: "bg-green-100 dark:bg-green-900/30",
    textColor: "text-green-800 dark:text-green-300",
    iconColor: "text-green-600 dark:text-green-400",
  },
  openlibrary: {
    label: "OpenLibrary",
    icon: Globe,
    bgColor: "bg-orange-100 dark:bg-orange-900/30",
    textColor: "text-orange-800 dark:text-orange-300",
    iconColor: "text-orange-600 dark:text-orange-400",
  },
};

const sizeConfig = {
  sm: {
    container: "px-1.5 py-0.5 text-xs gap-1",
    icon: "h-3 w-3",
  },
  md: {
    container: "px-2 py-1 text-sm gap-1.5",
    icon: "h-3.5 w-3.5",
  },
  lg: {
    container: "px-2.5 py-1.5 text-sm gap-2",
    icon: "h-4 w-4",
  },
};

export function ProviderBadge({
  source,
  className,
  size = "sm",
}: ProviderBadgeProps) {
  const config = sourceConfig[source];
  const sizeStyles = sizeConfig[size];
  const Icon = config.icon;

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full font-medium",
        config.bgColor,
        config.textColor,
        sizeStyles.container,
        className
      )}
      title={`Source: ${config.label}`}
    >
      <Icon className={cn(config.iconColor, sizeStyles.icon)} />
      <span>{config.label}</span>
    </span>
  );
}
