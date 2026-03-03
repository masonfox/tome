"use client";

import { PageHeader } from "@/components/Layout/PageHeader";
import { GoalsPagePanel } from "@/components/ReadingGoals/GoalsPagePanel";
import { Target } from "lucide-react";
import { usePageTitle } from "@/lib/hooks/usePageTitle";
import { useReadingGoals } from "@/hooks/useReadingGoals";

export default function GoalsPage() {
  usePageTitle("Reading Goals");
  const { goals, isLoading } = useReadingGoals();

  // Check if user has any goals at all
  const hasNoGoals = !isLoading && goals.length === 0;

  return (
    <div className="space-y-10">
      {!hasNoGoals && (
        <PageHeader
          title="Reading Goals"
          subtitle="Track your annual reading targets and progress"
          icon={Target}
        />
      )}

      <GoalsPagePanel />
    </div>
  );
}
