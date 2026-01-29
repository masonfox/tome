"use client";

import { ButtonHTMLAttributes, ReactNode, forwardRef } from "react";
import { cn } from "@/utils/cn";

export type ButtonVariant = "primary" | "secondary" | "tertiary" | "danger" | "icon-danger";
export type ButtonSize = "sm" | "md" | "lg";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Button style variant */
  variant?: ButtonVariant;
  /** Button size */
  size?: ButtonSize;
  /** Icon to display before text */
  icon?: ReactNode;
  /** Icon to display after text */
  iconAfter?: ReactNode;
  /** Whether button is in loading state */
  isLoading?: boolean;
  /** Full width button */
  fullWidth?: boolean;
  /** Additional classes */
  className?: string;
  /** Button content */
  children?: ReactNode;
}

/**
 * Button style variants matching the elegant serif theme
 * 
 * Shadow hierarchy:
 * - Primary/Danger: shadow-md → shadow-lg on hover
 * - Secondary: shadow-sm → shadow-md on hover
 * - Tertiary: No shadows (lightweight text buttons)
 * - Icon-danger: No shadows (icon-only delete buttons)
 */
const buttonStyles: Record<ButtonVariant, string> = {
  primary: "bg-[var(--accent)] text-white rounded-md hover:bg-[var(--light-accent)] shadow-md hover:shadow-lg transition-all font-semibold disabled:opacity-50 disabled:cursor-not-allowed",
  secondary: "border border-[var(--border-color)] text-[var(--foreground)] rounded-md hover:bg-[var(--card-bg)] shadow-sm hover:shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed",
  tertiary: "text-[var(--accent)] hover:text-[var(--light-accent)] transition-colors font-semibold disabled:opacity-50 disabled:cursor-not-allowed",
  danger: "bg-red-600 text-white rounded-md hover:bg-red-700 shadow-md hover:shadow-lg transition-all font-semibold disabled:opacity-50 disabled:cursor-not-allowed",
  "icon-danger": "p-1.5 text-red-500 hover:bg-red-500/10 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed",
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: "px-3 py-1.5 text-sm",
  md: "px-4 py-2 text-base",
  lg: "px-6 py-3 text-lg",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = "primary",
      size = "md",
      icon,
      iconAfter,
      isLoading = false,
      fullWidth = false,
      className,
      children,
      disabled,
      ...props
    },
    ref
  ) => {
    const baseStyle = buttonStyles[variant];
    const sizeStyle = variant === "icon-danger" ? "" : sizeStyles[size];

    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={cn(
          baseStyle,
          sizeStyle,
          fullWidth && "w-full",
          "inline-flex items-center justify-center gap-2",
          className
        )}
        {...props}
      >
        {isLoading ? (
          <>
            <svg
              className="animate-spin h-4 w-4"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            Loading...
          </>
        ) : (
          <>
            {icon}
            {children}
            {iconAfter}
          </>
        )}
      </button>
    );
  }
);

Button.displayName = "Button";
