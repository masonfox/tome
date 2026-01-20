"use client";

import { useDemo } from "@/lib/contexts/DemoContext";
import { Info, Github } from "lucide-react";

export function DemoBanner() {
  const { isDemoMode, mounted } = useDemo();

  // Don't render anything until mounted and demo mode is confirmed
  if (!mounted || !isDemoMode) {
    return null;
  }

  return (
    <div className="bg-[var(--accent)] text-white px-4 py-2 text-sm flex items-center justify-center gap-2 sticky top-0 z-50">
      <Info className="w-4 h-4 flex-shrink-0" />
      <span>This is a read-only demo. Changes are not saved.</span>
      <a
        href="https://github.com/masonfox/tome"
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 underline hover:no-underline ml-2"
      >
        <Github className="w-4 h-4" />
        <span>Self-host your own</span>
      </a>
    </div>
  );
}
