import { Settings as SettingsIcon } from "lucide-react";
import { TimezoneSettings } from "@/components/TimezoneSettings";
import { ReadingGoalsPanel } from "@/components/ReadingGoalsPanel";
import { StreakSettings } from "@/components/StreakSettings";
import { NavigationSettings } from "@/components/NavigationSettings";
import { PageHeader } from "@/components/PageHeader";
import { streakService } from "@/lib/services/streak.service";
import { readingGoalsService } from "@/lib/services";

export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  // Get current streak to fetch threshold and timezone (auto-creates if doesn't exist)
  const streak = await streakService.getStreak(null);
  const initialThreshold = streak.dailyThreshold;
  const initialTimezone = streak.userTimezone;

  // Get all reading goals
  const goals = await readingGoalsService.getAllGoals(null);

  return (
    <div className="space-y-10">
      <PageHeader
        title="Settings"
        subtitle="Configure your book tracker"
        icon={SettingsIcon}
      />

      {/* Navigation Settings */}
      <NavigationSettings />

      {/* Timezone Settings */}
      <TimezoneSettings initialTimezone={initialTimezone} />

      {/* Reading Goals Panel (Daily + Annual Goals Combined) */}
      <ReadingGoalsPanel 
        initialGoals={goals}
        initialThreshold={initialThreshold}
      />

      {/* Reading Streak Settings */}
      <StreakSettings 
        initialThreshold={initialThreshold}
        initialTimezone={initialTimezone}
      />
    </div>
  );
}
