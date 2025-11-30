"use client";

import { useState } from "react";
import { RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";

export function StreakRebuildSection() {
  const [isRebuilding, setIsRebuilding] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const router = useRouter();

  const handleRebuild = async () => {
    setIsRebuilding(true);
    setMessage(null);

    try {
      const response = await fetch("/api/streak/rebuild", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });

      const data = await response.json();

      if (data.success) {
        setMessage({
          type: "success",
          text: "Streak recalculated successfully! Refreshing...",
        });
        
        // Refresh the page after a short delay to show the success message
        setTimeout(() => {
          setIsRebuilding(false);
          router.refresh();
        }, 1000);
      } else {
        setMessage({
          type: "error",
          text: "Failed to recalculate streak. Please try again.",
        });
        setIsRebuilding(false);
      }
    } catch (error) {
      setMessage({
        type: "error",
        text: "An error occurred while recalculating. Please try again.",
      });
      setIsRebuilding(false);
    }
  };

  return (
    <div className="bg-[var(--card-bg)] border border-[var(--border-color)] rounded-md p-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h3 className="text-sm font-semibold text-[var(--heading-text)] mb-1">
            Streak Data Incorrect?
          </h3>
          <p className="text-xs text-[var(--subheading-text)]">
            Recalculate your streak from all reading history
          </p>
        </div>
        
        <button
          onClick={handleRebuild}
          disabled={isRebuilding}
          className="flex items-center gap-2 px-4 py-2 bg-[var(--accent)] hover:bg-[var(--accent)]/90 disabled:bg-[var(--accent)]/50 text-white rounded-md transition-colors text-sm font-medium whitespace-nowrap"
        >
          <RefreshCw className={`w-4 h-4 ${isRebuilding ? "animate-spin" : ""}`} />
          {isRebuilding ? "Recalculating..." : "Recalculate Streak"}
        </button>
      </div>

      {message && (
        <div
          className={`mt-4 p-3 rounded-md text-sm ${
            message.type === "success"
              ? "bg-green-500/10 text-green-700 dark:text-green-400 border border-green-500/20"
              : "bg-red-500/10 text-red-700 dark:text-red-400 border border-red-500/20"
          }`}
        >
          {message.text}
        </div>
      )}
    </div>
  );
}
