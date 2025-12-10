"use client";

import { ReadingGoalWidget } from "./ReadingGoalWidget";
import { CreateGoalPrompt } from "./CreateGoalPrompt";
import type { ReadingGoalWithProgress } from "@/lib/services/reading-goals.service";

interface GoalsPagePanelProps {
  initialGoalData: ReadingGoalWithProgress | null;
}

export function GoalsPagePanel({ initialGoalData }: GoalsPagePanelProps) {
  return (
    <div className="space-y-10 rounded-md">
      {/* Current Goal Display */}
      {initialGoalData ? (
        <ReadingGoalWidget goalData={initialGoalData} />
      ) : (
        <CreateGoalPrompt />
      )}

      {/* TODO: Year selector will go here in Phase 9 */}
      {/* TODO: Monthly chart will go here in Phase 11 */}
    </div>
  );
}
