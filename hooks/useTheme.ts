"use client";

import { useState, useEffect, useCallback } from "react";

export type ThemePreference = "light" | "dark" | "auto";
export type Theme = "light" | "dark";

export function useTheme() {
  const [preference, setPreference] = useState<ThemePreference>("auto");
  const [systemPrefersDark, setSystemPrefersDark] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Computed effective theme
  const effectiveTheme: Theme = 
    preference === "auto" 
      ? (systemPrefersDark ? "dark" : "light")
      : preference;

  // Initialize from localStorage with migration
  useEffect(() => {
    setMounted(true);
    
    const savedPreference = localStorage.getItem("themePreference");
    const oldSavedMode = localStorage.getItem("darkMode");
    
    if (savedPreference && ["light", "dark", "auto"].includes(savedPreference)) {
      setPreference(savedPreference as ThemePreference);
    } else if (oldSavedMode !== null) {
      // Migrate from old boolean format
      const migratedPreference: ThemePreference = oldSavedMode === "true" ? "dark" : "light";
      setPreference(migratedPreference);
      localStorage.setItem("themePreference", migratedPreference);
      localStorage.removeItem("darkMode");
    }
    // else: keep default "auto"
  }, []);

  // System preference listener
  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    setSystemPrefersDark(mediaQuery.matches);

    const handleChange = (e: MediaQueryListEvent) => {
      setSystemPrefersDark(e.matches);
    };

    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);

  // Apply theme to DOM whenever effective theme changes
  useEffect(() => {
    if (!mounted) return;
    
    const html = document.documentElement;
    html.setAttribute("data-theme", effectiveTheme);
    html.setAttribute("data-color-mode", effectiveTheme);
  }, [effectiveTheme, mounted]);

  // Update preference
  const setThemePreference = useCallback((newPreference: ThemePreference) => {
    setPreference(newPreference);
    localStorage.setItem("themePreference", newPreference);
  }, []);

  return { 
    preference, 
    effectiveTheme,
    setThemePreference,
    mounted 
  };
}
