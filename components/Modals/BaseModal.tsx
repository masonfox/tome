"use client";

import { X } from "lucide-react";
import { cn } from "@/utils/cn";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Spinner } from "@/components/Utilities/Spinner";

interface BaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  actions: React.ReactNode;
  size?: "sm" | "md" | "lg" | "xl" | "2xl";
  loading?: boolean;
  allowBackdropClose?: boolean;
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
  allowBackdropClose = true,
}: BaseModalProps) {
  const [isAnimating, setIsAnimating] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

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

  if (!isOpen || !mounted) return null;

  const modalContent = (
    <div 
      className={cn(
        "fixed top-0 left-0 right-0 bottom-0 bg-black flex items-center justify-center z-50 p-4 transition-opacity duration-200",
        isAnimating ? "bg-opacity-50" : "bg-opacity-0"
      )}
      onClick={allowBackdropClose ? onClose : undefined}
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
              <p className="text-sm text-[var(--subheading-text)] font-medium">
                {subtitle}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            disabled={loading}
            className="text-[var(--foreground)]/50 hover:text-[var(--foreground)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="mb-6">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Spinner size="md" />
            </div>
          ) : (
            children
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex justify-end gap-3">
          {actions}
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
