"use client";

import { useEffect, useState, useRef } from "react";
import { X } from "lucide-react";

interface BottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  title?: string;
  icon?: React.ReactNode;
  size?: "default" | "full";
  allowBackdropClose?: boolean;
}

// Animation duration for closing transition
const CLOSE_ANIMATION_MS = 300;

const sizeClasses = {
  default: "max-h-[80vh] rounded-t-2xl",
  full: "h-screen rounded-none",
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
  const [isClosing, setIsClosing] = useState(false);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
      setIsClosing(false);
      
      // Immediately focus the close button before browser auto-focus kicks in
      // Use requestAnimationFrame to ensure DOM is ready
      requestAnimationFrame(() => {
        closeButtonRef.current?.focus();
      });
    } else {
      document.body.style.overflow = "";
    }
    
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      setIsClosing(false);
      onClose();
    }, CLOSE_ANIMATION_MS);
  };

  if (!isOpen && !isClosing) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 bg-black bg-opacity-50 z-50 transition-opacity duration-300 ${
          isClosing ? "opacity-0 pointer-events-none" : "opacity-100"
        }`}
        onClick={allowBackdropClose ? handleClose : undefined}
      />
      
      {/* Bottom Sheet */}
      <div className={`fixed bottom-0 left-0 right-0 z-50 bg-[var(--card-bg)] border-t border-[var(--border-color)] shadow-lg transition-transform duration-300 ${
        sizeClasses[size]
      } ${
        isClosing ? "translate-y-full pointer-events-none" : "translate-y-0 animate-slide-up"
      } ${
        size === "full" ? "flex flex-col" : "overflow-y-auto pb-safe"
      }`}>
        {/* Header - fixed for full size, sticky for default */}
        <div className={`bg-[var(--card-bg)] border-b border-[var(--border-color)] px-4 py-3 flex items-center justify-between ${
          size === "full" ? "flex-shrink-0" : "sticky top-0 z-10"
        }`}>
          <div className="flex items-center gap-2">
            {icon && <span className="text-[var(--accent)]">{icon}</span>}
            <h3 className="text-lg font-semibold text-[var(--heading-text)]">{title}</h3>
          </div>
          <button
            ref={closeButtonRef}
            onClick={handleClose}
            className="text-[var(--foreground)]/50 hover:text-[var(--foreground)] transition-colors p-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] rounded"
            aria-label="Close"
            autoFocus
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        {/* Content - scrollable for full size, regular for default */}
        <div className={size === "full" ? "flex-1 overflow-y-auto p-4 pb-12" : "p-4 pb-12"}>
          {children}
        </div>
      </div>
    </>
  );
}
