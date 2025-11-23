import { Settings as SettingsIcon } from "lucide-react";

export default function SettingsPage() {
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

      <div className="bg-[var(--card-bg)] border border-[var(--border-color)] rounded-md p-12 flex flex-col items-center justify-center min-h-[400px]">
        <SettingsIcon className="w-16 h-16 text-[var(--foreground)]/20 mb-4" />
        <h2 className="text-2xl font-serif font-bold text-[var(--heading-text)] mb-2">
          Coming Soon
        </h2>
        <p className="text-[var(--foreground)]/60 text-center max-w-md font-medium">
          User preferences and configuration options will be available here in a future update.
        </p>
      </div>
    </div>
  );
}
