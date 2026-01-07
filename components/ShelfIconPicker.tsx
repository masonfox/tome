"use client";

import { useState } from "react";
import {
  BookMarked,
  Heart,
  Star,
  Trophy,
  Flame,
  Sparkles,
  Target,
  Flag,
  Rocket,
  Crown,
  BookOpen,
  Library,
  Bookmark,
  GraduationCap,
  Coffee,
  Zap,
  Gift,
  Lightbulb,
  Music,
  Camera,
  Glasses,
  Feather,
  Pen,
  MapPin,
  Moon,
  Sun,
  Cloud,
  Umbrella,
  Briefcase,
  Home,
  Mountain,
  Palette,
  Puzzle,
  Diamond,
  Gem,
  Award,
  Medal,
  Shield,
  Sword,
  Wand2,
  Brain,
  Atom,
  Bug,
  Flower2,
  Leaf,
  Trees,
  Bird,
  LucideIcon,
} from "lucide-react";
import { cn } from "@/utils/cn";

// Curated list of shelf icons - expanded selection
export const SHELF_ICONS = {
  // Books & Reading
  BookMarked: BookMarked,
  BookOpen: BookOpen,
  Library: Library,
  Bookmark: Bookmark,
  Glasses: Glasses,
  Feather: Feather,
  Pen: Pen,
  
  // Achievement & Goals
  Trophy: Trophy,
  Award: Award,
  Medal: Medal,
  Target: Target,
  Flag: Flag,
  Crown: Crown,
  
  // Energy & Emotion
  Heart: Heart,
  Star: Star,
  Flame: Flame,
  Sparkles: Sparkles,
  Zap: Zap,
  Lightbulb: Lightbulb,
  Brain: Brain,
  
  // Adventure & Travel
  Rocket: Rocket,
  MapPin: MapPin,
  Mountain: Mountain,
  Briefcase: Briefcase,
  Home: Home,
  
  // Nature & Weather
  Moon: Moon,
  Sun: Sun,
  Cloud: Cloud,
  Umbrella: Umbrella,
  Flower2: Flower2,
  Leaf: Leaf,
  Trees: Trees,
  Bird: Bird,
  
  // Fantasy & Magic
  Sword: Sword,
  Shield: Shield,
  Wand2: Wand2,
  
  // Creative & Art
  Music: Music,
  Camera: Camera,
  Palette: Palette,
  Puzzle: Puzzle,
  
  // Gems & Precious
  Diamond: Diamond,
  Gem: Gem,
  
  // Learning & Science
  GraduationCap: GraduationCap,
  Atom: Atom,
  Bug: Bug,
  
  // Lifestyle
  Coffee: Coffee,
  Gift: Gift,
} as const;

export type ShelfIconName = keyof typeof SHELF_ICONS;

// Helper function to get icon component by name
export function getShelfIcon(iconName: string | null | undefined): LucideIcon | null {
  if (!iconName || !(iconName in SHELF_ICONS)) {
    return null;
  }
  return SHELF_ICONS[iconName as ShelfIconName];
}

interface ShelfIconPickerProps {
  selectedIcon: string | null;
  onSelectIcon: (iconName: string | null) => void;
  color: string;
  disabled?: boolean;
}

export function ShelfIconPicker({
  selectedIcon,
  onSelectIcon,
  color,
  disabled = false,
}: ShelfIconPickerProps) {
  const [showPicker, setShowPicker] = useState(false);

  const iconEntries = Object.entries(SHELF_ICONS) as [ShelfIconName, LucideIcon][];

  return (
    <div>
      <label className="block text-sm font-medium text-[var(--heading-text)] mb-2">
        Icon (Optional)
      </label>
      
      {/* Selected icon preview and clear button */}
      <div className="flex items-center gap-3 mb-3">
        {selectedIcon ? (
          <>
            <div
              className="w-12 h-12 rounded-full flex items-center justify-center border-2 border-[var(--border-color)]"
              style={{ backgroundColor: color }}
            >
              {(() => {
                const Icon = getShelfIcon(selectedIcon);
                return Icon ? <Icon className="w-6 h-6 text-white" /> : null;
              })()}
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-[var(--foreground)]">
                {selectedIcon}
              </p>
              <button
                type="button"
                onClick={() => onSelectIcon(null)}
                disabled={disabled}
                className="text-xs text-[var(--foreground)]/60 hover:text-[var(--accent-color)] transition-colors disabled:opacity-50"
              >
                Remove icon
              </button>
            </div>
          </>
        ) : (
          <div className="flex items-center gap-3">
            <div
              className="w-12 h-12 rounded-full border-2 border-[var(--border-color)]"
              style={{ backgroundColor: color }}
            />
            <p className="text-sm text-[var(--foreground)]/60">
              No icon selected
            </p>
          </div>
        )}
      </div>

      {/* Icon grid toggle */}
      <button
        type="button"
        onClick={() => setShowPicker(!showPicker)}
        disabled={disabled}
        className="px-4 py-2 text-sm font-medium bg-[var(--background)] border border-[var(--border-color)] rounded-lg hover:border-[var(--accent-color)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {showPicker ? "Hide Icons" : "Choose Icon"}
      </button>

      {/* Icon grid */}
      {showPicker && (
        <div className="mt-3 p-3 bg-[var(--background)] border border-[var(--border-color)] rounded-lg max-h-[60vh] overflow-y-auto">
          <div className="grid grid-cols-6 gap-2">
            {iconEntries.map(([name, Icon]) => {
              const isSelected = selectedIcon === name;
              return (
                <button
                  key={name}
                  type="button"
                  onClick={() => {
                    onSelectIcon(name);
                    setShowPicker(false);
                  }}
                  disabled={disabled}
                  className={cn(
                    "group relative aspect-square flex flex-col items-center justify-center gap-1 p-2 rounded-lg transition-all",
                    isSelected
                      ? "bg-[var(--accent-color)]/20"
                      : "hover:bg-[var(--hover-bg)]",
                    disabled && "opacity-50 cursor-not-allowed"
                  )}
                  title={name}
                >
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center"
                    style={{ backgroundColor: color }}
                  >
                    <Icon className="w-5 h-5 text-white" />
                  </div>
                  <span className="text-[9px] text-[var(--foreground)]/60 text-center leading-tight truncate w-full">
                    {name}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
