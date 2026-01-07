"use client";

import { useState, useMemo } from "react";
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
  // New reading-related icons
  Book,
  BookA,
  BookText,
  BookType,
  BookOpenCheck,
  BookCopy,
  BookHeart,
  ScrollText,
  FileText,
  Eye,
  EyeOff,
  Repeat,
  BookmarkCheck,
  BookmarkPlus,
  BookmarkMinus,
  Ghost,
  Telescope,
  Castle,
  Skull,
  Laugh,
  Scale,
  Stethoscope,
  Plane,
  Utensils,
  Baby,
  Sunrise,
  Sunset,
  CloudRain,
  Snowflake,
  Waves,
  Sofa,
  BedDouble,
  Armchair,
  FolderOpen,
  Archive,
  Inbox,
  CheckCircle,
  Clock,
  Timer,
  Languages,
  Quote,
  Microscope,
  History,
  Map,
  Compass,
  Milestone,
  Users,
  Sparkle,
  Package,
  Search,
  X,
  LucideIcon,
} from "lucide-react";
import { cn } from "@/utils/cn";

// Curated list of shelf icons - expanded selection
export const SHELF_ICONS = {
  // === BOOKS & READING (expanded) ===
  BookMarked: BookMarked,
  Book: Book,
  BookA: BookA,
  BookText: BookText,
  BookType: BookType,
  BookOpen: BookOpen,
  BookOpenCheck: BookOpenCheck,
  BookCopy: BookCopy,
  BookHeart: BookHeart,
  Library: Library,
  Bookmark: Bookmark,
  BookmarkCheck: BookmarkCheck,
  BookmarkPlus: BookmarkPlus,
  BookmarkMinus: BookmarkMinus,
  Glasses: Glasses,
  Feather: Feather,
  Pen: Pen,
  ScrollText: ScrollText,
  FileText: FileText,
  
  // === READING ACTIVITIES ===
  Eye: Eye,
  EyeOff: EyeOff,
  Repeat: Repeat,
  
  // === ACHIEVEMENT & GOALS ===
  Trophy: Trophy,
  Award: Award,
  Medal: Medal,
  Target: Target,
  Flag: Flag,
  Crown: Crown,
  Milestone: Milestone,
  
  // === ENERGY & EMOTION ===
  Heart: Heart,
  Star: Star,
  Flame: Flame,
  Sparkles: Sparkles,
  Sparkle: Sparkle,
  Zap: Zap,
  Lightbulb: Lightbulb,
  Brain: Brain,
  
  // === GENRES & THEMES ===
  Ghost: Ghost,
  Telescope: Telescope,
  Castle: Castle,
  Skull: Skull,
  Laugh: Laugh,
  Scale: Scale,
  Stethoscope: Stethoscope,
  Plane: Plane,
  Utensils: Utensils,
  Baby: Baby,
  
  // === MOOD & ATMOSPHERE ===
  Sunrise: Sunrise,
  Sunset: Sunset,
  Moon: Moon,
  Sun: Sun,
  Cloud: Cloud,
  CloudRain: CloudRain,
  Snowflake: Snowflake,
  Waves: Waves,
  Sofa: Sofa,
  BedDouble: BedDouble,
  Armchair: Armchair,
  Umbrella: Umbrella,
  
  // === ADVENTURE & TRAVEL ===
  Rocket: Rocket,
  MapPin: MapPin,
  Map: Map,
  Compass: Compass,
  Mountain: Mountain,
  Briefcase: Briefcase,
  Home: Home,
  
  // === NATURE & WEATHER ===
  Flower2: Flower2,
  Leaf: Leaf,
  Trees: Trees,
  Bird: Bird,
  
  // === FANTASY & MAGIC ===
  Sword: Sword,
  Shield: Shield,
  Wand2: Wand2,
  
  // === CREATIVE & ART ===
  Music: Music,
  Camera: Camera,
  Palette: Palette,
  Puzzle: Puzzle,
  
  // === GEMS & PRECIOUS ===
  Diamond: Diamond,
  Gem: Gem,
  
  // === LEARNING & SCIENCE ===
  GraduationCap: GraduationCap,
  Atom: Atom,
  Bug: Bug,
  Microscope: Microscope,
  History: History,
  
  // === COLLECTIONS & ORGANIZATION ===
  FolderOpen: FolderOpen,
  Archive: Archive,
  Inbox: Inbox,
  CheckCircle: CheckCircle,
  Clock: Clock,
  Timer: Timer,
  Package: Package,
  
  // === LIFESTYLE & MISC ===
  Coffee: Coffee,
  Gift: Gift,
  Languages: Languages,
  Quote: Quote,
  Users: Users,
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
  const [searchQuery, setSearchQuery] = useState("");

  const iconEntries = Object.entries(SHELF_ICONS) as [ShelfIconName, LucideIcon][];

  // Filter icons based on search query
  const filteredIcons = useMemo(() => {
    if (!searchQuery.trim()) return iconEntries;
    
    const query = searchQuery.toLowerCase();
    return iconEntries.filter(([name]) => 
      name.toLowerCase().includes(query)
    );
  }, [searchQuery, iconEntries]);

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
          {/* Search input */}
          <div className="mb-3 relative">
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--foreground)]/50">
              <Search className="w-4 h-4" />
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search icons..."
              disabled={disabled}
              className="w-full pl-10 pr-10 py-2 bg-[var(--input-bg)] border border-[var(--border-color)] rounded-lg text-sm text-[var(--foreground)] placeholder:text-[var(--foreground)]/50 focus:outline-none focus:ring-2 focus:ring-[var(--accent)] disabled:opacity-50 disabled:cursor-not-allowed"
              autoFocus
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
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
                const isSelected = selectedIcon === name;
                return (
                  <button
                    key={name}
                    type="button"
                    onClick={() => {
                      onSelectIcon(name);
                      setShowPicker(false);
                      setSearchQuery("");
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
          ) : (
            <div className="text-center py-8 text-[var(--foreground)]/60">
              <p className="text-sm">No icons found</p>
              <p className="text-xs mt-1">Try a different search term</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
