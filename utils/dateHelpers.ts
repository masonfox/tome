import { format, startOfDay } from "date-fns";
import { formatInTimeZone, toZonedTime, fromZonedTime } from "date-fns-tz";

/**
 * Date Helpers Utility Library
 * 
 * Consolidated date handling utilities following ADR-006 "The Right Way™" pattern:
 * - Store UTC timestamps in database
 * - Calculate in user's timezone
 * - Convert between user timezone and UTC for storage
 * 
 * Key principle: Dates represent calendar days in the user's local timezone,
 * stored as UTC timestamps representing midnight in that timezone.
 */

// Cache timezone for the duration of the request to avoid repeated DB calls
let cachedTimezone: string | null = null;

/**
 * Get the current user's timezone from the streak record.
 * 
 * This is the single source of truth for user timezone across the application.
 * Results are cached per request to avoid repeated database queries.
 * 
 * @param userId - Optional user ID (defaults to null for single-user mode)
 * @returns IANA timezone identifier (e.g., 'America/New_York', 'Asia/Tokyo')
 * 
 * @example
 * const timezone = await getCurrentUserTimezone();
 * // "America/New_York"
 */
export async function getCurrentUserTimezone(userId?: number | null): Promise<string> {
  // Return cached value if available
  if (cachedTimezone) {
    return cachedTimezone;
  }

  try {
    // Dynamic import to avoid circular dependencies
    const { streakRepository } = await import('@/lib/repositories');
    const streak = await streakRepository.getOrCreate(userId || null);
    cachedTimezone = streak.userTimezone || 'America/New_York';
    return cachedTimezone;
  } catch (error) {
    // Fallback to default timezone if streak lookup fails
    const { getLogger } = await import('@/lib/logger');
    getLogger().warn({ err: error }, 'Failed to get user timezone, using default');
    return 'America/New_York';
  }
}

/**
 * Clear the timezone cache (useful for tests or when timezone changes)
 */
export function clearTimezoneCache(): void {
  cachedTimezone = null;
}

/**
 * Parse a date string (YYYY-MM-DD) to midnight in user's timezone, converted to UTC.
 * 
 * This is the canonical way to convert user-selected dates to database timestamps.
 * Follows ADR-006 "The Right Way™" pattern for date storage.
 * 
 * @param dateString - Date in YYYY-MM-DD format (e.g., "2025-12-08")
 * @param userId - Optional user ID for timezone lookup
 * @returns UTC Date object representing midnight in user's timezone
 * 
 * @example
 * // User in EST selects "2025-12-08"
 * const utcDate = await parseLocalDateToUtc("2025-12-08");
 * // Returns: 2025-12-08T05:00:00.000Z (midnight EST = 5 AM UTC)
 * 
 * @example
 * // User in JST selects "2025-12-08"
 * const utcDate = await parseLocalDateToUtc("2025-12-08");
 * // Returns: 2025-12-07T15:00:00.000Z (midnight JST = 3 PM previous day UTC)
 */
export async function parseLocalDateToUtc(dateString: string, userId?: number | null): Promise<Date> {
  const userTimezone = await getCurrentUserTimezone(userId);
  
  // Extract just the date portion (YYYY-MM-DD) if it's a full ISO string
  let dateOnly = dateString;
  if (dateString.includes('T')) {
    dateOnly = dateString.split('T')[0];
  }
  
  // Create midnight in the user's timezone
  // fromZonedTime interprets a date AS IF it's in the given timezone
  // E.g., "treat 2024-01-01 00:00 as if it's in America/New_York, and give me the UTC equivalent"
  const [year, month, day] = dateOnly.split('-').map(Number);
  const localDate = new Date(year, month - 1, day, 0, 0, 0, 0);
  
  // Convert to UTC: treat this local date as being in the user's timezone
  return fromZonedTime(localDate, userTimezone);
}

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

/**
 * Format a UTC date in the user's timezone with a custom format string.
 * 
 * Useful for displaying database timestamps in the user's local time.
 * 
 * @param date - UTC Date object
 * @param timezone - IANA timezone identifier
 * @param formatString - date-fns format string
 * @returns Formatted date string in user's timezone
 * 
 * @example
 * const utcDate = new Date("2025-12-08T05:00:00.000Z");
 * formatUtcDateInUserTimezone(utcDate, "America/New_York", "MMM d, yyyy")
 * // "Dec 8, 2025" (midnight EST)
 */
export function formatUtcDateInUserTimezone(
  date: Date,
  timezone: string,
  formatString: string
): string {
  return formatInTimeZone(date, timezone, formatString);
}

/**
 * Get the current date/time as midnight in user's timezone, converted to UTC.
 * 
 * This is useful for default values when creating records that should use "today"
 * in the user's timezone.
 * 
 * @param userId - Optional user ID for timezone lookup
 * @returns UTC Date object representing midnight today in user's timezone
 * 
 * @example
 * // User in EST, current time is 2 PM EST on Dec 30
 * const todayUtc = await getCurrentDateInUserTimezone();
 * // Returns: 2025-12-30T05:00:00.000Z (midnight EST today)
 */
export async function getCurrentDateInUserTimezone(userId?: number | null): Promise<Date> {
  const userTimezone = await getCurrentUserTimezone(userId);
  
  // Get current date in user's timezone
  const nowInUserTz = toZonedTime(new Date(), userTimezone);
  
  // Get midnight of current day in user's timezone
  const todayMidnightInUserTz = startOfDay(nowInUserTz);
  
  // Convert to UTC for storage
  return fromZonedTime(todayMidnightInUserTz, userTimezone);
}
