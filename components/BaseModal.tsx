"use client";

import { X } from "lucide-react";
import { cn } from "@/utils/cn";
import { useEffect, useState } from "react";

interface BaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  actions: React.ReactNode;
  size?: "sm" | "md" | "lg" | "xl" | "2xl";
  loading?: boolean;
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
  loading = false,
}: BaseModalProps) {
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    if (isOpen) {
      // Small delay to trigger animation
      requestAnimationFrame(() => {
        setIsAnimating(true);
      });
    } else {
      setIsAnimating(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div 
      className={cn(
        "fixed inset-0 bg-black flex items-center justify-center z-50 p-4 transition-opacity duration-200",
        isAnimating ? "bg-opacity-50" : "bg-opacity-0"
      )}
      onClick={onClose}
    >
      <div 
        className={cn(
          "bg-[var(--card-bg)] border border-[var(--border-color)] rounded-lg shadow-lg p-6 w-full transition-all duration-200",
          sizeClasses[size],
          isAnimating ? "opacity-100 scale-100" : "opacity-0 scale-95"
        )}
        onClick={(e) => e.stopPropagation()}
      >
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
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--accent)]"></div>
            </div>
          ) : (
            children
          )}
        </div>

        {/* Action Buttons */}
        <div>
          {actions}
        </div>
      </div>
    </div>
  );
}
