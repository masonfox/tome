/**
 * Flexible date parser for import data
 * Handles multiple date formats from Goodreads and TheStoryGraph
 */

/**
 * Common date formats from Goodreads and TheStoryGraph:
 * - "2024/01/15" (YYYY/MM/DD)
 * - "2024-01-15" (YYYY-MM-DD) ISO 8601
 * - "01/15/2024" (MM/DD/YYYY)
 * - "15/01/2024" (DD/MM/YYYY)
 * - "Jan 15, 2024" (Month DD, YYYY)
 * - "15 Jan 2024" (DD Month YYYY)
 * - "January 15, 2024" (Full month name)
 * - "2024" (Year only)
 */

const MONTH_NAMES: Record<string, number> = {
  jan: 0,
  january: 0,
  feb: 1,
  february: 1,
  mar: 2,
  march: 2,
  apr: 3,
  april: 3,
  may: 4,
  jun: 5,
  june: 5,
  jul: 6,
  july: 6,
  aug: 7,
  august: 7,
  sep: 8,
  sept: 8,
  september: 8,
  oct: 9,
  october: 9,
  nov: 10,
  november: 10,
  dec: 11,
  december: 11,
};

/**
 * Parse a date string into a Date object
 * Returns null if the date cannot be parsed
 */
export function parseDate(dateStr: string | null | undefined): Date | null {
  if (!dateStr) return null;

  const trimmed = dateStr.trim();
  if (!trimmed) return null;

  // Try built-in Date parser first (handles ISO 8601 and many formats)
  const nativeDate = new Date(trimmed);
  if (!isNaN(nativeDate.getTime())) {
    return nativeDate;
  }

  // Try custom parsers
  const parsers = [
    parseISODate,
    parseSlashDate,
    parseDashDate,
    parseMonthNameDate,
    parseYearOnly,
  ];

  for (const parser of parsers) {
    const result = parser(trimmed);
    if (result) return result;
  }

  return null;
}

/**
 * Parse ISO 8601 date format: YYYY-MM-DD
 */
function parseISODate(dateStr: string): Date | null {
  const match = dateStr.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (!match) return null;

  const year = parseInt(match[1], 10);
  const month = parseInt(match[2], 10) - 1; // 0-based
  const day = parseInt(match[3], 10);

  if (isValidDate(year, month, day)) {
    return new Date(year, month, day);
  }

  return null;
}

/**
 * Parse slash-separated dates: YYYY/MM/DD, MM/DD/YYYY, DD/MM/YYYY
 */
function parseSlashDate(dateStr: string): Date | null {
  const match = dateStr.match(/^(\d{1,4})\/(\d{1,2})\/(\d{1,4})$/);
  if (!match) return null;

  const part1 = parseInt(match[1], 10);
  const part2 = parseInt(match[2], 10);
  const part3 = parseInt(match[3], 10);

  // Try YYYY/MM/DD
  if (part1 > 31) {
    const year = part1;
    const month = part2 - 1;
    const day = part3;
    if (isValidDate(year, month, day)) {
      return new Date(year, month, day);
    }
  }

  // Try DD/MM/YYYY (day first, common in EU)
  if (part3 > 31) {
    const day = part1;
    const month = part2 - 1;
    const year = part3;
    if (isValidDate(year, month, day)) {
      return new Date(year, month, day);
    }
  }

  // Try MM/DD/YYYY (month first, common in US)
  if (part3 > 31) {
    const month = part1 - 1;
    const day = part2;
    const year = part3;
    if (isValidDate(year, month, day)) {
      return new Date(year, month, day);
    }
  }

  return null;
}

/**
 * Parse dash-separated dates: DD-MM-YYYY, MM-DD-YYYY
 */
function parseDashDate(dateStr: string): Date | null {
  const match = dateStr.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (!match) return null;

  const part1 = parseInt(match[1], 10);
  const part2 = parseInt(match[2], 10);
  const year = parseInt(match[3], 10);

  // Try DD-MM-YYYY
  if (part1 <= 31 && part2 <= 12) {
    const day = part1;
    const month = part2 - 1;
    if (isValidDate(year, month, day)) {
      return new Date(year, month, day);
    }
  }

  // Try MM-DD-YYYY
  if (part1 <= 12 && part2 <= 31) {
    const month = part1 - 1;
    const day = part2;
    if (isValidDate(year, month, day)) {
      return new Date(year, month, day);
    }
  }

  return null;
}

