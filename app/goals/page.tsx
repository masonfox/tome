import { PageHeader } from "@/components/PageHeader";
import { GoalsPagePanel } from "@/components/GoalsPagePanel";
import { Target } from "lucide-react";
import { readingGoalsService } from "@/lib/services";

export const dynamic = "force-dynamic";
export const revalidate = 0; // Disable all caching including router cache

export default async function GoalsPage() {
  // Get the most appropriate goal for initial display (most recent year with a goal)
  // Falls back to null if no goals exist (triggers onboarding)
  const defaultGoal = await readingGoalsService.getDefaultGoal(null);
  
  // Get all goals for year selector
  const allGoals = await readingGoalsService.getAllGoals(null);

  // Check if user has any goals at all
  const hasNoGoals = allGoals.length === 0;

  return (
    <div className="space-y-10">
      {!hasNoGoals && (
        <PageHeader
          title="Reading Goals"
          subtitle="Track your annual reading targets and progress"
          icon={Target}
        />
      )}

      <GoalsPagePanel 
        initialGoalData={defaultGoal}
        allGoals={allGoals}
      />
    </div>
  );
}
