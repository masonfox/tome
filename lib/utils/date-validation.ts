/**
 * Date Validation Utilities
 * 
 * Simple validation for YYYY-MM-DD date strings.
 * No timezone conversions needed - dates stored as strings in database.
 * 
 * @example
 * ```typescript
 * if (!validateDateString("2025-01-08")) {
 *   throw new Error("Invalid date format");
 * }
 * ```
 */

/**
 * Validate date string format (YYYY-MM-DD)
 * 
 * @param dateStr - Date string to validate
 * @returns true if valid YYYY-MM-DD format, false otherwise
 * 
 * @example
 * ```typescript
 * validateDateString("2025-01-08") // true
 * validateDateString("2025-1-8")   // false (no padding)
 * validateDateString("01/08/2025") // false (wrong format)
 * validateDateString("invalid")    // false
 * ```
 */
export function validateDateString(dateStr: string): boolean {
  // Check format: YYYY-MM-DD
  const regex = /^\d{4}-\d{2}-\d{2}$/;
  if (!regex.test(dateStr)) {
    return false;
  }

  // Check if it's a valid date
  const date = new Date(dateStr + "T00:00:00");
  if (isNaN(date.getTime())) {
    return false;
  }

  // Additional check: ensure parsed date matches input
  // Prevents "2025-02-31" becoming "2025-03-03"
  const [year, month, day] = dateStr.split("-").map(Number);
  if (
    date.getFullYear() !== year ||
    date.getMonth() + 1 !== month ||
    date.getDate() !== day
  ) {
    return false;
  }

  return true;
}

/**
 * Get today's date as YYYY-MM-DD string
 * 
 * Uses local system date. For server-side use, ensure system timezone is correct.
 * 
 * @returns Today's date in YYYY-MM-DD format
 * 
 * @example
 * ```typescript
 * getTodayDateString() // "2025-01-09"
 * ```
 */
export function getTodayDateString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Check if a date string is in the future
 * 
 * @param dateStr - Date string in YYYY-MM-DD format
 * @returns true if date is after today, false otherwise
 * 
 * @example
 * ```typescript
 * // Today is 2025-01-09
 * isFutureDate("2025-01-10") // true
 * isFutureDate("2025-01-09") // false
 * isFutureDate("2025-01-08") // false
 * ```
 */
export function isFutureDate(dateStr: string): boolean {
  const today = getTodayDateString();
  return dateStr > today;
}

/**
 * Convert Date object to YYYY-MM-DD string
 * 
 * @param date - Date object to convert
 * @returns Date string in YYYY-MM-DD format
 * 
 * @example
 * ```typescript
 * const date = new Date("2025-01-09T15:30:00Z");
 * formatDateToString(date) // "2025-01-09"
 * ```
 */
export function formatDateToString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
