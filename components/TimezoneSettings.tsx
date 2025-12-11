"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Globe } from "lucide-react";

interface TimezoneSettingsProps {
  initialTimezone: string;
}

export function TimezoneSettings({ initialTimezone }: TimezoneSettingsProps) {
  const [timezone, setTimezone] = useState(initialTimezone);
  const [savingTimezone, setSavingTimezone] = useState(false);

  async function handleTimezoneChange(newTimezone: string) {
    setSavingTimezone(true);
    try {
      const res = await fetch("/api/streak/timezone", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ timezone: newTimezone }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setTimezone(newTimezone);
        toast.success("Timezone updated! Streak recalculated with new day boundaries.");
      } else {
        toast.error(data.error?.message || "Failed to update timezone");
      }
    } catch (error) {
      toast.error("Failed to update timezone");
    } finally {
      setSavingTimezone(false);
    }
  }

  return (
    <div className="bg-[var(--card-bg)] border border-[var(--border-color)] rounded-md p-6">
      <div className="flex items-center gap-3 mb-4">
        <Globe className="w-6 h-6 text-[var(--accent)]" />
        <h3 className="text-xl font-serif font-bold text-[var(--heading-text)]">
          Timezone
        </h3>
      </div>

      <p className="text-sm text-[var(--subheading-text)] mb-4 font-medium">
        Set your timezone to ensure streak tracking uses the correct day boundaries.
      </p>

      <div className="flex items-start gap-4">
        <div className="flex-1">
          <label
            htmlFor="timezone"
            className="block text-sm font-semibold text-[var(--foreground)]/70 mb-2"
          >
            Your timezone
          </label>
          <select
            id="timezone"
            value={timezone}
            onChange={(e) => handleTimezoneChange(e.target.value)}
            className="w-full px-4 py-2 bg-[var(--card-bg)] border border-[var(--border-color)] rounded-sm text-[var(--foreground)] font-medium focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent"
            disabled={savingTimezone}
          >
            <optgroup label="Common Timezones">
              <option value="America/New_York">Eastern Time (America/New_York)</option>
              <option value="America/Chicago">Central Time (America/Chicago)</option>
              <option value="America/Denver">Mountain Time (America/Denver)</option>
              <option value="America/Los_Angeles">Pacific Time (America/Los_Angeles)</option>
              <option value="America/Anchorage">Alaska Time (America/Anchorage)</option>
              <option value="Pacific/Honolulu">Hawaii Time (Pacific/Honolulu)</option>
            </optgroup>
            <optgroup label="Americas">
              <option value="America/Toronto">Toronto</option>
              <option value="America/Vancouver">Vancouver</option>
              <option value="America/Mexico_City">Mexico City</option>
              <option value="America/Sao_Paulo">São Paulo</option>
              <option value="America/Argentina/Buenos_Aires">Buenos Aires</option>
            </optgroup>
            <optgroup label="Europe">
              <option value="Europe/London">London</option>
              <option value="Europe/Paris">Paris</option>
              <option value="Europe/Berlin">Berlin</option>
              <option value="Europe/Madrid">Madrid</option>
              <option value="Europe/Rome">Rome</option>
              <option value="Europe/Amsterdam">Amsterdam</option>
              <option value="Europe/Stockholm">Stockholm</option>
              <option value="Europe/Moscow">Moscow</option>
            </optgroup>
            <optgroup label="Asia">
              <option value="Asia/Tokyo">Tokyo</option>
              <option value="Asia/Shanghai">Shanghai</option>
              <option value="Asia/Hong_Kong">Hong Kong</option>
              <option value="Asia/Singapore">Singapore</option>
              <option value="Asia/Seoul">Seoul</option>
              <option value="Asia/Dubai">Dubai</option>
              <option value="Asia/Kolkata">Mumbai/Kolkata</option>
              <option value="Asia/Bangkok">Bangkok</option>
            </optgroup>
            <optgroup label="Pacific">
              <option value="Australia/Sydney">Sydney</option>
              <option value="Australia/Melbourne">Melbourne</option>
              <option value="Australia/Perth">Perth</option>
              <option value="Pacific/Auckland">Auckland</option>
            </optgroup>
            <optgroup label="Africa">
              <option value="Africa/Cairo">Cairo</option>
              <option value="Africa/Johannesburg">Johannesburg</option>
              <option value="Africa/Lagos">Lagos</option>
            </optgroup>
          </select>
          <p className="text-xs text-[var(--subheading-text)] mt-2 font-medium">
            {savingTimezone ? "Updating and recalculating streak..." : `Current time: ${new Date().toLocaleString('en-US', { timeZone: timezone, timeStyle: 'short' })}`}
          </p>
        </div>
      </div>
    </div>
  );
}
