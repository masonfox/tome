import { Settings as SettingsIcon } from "lucide-react";
import { StreakSettings } from "@/components/StreakSettings";
import { streakService } from "@/lib/services/streak.service";

export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  // Get current streak to fetch threshold (auto-creates if doesn't exist)
  const streak = await streakService.getStreak(null);
  const initialThreshold = streak.dailyThreshold;

  return (
    <div className="space-y-10">
      <div className="border-b border-[var(--border-color)] pb-6">
        <h1 className="text-5xl font-serif font-bold text-[var(--heading-text)] flex items-center gap-3">
          <SettingsIcon className="w-8 h-8" />
          Settings
        </h1>
        <p className="text-[var(--subheading-text)] mt-2 font-medium">
          Configure your book tracker
        </p>
      </div>

      {/* Reading Streak Settings */}
      <StreakSettings initialThreshold={initialThreshold} />
    </div>
  );
}
