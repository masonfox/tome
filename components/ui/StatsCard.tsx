import { ReactNode } from "react";
import { cn } from "@/utils/cn";

interface StatsCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: ReactNode;
  className?: string;
}

export function StatsCard({
  title,
  value,
  subtitle,
  icon,
  className,
}: StatsCardProps) {
  return (
    <div
      className={cn(
        "bg-[var(--card-bg)] border border-[var(--border-color)] p-6 hover:shadow-md transition-shadow",
        className
      )}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-xs uppercase tracking-wide font-light text-[var(--foreground)]/70">
            {title}
          </p>
          <p className="text-4xl font-serif font-bold text-[var(--foreground)] mt-3">
            {value}
          </p>
          {subtitle && (
            <p className="text-xs text-[var(--foreground)]/60 mt-2 font-light">
              {subtitle}
            </p>
          )}
        </div>
        {icon && (
          <div className="text-[var(--accent)]/60">{icon}</div>
        )}
      </div>
    </div>
  );
}
