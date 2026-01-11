import { format } from "date-fns";

/**
 * Date Helpers Utility Library (Client-Safe)
 * 
 * These functions can be used on both client and server.
 * For server-only functions (that access database), use '@/utils/dateHelpers.server'
 * 
 * ## When to Use Each Helper
 * 
 * - **getTodayLocalDate()**: Get current date for date input default values
 *   - Use case: `<input type="date" defaultValue={getTodayLocalDate()} />`
 * 
 * - **formatDateOnly()**: DEPRECATED - Use date-fns format/parse instead
 *   - Old way: `formatDateOnly(isoString, 'MMM d, yyyy')`
 *   - New way: `format(parse(dateStr, 'yyyy-MM-dd', new Date()), 'MMM d, yyyy')`
 * 
 * Follows ADR-006 and ADR-013 for date handling patterns.
 */

/**
 * @deprecated As of Jan 2026 - APIs now return YYYY-MM-DD strings directly, no need to parse ISO.
 * Use date-fns format() with parse() instead: `format(parse(dateStr, 'yyyy-MM-dd', new Date()), formatString)`
 * Will be removed in 3 months (April 2026).
 * 
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
 * Get today's date in YYYY-MM-DD format in the user's local timezone.
 * 
 * This is useful for setting default values in date inputs on the client.
 * Returns a string that can be used directly with HTML <input type="date">.
 * 
 * @returns Date string in YYYY-MM-DD format
 * 
 * @example
 * getTodayLocalDate() // "2025-12-30"
 * <input type="date" value={getTodayLocalDate()} />
 */
export function getTodayLocalDate(): string {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
