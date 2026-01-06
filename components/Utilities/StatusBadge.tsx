"use client";

import { cn } from "@/utils/cn";
import { STATUS_CONFIG, type BookStatus } from "@/utils/statusConfig";

type BadgeSize = "sm" | "md" | "lg";

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
      <span>{config.labels.short}</span>
    </div>
  );
}
