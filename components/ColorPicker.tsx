"use client";

import { useState, useEffect, useCallback } from "react";
import { cn } from "@/utils/cn";

interface ColorPickerProps {
  value: string;
  onChange: (color: string) => void;
  disabled?: boolean;
  label?: string;
  id?: string;
}

/**
 * Validates if a string is a valid HEX color
 * Supports both #RGB and #RRGGBB formats
 */
function isValidHex(hex: string): boolean {
  if (!hex.startsWith("#")) return false;
  const hexWithoutHash = hex.slice(1);
  return /^[0-9A-Fa-f]{3}$|^[0-9A-Fa-f]{6}$/.test(hexWithoutHash);
}

/**
 * Expands short HEX format (#RGB) to full format (#RRGGBB)
 */
function expandHex(hex: string): string {
  if (!hex.startsWith("#")) return hex;
  const hexWithoutHash = hex.slice(1);
  
  // If it's already 6 digits, return as-is
  if (hexWithoutHash.length === 6) {
    return hex.toLowerCase();
  }
  
  // If it's 3 digits, expand it
  if (hexWithoutHash.length === 3) {
    const [r, g, b] = hexWithoutHash.split("");
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
  }
  
  return hex;
}

/**
 * ColorPicker component with native color input and manual HEX text entry
 * Provides two-way synchronization and validation
 */
export function ColorPicker({
  value,
  onChange,
  disabled = false,
  label = "Color",
  id = "color-picker",
}: ColorPickerProps) {
  const [hexInput, setHexInput] = useState(value);
  const [error, setError] = useState<string | null>(null);

  // Sync input field when value prop changes
  useEffect(() => {
    setHexInput(value);
    setError(null);
  }, [value]);

  // Handle native color picker change
  const handleColorChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newColor = e.target.value.toLowerCase();
      setHexInput(newColor);
      setError(null);
      onChange(newColor);
    },
    [onChange]
  );

  // Handle text input change (real-time)
  const handleHexInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const input = e.target.value.trim();
      setHexInput(input);

      // Validate and update if valid
      if (input === "") {
        setError("HEX color cannot be empty");
        return;
      }

      if (!input.startsWith("#")) {
        setError("HEX color must start with #");
        return;
      }

      if (isValidHex(input)) {
        setError(null);
        const expandedHex = expandHex(input);
        onChange(expandedHex);
      } else {
        setError("Invalid HEX format (use #RGB or #RRGGBB)");
      }
    },
    [onChange]
  );

  // Handle input blur - revert to last valid value if invalid
  const handleBlur = useCallback(() => {
    if (error || !isValidHex(hexInput)) {
      setHexInput(value);
      setError(null);
    }
  }, [error, hexInput, value]);

  return (
    <div>
      <label
        htmlFor={id}
        className="block text-sm font-medium text-[var(--heading-text)] mb-2"
      >
        {label}
      </label>
      <div className="flex items-start gap-3">
        {/* Native Color Picker */}
        <input
          id={id}
          type="color"
          value={value}
          onChange={handleColorChange}
          disabled={disabled}
          className="h-10 w-20 rounded-lg cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        />

        {/* Preview Circle and HEX Input */}
        <div className="flex-1 space-y-2">
          <div className="flex items-center gap-3">
            <div
              className="w-8 h-8 rounded-full border-2 border-[var(--border-color)] flex-shrink-0"
              style={{ backgroundColor: value }}
              title={`Current color: ${value}`}
            />
            <input
              type="text"
              value={hexInput}
              onChange={handleHexInputChange}
              onBlur={handleBlur}
              disabled={disabled}
              placeholder="#3b82f6"
              maxLength={7}
              className={cn(
                "flex-1 px-3 py-2 bg-[var(--input-bg)] border rounded-lg font-mono text-sm",
                "text-[var(--foreground)] placeholder:text-[var(--foreground)]/50",
                "focus:outline-none focus:ring-2 focus:ring-[var(--accent)]",
                "disabled:opacity-50 disabled:cursor-not-allowed",
                error
                  ? "border-red-500 focus:ring-red-500"
                  : "border-[var(--border-color)]"
              )}
              aria-invalid={!!error}
              aria-describedby={error ? `${id}-error` : undefined}
            />
          </div>

          {/* Error Message */}
          {error && (
            <p
              id={`${id}-error`}
              className="text-xs text-red-500 pl-11"
              role="alert"
            >
              {error}
            </p>
          )}

          {/* Helper Text */}
          {!error && (
            <p className="text-xs text-[var(--foreground)]/60 pl-11">
              Enter HEX color (e.g., #3b82f6 or #f00)
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
