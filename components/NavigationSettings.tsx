"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Navigation2 } from "lucide-react";
import { useBottomNavigation } from "@/hooks/useBottomNavigation";

export function NavigationSettings() {
  const { enabled, toggleEnabled, mounted } = useBottomNavigation();
  const [localEnabled, setLocalEnabled] = useState(enabled);

  useEffect(() => {
    setLocalEnabled(enabled);
  }, [enabled]);

  const handleToggle = () => {
    const newValue = !localEnabled;
    setLocalEnabled(newValue);
    toggleEnabled(newValue);
    
    if (newValue) {
      toast.success("Bottom navigation enabled! Perfect for iOS Add to Home Screen.");
    } else {
      toast.success("Top navigation enabled!");
    }
  };

  if (!mounted) {
    return null;
  }

  return (
    <div className="bg-[var(--card-bg)] border border-[var(--border-color)] rounded-md p-6">
      <div className="flex items-center gap-3 mb-4">
        <Navigation2 className="w-6 h-6 text-[var(--accent)]" />
        <h3 className="text-xl font-serif font-bold text-[var(--heading-text)]">
          Navigation Style
        </h3>
      </div>

      <p className="text-sm text-[var(--subheading-text)] mb-4 font-medium">
        Choose between top navigation bar or bottom navigation for a native iOS feel.
        Bottom navigation is optimized for iOS &quot;Add to Home Screen&quot;.
      </p>

      <div className="flex items-center justify-between p-4 bg-[var(--background)] border border-[var(--border-color)] rounded-sm">
        <div>
          <p className="font-semibold text-[var(--foreground)]">
            Bottom Navigation
          </p>
          <p className="text-xs text-[var(--subheading-text)] mt-1 font-medium">
            iOS-style bottom bar with tabs
          </p>
        </div>
        
        <button
          onClick={handleToggle}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
            localEnabled ? "bg-[var(--accent)]" : "bg-[var(--border-color)]"
          }`}
          role="switch"
          aria-checked={localEnabled}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
              localEnabled ? "translate-x-6" : "translate-x-1"
            }`}
          />
        </button>
      </div>

      <p className="text-xs text-[var(--subheading-text)] mt-3 font-medium">
        💡 Tip: Enable bottom navigation for a native app experience when using iOS &quot;Add to Home Screen&quot;
      </p>
    </div>
  );
}
