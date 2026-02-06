import { Settings as SettingsIcon, Plug, ArrowRight } from "lucide-react";
import Link from "next/link";
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

      {/* Provider Settings Link */}
      <Link 
        href="/settings/providers"
        className="block bg-[var(--card-bg)] border border-[var(--border-color)] rounded-md p-6 hover:border-[var(--accent)] transition-colors group"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Plug className="w-6 h-6 text-[var(--accent)]" />
            <div>
              <h3 className="text-xl font-serif font-bold text-[var(--heading-text)] group-hover:text-[var(--accent)] transition-colors">
                Provider Settings
              </h3>
              <p className="text-sm text-[var(--subheading-text)] mt-1 font-medium">
                Configure metadata providers and API credentials
              </p>
            </div>
          </div>
          <ArrowRight className="w-5 h-5 text-[var(--foreground)]/40 group-hover:text-[var(--accent)] group-hover:translate-x-1 transition-all" />
        </div>
      </Link>

      {/* Theme Settings */}
      <ThemeSettings />

      {/* Timezone Settings */}
      <TimezoneSettings initialTimezone={initialTimezone} />

      {/* Version Information */}
      <VersionSettings />
    </div>
  );
}
