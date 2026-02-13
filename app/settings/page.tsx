import { Settings as SettingsIcon, Github, Bug, BookOpen } from "lucide-react";
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

      {/* Project Links */}
      <div className="flex items-center justify-center gap-4 text-sm text-[var(--subheading-text)] pb-4">
        <a
          href="https://github.com/masonfox/tome"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 hover:text-[var(--foreground)] transition-colors"
        >
          <Github className="w-3.5 h-3.5" />
          <span>GitHub</span>
        </a>
        <span aria-hidden="true">·</span>
        <a
          href="https://github.com/masonfox/tome/issues"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 hover:text-[var(--foreground)] transition-colors"
        >
          <Bug className="w-3.5 h-3.5" />
          <span>Issues</span>
        </a>
        <span aria-hidden="true">·</span>
        <a
          href="https://github.com/masonfox/tome/wiki"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 hover:text-[var(--foreground)] transition-colors"
        >
          <BookOpen className="w-3.5 h-3.5" />
          <span>Wiki</span>
        </a>
      </div>
    </div>
  );
}
