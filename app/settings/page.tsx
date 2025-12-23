import { Settings as SettingsIcon } from "lucide-react";
import { StreakSettings } from "@/components/StreakSettings";
import { NavigationSettings } from "@/components/NavigationSettings";
import { PageHeader } from "@/components/PageHeader";
import { streakService } from "@/lib/services/streak.service";

export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  // Get current streak to fetch timezone (auto-creates if doesn't exist)
  const streak = await streakService.getStreak(null);
  const initialTimezone = streak.userTimezone;

  return (
    <div className="space-y-10">
      <PageHeader
        title="Settings"
        subtitle="Configure your book tracker"
        icon={SettingsIcon}
      />

      {/* Navigation Settings */}
      <NavigationSettings />

      {/* Reading Streak Settings */}
      <StreakSettings 
        initialThreshold={initialThreshold}
        initialTimezone={initialTimezone}
      />
    </div>
  );
}
