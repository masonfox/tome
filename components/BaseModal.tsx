"use client";

import { X } from "lucide-react";
import { cn } from "@/utils/cn";

interface BaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  actions: React.ReactNode;
  size?: "sm" | "md" | "lg" | "xl" | "2xl";
}

const sizeClasses = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-lg",
  xl: "max-w-xl",
  "2xl": "max-w-2xl",
};

export default function BaseModal({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  actions,
  size = "md",
}: BaseModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className={cn("bg-[var(--card-bg)] border border-[var(--border-color)] rounded-lg shadow-lg p-6 w-full", sizeClasses[size])}>
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-xl font-serif font-bold text-[var(--heading-text)] mb-1">
              {title}
            </h2>
            {subtitle && (
              <p className="text-sm text-[var(--foreground)]/70 font-medium">
                {subtitle}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-[var(--foreground)]/50 hover:text-[var(--foreground)] transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="mb-6">
          {children}
        </div>

        {/* Action Buttons */}
        <div>
          {actions}
        </div>
      </div>
    </div>
  );
}
