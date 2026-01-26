"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { LucideIcon, Search, X } from "lucide-react";
import { cn } from "@/utils/cn";
import { getShelfIcon, SHELF_ICONS, type ShelfIconName } from "@/components/ShelfManagement/ShelfIconPicker";
import { ShelfAvatar } from "./ShelfAvatar";

interface ShelfAppearancePickerProps {
  color: string;
  icon: string | null;
  onColorChange: (color: string) => void;
  onIconChange: (icon: string | null) => void;
  disabled?: boolean;
  shelfName?: string; // Optional: for preview display
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
 * Unified appearance picker combining color and icon selection
 * Shows a preview of how the shelf will look with the selected color and icon
 */
export function ShelfAppearancePicker({
  color,
  icon,
  onColorChange,
  onIconChange,
  disabled = false,
  shelfName,
}: ShelfAppearancePickerProps) {
  const [hexInput, setHexInput] = useState(color);
  const [colorError, setColorError] = useState<string | null>(null);
  const [showIconPicker, setShowIconPicker] = useState(false);
  const [iconSearchQuery, setIconSearchQuery] = useState("");

  const iconEntries = Object.entries(SHELF_ICONS) as [ShelfIconName, LucideIcon][];

  // Sync hex input when color prop changes
  useEffect(() => {
    setHexInput(color);
    setColorError(null);
  }, [color]);

  // Handle native color picker change
  const handleColorChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newColor = e.target.value.toLowerCase();
      setHexInput(newColor);
      setColorError(null);
      onColorChange(newColor);
    },
    [onColorChange]
  );

  // Handle text input change (real-time)
  const handleHexInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const input = e.target.value.trim();
      setHexInput(input);

      // Validate and update if valid
      if (input === "") {
        setColorError("HEX color cannot be empty");
        return;
      }

      if (!input.startsWith("#")) {
        setColorError("HEX color must start with #");
        return;
      }

      if (isValidHex(input)) {
        setColorError(null);
        const expandedHex = expandHex(input);
        onColorChange(expandedHex);
      } else {
        setColorError("Invalid HEX format (use #RGB or #RRGGBB)");
      }
    },
    [onColorChange]
  );

  // Handle input blur - revert to last valid value if invalid
  const handleHexBlur = useCallback(() => {
    if (colorError || !isValidHex(hexInput)) {
      setHexInput(color);
      setColorError(null);
    }
  }, [colorError, hexInput, color]);

  // Filter icons based on search query
  const filteredIcons = useMemo(() => {
    if (!iconSearchQuery.trim()) return iconEntries;
    
    const query = iconSearchQuery.toLowerCase();
    return iconEntries.filter(([name]) => 
      name.toLowerCase().includes(query)
    );
  }, [iconSearchQuery, iconEntries]);

  const SelectedIcon = icon ? getShelfIcon(icon) : null;

  return (
    <div>
      {/* Controls Section - Side by Side */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        {/* Color Picker */}
        <div>
          <label htmlFor="shelf-color" className="block text-sm font-medium text-[var(--heading-text)] mb-2">
            Color
          </label>
          <div className="space-y-2">
            {/* Native color input and small preview */}
            <div className="flex items-center gap-2">
              <input
                id="shelf-color"
                type="color"
                value={color}
                onChange={handleColorChange}
                disabled={disabled}
                className="h-10 w-16 rounded-lg cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              />
              <div
                className="w-8 h-8 rounded-full border-2 border-[var(--border-color)] flex-shrink-0"
                style={{ backgroundColor: color }}
                title={`Current color: ${color}`}
              />
            </div>

            {/* HEX Input */}
            <input
              type="text"
              value={hexInput}
              onChange={handleHexInputChange}
              onBlur={handleHexBlur}
              disabled={disabled}
              placeholder="#3b82f6"
              maxLength={7}
              className={cn(
                "w-full px-3 py-2 bg-[var(--background)] border rounded-lg font-mono text-sm",
                "text-[var(--foreground)] placeholder:text-[var(--foreground)]/50",
                "focus:outline-none focus:ring-2 focus:ring-[var(--accent)]",
                "disabled:opacity-50 disabled:cursor-not-allowed",
                colorError
                  ? "border-red-500 focus:ring-red-500"
                  : "border-[var(--border-color)]"
              )}
              aria-invalid={!!colorError}
              aria-describedby={colorError ? "color-error" : undefined}
            />

            {/* Error or Helper Text */}
            {colorError ? (
              <p id="color-error" className="text-xs text-red-500" role="alert">
                {colorError}
              </p>
            ) : (
              <p className="text-xs text-[var(--foreground)]/60">
                HEX format
              </p>
            )}
          </div>
        </div>

        {/* Icon Picker */}
        <div>
          <label className="block text-sm font-medium text-[var(--heading-text)] mb-2">
            Icon (Optional)
          </label>
          <div className="space-y-2">
            {/* Selected icon display */}
            <div className="flex items-center gap-2 min-h-[2.5rem]">
              {icon ? (
                <>
                  <ShelfAvatar
                    color={color}
                    icon={icon}
                    size="md"
                    className="border-2 border-[var(--border-color)]"
                  />
                  <button
                    type="button"
                    onClick={() => onIconChange(null)}
                    disabled={disabled}
                    className="text-xs text-[var(--foreground)]/60 hover:text-red-500 transition-colors disabled:opacity-50 underline"
                  >
                    Remove
                  </button>
                </>
              ) : (
                <p className="text-sm text-[var(--foreground)]/50">
                  None selected
                </p>
              )}
            </div>

            {/* Choose icon button */}
            <button
              type="button"
              onClick={() => setShowIconPicker(!showIconPicker)}
              disabled={disabled}
              className="w-full px-3 py-2 text-sm font-medium bg-[var(--background)] border border-[var(--border-color)] rounded-lg hover:border-[var(--accent-color)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {showIconPicker ? "Hide Icons" : "Choose Icon"}
            </button>

            <p className="text-xs text-[var(--foreground)]/60">
              {Object.keys(SHELF_ICONS).length} icons
            </p>
          </div>
        </div>
      </div>

      {/* Icon Grid */}
      {showIconPicker && (
        <div className="mb-4 p-3 bg-[var(--background)] border border-[var(--border-color)] rounded-lg max-h-[50vh] overflow-y-auto">
          {/* Search input */}
          <div className="mb-3 relative">
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--foreground)]/50">
              <Search className="w-4 h-4" />
            </div>
            <input
              type="text"
              value={iconSearchQuery}
              onChange={(e) => setIconSearchQuery(e.target.value)}
              placeholder="Search icons..."
              disabled={disabled}
              className="w-full pl-10 pr-10 py-2 bg-[var(--background)] border border-[var(--border-color)] rounded-lg text-sm text-[var(--foreground)] placeholder:text-[var(--foreground)]/50 focus:outline-none focus:ring-2 focus:ring-[var(--accent)] disabled:opacity-50 disabled:cursor-not-allowed"
              autoFocus
            />
            {iconSearchQuery && (
              <button
                type="button"
                onClick={() => setIconSearchQuery("")}
                disabled={disabled}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--foreground)]/50 hover:text-[var(--foreground)] transition-colors disabled:opacity-50"
                aria-label="Clear search"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Icon grid */}
          {filteredIcons.length > 0 ? (
            <div className="grid grid-cols-7 gap-2">
              {filteredIcons.map(([name, Icon]) => {
                const isSelected = icon === name;
                return (
                  <button
                    key={name}
                    type="button"
                    onClick={() => {
                      onIconChange(name);
                      setShowIconPicker(false);
                      setIconSearchQuery("");
                    }}
                    disabled={disabled}
                    className={cn(
                      "group relative aspect-square flex flex-col items-center justify-center gap-1 p-2 rounded-lg transition-all",
                      isSelected
                        ? "bg-[var(--accent-color)]/20 ring-2 ring-[var(--accent-color)]"
                        : "hover:bg-[var(--hover-bg)]",
                      disabled && "opacity-50 cursor-not-allowed"
                    )}
                    title={name}
                  >
                    <ShelfAvatar
                      color={color}
                      icon={name}
                      size="sm"
                    />
                    <span className="text-[9px] text-[var(--foreground)]/60 text-center leading-tight truncate w-full">
                      {name}
                    </span>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-8 text-[var(--foreground)]/60">
              <p className="text-sm">No icons found</p>
              <p className="text-xs mt-1">Try a different search term</p>
            </div>
          )}
        </div>
      )}

      {/* Preview Section */}
      <div>
        <label className="block text-sm font-medium text-[var(--heading-text)] mb-3">
          Preview
        </label>
        <div className="p-4 bg-[var(--background)] border border-[var(--border-color)] rounded-lg">
          <div className="flex items-center gap-3">
            <ShelfAvatar
              color={color}
              icon={icon}
              size="lg"
              className="border-2 border-[var(--border-color)]"
            />
            <div className="flex-1 min-w-0">
              <p className="font-medium text-[var(--foreground)] truncate">
                {shelfName || "Your Shelf"}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
