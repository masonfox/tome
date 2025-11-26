import { Settings as SettingsIcon } from "lucide-react";
import { StreakSettings } from "@/components/StreakSettings";
import { PageHeader } from "@/components/PageHeader";
import { streakService } from "@/lib/services/streak.service";

export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  // Get current streak to fetch threshold (auto-creates if doesn't exist)
  const streak = await streakService.getStreak(null);
  const initialThreshold = streak.dailyThreshold;

  return (
    <div className="space-y-10">
      <PageHeader
        title="Settings"
        subtitle="Configure your book tracker"
        icon={SettingsIcon}
      />

      {/* Reading Streak Settings */}
      <StreakSettings initialThreshold={initialThreshold} />
    </div>
  );
}
