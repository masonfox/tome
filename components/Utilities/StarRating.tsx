"use client";

import { useState } from "react";
import { Star } from "lucide-react";
import { cn } from "@/utils/cn";

interface StarRatingProps {
  rating: number; // 0-5
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  interactive?: boolean;
  onRatingChange?: (rating: number) => void;
  showCount?: boolean;
  className?: string;
}

const sizeClasses = {
  xs: 'w-3.5 h-3.5',
  sm: 'w-4 h-4',
  md: 'w-5 h-5',
  lg: 'w-8 h-8',
  xl: 'w-10 h-10',
};

export function StarRating({
  rating,
  size = 'sm',
  interactive = false,
  onRatingChange,
  showCount = false,
  className,
}: StarRatingProps) {
  const [hoverRating, setHoverRating] = useState(0);

  const handleClick = (star: number) => {
    if (interactive && onRatingChange) {
      onRatingChange(star);
    }
  };

  const currentRating = interactive && hoverRating > 0 ? hoverRating : rating;

  return (
    <div className={cn("flex flex-col items-center", className)}>
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((star) => {
          const isFilled = star <= currentRating;
          
          const starElement = (
            <Star
              key={star}
              className={cn(
                sizeClasses[size],
                "transition-all duration-300",
                isFilled
                  ? "fill-amber-400 text-amber-400"
                  : "text-[var(--foreground)] opacity-30",
                interactive && "cursor-pointer hover:scale-110"
              )}
            />
          );

          if (interactive) {
            return (
              <button
                key={star}
                type="button"
                onClick={() => handleClick(star)}
                onMouseEnter={() => setHoverRating(star)}
                onMouseLeave={() => setHoverRating(0)}
                className="focus:outline-none"
              >
                {starElement}
              </button>
            );
          }

          return starElement;
        })}
      </div>
      
      {showCount && rating > 0 && (
        <p className="text-sm text-[var(--subheading-text)] mt-3 font-medium text-center">
          {rating} {rating === 1 ? "star" : "stars"}
        </p>
      )}
    </div>
  );
}
