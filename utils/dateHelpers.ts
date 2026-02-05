import { format, parse } from "date-fns";

/**
 * Date Helpers Utility Library (Client-Safe)
 * 
 * These functions can be used on both client and server.
 * For server-only functions (that access database), use '@/utils/dateHelpers.server'
 * 
 * ## When to Use Each Helper
 * 
 * - **formatDate()**: Format YYYY-MM-DD strings for display
 *   - Use case: `formatDate(session.startedDate)` → "Jun 9, 2024"
 *   - Custom format: `formatDate(date, "MMM d")` → "Jun 9"
 * 
 * - **formatDayOfWeek()**: Get day of week for YYYY-MM-DD strings
 *   - Use case: `formatDayOfWeek(session.startedDate)` → "Mon"
 * 
 * - **getTodayLocalDate()**: Get current date for date input default values
 *   - Use case: `<input type="date" defaultValue={getTodayLocalDate()} />`
 * 
 * Follows ADR-006 and ADR-013 for date handling patterns.
 */

/**
 * Format a YYYY-MM-DD date string for display.
 * 
 * Takes a date string in YYYY-MM-DD format (as returned by the API)
 * and formats it for human-readable display.
 * 
 * @param dateString - Date in YYYY-MM-DD format (e.g., "2024-06-09")
 * @param formatString - date-fns format string (defaults to "MMM d, yyyy")
 * @returns Formatted date string (e.g., "Jun 9, 2024")
 * 
 * @example
 * formatDate("2024-06-09") // "Jun 9, 2024"
 * formatDate("2024-06-09", "MMM d") // "Jun 9"
 * formatDate("2024-06-09", "MMMM d, yyyy") // "June 9, 2024"
 */
export function formatDate(dateString: string, formatString = "MMM d, yyyy"): string {
  return format(parse(dateString, 'yyyy-MM-dd', new Date()), formatString);
}

/**
 * Get the day of week for a YYYY-MM-DD date string.
 * 
 * @param dateString - Date in YYYY-MM-DD format (e.g., "2024-06-09")
 * @returns Day of week abbreviation (e.g., "Mon", "Tue", "Wed")
 * 
 * @example
 * formatDayOfWeek("2024-06-09") // "Sun"
 * formatDayOfWeek("2024-12-25") // "Wed"
 */
export function formatDayOfWeek(dateString: string): string {
  return format(parse(dateString, 'yyyy-MM-dd', new Date()), 'EEE');
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
