'use client';

import { ReactNode } from 'react';
import { LucideIcon } from 'lucide-react';

interface FloatingActionButtonProps {
  /** The icon component to display */
  icon?: LucideIcon;
  /** Custom icon element (alternative to icon prop) */
  children?: ReactNode;
  /** Click handler */
  onClick: () => void;
  /** Aria label for accessibility */
  ariaLabel: string;
  /** Position from bottom (in Tailwind spacing units) */
  bottom?: 'bottom-6' | 'bottom-32' | 'bottom-48';
  /** Position from right (in Tailwind spacing units) */
  right?: 'right-4' | 'right-20';
  /** Responsive visibility class (e.g., 'lg:hidden' for mobile-only) */
  visibility?: string;
  /** Z-index layer */
  zIndex?: 'z-40' | 'z-[45]' | 'z-50' | 'z-[60]';
  /** Additional custom classes */
  className?: string;
}

export function FloatingActionButton({
  icon: Icon,
  children,
  onClick,
  ariaLabel,
  bottom = 'bottom-32',
  right = 'right-4',
  visibility = '',
  zIndex = 'z-40',
  className = '',
}: FloatingActionButtonProps) {
  return (
    <button
      onClick={onClick}
      className={`fixed ${bottom} md:bottom-6 ${right} ${zIndex} w-14 h-14 rounded-full bg-[var(--accent)] text-white shadow-lg flex items-center justify-center hover:scale-110 transition-transform ${visibility} ${className}`.trim()}
      aria-label={ariaLabel}
    >
      {Icon ? <Icon className="w-6 h-6" /> : children}
    </button>
  );
}
