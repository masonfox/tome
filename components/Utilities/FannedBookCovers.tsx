'use client';

import Image from 'next/image';
import { BookOpen } from 'lucide-react';
import { useState } from 'react';
import { getCoverUrl } from '@/lib/utils/cover-url';

interface FannedBookCoversProps {
  /** Tome book IDs for book covers */
  coverIds: number[];
  /** Maximum number of covers to display (default: 12) */
  maxCovers?: number;
  /** Size variant for cover dimensions */
  size?: 'sm' | 'md' | 'lg';
  /** Enable hover animations (default: true) */
  withHoverEffect?: boolean;
  /** Additional CSS classes for container */
  className?: string;
  /** Loading/skeleton state */
  isLoading?: boolean;
  /** Container height in pixels (default: 180) */
  height?: number;
}

/**
 * FannedBookCovers - Displays book covers in a fanned/stacked layout
 * 
 * Features:
 * - Smart positioning based on number of covers
 * - Responsive container-based display
 * - Configurable size variants
 * - Hover animations that fan out covers
 * - Loading/skeleton state support
 * 
 * Usage:
 * ```tsx
 * <FannedBookCovers 
 *   coverIds={[1, 2, 3, 4, 5]} 
 *   size="md" 
 *   maxCovers={8}
 * />
 * ```
 */
export default function FannedBookCovers({
  coverIds,
  maxCovers = 12,
  size = 'md',
  withHoverEffect = true,
  className = '',
  isLoading = false,
  height = 180,
}: FannedBookCoversProps) {
  const [imageErrors, setImageErrors] = useState<Record<number, boolean>>({});
  const [isHovered, setIsHovered] = useState(false);

  // Cover dimensions based on size variant
  const dimensions = {
    sm: { width: 70, height: 105 },
    md: { width: 85, height: 128 },
    lg: { width: 95, height: 143 },
  }[size];

  // Limit covers to display
  const visibleCovers = isLoading 
    ? Array.from({ length: 3 }, (_, i) => i) // Show 3 skeleton covers
    : coverIds.slice(0, maxCovers);

  const coverCount = visibleCovers.length;

  if (coverCount === 0) {
    return (
      <div 
        className={`flex items-center justify-center ${className}`}
        style={{ height: `${height}px` }}
      >
        <BookOpen className="w-16 h-16 text-[var(--foreground)]/30" />
      </div>
    );
  }

  /**
   * Calculate positioning for each cover based on total count
   * Centers the fanned covers within the container with equal spacing on both sides
   */
  const calculateCoverStyle = (index: number) => {
    const maxRotation = 8; // Maximum rotation in degrees
    const minSpacing = 25; // Minimum spacing between covers in px
    const maxSpacing = 50; // Maximum spacing between covers in px
    
    // Calculate spacing based on cover count (more covers = less spacing)
    const spacing = Math.max(
      minSpacing,
      maxSpacing - (coverCount - 3) * 3
    );

    // Calculate rotation based on position (-maxRotation to +maxRotation)
    const normalizedPosition = (index / Math.max(coverCount - 1, 1)) - 0.5; // -0.5 to 0.5
    const rotation = normalizedPosition * maxRotation * 2;

    // Calculate total width of the fan
    const totalFanWidth = (coverCount - 1) * spacing + dimensions.width;
    
    // Position each cover from the center point
    // Start from center of container, then offset by half the fan width to the left,
    // then add the individual cover's position
    // Subtract 40px to shift the whole fan slightly left for better optical centering
    const translateX = -(totalFanWidth / 2) + (index * spacing) + (dimensions.width / 2) - 40;

    // Z-index increases with index (later covers on top)
    const zIndex = 10 + index;

    // Calculate hover translation - spread equally left and right from center
    // Covers on the left move more left, covers on the right move more right
    const hoverSpread = 8; // Total spread in pixels per cover from center
    const hoverTranslateX = withHoverEffect && isHovered 
      ? normalizedPosition * hoverSpread * coverCount
      : 0;

    return {
      rotation,
      translateX,
      zIndex,
      hoverTranslateX,
    };
  };

  const handleImageError = (bookId: number) => {
    setImageErrors(prev => ({ ...prev, [bookId]: true }));
  };

  return (
    <div 
      className={`relative overflow-hidden ${className}`}
      style={{ height: `${height}px` }}
      onMouseEnter={() => withHoverEffect && setIsHovered(true)}
      onMouseLeave={() => withHoverEffect && setIsHovered(false)}
    >
      <div className="absolute inset-0 flex items-center justify-center">
        {visibleCovers.map((item, index) => {
          const bookId = typeof item === 'number' && !isLoading ? item : null;
          const style = calculateCoverStyle(index);
          
          return (
            <div
              key={bookId || `skeleton-${index}`}
              className={`absolute transition-all duration-300 ${isHovered ? 'scale-105' : ''}`}
              style={{
                left: '50%',
                zIndex: style.zIndex,
                transform: `translateX(${style.translateX}px)`,
              }}
            >
              <div 
                className="transition-transform duration-300"
                style={{
                  transform: `rotate(${style.rotation}deg) translateX(${style.hoverTranslateX}px)`,
                }}
              >
                {isLoading ? (
                  // Skeleton state
                  <div 
                    className="bg-[var(--foreground)]/10 rounded shadow-xl border-2 border-[var(--card-bg)]"
                    style={{ 
                      width: `${dimensions.width}px`, 
                      height: `${dimensions.height}px` 
                    }}
                  />
                ) : bookId && !imageErrors[bookId] ? (
                  // Actual cover image
                  <Image
                    src={getCoverUrl(bookId)}
                    alt={`Cover ${index + 1}`}
                    width={dimensions.width}
                    height={dimensions.height}
                    className="rounded shadow-xl border-2 border-[var(--card-bg)]"
                    onError={() => handleImageError(bookId)}
                    unoptimized
                  />
                ) : (
                  // Error fallback
                  <div 
                    className="bg-[var(--hover-bg)] rounded border-2 border-[var(--card-bg)] flex items-center justify-center shadow-xl"
                    style={{ 
                      width: `${dimensions.width}px`, 
                      height: `${dimensions.height}px` 
                    }}
                  >
                    <BookOpen className="w-8 h-8 text-[var(--foreground)]/30" />
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
