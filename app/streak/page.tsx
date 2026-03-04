"use client";

import { StreakPagePanel } from "@/components/Streaks/StreakPagePanel";
import { PageHeader } from "@/components/Layout/PageHeader";
import { Flame } from "lucide-react";
import { usePageTitle } from "@/lib/hooks/usePageTitle";

export default function StreakPage() {
  usePageTitle("Streak");

  return (
    <div className="space-y-10">
      <PageHeader
        title="Streak"
        subtitle="Track your reading habits and progress over time"
        icon={Flame}
      />

      <StreakPagePanel />
    </div>
  );
}
