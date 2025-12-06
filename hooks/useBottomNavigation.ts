"use client";

import { useState, useEffect } from "react";

const STORAGE_KEY = "bottomNavigationEnabled";

export function useBottomNavigation() {
  const [enabled, setEnabled] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored !== null) {
      setEnabled(stored === "true");
    }
  }, []);

  const toggleEnabled = (value: boolean) => {
    setEnabled(value);
    localStorage.setItem(STORAGE_KEY, value.toString());
  };

  return {
    enabled: mounted ? enabled : false,
    toggleEnabled,
    mounted,
  };
}
