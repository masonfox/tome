"use client";

import { useTheme } from "@/hooks/useTheme";
import { Palette } from "lucide-react";
import type { ThemePreference } from "@/hooks/useTheme";

export function ThemeSettings() {
  const { preference, effectiveTheme, setThemePreference } = useTheme();

  function handleThemeChange(newPreference: ThemePreference) {
    setThemePreference(newPreference);
  }

  return (
    <div className="bg-[var(--card-bg)] border border-[var(--border-color)] rounded-md p-6">
      <div className="flex items-center gap-3 mb-4">
        <Palette className="w-6 h-6 text-[var(--accent)]" />
        <h3 className="text-xl font-serif font-bold text-[var(--heading-text)]">
          Theme
        </h3>
      </div>

      <p className="text-sm text-[var(--subheading-text)] mb-4 font-medium">
        Choose how Tome looks on this device
      </p>

      <div className="space-y-3">
        {/* Light Mode */}
        <label className="flex items-start gap-3 cursor-pointer p-3 rounded-md hover:bg-[var(--border-color)]/30 transition-colors">
          <div className="relative flex items-center justify-center mt-1">
            <input
              type="radio"
              name="theme"
              value="light"
              checked={preference === "light"}
              onChange={() => handleThemeChange("light")}
              className="appearance-none w-4 h-4 border-2 border-[var(--foreground)]/40 rounded-full cursor-pointer
                       checked:border-[var(--accent)] checked:border-[6px]
                       focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:ring-offset-2
                       transition-all duration-150"
            />
          </div>
          <div className="flex-1">
            <div className="font-semibold text-[var(--foreground)]">Light</div>
            <div className="text-sm text-[var(--subheading-text)]">
              Always use light mode
            </div>
          </div>
        </label>

        {/* Dark Mode */}
        <label className="flex items-start gap-3 cursor-pointer p-3 rounded-md hover:bg-[var(--border-color)]/30 transition-colors">
          <div className="relative flex items-center justify-center mt-1">
            <input
              type="radio"
              name="theme"
              value="dark"
              checked={preference === "dark"}
              onChange={() => handleThemeChange("dark")}
              className="appearance-none w-4 h-4 border-2 border-[var(--foreground)]/40 rounded-full cursor-pointer
                       checked:border-[var(--accent)] checked:border-[6px]
                       focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:ring-offset-2
                       transition-all duration-150"
            />
          </div>
          <div className="flex-1">
            <div className="font-semibold text-[var(--foreground)]">Dark</div>
            <div className="text-sm text-[var(--subheading-text)]">
              Always use dark mode
            </div>
          </div>
        </label>

        {/* Auto Mode */}
        <label className="flex items-start gap-3 cursor-pointer p-3 rounded-md hover:bg-[var(--border-color)]/30 transition-colors">
          <div className="relative flex items-center justify-center mt-1">
            <input
              type="radio"
              name="theme"
              value="auto"
              checked={preference === "auto"}
              onChange={() => handleThemeChange("auto")}
              className="appearance-none w-4 h-4 border-2 border-[var(--foreground)]/40 rounded-full cursor-pointer
                       checked:border-[var(--accent)] checked:border-[6px]
                       focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:ring-offset-2
                       transition-all duration-150"
            />
          </div>
          <div className="flex-1">
            <div className="font-semibold text-[var(--foreground)]">Auto</div>
            <div className="text-sm text-[var(--subheading-text)]">
              Match system preferences
            </div>
            {preference === "auto" && (
              <div className="text-xs text-[var(--accent)] mt-1 font-medium">
                Currently showing: {effectiveTheme === "dark" ? "Dark" : "Light"} theme
              </div>
            )}
          </div>
        </label>
      </div>
    </div>
  );
}
