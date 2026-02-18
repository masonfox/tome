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
  
  // Validate date format (YYYY-MM-DD)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateOnly)) {
    throw new Error(`Invalid date format: ${dateString}. Expected YYYY-MM-DD format.`);
  }
  
  // Parse date parts
  const [year, month, day] = dateOnly.split('-').map(Number);
  
  // Validate date parts
  if (isNaN(year) || isNaN(month) || isNaN(day)) {
    throw new Error(`Invalid date format: ${dateString}. Date parts must be numeric.`);
  }
  if (month < 1 || month > 12) {
    throw new Error(`Invalid date format: ${dateString}. Month must be between 1 and 12.`);
  }
  if (day < 1 || day > 31) {
    throw new Error(`Invalid date format: ${dateString}. Day must be between 1 and 31.`);
  }
  
  // Create midnight in the user's timezone
  // fromZonedTime interprets a date AS IF it's in the given timezone
  // E.g., "treat 2024-01-01 00:00 as if it's in America/New_York, and give me the UTC equivalent"
  const localDate = new Date(year, month - 1, day, 0, 0, 0, 0);
  
  // Validate that we got a valid date (e.g., not Feb 31)
  if (isNaN(localDate.getTime())) {
    throw new Error(`Invalid date: ${dateString}. Date does not exist in calendar.`);
  }
  
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
  const userTimezone = await getCurrentUserTimezone(userId);
  
  // Get the current date/time in the user's timezone
  const { formatInTimeZone } = await import('date-fns-tz');
  const now = new Date();
  const dateString = formatInTimeZone(now, userTimezone, 'yyyy-MM-dd');
  
  // Parse this date back to midnight in user's timezone, converted to UTC
  return parseLocalDateToUtc(dateString, userId);
}

/**
 * Convert a Date object to YYYY-MM-DD string format (UTC).
 * 
 * This is the canonical way to convert Date objects to database date strings
 * for session dates (started_date, completed_date) and progress dates (progress_date).
 * Uses UTC to ensure consistency across timezones.
 * 
 * **When to use:**
 * - Converting Date objects for database queries (date range filters, comparisons)
 * - Working with dates already in UTC
 * - Comparing calendar days at UTC midnight
 * 
 * **When NOT to use:**
 * For timezone-aware conversions (e.g., "today" in user's timezone), use
 * `formatInTimeZone(date, timezone, 'yyyy-MM-dd')` from date-fns-tz instead.
 * 
 * @param date - Date object to convert
 * @returns Date string in YYYY-MM-DD format (UTC)
 * 
 * @example
 * // Database query
 * const dateStr = toDateString(new Date('2025-01-15T10:30:00Z')); // "2025-01-15"
 * await progressRepository.findAfterDate(dateStr);
 * 
 * @example
 * // For timezone-aware conversion, use formatInTimeZone instead:
 * import { formatInTimeZone } from 'date-fns-tz';
 * const todayInUserTz = formatInTimeZone(new Date(), userTimezone, 'yyyy-MM-dd');
 * 
 * @see formatInTimeZone from date-fns-tz for timezone-aware conversions
 */
