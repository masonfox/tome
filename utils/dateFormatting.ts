import { format } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";

/**
 * Formats an ISO date string for display, avoiding timezone conversion issues.
 * 
 * When dates are stored as ISO strings with midnight UTC (e.g., "2025-11-23T00:00:00.000Z"),
 * converting them directly with `new Date()` causes timezone shifts that can change the date
 * by a day for users in timezones behind UTC.
 * 
 * This function extracts the date portion and interprets it in the user's local timezone
 * at noon to ensure the date displays as intended.
 * 
 * @param isoString - ISO date string (e.g., "2025-11-23T00:00:00.000Z")
 * @param formatString - date-fns format string (defaults to "MMM d, yyyy")
 * @returns Formatted date string
 * 
 * @example
 * formatDateOnly("2025-11-23T00:00:00.000Z") // "Nov 23, 2025" (regardless of timezone)
 * formatDateOnly("2025-11-23T00:00:00.000Z", "yyyy-MM-dd") // "2025-11-23"
 */
export function formatDateOnly(isoString: string, formatString = "MMM d, yyyy"): string {
  // Extract just the date portion (YYYY-MM-DD)
  const dateOnly = isoString.split("T")[0];
  
  // Parse at noon local time to avoid any timezone edge cases
  // This ensures the date displays as the user intended when they selected it
  const date = new Date(dateOnly + "T12:00:00");
  
  return format(date, formatString);
}

/**
 * Returns today's date in YYYY-MM-DD format using the user's timezone.
 * 
 * Uses the browser's detected timezone via Intl API and date-fns-tz
 * to ensure the date is correct for the user's actual location.
 * 
 * @returns Today's date in YYYY-MM-DD format for use in date inputs
 * 
 * @example
 * getTodayLocalDate() // "2025-12-02" (based on user's actual timezone)
 */
export function getTodayLocalDate(): string {
  const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  return formatInTimeZone(new Date(), userTimezone, 'yyyy-MM-dd');
}
