import { Settings as SettingsIcon, Plug, ArrowRight, Github, Bug, BookOpen } from "lucide-react";
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
