import { test, expect, describe, beforeEach, afterEach, vi } from 'vitest';
import { formatDateOnly, getTodayLocalDate } from '@/utils/dateHelpers';

describe("formatDateOnly", () => {
  test("should format ISO date string correctly regardless of timezone", () => {
    // Date stored as midnight UTC should display as Nov 23, 2025
    const isoString = "2025-11-23T00:00:00.000Z";
    const result = formatDateOnly(isoString);
    expect(result).toBe("Nov 23, 2025");
  });

  test("should format date with custom format string", () => {
    const isoString = "2025-11-23T00:00:00.000Z";
    const result = formatDateOnly(isoString, "yyyy-MM-dd");
    expect(result).toBe("2025-11-23");
  });

  test("should handle dates at different times of day consistently", () => {
    // These should all display as Nov 23, 2025
    const midnight = "2025-11-23T00:00:00.000Z";
    const noon = "2025-11-23T12:00:00.000Z";
    const evening = "2025-11-23T23:59:59.000Z";

    expect(formatDateOnly(midnight)).toBe("Nov 23, 2025");
    expect(formatDateOnly(noon)).toBe("Nov 23, 2025");
    expect(formatDateOnly(evening)).toBe("Nov 23, 2025");
  });

  test("should extract date part correctly from ISO string", () => {
    const isoString = "2024-01-15T08:30:45.123Z";
    const result = formatDateOnly(isoString);
    expect(result).toBe("Jan 15, 2024");
  });

  test("should work with different date formats", () => {
    const isoString = "2025-11-23T00:00:00.000Z";
    
    expect(formatDateOnly(isoString, "MMM d, yyyy")).toBe("Nov 23, 2025");
    expect(formatDateOnly(isoString, "MMMM d, yyyy")).toBe("November 23, 2025");
    expect(formatDateOnly(isoString, "MM/dd/yyyy")).toBe("11/23/2025");
    expect(formatDateOnly(isoString, "yyyy-MM-dd")).toBe("2025-11-23");
  });
});

describe("getTodayLocalDate", () => {
  let originalDate: typeof Date;

  beforeEach(() => {
    originalDate = global.Date;
  });

  afterEach(() => {
    global.Date = originalDate;
  });

  test("returns date in YYYY-MM-DD format", () => {
    // Mock Date to return a known date
    const mockDate = new Date("2025-01-10T15:30:00.000Z");
    vi.setSystemTime(mockDate);

    const result = getTodayLocalDate();
    
    // Should be YYYY-MM-DD format
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  test("uses user's local timezone, not UTC", () => {
    // Mock: 2025-01-09 23:00 EST (2025-01-10 04:00 UTC)
    // In EST, it's still Jan 9, not Jan 10
    const mockDate = new Date("2025-01-10T04:00:00.000Z");
    vi.setSystemTime(mockDate);

    const result = getTodayLocalDate();
    
    // Result depends on system timezone
    // In UTC timezone (test environment), should be "2025-01-10"
    expect(result).toBe("2025-01-10");
    
    // Verify format is correct
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  test("zero-pads single-digit months and days", () => {
    // Mock: January 5, 2025
    const mockDate = new Date("2025-01-05T12:00:00.000Z");
    vi.setSystemTime(mockDate);

    const result = getTodayLocalDate();
    
    // Should be "2025-01-05", not "2025-1-5"
    expect(result).toBe("2025-01-05");
  });

  test("handles end of month correctly", () => {
    // Mock: January 31, 2025
    const mockDate = new Date("2025-01-31T12:00:00.000Z");
    vi.setSystemTime(mockDate);

    const result = getTodayLocalDate();
    
    expect(result).toBe("2025-01-31");
  });

  test("handles end of year correctly", () => {
    // Mock: December 31, 2024
    const mockDate = new Date("2024-12-31T12:00:00.000Z");
    vi.setSystemTime(mockDate);

    const result = getTodayLocalDate();
    
    expect(result).toBe("2024-12-31");
  });

  test("handles start of year correctly", () => {
    // Mock: January 1, 2025
    const mockDate = new Date("2025-01-01T00:30:00.000Z");
    vi.setSystemTime(mockDate);

    const result = getTodayLocalDate();
    
    expect(result).toBe("2025-01-01");
  });

  test("consistent across midnight boundary", () => {
    // Mock: Just before midnight UTC
    const beforeMidnight = new Date("2025-01-09T23:59:59.999Z");
    vi.setSystemTime(beforeMidnight);
    const resultBefore = getTodayLocalDate();

    // Mock: Just after midnight UTC
    const afterMidnight = new Date("2025-01-10T00:00:00.001Z");
    vi.setSystemTime(afterMidnight);
    const resultAfter = getTodayLocalDate();

    // Should be consecutive dates
    expect(resultBefore).toBe("2025-01-09");
    expect(resultAfter).toBe("2025-01-10");
  });

  test("returns same date for entire local day", () => {
    // In UTC timezone, these should all return "2025-01-10"
    const timestamps = [
      new Date("2025-01-10T00:00:00.000Z"), // Midnight
      new Date("2025-01-10T06:00:00.000Z"), // Morning
      new Date("2025-01-10T12:00:00.000Z"), // Noon
      new Date("2025-01-10T18:00:00.000Z"), // Evening
      new Date("2025-01-10T23:59:59.999Z"), // Just before midnight
    ];

    const results = timestamps.map(ts => {
      vi.setSystemTime(ts);
      return getTodayLocalDate();
    });

    // All should be the same date
    expect(results).toEqual([
      "2025-01-10",
      "2025-01-10",
      "2025-01-10",
      "2025-01-10",
      "2025-01-10",
    ]);
  });

  test("produces format compatible with HTML date input", () => {
    const mockDate = new Date("2025-01-10T12:00:00.000Z");
    vi.setSystemTime(mockDate);

    const result = getTodayLocalDate();
    
    // HTML <input type="date"> requires YYYY-MM-DD format
    // Verify by parsing it back
    const parsed = new Date(result + "T00:00:00");
    expect(isNaN(parsed.getTime())).toBe(false); // Should be valid date
    expect(result).toBe("2025-01-10");
  });
});

describe("Date Helper Integration - Critical Path", () => {
  test("getTodayLocalDate produces format that would pass API validation", () => {
    const mockDate = new Date("2025-01-10T15:30:00.000Z");
    vi.setSystemTime(mockDate);

    const today = getTodayLocalDate();
    
    // Should match YYYY-MM-DD regex from API validation
    const validationRegex = /^\d{4}-\d{2}-\d{2}$/;
    expect(today).toMatch(validationRegex);
    
    // Should be a valid calendar date
    const [year, month, day] = today.split("-").map(Number);
    const dateObj = new Date(today + "T00:00:00");
    expect(dateObj.getFullYear()).toBe(year);
    expect(dateObj.getMonth() + 1).toBe(month);
    expect(dateObj.getDate()).toBe(day);
  });

  test("date produced by getTodayLocalDate can be submitted to API without conversion", () => {
    const mockDate = new Date("2025-01-10T12:00:00.000Z");
    vi.setSystemTime(mockDate);

    const dateForAPI = getTodayLocalDate();
    
    // This is the date string that would be sent in: { progressDate: dateForAPI }
    // It should be the exact string stored in database (no conversion needed)
    expect(dateForAPI).toBe("2025-01-10");
    expect(typeof dateForAPI).toBe("string");
    expect(dateForAPI.includes("T")).toBe(false); // Not an ISO timestamp
  });
});
