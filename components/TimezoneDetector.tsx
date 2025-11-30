"use client";

import { useEffect, useState } from "react";

/**
 * TimezoneDetector - Auto-detects user's timezone on first visit
 * 
 * This component runs once when the app loads and sends the detected
 * timezone to the server. The server only applies it if the user hasn't
 * customized their timezone yet (still using default America/New_York).
 * 
 * This ensures users get accurate day boundaries for streak tracking
 * without requiring manual configuration.
 */
export function TimezoneDetector() {
  const [detected, setDetected] = useState(false);

  useEffect(() => {
    // Only run once per session
    if (detected) return;

    const detectAndSetTimezone = async () => {
      try {
        // Detect timezone using browser API
        const detectedTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

        // Send to server (server will only apply if user hasn't customized)
        await fetch("/api/streak/timezone", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ timezone: detectedTimezone }),
        });

        setDetected(true);
      } catch (error) {
        // Silently fail - timezone detection is non-critical
        // No logging needed as this is a best-effort enhancement
      }
    };

    detectAndSetTimezone();
  }, [detected]);

  // This component renders nothing - it's purely functional
  return null;
}
