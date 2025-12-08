import { Settings as SettingsIcon, Upload } from "lucide-react";
import { StreakSettings } from "@/components/StreakSettings";
import { DataWipeSettings } from "@/components/DataWipeSettings";
import { NavigationSettings } from "@/components/NavigationSettings";
import { PageHeader } from "@/components/PageHeader";
import { streakService } from "@/lib/services/streak.service";
import Link from "next/link";

export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  // Get current streak to fetch threshold and timezone (auto-creates if doesn't exist)
  const streak = await streakService.getStreak(null);
  const initialThreshold = streak.dailyThreshold;
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

      {/* Import Settings */}
      <div className="bg-[var(--card-bg)] border border-[var(--border-color)] rounded-md p-6">
        <div className="flex items-center gap-3 mb-4">
          <Upload className="w-6 h-6 text-[var(--accent)]" />
          <h3 className="text-xl font-serif font-bold text-[var(--heading-text)]">
            Import Reading History
          </h3>
        </div>

        <p className="text-sm text-[var(--subheading-text)] mb-4 font-medium">
          Import your reading history from Goodreads or TheStoryGraph CSV exports.
        </p>

        <Link
          href="/import"
          className="inline-flex items-center gap-2 px-6 py-3 bg-[var(--accent)] text-white rounded-md hover:bg-[var(--light-accent)] transition-colors font-semibold"
        >
          <Upload className="w-4 h-4" />
          Import Books
        </Link>
      </div>

      {/* Data Wipe Settings */}
      <DataWipeSettings />
    </div>
  );
}
