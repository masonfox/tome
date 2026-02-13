"use client";

import { Database, User, BookOpen, Globe, CheckCircle, XCircle, Clock } from "lucide-react";
import { cn } from "@/utils/cn";
import type { BookSource, ProviderId } from "@/lib/providers/base/IMetadataProvider";

interface ProviderBadgeProps {
  source: BookSource | ProviderId;
  status?: "success" | "error" | "timeout";
  showStatus?: boolean;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const providerConfig = {
  calibre: {
    label: "Calibre",
    icon: Database,
    bgColor: "bg-blue-100 dark:bg-blue-900/30",
    textColor: "text-blue-700 dark:text-blue-300",
    borderColor: "border-blue-300 dark:border-blue-700",
  },
  manual: {
    label: "Manual",
    icon: User,
    bgColor: "bg-gray-100 dark:bg-gray-800/50",
    textColor: "text-gray-700 dark:text-gray-300",
    borderColor: "border-gray-300 dark:border-gray-600",
  },
  hardcover: {
    label: "Hardcover",
    icon: BookOpen,
    bgColor: "bg-purple-100 dark:bg-purple-900/30",
    textColor: "text-purple-700 dark:text-purple-300",
    borderColor: "border-purple-300 dark:border-purple-700",
  },
  openlibrary: {
    label: "Open Library",
    icon: Globe,
    bgColor: "bg-green-100 dark:bg-green-900/30",
    textColor: "text-green-700 dark:text-green-300",
    borderColor: "border-green-300 dark:border-green-700",
  },
} as const;

const statusConfig = {
  success: {
    icon: CheckCircle,
    color: "text-green-600 dark:text-green-400",
  },
  error: {
    icon: XCircle,
    color: "text-red-600 dark:text-red-400",
  },
  timeout: {
    icon: Clock,
    color: "text-orange-600 dark:text-orange-400",
  },
} as const;

const sizeConfig = {
  sm: {
    badge: "px-2 py-0.5 text-xs",
    icon: "w-3 h-3",
    statusIcon: "w-3 h-3",
  },
  md: {
    badge: "px-2.5 py-1 text-sm",
    icon: "w-3.5 h-3.5",
    statusIcon: "w-3.5 h-3.5",
  },
  lg: {
    badge: "px-3 py-1.5 text-base",
    icon: "w-4 h-4",
    statusIcon: "w-4 h-4",
  },
} as const;

export function ProviderBadge({
  source,
  status,
  showStatus = false,
  size = "md",
  className,
}: ProviderBadgeProps) {
  const config = providerConfig[source];
  const sizes = sizeConfig[size];
  const ProviderIcon = config.icon;

  return (
    <div
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border font-medium",
        config.bgColor,
        config.textColor,
        config.borderColor,
        sizes.badge,
        className
      )}
    >
      <ProviderIcon className={sizes.icon} />
      <span>{config.label}</span>
      {showStatus && status && (
        <>
          <span className="mx-0.5 opacity-30">•</span>
          {(() => {
            const StatusIcon = statusConfig[status].icon;
            return <StatusIcon className={cn(sizes.statusIcon, statusConfig[status].color)} />;
          })()}
        </>
      )}
    </div>
  );
}

// Re-export types for convenience
export type { BookSource, ProviderId } from "@/lib/providers/base/IMetadataProvider";