export function toDateString(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Parse various publication date string formats into Date objects.
 * 
 * Handles multiple formats from external metadata providers (OpenLibrary, Hardcover):
 * - ISO: "2022-02-15" → Feb 15, 2022 00:00:00 UTC
 * - Full text: "May 16, 2019" → May 16, 2019 00:00:00 UTC
 * - Month/Year: "October 2007" → Oct 1, 2007 00:00:00 UTC (defaults to 1st of month)
 * - Year only: "1996" → Jan 1, 1996 00:00:00 UTC (defaults to Jan 1st)
 * - Partial ISO: "1967-07" → Jul 1, 1967 00:00:00 UTC (defaults to 1st of month)
 * 
 * Skips unparseable formats:
 * - Date ranges: "1927-1928"
 * - Placeholders: "19xx", "196x", "[ca. 1960]"
 * 
 * @param dateStr - Date string in various formats (or undefined)
 * @returns Parsed Date object in UTC, or undefined if unparseable or invalid
 * 
 * @example
 * parsePublishDate("2022-02-15")        // Date(2022-02-15T00:00:00.000Z)
 * parsePublishDate("May 16, 2019")      // Date(2019-05-16T00:00:00.000Z)
 * parsePublishDate("October 2007")      // Date(2007-10-01T00:00:00.000Z)
 * parsePublishDate("1996")              // Date(1996-01-01T00:00:00.000Z)
 * parsePublishDate("1967-07")           // Date(1967-07-01T00:00:00.000Z)
 * parsePublishDate("19xx")              // undefined (placeholder)
 * parsePublishDate("1927-1928")         // undefined (range)
 * parsePublishDate(undefined)           // undefined
 */
export function parsePublishDate(dateStr: string | undefined): Date | undefined {
  if (!dateStr || typeof dateStr !== 'string') {
    return undefined;
  }

  const trimmed = dateStr.trim();
  if (!trimmed) {
    return undefined;
  }

  // Skip placeholders and ranges
  if (
    trimmed.includes('x') ||           // "19xx", "196x"
    trimmed.includes('[') ||           // "[ca. 1960]"
    /^\d{4}-\d{4}$/.test(trimmed)      // "1927-1928" (range)
  ) {
    return undefined;
  }

  // Try ISO format: "2022-02-15" or "1967-07"
  const isoMatch = trimmed.match(/^(\d{4})-(\d{2})(?:-(\d{2}))?$/);
  if (isoMatch) {
    const year = parseInt(isoMatch[1], 10);
    const month = parseInt(isoMatch[2], 10);
    const day = isoMatch[3] ? parseInt(isoMatch[3], 10) : 1; // Default to 1st if no day
    
    // Validate ranges
    if (month < 1 || month > 12 || day < 1 || day > 31) {
      return undefined;
    }
    
    const date = new Date(Date.UTC(year, month - 1, day));
    return isNaN(date.getTime()) ? undefined : date;
  }

  // Try year only: "1996", "2015"
  const yearMatch = trimmed.match(/^(\d{4})$/);
  if (yearMatch) {
    const year = parseInt(yearMatch[1], 10);
    if (year < 1000 || year > 9999) {
      return undefined;
    }
    return new Date(Date.UTC(year, 0, 1)); // January 1st
  }

  // Try full text date: "May 16, 2019", "June 30, 1994", "December 2001", "2007 October 1"
  const months: Record<string, number> = {
    january: 0, february: 1, march: 2, april: 3,
    may: 4, june: 5, july: 6, august: 7,
    september: 8, october: 9, november: 10, december: 11,
    jan: 0, feb: 1, mar: 2, apr: 3, jun: 5, jul: 6,
    aug: 7, sep: 8, oct: 9, nov: 10, dec: 11
  };

  // Pattern 1: "Year Month Day" (e.g., "2007 October 1")
  const yearFirstMatch = trimmed.match(/^(\d{4})\s+([a-z]+)(?:\s+(\d{1,2}))?$/i);
  if (yearFirstMatch) {
    const year = parseInt(yearFirstMatch[1], 10);
    const monthStr = yearFirstMatch[2].toLowerCase();
    const day = yearFirstMatch[3] ? parseInt(yearFirstMatch[3], 10) : 1;
    
    const monthIndex = months[monthStr];
    if (monthIndex === undefined) {
      return undefined; // Unknown month name
    }
    
    // Validate day range
    if (day < 1 || day > 31) {
      return undefined;
    }
    
    const date = new Date(Date.UTC(year, monthIndex, day));
    return isNaN(date.getTime()) ? undefined : date;
  }

  // Pattern 2: "Month Day, Year" or "Month Year" or "Day Month Year"
  const textDateMatch = trimmed.match(
    /^(?:(\d{1,2})\s+)?([a-z]+)(?:\s+(\d{1,2}),?)?\s+(\d{4})$/i
  );
  
  if (textDateMatch) {
    const dayBefore = textDateMatch[1] ? parseInt(textDateMatch[1], 10) : null;
    const monthStr = textDateMatch[2].toLowerCase();
    const dayAfter = textDateMatch[3] ? parseInt(textDateMatch[3], 10) : null;
    const year = parseInt(textDateMatch[4], 10);
    
    const monthIndex = months[monthStr];
    if (monthIndex === undefined) {
      return undefined; // Unknown month name
    }
    
    // Use day from either position, or default to 1st
    const day = dayAfter || dayBefore || 1;
    
    // Validate day range
    if (day < 1 || day > 31) {
      return undefined;
    }
    
    const date = new Date(Date.UTC(year, monthIndex, day));
    return isNaN(date.getTime()) ? undefined : date;
  }

  // Unable to parse
  return undefined;
}
