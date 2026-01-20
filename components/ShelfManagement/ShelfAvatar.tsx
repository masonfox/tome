"use client";

import { useMemo } from "react";
import { FolderOpen, type LucideIcon } from "lucide-react";
import { cn } from "@/utils/cn";
import { getShelfIcon } from "./ShelfIconPicker";
import { getAccessibleTextColor } from "@/utils/color-contrast";

type ShelfAvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';
type ShelfAvatarShape = 'circle' | 'rounded';

interface ShelfAvatarProps {
  /** Hex color for the avatar background (e.g., "#3b82f6") */
  color: string | null;

  /** Icon name from SHELF_ICONS */
  icon: string | null;

  /** Size variant - defaults to 'md' */
  size?: ShelfAvatarSize;

  /** Shape variant - defaults to 'circle' */
  shape?: ShelfAvatarShape;

  /** Additional CSS classes */
  className?: string;

  /** Fallback icon when icon is null - defaults to FolderOpen */
  fallbackIcon?: LucideIcon;

  /** Accessibility label */
  'aria-label'?: string;
}

// Size configuration mapping
const SIZE_CONFIG: Record<ShelfAvatarSize, { container: string; icon: string }> = {
  'xs':  { container: 'w-5 h-5',   icon: 'w-3 h-3' },
  'sm':  { container: 'w-8 h-8',   icon: 'w-4 h-4' },
  'md':  { container: 'w-10 h-10', icon: 'w-5 h-5' },
  'lg':  { container: 'w-12 h-12', icon: 'w-6 h-6' },
  'xl':  { container: 'w-16 h-16', icon: 'w-8 h-8' },
  '2xl': { container: 'w-20 h-20', icon: 'w-10 h-10' },
};

const SHAPE_CONFIG: Record<ShelfAvatarShape, string> = {
  'circle': 'rounded-full',
  'rounded': 'rounded-lg',
};

const DEFAULT_COLOR = '#3b82f6';

/**
 * ShelfAvatar Component
 *
 * Renders a shelf icon with proper color contrast accessibility.
 * Automatically selects white or black icon color based on background luminance
 * to ensure WCAG 2.1 compliance.
 *
 * @example
 * // Basic usage
 * <ShelfAvatar color="#3b82f6" icon="BookMarked" />
 *
 * @example
 * // Large circular avatar
 * <ShelfAvatar color="#ffffcc" icon="Heart" size="2xl" shape="circle" />
 *
 * @example
 * // With custom styling and accessibility
 * <ShelfAvatar
 *   color={shelf.color}
 *   icon={shelf.icon}
 *   className="shadow-lg"
 *   aria-label={`${shelf.name} shelf`}
 * />
 */
export function ShelfAvatar({
  color,
  icon,
  size = 'md',
  shape = 'circle',
  className,
  fallbackIcon = FolderOpen,
  'aria-label': ariaLabel,
}: ShelfAvatarProps) {
  // Validate and sanitize color
  const validColor = useMemo(() => {
    if (!color) return DEFAULT_COLOR;

    // Basic hex validation
    if (!/^#([0-9A-Fa-f]{3}){1,2}$/.test(color)) {
      if (process.env.NODE_ENV === 'development') {
        console.warn(`Invalid shelf color: ${color}, using default ${DEFAULT_COLOR}`);
      }
      return DEFAULT_COLOR;
    }

    return color;
  }, [color]);

  // Calculate accessible text color
  const textColor = useMemo(
    () => getAccessibleTextColor(validColor),
    [validColor]
  );

  // Get icon component
  const IconComponent = icon ? getShelfIcon(icon) : null;
  const Icon = IconComponent || fallbackIcon;

  // Get size and shape classes
  const containerSize = SIZE_CONFIG[size].container;
  const iconSize = SIZE_CONFIG[size].icon;
  const shapeClass = SHAPE_CONFIG[shape];

  return (
    <div
      className={cn(
        "flex items-center justify-center flex-shrink-0",
        containerSize,
        shapeClass,
        className
      )}
      style={{ backgroundColor: validColor }}
      aria-label={ariaLabel}
    >
      <Icon
        className={iconSize}
        style={{ color: textColor === 'white' ? '#ffffff' : '#000000' }}
        aria-hidden="true"
      />
    </div>
  );
}
