import { Settings as SettingsIcon } from "lucide-react";
import { ThemeSettings } from "@/components/Settings/ThemeSettings";
import { TimezoneSettings } from "@/components/Settings/TimezoneSettings";
import { PageHeader } from "@/components/Layout/PageHeader";
import { VersionSettings } from "@/components/Settings/VersionSettings";
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

      {/* Theme Settings */}
      <ThemeSettings />

      {/* Timezone Settings */}
      <TimezoneSettings initialTimezone={initialTimezone} />

      {/* Version Information */}
      <VersionSettings />
    </div>
  );
}
