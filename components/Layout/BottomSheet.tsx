"use client";

import { useEffect, useState, useRef } from "react";
import { X } from "lucide-react";

interface BottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  title?: string;
  icon?: React.ReactNode;
  size?: "small" | "medium" | "default" | "large" | "full";
  allowBackdropClose?: boolean;
}

// Animation timing
const ANIMATION_DURATION = 300; // ms

const sizeClasses = {
  small: "h-[33vh] rounded-t-2xl",
  medium: "h-[50vh] rounded-t-2xl",
  default: "max-h-[80vh] rounded-t-2xl",
  large: "h-[75vh] rounded-t-2xl",
  full: "h-[100dvh] rounded-none",
};

export function BottomSheet({ 
  isOpen, 
  onClose, 
  children, 
  title = "More", 
  icon, 
  size = "default",
  allowBackdropClose = true,
}: BottomSheetProps) {
  // Animation states: null = not rendered, 'entering' = animating in, 'entered' = visible, 'exiting' = animating out
  const [animationState, setAnimationState] = useState<'entering' | 'entered' | 'exiting' | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  // Handle opening and closing
  useEffect(() => {
    if (isOpen) {
      // Lock body scroll
      document.body.style.overflow = "hidden";
      
      // Start entering state
      setAnimationState('entering');
      
      // Use setTimeout to ensure the initial state is painted
      const timeout1 = setTimeout(() => {
        setAnimationState('entered');
        
        // Focus close button after animation
        const timeout2 = setTimeout(() => {
          closeButtonRef.current?.focus();
        }, ANIMATION_DURATION);
      }, 10); // Small delay to ensure paint
      
      return () => {
        clearTimeout(timeout1);
        document.body.style.overflow = "";
      };
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
        document.body.style.overflow = "";
      }, ANIMATION_DURATION);
      
      return () => {
        clearTimeout(timeout);
      };
    }
  }, [isOpen]);

  const handleClose = () => {
    onClose();
  };

  // Don't render if not in any animation state
  if (!animationState) return null;

  const isVisible = animationState === 'entered';
  const isExiting = animationState === 'exiting';

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black z-[100] transition-opacity"
        style={{
          opacity: isVisible ? 0.5 : 0,
          transitionDuration: `${ANIMATION_DURATION}ms`,
          pointerEvents: isExiting ? 'none' : 'auto',
        }}
        onClick={allowBackdropClose ? handleClose : undefined}
      />
      
      {/* Bottom Sheet */}
      <div 
        ref={contentRef}
        className={`fixed bottom-0 left-0 right-0 z-[101] bg-[var(--card-bg)] border-t border-[var(--border-color)] shadow-2xl flex flex-col ${
          sizeClasses[size]
        }`}
        style={{
          transform: isVisible ? 'translateY(0)' : 'translateY(100%)',
          transition: animationState === 'entering' ? 'none' : `transform ${ANIMATION_DURATION}ms cubic-bezier(0.32, 0.72, 0, 1)`,
          willChange: 'transform',
          contain: 'layout paint',
        }}
      >
        {/* Header - fixed */}
        <div className={`bg-[var(--card-bg)] border-b border-[var(--border-color)] px-4 py-3 flex items-center justify-between flex-shrink-0 ${
          size === "large" ? "rounded-t-3xl" : ""
        }`}>
          <div className="flex items-center gap-2">
            {icon && <span className="text-[var(--accent)]">{icon}</span>}
            <h3 className="text-lg font-semibold text-[var(--heading-text)]">{title}</h3>
          </div>
          <button
            ref={closeButtonRef}
            onClick={handleClose}
            tabIndex={0}
            className="text-[var(--foreground)]/50 hover:text-[var(--foreground)] transition-colors p-1 focus:outline-none focus:outline focus:outline-2 focus:outline-[var(--accent)] focus:outline-offset-2 rounded"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        {/* Content - scrollable */}
        <div className="flex-1 overflow-y-auto p-4">
          {children}
        </div>
      </div>
    </>
  );
}
