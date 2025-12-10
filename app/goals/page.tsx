import { PageHeader } from "@/components/PageHeader";
import { GoalsPagePanel } from "@/components/GoalsPagePanel";
import { Target } from "lucide-react";
import { readingGoalsService } from "@/lib/services";

export const dynamic = "force-dynamic";
export const revalidate = 0; // Disable all caching including router cache

export default async function GoalsPage() {
  // Get current year's reading goal
  const currentGoal = await readingGoalsService.getCurrentYearGoal(null);

  return (
    <div className="space-y-10">
      <PageHeader
        title="Reading Goals"
        subtitle="Track your annual reading targets and progress"
        icon={Target}
      />

      <GoalsPagePanel initialGoalData={currentGoal} />
    </div>
  );
}
