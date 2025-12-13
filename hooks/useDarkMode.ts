"use client";

import { useState, useEffect, useCallback } from "react";

export function useDarkMode() {
  const [darkMode, setDarkMode] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    
    // Get current theme from DOM (already set by layout script)
    const currentTheme = document.documentElement.getAttribute("data-theme");
    setDarkMode(currentTheme === "dark");
    
    // Listen for theme changes from other components
    const handleThemeChange = () => {
      const theme = document.documentElement.getAttribute("data-theme");
      setDarkMode(theme === "dark");
    };
    
    const observer = new MutationObserver(handleThemeChange);
    observer.observe(document.documentElement, { 
      attributes: true, 
      attributeFilter: ['data-theme'] 
    });
    
    return () => observer.disconnect();
  }, []);

  const applyTheme = useCallback((isDark: boolean) => {
    const html = document.documentElement;
    const theme = isDark ? "dark" : "light";
    html.setAttribute("data-theme", theme);
    html.setAttribute("data-color-mode", theme);
  }, []);

  const toggleDarkMode = useCallback(() => {
    setDarkMode(prev => {
      const newMode = !prev;
      localStorage.setItem("darkMode", newMode.toString());
      applyTheme(newMode);
      return newMode;
    });
  }, [applyTheme]);

  return { darkMode, toggleDarkMode, mounted };
}
