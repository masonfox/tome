import { fromZonedTime } from "date-fns-tz";

/**
 * Server-Only Date Helpers
 * 
 * These functions access the database and must only be used on the server side.
 * Import from '@/utils/dateHelpers.server' (not '@/utils/dateHelpers').
 * 
 * Follows ADR-006 "The Right Way™" pattern for timezone-aware date storage.
 */

// Cache timezone for the duration of the request to avoid repeated DB calls
let cachedTimezone: string | null = null;

/**
 * Get the current user's timezone from the streak record.
 * 
 * ⚠️ SERVER-ONLY: Accesses database
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
 * ⚠️ SERVER-ONLY: Accesses database to get user timezone
 * 
 * This is the canonical way to convert user-selected dates to database timestamps.
 * Follows ADR-006 "The Right Way™" pattern for date storage.
 * 
 * @param dateString - Date in YYYY-MM-DD format or ISO string (e.g., "2025-12-08" or "2025-12-08T00:00:00.000Z")
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
 * Get the current date as midnight in user's timezone, converted to UTC.
 * 
 * ⚠️ SERVER-ONLY: Accesses database to get user timezone
 * 
 * Used for default date values when creating sessions or progress logs.
 * Follows ADR-006 "The Right Way™" pattern.
 * 
 * @param userId - Optional user ID for timezone lookup
 * @returns UTC Date representing midnight today in user's timezone
 * 
 * @example
 * // Today is Dec 30, 2025 in EST
 * const today = await getCurrentDateInUserTimezone();
 * // Returns: 2025-12-30T05:00:00.000Z (midnight EST = 5 AM UTC)
 */
export async function getCurrentDateInUserTimezone(userId?: number | null): Promise<Date> {
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth() + 1;
  const day = today.getDate();
  const dateString = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  return parseLocalDateToUtc(dateString, userId);
}
