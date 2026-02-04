"use client";

import { RefreshCw } from "lucide-react";
import { Button } from "@/components/Utilities/Button";
import { useStreak } from "@/hooks/useStreak";

export function StreakRebuildSection() {
  const { rebuildStreak, isRebuilding } = useStreak();

  const handleRebuild = () => {
    rebuildStreak();
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
        
        <Button
          onClick={handleRebuild}
          disabled={isRebuilding}
          variant="primary"
          size="md"
          className="whitespace-nowrap"
          icon={<RefreshCw className={`w-4 h-4 ${isRebuilding ? "animate-spin" : ""}`} />}
        >
          {isRebuilding ? "Recalculating..." : "Recalculate Streak"}
        </Button>
      </div>
    </div>
  );
}
