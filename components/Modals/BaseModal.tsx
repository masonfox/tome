"use client";

import { X } from "lucide-react";
import { cn } from "@/utils/cn";
import { useEffect, useState, useRef, Children } from "react";
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

// Animation timing constant (matches BottomSheet)
const ANIMATION_DURATION = 300; // ms

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
  // Animation states: null = not rendered, 'entering' = animating in, 'entered' = visible, 'exiting' = animating out
  const [animationState, setAnimationState] = useState<'entering' | 'entered' | 'exiting' | null>(null);
  const [mounted, setMounted] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  // Check if actions has any children (to handle <></> case)
  const hasActions = Children.count(actions) > 0;

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  // Lock body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      // Save current scroll position
      const scrollY = window.scrollY;
      
      // Lock body scroll
      document.body.style.overflow = 'hidden';
      document.body.style.position = 'fixed';
      document.body.style.top = `-${scrollY}px`;
      document.body.style.width = '100%';
      
      return () => {
        // Restore body scroll
        document.body.style.overflow = '';
        document.body.style.position = '';
        document.body.style.top = '';
        document.body.style.width = '';
        
        // Restore scroll position
        window.scrollTo(0, scrollY);
      };
    }
  }, [isOpen]);

  // Handle opening and closing with proper animation states
  useEffect(() => {
    if (isOpen) {
      // Start entering state
      setAnimationState('entering');
      
      // Use setTimeout to ensure the initial state is painted before transitioning
      const timeout = setTimeout(() => {
        setAnimationState('entered');
      }, 10); // Small delay to ensure paint
      
      return () => clearTimeout(timeout);
    } else {
      // Start exit animation if we were open
      setAnimationState((prev) => {
        if (prev === 'entered' || prev === 'entering') {
          return 'exiting';
        }
        return prev;
      });
      
      // Clean up after animation completes
      const timeout = setTimeout(() => {
        setAnimationState(null);
      }, ANIMATION_DURATION);
      
      return () => clearTimeout(timeout);
    }
  }, [isOpen]);

  // Don't render if not in any animation state or not mounted
  if (!animationState || !mounted) return null;

  const isVisible = animationState === 'entered';
  const isExiting = animationState === 'exiting';

  const modalContent = (
    <div 
      className={cn(
        "fixed top-0 left-0 right-0 bottom-0 bg-black flex items-center justify-center z-50 p-4",
        isVisible ? "bg-opacity-50" : "bg-opacity-0"
      )}
      style={{
        transition: `opacity ${ANIMATION_DURATION}ms cubic-bezier(0.32, 0.72, 0, 1)`,
        pointerEvents: isExiting ? 'none' : 'auto',
        touchAction: 'none',
      }}
      onClick={allowBackdropClose ? onClose : undefined}
    >
      <div 
        className={cn(
          "bg-[var(--card-bg)] border border-[var(--border-color)] rounded-lg shadow-lg w-full flex flex-col max-h-[90vh]",
          sizeClasses[size],
          isVisible ? "opacity-100 scale-100" : "opacity-0 scale-95"
        )}
        style={{
          transition: `all ${ANIMATION_DURATION}ms cubic-bezier(0.32, 0.72, 0, 1)`,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between px-6 pt-6 pb-4 flex-shrink-0">
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

        {/* Content - Scrollable */}
        <div 
          ref={contentRef}
          className={cn("flex-1 overflow-y-auto px-6", hasActions ? "pb-4" : "pb-6")}
          style={{ 
            overscrollBehavior: 'none',
            WebkitOverflowScrolling: 'touch',
            touchAction: 'pan-y',
          }}
        >
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Spinner size="md" />
            </div>
          ) : (
            children
          )}
        </div>

        {/* Action Buttons - Pinned to bottom */}
        {hasActions && (
          <div className="flex justify-end gap-3 px-6 pb-6 pt-4 border-t border-[var(--border-color)] flex-shrink-0">
            {actions}
          </div>
        )}
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
