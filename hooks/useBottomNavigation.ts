"use client";

import { useState, useEffect } from "react";

const STORAGE_KEY = "bottomNavigationEnabled";

export function useBottomNavigation() {
  const [mounted, setMounted] = useState(false);
  // Initialize from data attribute set by blocking script to prevent flicker
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    setMounted(true);
    // Read from data attribute that was set by the blocking script
    const dataAttr = document.documentElement.getAttribute('data-bottom-nav');
    if (dataAttr === 'true') {
      setEnabled(true);
    } else {
      setEnabled(false);
    }
  }, []);

  const toggleEnabled = (value: boolean) => {
    setEnabled(value);
    localStorage.setItem(STORAGE_KEY, value.toString());
    // Also update the data attribute for consistency
    document.documentElement.setAttribute('data-bottom-nav', value.toString());
  };

  return {
    enabled,
    toggleEnabled,
    mounted,
  };
}
