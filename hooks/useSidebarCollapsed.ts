"use client";

import { useState, useEffect } from "react";

const STORAGE_KEY = "sidebarCollapsed";

export function useSidebarCollapsed() {
  const [mounted, setMounted] = useState(false);
  // Initialize from data attribute set by blocking script to prevent flicker
  const [collapsed, setCollapsed] = useState(true); // Default to collapsed

  useEffect(() => {
    setMounted(true);
    // Read from data attribute that was set by the blocking script
    const dataAttr = document.documentElement.getAttribute('data-sidebar-collapsed');
    if (dataAttr === 'true') {
      setCollapsed(true);
    } else if (dataAttr === 'false') {
      setCollapsed(false);
    }
  }, []);

  const toggleCollapsed = (value: boolean) => {
    setCollapsed(value);
    localStorage.setItem(STORAGE_KEY, value.toString());
    // Also update the data attribute for consistency
    document.documentElement.setAttribute('data-sidebar-collapsed', value.toString());
  };

  return {
    collapsed,
    toggleCollapsed,
    mounted,
  };
}