/**
 * Parse dates with month names: "Jan 15, 2024", "15 Jan 2024", "January 15, 2024"
 */
function parseMonthNameDate(dateStr: string): Date | null {
  // Match patterns like "Jan 15, 2024" or "January 15, 2024"
  const match1 = dateStr.match(
    /^([a-z]+)\s+(\d{1,2}),?\s+(\d{4})$/i
  );
  if (match1) {
    const monthName = match1[1].toLowerCase();
    const day = parseInt(match1[2], 10);
    const year = parseInt(match1[3], 10);
    const month = MONTH_NAMES[monthName];

    if (month !== undefined && isValidDate(year, month, day)) {
      return new Date(year, month, day);
    }
  }

  // Match patterns like "15 Jan 2024" or "15 January 2024"
  const match2 = dateStr.match(
    /^(\d{1,2})\s+([a-z]+)\s+(\d{4})$/i
  );
  if (match2) {
    const day = parseInt(match2[1], 10);
    const monthName = match2[2].toLowerCase();
    const year = parseInt(match2[3], 10);
    const month = MONTH_NAMES[monthName];

    if (month !== undefined && isValidDate(year, month, day)) {
      return new Date(year, month, day);
    }
  }

  return null;
}

/**
 * Parse year-only dates: "2024"
 */
function parseYearOnly(dateStr: string): Date | null {
  const match = dateStr.match(/^(\d{4})$/);
  if (!match) return null;

  const year = parseInt(match[1], 10);
  if (year >= 1000 && year <= 9999) {
    // Return January 1st of that year
    return new Date(year, 0, 1);
  }

  return null;
}

/**
 * Validate if a date is valid
 */
function isValidDate(year: number, month: number, day: number): boolean {
  if (year < 1000 || year > 9999) return false;
  if (month < 0 || month > 11) return false;
  if (day < 1 || day > 31) return false;

  // Check if the day is valid for the given month
  const date = new Date(year, month, day);
  return (
    date.getFullYear() === year &&
    date.getMonth() === month &&
    date.getDate() === day
  );
}

/**
 * Parse multiple date formats and return the first valid date
 * Useful when a field might contain different formats
 */
export function parseFlexibleDate(
  ...dateStrs: (string | null | undefined)[]
): Date | null {
  for (const dateStr of dateStrs) {
    const date = parseDate(dateStr);
    if (date) return date;
  }
  return null;
}

/**
 * Convert a date to ISO 8601 format (YYYY-MM-DD)
 */
export function toISODateString(date: Date | null | undefined): string | null {
  if (!date || isNaN(date.getTime())) return null;

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

/**
 * Parse and convert a date string to ISO 8601 format
 */
export function normalizeDate(dateStr: string | null | undefined): string | null {
  const date = parseDate(dateStr);
  return toISODateString(date);
}

/**
 * Check if a date string is valid
 */
export function isValidDateString(dateStr: string | null | undefined): boolean {
  return parseDate(dateStr) !== null;
}

/**
 * Parse a date range string (e.g., "2024/01/17-2024/01/19")
 * Returns { startDate, endDate } or null if parsing fails
 * 
 * Formats supported:
 * - "YYYY/MM/DD-YYYY/MM/DD"
 * - "YYYY-MM-DD to YYYY-MM-DD"
 * - "MM/DD/YYYY - MM/DD/YYYY"
 */
export function parseDateRange(
  dateRangeStr: string | null | undefined
): { startDate: Date; endDate: Date } | null {
  if (!dateRangeStr) return null;

  const trimmed = dateRangeStr.trim();
  if (!trimmed) return null;

  // Try different separators
  const separators = ['-', ' to ', ' - ', '–', '—'];
  
  for (const separator of separators) {
    const parts = trimmed.split(separator);
    
    if (parts.length === 2) {
      const startDate = parseDate(parts[0].trim());
      const endDate = parseDate(parts[1].trim());
      
      if (startDate && endDate) {
        // Validate that start is before or equal to end
        if (startDate.getTime() <= endDate.getTime()) {
          return { startDate, endDate };
        }
      }
    }
  }

  return null;
}
